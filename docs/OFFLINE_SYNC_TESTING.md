# Frostly Offline Sync & Network Failure Testing Protocol

This document outlines manual and automated verification steps for Frostly's local-first offline sync engine, queue consolidation, and recovery.

---

## 1. Automated Vitest Suite

Run the automated queue test suite:
```bash
npm run test
```

### Covered Test Cases
- **Queue Enqueue**: Generates deterministic sync IDs, timestamping, initial retry counter (0).
- **LocalStorage Persistence**: Confirms writes serialize to `frostly_sync_queue_v1`.
- **Conflict Consolidation (Insert + Update)**: Merges offline field modifications into pending insert before upload to save bandwidth and prevent redundant API rounds.
- **Un-synced Insert + Delete**: Immediately discards records created offline and deleted before syncing (no phantom server records).
- **Update + Delete**: Converts pending update to delete on server-side records.
- **Queue Dequeue & Flush Replay**: Flushes and dequeues on successful network commit, handles retry increments and error logging on failure.

---

## 2. Manual Test Procedure: "Kill Network Mid-Write & Restore"

### Setup
1. Open Frostly in Google Chrome or Microsoft Edge DevTools (`F12`).
2. Navigate to the **Network** tab.
3. Open the **Application** tab in a second panel to watch `LocalStorage -> frostly_sync_queue_v1`.

### Step 2.1: Authenticate with Staff Profile
1. Click the **Auth** button in the top navigation bar.
2. Click **"Sign In as Admin Test User"** (or provide Supabase staff credentials).
3. Confirm the status pill turns green: `ADMIN (LIVE)`.

### Step 2.2: Cut Network
1. In the DevTools Network panel, set throttling to **"Offline"**.
2. The `PWAStatusBanner` immediately displays:
   > *"Operating in Offline Cache Mode — Data logged will queue and sync when connection returns."*
3. The top bar Auth button displays status with pending queue indicator.

### Step 2.3: Perform Mutations While Offline
1. Click **"Intake Catch"** in the top bar.
2. Fill out a new catch batch (e.g. `Lot #LOT-OFFLINE-99`, Species: Atlantic Cod, 750 kg).
3. Click **"Register Intake Batch"**.
4. Observe:
   - UI instantly renders the new lot in the inventory table and dashboard metrics.
   - In DevTools `Application -> LocalStorage`, inspect `frostly_sync_queue_v1`:
     - An `INSERT` operation for `inventory_batches` is queued.
5. In the UI, perform an edit or weight adjustment on that batch.
6. Inspect `frostly_sync_queue_v1` again:
   - Notice the pending `INSERT` payload was consolidated in place rather than creating a fragmented `UPDATE` step.

### Step 2.4: Restore Connection & Verify Sync Replay
1. In DevTools Network panel, switch back to **"No throttling"** (Online).
2. The network listener triggers `syncManager.flushAll()` automatically.
3. Observe:
   - Offline queue flushes in order.
   - Pending operations count drops to 0.
   - The remote Supabase PostgreSQL database receives the consolidated record with correct schema and timestamp.

---

## 3. Multi-Device Real-Time Verification Procedure

To demonstrate that persistence is load-bearing across multiple clients:

1. **Device A (Intake Operator)**:
   - Open Frostly in Browser 1 (or normal window).
   - Click the **Auth** button in the header and sign in with authorized staff credentials.
   - Click **"Intake Catch"** and add a new harvest lot (e.g. `LOT-NORDIC-101`, 600 kg Atlantic Cod).
   - Confirm the batch appears and flushes to Supabase (`inventory_batches` table).

2. **Device B (Sales / Order Fulfilment Operator)**:
   - Open Frostly in Browser 2 (or Incognito window with a fresh cache).
   - Click **Auth** in the header and sign in to the same Supabase workspace.
   - Notice `batchRepository.getBatches()` immediately queries Supabase upon mount and authentication.
   - Confirm `LOT-NORDIC-101` created on Device A appears in Device B's Inventory Ledger with full traceability data.
   - On Device B, create a wholesale order selecting `LOT-NORDIC-101` for 100 kg.
   - Device B calls `batchRepository.updateWeights()`, deducting available kg to 500 kg.
   - Device A reloads or re-authenticates and sees the updated 500 kg available weight.
