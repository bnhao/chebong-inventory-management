#!/usr/bin/env bash

# ==============================================================================
# CB Inventory - GitHub Issues Auto-Generator
# Creates all 14 tickets across 4 milestones in bnhao/chebong-inventory-management
# ==============================================================================

set -e

REPO="bnhao/chebong-inventory-management"

echo "=========================================================="
echo "🚀 Configuring GitHub Milestones and Labels for CB Inventory"
echo "=========================================================="

# 1. Create Labels
echo "🏷️  Configuring labels..."
gh label create "milestone:bridge-1" --color "0e8a16" --description "Bridge 1: Production Launch & Polish" --repo "$REPO" --force || true
gh label create "milestone:phase-2" --color "1d76db" --description "Phase 2: Floor Speed & Hardware Workflows" --repo "$REPO" --force || true
gh label create "milestone:bridge-2" --color "fbca04" --description "Bridge 2: Architecture & Data Scaling Prep" --repo "$REPO" --force || true
gh label create "milestone:phase-3" --color "5319e7" --description "Phase 3: Intelligence & Multi-Store Scaling" --repo "$REPO" --force || true
gh label create "layer:database" --color "d93f0b" --description "Database schema & migrations" --repo "$REPO" --force || true
gh label create "layer:backend" --color "5319e7" --description "Backend API & Server Actions" --repo "$REPO" --force || true
gh label create "layer:frontend" --color "1d76db" --description "Frontend UI & PWA" --repo "$REPO" --force || true
gh label create "layer:hardware" --color "c2e0c6" --description "Hardware, POS & Camera APIs" --repo "$REPO" --force || true
gh label create "layer:mobile" --color "0075ca" --description "Mobile-specific features & UX" --repo "$REPO" --force || true
gh label create "layer:analytics" --color "a2eeef" --description "Analytics & AI demand forecasting" --repo "$REPO" --force || true
gh label create "layer:finance" --color "006b75" --description "Financial & Accounting reporting" --repo "$REPO" --force || true

# 2. Create Milestones via GitHub API
echo "🚩 Creating milestones..."
gh api "repos/$REPO/milestones" -f title="Milestone 1: Bridge 1 (Production Launch & Polish)" -f description="Move prototype to live store operations with Clover integration." || true
gh api "repos/$REPO/milestones" -f title="Milestone 2: Phase 2 (Floor Speed & Shopping Workflows)" -f description="Kitchen speed, barcode scanning, Clover modifiers, and to-buy grocery checklist." || true
gh api "repos/$REPO/milestones" -f title="Milestone 3: Bridge 2 (Architecture & Scaling Prep)" -f description="Multi-store schema, daily rollups, and historical consumption analytics." || true
gh api "repos/$REPO/milestones" -f title="Milestone 4: Phase 3 (Intelligence & Multi-Store Scaling)" -f description="Multi-branch switcher, inter-store transfers, AI demand prep forecasting, and accounting sync." || true

echo ""
echo "=========================================================="
echo "📝 Creating Tickets Across 4 Milestones..."
echo "=========================================================="

create_issue_if_missing() {
  local title="$1"
  local milestone="$2"
  local labels="$3"
  local body="$4"

  # Check if issue title already exists
  if gh issue list --repo "$REPO" --search "$title" --json title --jq '.[].title' | grep -qF "$title"; then
    echo "⏭️  Already exists: $title"
  else
    echo "✨ Creating: $title"
    gh issue create --repo "$REPO" \
      --title "$title" \
      --milestone "$milestone" \
      --label "$labels" \
      --body "$body"
  fi
}

# ------------------------------------------------------------------------------
# MILESTONE 1: Bridge 1 (Production Launch & Polish)
# ------------------------------------------------------------------------------

create_issue_if_missing \
  "[Database] Multi-Ingredient Recipe Constraint (uq_clover_ingredient)" \
  "Milestone 1: Bridge 1 (Production Launch & Polish)" \
  "milestone:bridge-1,layer:database" \
  "### Objective
Ensure a single Clover menu item (e.g. 'Durian Che') can deduct multiple raw ingredients simultaneously.

### Acceptance Criteria
- [x] Unique constraint is defined as \`UNIQUE (clover_item_id, ingredient_id)\` in \`supabase/schema.sql\`.
- [x] Recipe ingredients table supports Bill of Materials (BOM) mapping.
- [x] Tested in Manager Recipes view.

*Status: Completed in initial schema setup.*"

create_issue_if_missing \
  "[PWA] Mobile Home Screen Packaging & Dessert Bowl Branding" \
  "Milestone 1: Bridge 1 (Production Launch & Polish)" \
  "milestone:bridge-1,layer:frontend" \
  "### Objective
Package the application as a standalone Progressive Web App (PWA) with custom dessert bowl branding, safe areas, and offline-capable service worker.

### Acceptance Criteria
- [x] Web App Manifest (\`manifest.ts\` / \`manifest.json\`) with \`display: standalone\`.
- [x] App title set to **CB Inventory** across manifests and metadata.
- [x] High-resolution dessert bowl icons in 192x192, 512x512, and maskable formats.
- [x] PWA registration component with iOS Safari 'Add to Home Screen' guide.
- [x] Safe area insets (\`pt-safe\`, \`pb-safe\`) configured for iPhone Dynamic Island and Home indicator.

*Status: Completed & deployed live on Vercel.*"

create_issue_if_missing \
  "[Backend] Live Clover Webhook Endpoint & Verification Handshake" \
  "Milestone 1: Bridge 1 (Production Launch & Polish)" \
  "milestone:bridge-1,layer:backend,layer:hardware" \
  "### Objective
Implement the live Clover POS webhook endpoint to receive order/payment events and verify webhook ownership.

### Requirements
1. Create \`/api/clover-webhook/route.ts\`.
2. Handle Clover GET/POST verification code handshake on registration.
3. Handle \`ORDER_CREATED\` or \`PAYMENT_PROCESSED\` webhook events.
4. Fetch order line items from Clover REST API and trigger \`inventory_transactions\` deduction with \`transaction_type = 'SALE'\`.

### Acceptance Criteria
- [ ] Endpoint successfully validates Clover webhook handshake.
- [ ] Processing an order deducts the mapped ingredient recipe quantities.
- [ ] Production webhook registered in Clover Merchant Dashboard."

create_issue_if_missing \
  "[Fullstack] Clover Menu & Inventory Catalog Sync Action" \
  "Milestone 1: Bridge 1 (Production Launch & Polish)" \
  "milestone:bridge-1,layer:backend,layer:frontend" \
  "### Objective
Build a one-click sync action in the Manager Recipes view to import and update menu items directly from the Clover Inventory REST API.

### Requirements
1. Add server action \`syncCloverCatalogAction\` that fetches \`/v3/merchants/{mId}/items\` using the Clover API token.
2. Upsert items into \`clover_items\` (matching on \`clover_id\`).
3. Add a 'Sync with Clover' button with loading state in \`/manager/recipes\`.

### Acceptance Criteria
- [ ] Clicking 'Sync with Clover' imports active store items with pricing and category.
- [ ] Existing recipe ingredient mappings remain intact during re-sync.
- [ ] Graceful error toast when Clover API token is invalid or missing."

# ------------------------------------------------------------------------------
# MILESTONE 2: Phase 2 — Floor Speed & Hardware Workflows
# ------------------------------------------------------------------------------

create_issue_if_missing \
  "[Mobile] Interactive 'To-Buy' Categorized Grocery Shopping Checklist" \
  "Milestone 2: Phase 2 (Floor Speed & Shopping Workflows)" \
  "milestone:phase-2,layer:frontend,layer:mobile" \
  "### Objective
Upgrade \`/staff/groceries\` into a mobile shopping checklist optimized for manual grocery runs (Costco, Restaurant Depot, Asian markets).

### Requirements
1. Group ingredients needing restock by department (Dairy & Milk, Produce & Fruits, Jellies & Beans, Dry Goods & Packaging).
2. Interactive check-off checkboxes so staff can mark items off while walking down market aisles.
3. Display suggested purchase quantity based on current burn rate and par levels.
4. Show estimated total shopping basket cost.

### Acceptance Criteria
- [ ] Staff can filter by category or view only items below threshold.
- [ ] Tapping an item checks it off with clear visual strike-through.
- [ ] 'Restock Checked' shortcut that pre-fills receiving amounts."

create_issue_if_missing \
  "[Mobile/Hardware] Camera Barcode Scanning for Restock Receiving" \
  "Milestone 2: Phase 2 (Floor Speed & Shopping Workflows)" \
  "milestone:phase-2,layer:hardware,layer:mobile" \
  "### Objective
Enable mobile camera barcode scanning in the Restock screen to auto-select ingredients when receiving vendor packaging.

### Requirements
1. Add barcode scanner trigger button in \`/staff/restock\`.
2. Use HTML5 camera / Web BarcodeDetector API (with fallback library like \`@zxing/library\`).
3. Map ingredient UPC/EAN barcodes in \`ingredients\` table.
4. On scan, immediately select ingredient, focus quantity input, and generate batch code.

### Acceptance Criteria
- [ ] Camera opens with viewfinder overlay on iOS and Android PWA.
- [ ] Scanning a recognized product barcode selects the ingredient in < 1 second.
- [ ] Option to associate a new barcode with an existing ingredient."

create_issue_if_missing \
  "[Backend/POS] Clover Modifier Depletion Logic (Half Sugar, Extra Boba)" \
  "Milestone 2: Phase 2 (Floor Speed & Shopping Workflows)" \
  "milestone:phase-2,layer:backend,layer:hardware" \
  "### Objective
Upgrade Clover order webhook processing to parse customer modifiers and scale raw ingredient deductions accordingly.

### Requirements
1. Parse Clover modifier groups from order payload (e.g. Sugar level: 0%, 50%, 100%; Toppings: Extra Boba, Extra Jelly).
2. Apply deduction multiplier (e.g. 50% sugar scales sugar syrup recipe ingredient by 0.5x).
3. Add modifier-level ingredient deductions for add-on toppings.

### Acceptance Criteria
- [ ] 'Half Sweet' orders deduct half the syrup amount.
- [ ] Add-on toppings deduct additional stock from the appropriate topping batch.
- [ ] Fallback to standard BOM if modifier has no inventory rule."

# ------------------------------------------------------------------------------
# MILESTONE 3: Bridge 2 — Architecture & Data Scaling Prep
# ------------------------------------------------------------------------------

create_issue_if_missing \
  "[Database] Multi-Store Schema Migration (locations table & RLS)" \
  "Milestone 3: Bridge 2 (Architecture & Scaling Prep)" \
  "milestone:bridge-2,layer:database" \
  "### Objective
Prepare the single-store database for multi-location operation by introducing a \`locations\` table and partitioning inventory by branch.

### Requirements
1. Create table \`locations (id uuid, name text, address text, is_active boolean)\`.
2. Add \`location_id\` foreign keys to \`inventory_batches\`, \`inventory_transactions\`, and staff profiles.
3. Migrate existing data to default store location ('Chè Bông Flagship').
4. Update Row Level Security (RLS) so staff users only view and mutate stock at their assigned branch.

### Acceptance Criteria
- [ ] Schema migration script executes idempotently.
- [ ] RLS prevents cross-location data leakage for staff role.
- [ ] Managers maintain global access across all branch locations."

create_issue_if_missing \
  "[Backend] Automated Daily Inventory Ledger Rollups" \
  "Milestone 3: Bridge 2 (Architecture & Scaling Prep)" \
  "milestone:bridge-2,layer:backend,layer:database" \
  "### Objective
Create daily automated rollups so dashboard queries and historical reporting stay instant as the transaction ledger grows.

### Requirements
1. Create table \`daily_inventory_rollups (id, date, ingredient_id, location_id, starting_stock, restock_qty, waste_qty, sale_qty, ending_stock, variance)\`.
2. Schedule a Supabase pg_cron job / Edge Function to calculate end-of-day summary at 11:59 PM.
3. Optimize manager dashboard queries to read from rollups rather than scanning millions of raw transaction rows.

### Acceptance Criteria
- [ ] Nightly rollup accurately balances against raw transactions.
- [ ] Dashboard historical load time remains < 200ms."

create_issue_if_missing \
  "[Frontend] Historical Inventory Consumption & Variance Reports" \
  "Milestone 3: Bridge 2 (Architecture & Scaling Prep)" \
  "milestone:bridge-2,layer:frontend,layer:finance" \
  "### Objective
Provide visual analytics on ingredient usage rates, shrinkage trends, and audit discrepancy heatmaps over time.

### Requirements
1. Build historical consumption charts in \`/manager/reports\`.
2. Display 7-day, 30-day, and 90-day usage trends per ingredient.
3. Highlight high-shrinkage ingredients (discrepancies between system sales and physical cycle counts).

### Acceptance Criteria
- [ ] Manager can filter reports by date range and ingredient category.
- [ ] Discrepancy report calculates total dollar variance lost to shrinkage."

# ------------------------------------------------------------------------------
# MILESTONE 4: Phase 3 — Intelligence & Multi-Store Scaling (Final Product)
# ------------------------------------------------------------------------------

create_issue_if_missing \
  "[Fullstack] Multi-Location Switcher & Inter-Store Stock Transfers" \
  "Milestone 4: Phase 3 (Intelligence & Multi-Store Scaling)" \
  "milestone:phase-3,layer:backend,layer:frontend" \
  "### Objective
Enable managers to switch between store locations and record stock transfers between branches.

### Requirements
1. Add Location Selector in Manager TopBar.
2. Build 'Transfer Stock' modal: select origin store, destination store, ingredient, quantity, and batch.
3. Log matching \`TRANSFER_OUT\` and \`TRANSFER_IN\` ledger transactions to maintain balanced stock.

### Acceptance Criteria
- [ ] Transfer deducts from source location and credits target location in a single transaction.
- [ ] FIFO expiration dates persist across inter-store transfers."

create_issue_if_missing \
  "[AI/Analytics] Predictive Demand & Seasonal Prep Forecasting" \
  "Milestone 4: Phase 3 (Intelligence & Multi-Store Scaling)" \
  "milestone:phase-3,layer:backend,layer:analytics" \
  "### Objective
Analyze historical Clover sales and seasonality to generate predictive prep volumes and grocery shopping recommendations.

### Requirements
1. Analyze weekday vs. weekend sales multipliers and seasonal trends (e.g. high durian/coconut demand in summer).
2. Generate weekly prep schedules for kitchen staff (e.g. 'Cook 12 kg Pandan Jelly for Friday-Sunday').
3. Suggest grocery purchase orders 48 hours before projected stockouts.

### Acceptance Criteria
- [ ] Forecast outputs actionable batch quantities for weekly prep.
- [ ] Shopping recommendations adapt to recent sales velocity."

create_issue_if_missing \
  "[Finance] Real-Time COGS, Waste Valuation & Margin Analysis" \
  "Milestone 4: Phase 3 (Intelligence & Multi-Store Scaling)" \
  "milestone:phase-3,layer:finance,layer:frontend" \
  "### Objective
Equip the manager dashboard with accurate restaurant financial metrics: Cost of Goods Sold (COGS), gross margin per recipe, and waste financial impact.

### Requirements
1. Calculate live COGS % = (Beginning Inventory + Purchases - Ending Inventory) / Total Revenue.
2. Calculate dessert profit margins = (Clover Menu Price - BOM Recipe Cost) / Price.
3. Report total monthly financial loss attributed to waste and spoilage.

### Acceptance Criteria
- [ ] Financial metrics update dynamically with new batch costs.
- [ ] Food cost percentage gauge with target thresholds (e.g. 25%-30% target)."

create_issue_if_missing \
  "[Integration] Accounting Sync Pipeline (QuickBooks / Xero)" \
  "Milestone 4: Phase 3 (Intelligence & Multi-Store Scaling)" \
  "milestone:phase-3,layer:finance,layer:backend" \
  "### Objective
Automate monthly bookkeeping by generating accounting journal entries for inventory asset values and COGS for QuickBooks or Xero.

### Requirements
1. Provide standard accounting CSV export compatible with QuickBooks / Xero journal imports.
2. Map debit/credit accounts (Inventory Asset, Cost of Goods Sold, Inventory Shrinkage/Spoilage Expense).
3. Optional direct OAuth sync with QuickBooks Online API.

### Acceptance Criteria
- [ ] Generates balanced monthly journal entries (Debit COGS, Credit Inventory Asset).
- [ ] Format validates with QuickBooks / Xero CSV import templates."

echo ""
echo "=========================================================="
echo "🎉 All 14 tickets created successfully on $REPO!"
echo "=========================================================="
