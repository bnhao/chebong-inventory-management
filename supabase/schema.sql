-- ============================================================
-- Che Bong Inventory Management - Comprehensive Supabase Schema
-- Run this in your Supabase SQL Editor (Idempotent - safe to re-run)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Ingredients Master List
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null default 'kg',
  current_stock numeric(12, 4) not null default 0 check (current_stock >= 0),
  low_stock_threshold numeric(12, 2) not null default 0 check (low_stock_threshold >= 0),
  spoiled_time_limit_days integer not null default 7 check (spoiled_time_limit_days > 0),
  daily_usage_rate numeric(12, 2) not null default 0,
  cost_per_unit numeric(12, 4) not null default 0 check (cost_per_unit >= 0),
  category text,
  description text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure all columns & types match if table already existed
alter table ingredients add column if not exists unit text not null default 'kg';
alter table ingredients add column if not exists current_stock numeric(12, 4) not null default 0;
alter table ingredients drop constraint if exists ingredients_low_stock_threshold_check;
alter table ingredients alter column low_stock_threshold type numeric(12, 2) using low_stock_threshold::numeric(12, 2);
alter table ingredients add constraint ingredients_low_stock_threshold_check check (low_stock_threshold >= 0);
alter table ingredients add column if not exists spoiled_time_limit_days integer not null default 7;
alter table ingredients add column if not exists daily_usage_rate numeric(12, 2) not null default 0;
alter table ingredients add column if not exists cost_per_unit numeric(12, 4) not null default 0;
alter table ingredients add column if not exists category text;
alter table ingredients add column if not exists description text;
alter table ingredients add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

-- Inventory Batches (created on Restock, tracked & synced via FIFO)
create table if not exists inventory_batches (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  batch_code text,
  quantity_received numeric(12, 4) not null check (quantity_received > 0),
  quantity_remaining numeric(12, 4) not null check (quantity_remaining >= 0 and quantity_remaining <= quantity_received),
  cost_per_unit numeric(12, 4) not null default 0 check (cost_per_unit >= 0),
  received_date timestamptz not null default timezone('utc'::text, now()),
  expiration_date timestamptz not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DEPLETED', 'EXPIRED', 'DISCARDED')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table inventory_batches add column if not exists batch_code text;
alter table inventory_batches add column if not exists cost_per_unit numeric(12, 4) not null default 0;
alter table inventory_batches add column if not exists received_date timestamptz not null default timezone('utc'::text, now());
alter table inventory_batches add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());
alter table inventory_batches drop constraint if exists inventory_batches_status_check;
alter table inventory_batches add constraint inventory_batches_status_check check (status in ('ACTIVE', 'DEPLETED', 'EXPIRED', 'DISCARDED'));

-- Inventory Transactions (Audit log for RESTOCK, WASTE, CYCLE_COUNT, SALE)
create table if not exists inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  batch_id uuid references inventory_batches(id) on delete set null,
  transaction_type text not null check (transaction_type in ('RESTOCK', 'WASTE', 'CYCLE_COUNT', 'SALE')),
  quantity_change numeric(12, 4) not null default 0,
  previous_stock numeric(12, 4),
  new_stock numeric(12, 4),
  reason text,
  reference_id text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table inventory_transactions add column if not exists previous_stock numeric(12, 4);
alter table inventory_transactions add column if not exists new_stock numeric(12, 4);
alter table inventory_transactions add column if not exists reason text;
alter table inventory_transactions add column if not exists reference_id text;

-- Clover Items (Menu products sold via Clover POS)
create table if not exists clover_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  clover_id text unique,
  price numeric not null default 0,
  category text not null default 'Chè Desserts',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

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
    alter table clover_items add constraint clover_items_clover_id_key unique (clover_id);
  end if;
end $$;

-- Recipe Ingredients (BOM mapping Clover Items -> Raw Ingredients)
create table if not exists recipe_ingredients (
  id uuid primary key default uuid_generate_v4(),
  clover_item_id uuid not null references clover_items(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  quantity_required numeric not null default 0 check (quantity_required > 0),
  created_at timestamptz default now(),
  constraint uq_clover_ingredient unique (clover_item_id, ingredient_id)
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

create index if not exists idx_batches_ingredient_id on inventory_batches(ingredient_id);
create index if not exists idx_batches_remaining on inventory_batches(quantity_remaining) where quantity_remaining > 0;
create index if not exists idx_batches_exp on inventory_batches(expiration_date);
create index if not exists idx_batches_active_fifo on inventory_batches(ingredient_id, expiration_date asc nulls last, created_at asc) where status = 'ACTIVE' and quantity_remaining > 0;

create index if not exists idx_tx_ingredient_id on inventory_transactions(ingredient_id);
create index if not exists idx_tx_type on inventory_transactions(transaction_type);
create index if not exists idx_tx_created on inventory_transactions(created_at desc);
create index if not exists idx_tx_type_created on inventory_transactions(transaction_type, created_at desc);
create index if not exists idx_tx_reference_id on inventory_transactions(reference_id) where reference_id is not null;

create index if not exists idx_recipes_clover on recipe_ingredients(clover_item_id);
create index if not exists idx_recipes_ingredient on recipe_ingredients(ingredient_id);

-- ============================================================
-- 3. AUTOMATIC STOCK & FIFO BATCH SYNC TRIGGER
-- ============================================================

drop trigger if exists trg_inventory_transaction on inventory_transactions;
drop trigger if exists trg_handle_inventory_transaction on inventory_transactions;

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

    NEW.quantity_change := v_new - v_current;

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

-- ============================================================
-- 4. ATOMIC TRANSACTIONAL RPCs
-- ============================================================

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

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

alter table ingredients enable row level security;
alter table inventory_batches enable row level security;
alter table inventory_transactions enable row level security;
alter table clover_items enable row level security;
alter table recipe_ingredients enable row level security;

-- Open policies for anon & authenticated users (inventory kiosk app)
drop policy if exists "all_ingredients" on ingredients;
create policy "all_ingredients" on ingredients for all using (true) with check (true);

drop policy if exists "all_batches" on inventory_batches;
create policy "all_batches" on inventory_batches for all using (true) with check (true);

drop policy if exists "all_transactions" on inventory_transactions;
create policy "all_transactions" on inventory_transactions for all using (true) with check (true);

drop policy if exists "all_clover_items" on clover_items;
create policy "all_clover_items" on clover_items for all using (true) with check (true);

drop policy if exists "all_recipes" on recipe_ingredients;
create policy "all_recipes" on recipe_ingredients for all using (true) with check (true);

-- ============================================================
-- 6. INITIAL SEED DATA
-- ============================================================

insert into ingredients (name, unit, current_stock, low_stock_threshold, spoiled_time_limit_days, daily_usage_rate, cost_per_unit, category, description) values
  ('Pandan Jelly', 'kg', 5.0, 2, 3, 0.7, 6.80, 'Hand-Cooked Jellies', 'Hand-cooked in-house kitchen prep (not bought pre-made)'),
  ('Grass Jelly', 'kg', 4.0, 1, 7, 0.4, 4.50, 'Hand-Cooked Jellies', 'Hand-cooked in-house kitchen prep (not bought pre-made)'),
  ('Coconut Jelly', 'kg', 4.0, 2, 3, 0.6, 5.50, 'Hand-Cooked Jellies', 'Hand-cooked in-house kitchen prep (not bought pre-made)'),
  ('Whole Milk', 'L', 12.0, 5, 3, 1.2, 1.90, 'Dairy & Milk', null),
  ('Coconut Milk', 'L', 10.0, 3, 4, 1.5, 3.10, 'Dairy & Milk', null),
  ('Brown Sugar', 'kg', 15.0, 3, 90, 0.8, 2.40, 'Dry Goods & Packaging', null),
  ('Tapioca Pearls', 'kg', 8.0, 2, 60, 0.5, 3.20, 'Beans & Pearls', 'Fresh boba/tapioca pearls for sweet soup desserts'),
  ('Mung Beans', 'kg', 6.0, 1, 30, 0.3, 2.80, 'Beans & Pearls', null),
  ('Durian Pulp', 'kg', 4.0, 2, 4, 1.0, 14.00, 'Produce & Fruits', null),
  ('Jackfruit', 'kg', 5.0, 1, 5, 0.8, 5.20, 'Produce & Fruits', null)
on conflict do nothing;

-- Official Chè Bông Menu Items (43 items across 6 categories, ready for Clover Webhook & manual recipe mapping)
insert into clover_items (clover_id, name, category, price, is_active) values
  -- Chè (Desserts)
  ('CHE-1',  '1. Creamy Coconut Jelly', 'Chè (Desserts)', 7.90, true),
  ('CHE-1A', '1A. Creamy Pandan Coco', 'Chè (Desserts)', 8.50, true),
  ('CHE-1B', '1B. Flan Pandan Coco', 'Chè (Desserts)', 9.50, true),
  ('CHE-2A', '2A. Chè Thai', 'Chè (Desserts)', 9.30, true),
  ('CHE-2B', '2B. Chè Thai Flan (+durian 2)', 'Chè (Desserts)', 11.50, true),
  ('CHE-2C', '2C. Chè Thai with Durian', 'Chè (Desserts)', 10.40, true),
  ('CHE-3',  '3. Tofu Pudding', 'Chè (Desserts)', 7.00, true),
  ('CHE-4',  '4. Traffic Light Che', 'Chè (Desserts)', 8.50, true),
  ('CHE-5A', '5A. Flantastic Che', 'Chè (Desserts)', 8.50, true),
  ('CHE-5B', '5B. Classic Flan with Pearls', 'Chè (Desserts)', 7.00, true),
  ('CHE-5C', '5C. Deluxe Flantastic Che', 'Chè (Desserts)', 10.50, true),
  ('CHE-6A', '6A. Strawberry Sago', 'Chè (Desserts)', 9.50, true),
  ('CHE-6B', '6B. Mango Sago', 'Chè (Desserts)', 9.50, true),
  ('CHE-7A', '7A. Grass Jelly with Taro Ball', 'Chè (Desserts)', 8.90, true),
  ('CHE-7B', '7B. Grass Jelly with Mango Coco', 'Chè (Desserts)', 8.50, true),

  -- Bánh Mì (Subs)
  ('BM-B1', 'B1. Sate Chicken', 'Bánh Mì (Subs)', 11.00, true),
  ('BM-B2', 'B2. Sate Beef', 'Bánh Mì (Subs)', 12.00, true),
  ('BM-B3', 'B3. Grill Pork', 'Bánh Mì (Subs)', 11.00, true),
  ('BM-B4', 'B4. Assorted Cold Cut', 'Bánh Mì (Subs)', 11.00, true),
  ('BM-B5', 'B5. Veggie', 'Bánh Mì (Subs)', 9.50, true),

  -- Giải Khát (Drinks)
  ('GK-N1', 'N1. Dessert Drink (Mango, Strawberry, Avocado)', 'Giải Khát (Drinks)', 8.90, true),
  ('GK-N2', 'N2. Avocado Coco Drink', 'Giải Khát (Drinks)', 7.00, true),
  ('GK-N3', 'N3. Fruity Yakult (Mango, Strawberry)', 'Giải Khát (Drinks)', 7.90, true),
  ('GK-N4', 'N4. Cocoa Latte (Hot/Cold)', 'Giải Khát (Drinks)', 6.50, true),
  ('GK-N5', 'N5. Cocoa Latte Cloud (Hot/Cold)', 'Giải Khát (Drinks)', 7.00, true),
  ('GK-N6', 'N6. Strawberry Cocoa Latte', 'Giải Khát (Drinks)', 7.50, true),

  -- Viet Coffee
  ('CF-01', 'Viet Espresso', 'Viet Coffee', 5.00, true),
  ('CF-02', 'Viet Coffee (Hot/Cold)', 'Viet Coffee', 6.50, true),
  ('CF-03', 'Viet White Coffee (+foam 1)', 'Viet Coffee', 6.50, true),
  ('CF-04', 'Coconut Coffee', 'Viet Coffee', 7.00, true),
  ('CF-05', 'Grass Jelly Coffee', 'Viet Coffee', 7.90, true),
  ('CF-06', 'Salted Viet Coffee', 'Viet Coffee', 7.00, true),
  ('CF-07', 'Salted Viet Flan Coffee', 'Viet Coffee', 8.50, true),
  ('CF-08', 'Matcha Coffee Latte', 'Viet Coffee', 7.50, true),

  -- Bubble Tea & Milk Tea
  ('BT-01', 'Brown Sugar Pearls Latte', 'Bubble Tea & Milk Tea', 7.00, true),
  ('BT-02', 'Flan Milk Tea Cloud (Thai/Original)', 'Bubble Tea & Milk Tea', 8.50, true),
  ('BT-03', 'Pearls Milk Tea (Thai/Original)', 'Bubble Tea & Milk Tea', 7.00, true),
  ('BT-04', 'Fruit Tea (Peach, Mango)', 'Bubble Tea & Milk Tea', 7.50, true),
  ('BT-05', 'Bubble Tea (Mango, Strawberry, Avocado, Taro)', 'Bubble Tea & Milk Tea', 7.50, true),

  -- Matcha Series (Additional Menu Items)
  ('MT-01', 'Strawberry Matcha', 'Matcha Series', 7.50, true),
  ('MT-02', 'Jasmine Matcha', 'Matcha Series', 7.50, true),
  ('MT-03', 'Matcha Latte', 'Matcha Series', 7.00, true),
  ('MT-04', 'Coco Matcha', 'Matcha Series', 7.50, true)
on conflict (clover_id) do update
set name = excluded.name,
    category = excluded.category,
    price = excluded.price,
    is_active = excluded.is_active;

-- ============================================================
-- 7. SUPABASE REALTIME REPLICATION (MULTI-DEVICE LIVE SYNC)
-- ============================================================

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
