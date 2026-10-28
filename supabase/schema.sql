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
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  unit text not null default 'kg',
  current_stock numeric not null default 0,
  low_stock_threshold numeric not null default 0,
  spoiled_time_limit_days integer not null default 7,
  daily_usage_rate numeric not null default 0,
  cost_per_unit numeric not null default 0,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure all columns exist if table was already created
alter table ingredients add column if not exists unit text not null default 'kg';
alter table ingredients add column if not exists current_stock numeric not null default 0;
alter table ingredients add column if not exists low_stock_threshold numeric not null default 0;
alter table ingredients add column if not exists spoiled_time_limit_days integer not null default 7;
alter table ingredients add column if not exists daily_usage_rate numeric not null default 0;
alter table ingredients add column if not exists cost_per_unit numeric not null default 0;
alter table ingredients add column if not exists description text;
alter table ingredients add column if not exists updated_at timestamptz default now();

-- Inventory Batches (created on Restock, tracked by FIFO)
create table if not exists inventory_batches (
  id uuid primary key default uuid_generate_v4(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  batch_code text,
  quantity_received numeric not null,
  quantity_remaining numeric not null,
  cost_per_unit numeric not null default 0,
  expiration_date timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXHAUSTED', 'SPOILED', 'DISCARDED')),
  created_at timestamptz default now()
);

alter table inventory_batches add column if not exists batch_code text;
alter table inventory_batches add column if not exists cost_per_unit numeric not null default 0;
alter table inventory_batches add column if not exists status text not null default 'ACTIVE';

-- Inventory Transactions (Audit log for RESTOCK, WASTE, CYCLE_COUNT, SALE)
create table if not exists inventory_transactions (
  id uuid primary key default uuid_generate_v4(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  batch_id uuid references inventory_batches(id) on delete set null,
  transaction_type text not null check (transaction_type in ('RESTOCK', 'WASTE', 'CYCLE_COUNT', 'SALE')),
  quantity_change numeric not null default 0,
  new_stock numeric,
  reason text,
  reference_id text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table inventory_transactions add column if not exists new_stock numeric;
alter table inventory_transactions add column if not exists reason text;
alter table inventory_transactions add column if not exists reference_id text;

-- Clover Items (Menu products sold via Clover POS)
create table if not exists clover_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  clover_id text,
  price numeric not null default 0,
  category text not null default 'Chè Desserts',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Recipe Ingredients (BOM mapping Clover Items -> Raw Ingredients)
create table if not exists recipe_ingredients (
  id uuid primary key default uuid_generate_v4(),
  clover_item_id uuid not null references clover_items(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  quantity_required numeric not null default 0,
  created_at timestamptz default now(),
  constraint uq_clover_ingredient unique (clover_item_id, ingredient_id)
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

create index if not exists idx_batches_ingredient_id on inventory_batches(ingredient_id);
create index if not exists idx_batches_remaining on inventory_batches(quantity_remaining) where quantity_remaining > 0;
create index if not exists idx_batches_exp on inventory_batches(expiration_date);

create index if not exists idx_tx_ingredient_id on inventory_transactions(ingredient_id);
create index if not exists idx_tx_type on inventory_transactions(transaction_type);
create index if not exists idx_tx_created on inventory_transactions(created_at desc);

create index if not exists idx_recipes_clover on recipe_ingredients(clover_item_id);
create index if not exists idx_recipes_ingredient on recipe_ingredients(ingredient_id);

-- ============================================================
-- 3. AUTOMATIC STOCK CALCULATION TRIGGER
-- ============================================================

create or replace function handle_inventory_transaction()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.transaction_type = 'RESTOCK' then
    update ingredients
    set current_stock = coalesce(current_stock, 0) + NEW.quantity_change,
        updated_at = now()
    where id = NEW.ingredient_id;
  elsif NEW.transaction_type = 'WASTE' then
    update ingredients
    set current_stock = greatest(0, coalesce(current_stock, 0) - NEW.quantity_change),
        updated_at = now()
    where id = NEW.ingredient_id;
  elsif NEW.transaction_type = 'SALE' then
    update ingredients
    set current_stock = greatest(0, coalesce(current_stock, 0) - NEW.quantity_change),
        updated_at = now()
    where id = NEW.ingredient_id;
  elsif NEW.transaction_type = 'CYCLE_COUNT' then
    if NEW.new_stock is not null then
      update ingredients
      set current_stock = NEW.new_stock,
          updated_at = now()
      where id = NEW.ingredient_id;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_inventory_transaction on inventory_transactions;
create trigger trg_inventory_transaction
after insert on inventory_transactions
for each row
execute function handle_inventory_transaction();

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
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
-- 5. INITIAL SEED DATA
-- ============================================================

insert into ingredients (name, unit, current_stock, low_stock_threshold, spoiled_time_limit_days, daily_usage_rate, cost_per_unit) values
  ('Pandan Jelly', 'kg', 5.0, 2, 3, 0.7, 6.80),
  ('Whole Milk', 'L', 12.0, 5, 3, 1.2, 1.90),
  ('Brown Sugar', 'kg', 15.0, 3, 90, 0.8, 2.40),
  ('Tapioca Pearls', 'kg', 8.0, 2, 60, 0.5, 3.20),
  ('Mung Beans', 'kg', 6.0, 1, 30, 0.3, 2.80),
  ('Coconut Milk', 'L', 10.0, 3, 4, 1.5, 3.10),
  ('Durian Pulp', 'kg', 4.0, 2, 4, 1.0, 14.00),
  ('Jackfruit', 'kg', 5.0, 1, 5, 0.8, 5.20),
  ('Grass Jelly', 'kg', 4.0, 1, 7, 0.4, 4.50)
on conflict do nothing;
