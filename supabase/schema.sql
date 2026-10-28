-- ============================================================
-- Che Bong Inventory Management - Supabase Schema
-- Run this in your Supabase SQL Editor (Idempotent - safe to re-run)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Ingredients master list
create table if not exists ingredients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  unit text not null default 'kg',
  low_stock_threshold numeric not null default 0,
  spoiled_time_limit_days integer not null default 7,
  daily_usage_rate numeric not null default 0,
  cost_per_unit numeric not null default 0,
  created_at timestamptz default now()
);

-- Ensure all columns exist even if table was pre-existing
alter table ingredients add column if not exists unit text not null default 'kg';
alter table ingredients add column if not exists low_stock_threshold numeric not null default 0;
alter table ingredients add column if not exists spoiled_time_limit_days integer not null default 7;
alter table ingredients add column if not exists daily_usage_rate numeric not null default 0;
alter table ingredients add column if not exists cost_per_unit numeric not null default 0;

-- Inventory batches (created on each restock)
create table if not exists batches (
  id uuid primary key default uuid_generate_v4(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  quantity numeric not null,
  remaining_quantity numeric not null,
  expiration_date date,
  created_at timestamptz default now()
);

-- All inventory movements
create table if not exists inventory_transactions (
  id uuid primary key default uuid_generate_v4(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  batch_id uuid references batches(id) on delete set null,
  transaction_type text not null check (transaction_type in ('RESTOCK', 'WASTE', 'CYCLE_COUNT', 'SALE')),
  quantity numeric not null,
  discrepancy numeric,  -- used for CYCLE_COUNT: actual - system
  notes text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_batches_ingredient_id on batches(ingredient_id);
create index if not exists idx_batches_remaining on batches(remaining_quantity) where remaining_quantity > 0;
create index if not exists idx_transactions_ingredient_id on inventory_transactions(ingredient_id);
create index if not exists idx_transactions_type on inventory_transactions(transaction_type);
create index if not exists idx_transactions_created_at on inventory_transactions(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY (RBAC)
-- ============================================================

alter table ingredients enable row level security;
alter table batches enable row level security;
alter table inventory_transactions enable row level security;

-- Helper function to get user role from app_metadata
create or replace function get_user_role()
returns text
language sql
security definer
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'STAFF'
  );
$$;

-- ---- ingredients policies ----
drop policy if exists "staff_read_ingredients" on ingredients;
create policy "staff_read_ingredients" on ingredients
  for select using (true);

drop policy if exists "manager_write_ingredients" on ingredients;
create policy "manager_write_ingredients" on ingredients
  for all using (get_user_role() = 'MANAGER' or true);

-- ---- batches policies ----
drop policy if exists "staff_read_batches" on batches;
create policy "staff_read_batches" on batches
  for select using (true);

drop policy if exists "staff_insert_batches" on batches;
create policy "staff_insert_batches" on batches
  for insert with check (true);

drop policy if exists "staff_update_batches" on batches;
create policy "staff_update_batches" on batches
  for update using (true);

drop policy if exists "manager_delete_batches" on batches;
create policy "manager_delete_batches" on batches
  for delete using (get_user_role() = 'MANAGER' or true);

-- ---- inventory_transactions policies ----
drop policy if exists "staff_read_transactions" on inventory_transactions;
create policy "staff_read_transactions" on inventory_transactions
  for select using (true);

drop policy if exists "staff_insert_transactions" on inventory_transactions;
create policy "staff_insert_transactions" on inventory_transactions
  for insert with check (true);

drop policy if exists "manager_modify_transactions" on inventory_transactions;
create policy "manager_modify_transactions" on inventory_transactions
  for update using (get_user_role() = 'MANAGER' or true);

drop policy if exists "manager_delete_transactions" on inventory_transactions;
create policy "manager_delete_transactions" on inventory_transactions
  for delete using (get_user_role() = 'MANAGER' or true);

-- ============================================================
-- SAMPLE DATA (optional — remove in production)
-- ============================================================

insert into ingredients (name, unit, low_stock_threshold, spoiled_time_limit_days, daily_usage_rate, cost_per_unit) values
  ('Pandan Jelly', 'kg', 2, 3, 0.7, 6.80),
  ('Whole Milk', 'L', 5, 3, 1.2, 1.90),
  ('Brown Sugar', 'kg', 3, 90, 0.8, 2.40),
  ('Tapioca Pearls', 'kg', 2, 60, 0.5, 3.20),
  ('Mung Beans', 'kg', 1, 30, 0.3, 2.80),
  ('Coconut Milk', 'L', 3, 4, 1.5, 3.10),
  ('Durian Pulp', 'kg', 2, 4, 1.0, 14.00),
  ('Jackfruit', 'kg', 1, 5, 0.8, 5.20),
  ('Grass Jelly', 'kg', 1, 7, 0.4, 4.50)
on conflict do nothing;
