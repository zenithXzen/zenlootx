# ZenLootX — Memory & Change Log

> **Purpose:** Persistent memory across `/clear`. At the start of any session, read this to know the current state. Whenever you make changes, add a new dated entry under "Change Log" (newest at top).
>
> **Owner context:** New to coding, strong at marketing. Explain simply; confirm before big or irreversible steps.

---

## 📍 Current State (snapshot — last updated 2026-06-03)

**Live stack**
- Frontend: Static HTML/CSS/JS (Vite) — Geist font, dark theme (accent `#19C37D`)
- Hosting: Cloudflare Pages (repo `zenithXzen/zenlootx`)
- Domain: zenlootexchange.com (Namecheap registrar → Cloudflare DNS)
- Auth + DB: Supabase
- Email: Resend (custom 6-digit code flow)
- Backend: Cloudflare Pages Functions (`/functions/api/`)

**Pages that exist**
`/` (landing) · `/login` · `/register` · `/forgot-password` · `/reset-password` · `/account` · `/profile` · `/listings/genshin` · `/listings/mlbb` · `/listings/valorant`

**Working features**
- Landing page (hero, escrow badges, game slideshow, how-it-works, footer)
- Auth-aware nav dropdown
- Register / Login (email or username) / Forgot + Reset password
- Account page: avatar upload, username change (once), email change, password change, active sessions + remote sign-out

**Supabase pieces**
- `user_sessions` table (with RLS + realtime + revoke trigger)
- SQL function `get_email_by_username`
- Storage bucket `avatars` (public)
- Email confirmation disabled (custom Resend flow used instead)

**Cloudflare env vars set:** `RESEND_API_KEY`, `HMAC_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`

**⚠️ Known cleanups / risks**
- `debug-user.js` is a temp endpoint → **remove before launch**.
- RLS currently only on `user_sessions` → **enable on every future table** (listings, orders, wallet, messages).
- Earlier GitHub Pages domain showed a 404 during the migration; site now hosted on Cloudflare Pages instead.

**Not built yet**
- Real listings system (create/browse/buy)
- Orders + escrow flow
- Wallet / payouts
- Payments integration (provider undecided)
- Messaging, seller onboarding, disputes

---

## 🗓️ Change Log (newest first)

### 2026-06-04 (session 3)
- Fixed "Database error saving new user" registration bug. Root cause: `on_signup_create_wallet` trigger on `auth.users` was calling `create_wallet_for_user()` which failed silently. Can't `DISABLE TRIGGER` on `auth.users` (permission denied). Fixed by replacing function body with `EXCEPTION WHEN OTHERS` handler. Also dropped `sync_profile_on_create` trigger and moved profile + wallet creation to new `functions/api/create-profile.js` (uses service key).
- Enforced unique usernames: added `UNIQUE INDEX profiles_username_unique ON profiles(LOWER(username))`. Updated `check-username.js` to query `profiles` table instead of scanning all auth users. Added username check in register.html step 1 before sending verification code.
- Rejected top-up transactions now appear in wallet transaction history with red FAILED badge. Updated `functions/api/admin/topup-action.js` to log a transaction for both approve and reject actions.
- Added real-time listing updates: sold listings vanish instantly from browse pages and detail page shows "Sold" + red notice without reload. Uses Supabase Realtime on `listings` table (in supabase_realtime publication).
- Added "File Dispute" button to completed orders in `orders.html` (was only for in-escrow before).
- Added real-time unread message badge in nav (all pages). Badge = total unread messages across all conversations. Server-side counts via `buyer_unread_count`/`seller_unread_count` columns on `conversations`. Clears when clicking Messages nav link. New `functions/api/mark-read.js` handles reset.
- Added real-time unread notification badge in nav. Reads `notifications.read` column directly. Clears on clicking Notifications link.
- Added read receipts in messages: "· Read 7:31 PM" shows under the last message the other person has read. Tracked via `buyer_last_read_at`/`seller_last_read_at` on conversations. Updates in real-time.
- DB columns added this session: `conversations.last_message_at`, `last_message_preview`, `last_message_sender_id`, `buyer_unread_count`, `seller_unread_count`, `buyer_last_read_at`, `seller_last_read_at`. Trigger `on_message_insert` on `messages` table keeps these in sync.
- Realtime enabled on: `listings`, `conversations`, `notifications` (supabase_realtime publication).

### 2026-06-04
- Fixed withdrawal double-request bug: balance was only deducted when admin approved, so users could submit multiple requests against the same balance. Created `functions/api/request-withdrawal.js` — deducts (freezes) the amount from `wallets.balance` immediately on submit, with rollback if the DB insert fails. Updated `wallet.html` to call this function instead of inserting into `withdrawal_requests` directly. Updated `functions/api/admin/withdrawal-action.js` reject branch to refund the frozen amount back to balance (approve no longer touches balance since it's already deducted at request time).
- Fixed "logged out when clicking View listings" bug: `listings.html` (at `/listings`) had no auth-aware nav — it always showed Sign in/Get started. Added Supabase client + `initNav()` IIFE to detect the session and render the user dropdown if logged in.



### 2026-06-03 (session 2)
- Created `profile.html` — user's own public profile page at `/profile`.
- Profile shows: avatar, username, member-since date, listing count, bio (editable inline), active listings grid, reviews empty state.
- Bio stored in Supabase `user_metadata.bio` via `sb.auth.updateUser`.
- Listings fetched from `listings` table filtered by `seller_id = user.id`.
- Reviews section shows honest empty state (reviews feature not built yet).
- Page redirects to `/login` if not authenticated.

### 2026-06-03
- Created project memory system: `CLAUDE.md`, `decision.md`, `memory.md`.
- Recorded full snapshot of the app as built so far (see Current State above).
- Confirmed stack: Cloudflare Pages + Supabase + Resend + Cloudflare Functions.
- Noted open items: payments provider, mobile-app approach, RLS on future tables, remove debug endpoint.

<!--
TEMPLATE — copy this for each new working session:

### YYYY-MM-DD
- What I changed:
- New files/functions/tables:
- Anything broken / to fix next:
- Decisions made (also add to decision.md if significant):
-->
