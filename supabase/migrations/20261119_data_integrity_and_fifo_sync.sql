-- ============================================================
-- Che Bong Inventory Management - Data Integrity & FIFO Sync Migration
-- Date: 2026-11-19
-- Idempotent migration (safe to re-run in Supabase SQL Editor)
-- ============================================================

-- 1. Reconcile schema drift & column types
-- ------------------------------------------------------------

-- Allow decimal low_stock_threshold (e.g. 1.5 kg) while keeping >= 0 check
alter table public.ingredients
  drop constraint if exists ingredients_low_stock_threshold_check;

alter table public.ingredients
  alter column low_stock_threshold type numeric(12, 2)
  using low_stock_threshold::numeric(12, 2);

alter table public.ingredients
  add constraint ingredients_low_stock_threshold_check
  check (low_stock_threshold >= 0);

-- Ensure inventory_batches columns and constraints match application expectations
alter table public.inventory_batches
  add column if not exists received_date timestamptz not null default timezone('utc'::text, now());

alter table public.inventory_batches
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.inventory_batches
  drop constraint if exists inventory_batches_status_check;

update public.inventory_batches
set status = 'DEPLETED'
where status = 'EXHAUSTED';

update public.inventory_batches
set status = 'EXPIRED'
where status = 'SPOILED';

alter table public.inventory_batches
  add constraint inventory_batches_status_check
  check (status in ('ACTIVE', 'DEPLETED', 'EXPIRED', 'DISCARDED'));

-- Ensure inventory_transactions has audit transition columns
alter table public.inventory_transactions
  add column if not exists previous_stock numeric(12, 2);

alter table public.inventory_transactions
  add column if not exists new_stock numeric(12, 2);

alter table public.inventory_transactions
  add column if not exists reason text;

alter table public.inventory_transactions
  add column if not exists reference_id text;

-- Ensure clover_items.clover_id supports ON CONFLICT (clover_id)
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'clover_items'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%(clover_id)%'
  ) then
    alter table public.clover_items
      add constraint clover_items_clover_id_key unique (clover_id);
  end if;
end $$;

-- Helpful indexes for daily cycle count, FIFO ordering, and EOD duplicate checks
create index if not exists idx_tx_type_created
  on public.inventory_transactions(transaction_type, created_at desc);

create index if not exists idx_tx_reference_id
  on public.inventory_transactions(reference_id)
  where reference_id is not null;

create index if not exists idx_batches_active_fifo
  on public.inventory_batches(ingredient_id, expiration_date asc nulls last, created_at asc)
  where status = 'ACTIVE' and quantity_remaining > 0;

-- 2. Canonical BEFORE INSERT trigger with Automatic FIFO Batch Sync
-- ------------------------------------------------------------

-- Drop both legacy and current trigger names to prevent duplicate execution
drop trigger if exists trg_inventory_transaction on public.inventory_transactions;
drop trigger if exists trg_handle_inventory_transaction on public.inventory_transactions;

create or replace function public.handle_inventory_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx_type text;
  v_current numeric;
  v_new numeric;
  v_deduct numeric;
  v_remaining numeric;
  v_take numeric;
  v_spoiled_days integer;
  v_cost numeric;
  v_batch_sum numeric;
  v_batch_diff numeric;
  v_batch record;
begin
  v_tx_type := NEW.transaction_type::text;

  select
    coalesce(current_stock, 0),
    greatest(1, coalesce(spoiled_time_limit_days, 7)),
    coalesce(cost_per_unit, 0)
  into v_current, v_spoiled_days, v_cost
  from public.ingredients
  where id = NEW.ingredient_id
  for update;

  if not found then
    raise exception 'Ingredient % does not exist', NEW.ingredient_id;
  end if;

  NEW.previous_stock := v_current;

  if v_tx_type = 'RESTOCK' then
    NEW.quantity_change := abs(coalesce(NEW.quantity_change, 0));
    v_new := v_current + NEW.quantity_change;

  elsif v_tx_type = 'WASTE' then
    v_deduct := abs(coalesce(NEW.quantity_change, 0));
    NEW.quantity_change := v_deduct;
    v_new := greatest(0, v_current - v_deduct);

    if NEW.batch_id is not null then
      select id, quantity_remaining
      into v_batch
      from public.inventory_batches
      where id = NEW.batch_id
      for update;

      if found then
        update public.inventory_batches
        set quantity_remaining = greatest(0, quantity_remaining - v_deduct),
            status = case
              when quantity_remaining - v_deduct <= 0 then 'DISCARDED'
              else 'ACTIVE'
            end,
            updated_at = timezone('utc', now())
        where id = v_batch.id;
      end if;
    else
      v_remaining := v_deduct;
      for v_batch in
        select id, quantity_remaining
        from public.inventory_batches
        where ingredient_id = NEW.ingredient_id
          and status = 'ACTIVE'
          and quantity_remaining > 0
        order by expiration_date asc nulls last, created_at asc, id asc
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_batch.quantity_remaining, v_remaining);
        update public.inventory_batches
        set quantity_remaining = quantity_remaining - v_take,
            status = case
              when quantity_remaining - v_take <= 0 then 'DISCARDED'
              else 'ACTIVE'
            end,
            updated_at = timezone('utc', now())
        where id = v_batch.id;
        v_remaining := v_remaining - v_take;
      end loop;
    end if;

  elsif v_tx_type = 'SALE' then
    v_deduct := abs(coalesce(NEW.quantity_change, 0));
    NEW.quantity_change := v_deduct;
    v_new := greatest(0, v_current - v_deduct);

    if v_deduct > v_current and coalesce(NEW.reason, '') not ilike '%shortfall%' then
      NEW.reason := trim(
        coalesce(NEW.reason, 'Clover POS sales deduction') ||
        format(' [Shortfall: %s clamped at 0]', round(v_deduct - v_current, 2))
      );
    end if;

    v_remaining := v_deduct;
    for v_batch in
      select id, quantity_remaining
      from public.inventory_batches
      where ingredient_id = NEW.ingredient_id
        and status = 'ACTIVE'
        and quantity_remaining > 0
      order by expiration_date asc nulls last, created_at asc, id asc
      for update
    loop
      exit when v_remaining <= 0;
      v_take := least(v_batch.quantity_remaining, v_remaining);
      update public.inventory_batches
      set quantity_remaining = quantity_remaining - v_take,
          status = case
            when quantity_remaining - v_take <= 0 then 'DEPLETED'
            else 'ACTIVE'
          end,
          updated_at = timezone('utc', now())
      where id = v_batch.id;
      v_remaining := v_remaining - v_take;
    end loop;

  elsif v_tx_type = 'CYCLE_COUNT' then
    if NEW.new_stock is not null then
      v_new := greatest(0, NEW.new_stock);
    else
      v_new := greatest(0, v_current + coalesce(NEW.quantity_change, 0));
    end if;

    -- Store signed variance on quantity_change for audit reporting
    NEW.quantity_change := v_new - v_current;

    -- Keep active FIFO batch totals aligned with the physical count
    select coalesce(sum(quantity_remaining), 0)
    into v_batch_sum
    from public.inventory_batches
    where ingredient_id = NEW.ingredient_id
      and status = 'ACTIVE'
      and quantity_remaining > 0;

    v_batch_diff := v_new - v_batch_sum;

    if v_batch_diff < 0 then
      v_remaining := abs(v_batch_diff);
      for v_batch in
        select id, quantity_remaining
        from public.inventory_batches
        where ingredient_id = NEW.ingredient_id
          and status = 'ACTIVE'
          and quantity_remaining > 0
        order by expiration_date asc nulls last, created_at asc, id asc
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_batch.quantity_remaining, v_remaining);
        update public.inventory_batches
        set quantity_remaining = quantity_remaining - v_take,
            status = case
              when quantity_remaining - v_take <= 0 then 'DEPLETED'
              else 'ACTIVE'
            end,
            updated_at = timezone('utc', now())
        where id = v_batch.id;
        v_remaining := v_remaining - v_take;
      end loop;
    elsif v_batch_diff > 0 then
      insert into public.inventory_batches (
        ingredient_id,
        batch_code,
        quantity_received,
        quantity_remaining,
        cost_per_unit,
        received_date,
        expiration_date,
        status
      ) values (
        NEW.ingredient_id,
        'AUDIT-' || to_char(timezone('America/Edmonton', now()), 'YYYYMMDD-HH24MISSMS'),
        v_batch_diff,
        v_batch_diff,
        v_cost,
        timezone('utc', now()),
        timezone('utc', now()) + make_interval(days => v_spoiled_days),
        'ACTIVE'
      );
    end if;
  else
    raise exception 'Unsupported transaction_type: %', v_tx_type;
  end if;

  NEW.new_stock := v_new;

  update public.ingredients
  set current_stock = v_new,
      updated_at = timezone('utc', now())
  where id = NEW.ingredient_id;

  return NEW;
end;
$$;

revoke all on function public.handle_inventory_transaction() from public;

create trigger trg_handle_inventory_transaction
before insert on public.inventory_transactions
for each row
execute function public.handle_inventory_transaction();

-- 3. One-time idempotent backfill for existing drifted FIFO batches
-- ------------------------------------------------------------
do $$
declare
  v_ing record;
  v_batch_sum numeric(12, 2);
  v_diff numeric(12, 2);
  v_remaining numeric(12, 2);
  v_take numeric(12, 2);
  v_batch record;
begin
  -- Ensure any zero-remaining ACTIVE rows are marked DEPLETED
  update public.inventory_batches
  set status = 'DEPLETED',
      updated_at = timezone('utc', now())
  where status = 'ACTIVE'
    and quantity_remaining <= 0;

  for v_ing in
    select
      id,
      coalesce(current_stock, 0) as current_stock,
      greatest(1, coalesce(spoiled_time_limit_days, 7)) as spoiled_days,
      coalesce(cost_per_unit, 0) as cost_per_unit
    from public.ingredients
    for update
  loop
    select coalesce(sum(quantity_remaining), 0)
    into v_batch_sum
    from public.inventory_batches
    where ingredient_id = v_ing.id
      and status = 'ACTIVE'
      and quantity_remaining > 0;

    v_diff := v_ing.current_stock - v_batch_sum;

    if v_diff < 0 then
      v_remaining := abs(v_diff);
      for v_batch in
        select id, quantity_remaining
        from public.inventory_batches
        where ingredient_id = v_ing.id
          and status = 'ACTIVE'
          and quantity_remaining > 0
        order by expiration_date asc nulls last, created_at asc, id asc
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_batch.quantity_remaining, v_remaining);
        update public.inventory_batches
        set quantity_remaining = quantity_remaining - v_take,
            status = case
              when quantity_remaining - v_take <= 0 then 'DEPLETED'
              else 'ACTIVE'
            end,
            updated_at = timezone('utc', now())
        where id = v_batch.id;
        v_remaining := v_remaining - v_take;
      end loop;
    elsif v_diff > 0 then
      insert into public.inventory_batches (
        ingredient_id,
        batch_code,
        quantity_received,
        quantity_remaining,
        cost_per_unit,
        received_date,
        expiration_date,
        status
      ) values (
        v_ing.id,
        'RECONCILE-INIT-' || to_char(timezone('America/Edmonton', now()), 'YYYYMMDD'),
        v_diff,
        v_diff,
        v_ing.cost_per_unit,
        timezone('utc', now()),
        timezone('utc', now()) + make_interval(days => v_ing.spoiled_days),
        'ACTIVE'
      );
    end if;
  end loop;
end $$;

-- 4. Atomic Postgres RPCs (SECURITY INVOKER)
-- ------------------------------------------------------------

create or replace function public.commit_eod_sales(
  p_business_date date,
  p_deductions jsonb,
  p_allow_supplemental boolean default false,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_base_ref text;
  v_ref text;
  v_existing_count integer;
  v_last_at timestamptz;
  v_item jsonb;
  v_ing_id uuid;
  v_qty numeric;
  v_ing_name text;
  v_ing_unit text;
  v_prev_stock numeric;
  v_reason text;
  v_committed_count integer := 0;
  v_shortfalls jsonb := '[]'::jsonb;
begin
  if p_business_date is null then
    return jsonb_build_object('success', false, 'error', 'Business date is required');
  end if;

  if p_deductions is null or jsonb_typeof(p_deductions) <> 'array' or jsonb_array_length(p_deductions) = 0 then
    return jsonb_build_object('success', false, 'error', 'No ingredient deductions provided');
  end if;

  v_base_ref := 'EOD-SALES-' || to_char(p_business_date, 'YYYY-MM-DD');

  select count(*), max(created_at)
  into v_existing_count, v_last_at
  from public.inventory_transactions
  where transaction_type::text = 'SALE'
    and (reference_id = v_base_ref or reference_id like v_base_ref || '-%');

  if v_existing_count > 0 and not coalesce(p_allow_supplemental, false) then
    return jsonb_build_object(
      'success', false,
      'duplicate', true,
      'existing_count', v_existing_count,
      'last_committed_at', v_last_at,
      'base_reference_id', v_base_ref
    );
  end if;

  if v_existing_count = 0 then
    v_ref := v_base_ref;
  else
    v_ref := v_base_ref || '-SUPP-' || to_char(timezone('America/Edmonton', now()), 'HH24MISSMS');
  end if;

  for v_item in select * from jsonb_array_elements(p_deductions)
  loop
    v_ing_id := (v_item->>'ingredient_id')::uuid;
    v_qty := round(coalesce((v_item->>'quantity')::numeric, 0), 4);
    continue when v_qty <= 0;

    select name, unit, coalesce(current_stock, 0)
    into v_ing_name, v_ing_unit, v_prev_stock
    from public.ingredients
    where id = v_ing_id
    for update;

    if not found then
      raise exception 'Ingredient % not found during EOD commit', v_ing_id;
    end if;

    if v_qty > v_prev_stock then
      v_shortfalls := v_shortfalls || jsonb_build_array(
        jsonb_build_object(
          'ingredient_id', v_ing_id,
          'name', v_ing_name,
          'unit', v_ing_unit,
          'required', round(v_qty, 2),
          'available', v_prev_stock,
          'shortfall', round(v_qty - v_prev_stock, 2)
        )
      );
    end if;

    v_reason := coalesce(
      nullif(trim(v_item->>'reason'), ''),
      nullif(trim(p_note), ''),
      'Clover EOD sales deduction (' || to_char(p_business_date, 'YYYY-MM-DD') || ')'
    );

    if nullif(trim(p_note), '') is not null
       and nullif(trim(v_item->>'reason'), '') is not null
       and trim(p_note) <> trim(v_item->>'reason') then
      v_reason := trim(v_item->>'reason') || ' · ' || trim(p_note);
    end if;

    insert into public.inventory_transactions (
      ingredient_id,
      transaction_type,
      quantity_change,
      reason,
      reference_id
    ) values (
      v_ing_id,
      'SALE',
      round(v_qty, 4),
      v_reason,
      v_ref
    );

    v_committed_count := v_committed_count + 1;
  end loop;

  if v_committed_count = 0 then
    return jsonb_build_object('success', false, 'error', 'All deduction quantities were zero');
  end if;

  return jsonb_build_object(
    'success', true,
    'reference_id', v_ref,
    'committed_count', v_committed_count,
    'shortfalls', v_shortfalls
  );
end;
$$;

create or replace function public.submit_cycle_count_batch(
  p_entries jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_entry jsonb;
  v_ing_id uuid;
  v_actual numeric(12, 2);
  v_reason text;
  v_count integer := 0;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    return jsonb_build_object('success', false, 'error', 'No cycle count entries provided');
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_ing_id := (v_entry->>'ingredient_id')::uuid;
    v_actual := (v_entry->>'actual_count')::numeric;
    continue when v_actual is null or v_actual < 0;

    v_reason := coalesce(
      nullif(trim(v_entry->>'reason'), ''),
      'Physical inventory cycle count audit'
    );

    insert into public.inventory_transactions (
      ingredient_id,
      transaction_type,
      quantity_change,
      new_stock,
      reason
    ) values (
      v_ing_id,
      'CYCLE_COUNT',
      0,
      v_actual,
      v_reason
    );

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    return jsonb_build_object('success', false, 'error', 'No valid cycle count quantities provided');
  end if;

  return jsonb_build_object('success', true, 'count', v_count);
end;
$$;

create or replace function public.submit_restock_batch(
  p_items jsonb,
  p_batch_code text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_ing_id uuid;
  v_qty numeric(12, 2);
  v_cost numeric(12, 4);
  v_exp timestamptz;
  v_spoiled_days integer;
  v_ing_cost numeric(12, 4);
  v_batch_id uuid;
  v_code text;
  v_reason text;
  v_count integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'error', 'No items provided to restock');
  end if;

  v_code := coalesce(
    nullif(trim(p_batch_code), ''),
    'GROCERY-' || to_char(timezone('America/Edmonton', now()), 'YYYYMMDD-HH24MISSMS')
  );
  v_reason := coalesce(
    nullif(trim(p_reason), ''),
    'Restocked from grocery run (Costco / Asian Market)'
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_ing_id := (v_item->>'ingredient_id')::uuid;
    v_qty := round(coalesce((v_item->>'quantity')::numeric, 0), 2);
    continue when v_qty <= 0;

    select
      greatest(1, coalesce(spoiled_time_limit_days, 7)),
      coalesce(cost_per_unit, 0)
    into v_spoiled_days, v_ing_cost
    from public.ingredients
    where id = v_ing_id;

    if not found then
      raise exception 'Ingredient % not found during batch restock', v_ing_id;
    end if;

    v_cost := coalesce(
      nullif(trim(v_item->>'cost_per_unit'), '')::numeric,
      v_ing_cost,
      0
    );

    v_exp := coalesce(
      nullif(trim(v_item->>'expiration_date'), '')::timestamptz,
      timezone('utc', now()) + make_interval(days => v_spoiled_days)
    );

    insert into public.inventory_batches (
      ingredient_id,
      batch_code,
      quantity_received,
      quantity_remaining,
      cost_per_unit,
      received_date,
      expiration_date,
      status
    ) values (
      v_ing_id,
      v_code,
      v_qty,
      v_qty,
      greatest(0, v_cost),
      timezone('utc', now()),
      v_exp,
      'ACTIVE'
    )
    returning id into v_batch_id;

    insert into public.inventory_transactions (
      ingredient_id,
      batch_id,
      transaction_type,
      quantity_change,
      reason,
      reference_id
    ) values (
      v_ing_id,
      v_batch_id,
      'RESTOCK',
      v_qty,
      v_reason,
      v_code
    );

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    return jsonb_build_object('success', false, 'error', 'All restock quantities were zero');
  end if;

  return jsonb_build_object(
    'success', true,
    'count', v_count,
    'batch_code', v_code
  );
end;
$$;

grant execute on function public.commit_eod_sales(date, jsonb, boolean, text) to anon, authenticated;
grant execute on function public.submit_cycle_count_batch(jsonb) to anon, authenticated;
grant execute on function public.submit_restock_batch(jsonb, text, text) to anon, authenticated;

-- 5. Ensure Realtime Publication covers all 5 inventory & recipe tables
-- ------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'ingredients',
    'inventory_batches',
    'inventory_transactions',
    'clover_items',
    'recipe_ingredients'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;
