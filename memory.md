# ZenLootX — Memory & Change Log

> **Purpose:** Persistent memory across `/clear`. At the start of any session, read this to know the current state. Whenever you make changes, add a new dated entry under "Change Log" (newest at top).
>
> **Owner context:** New to coding, strong at marketing. Explain simply; confirm before big or irreversible steps.

---

## 📍 Current State (snapshot — last updated 2026-06-06)

**Live stack**
- Frontend: Static HTML/CSS/JS (Vite) — Geist font, dark theme (accent `#19C37D`)
- Hosting: Cloudflare Pages (repo `zenithXzen/zenlootx`)
- Domain: zenlootexchange.com (Namecheap registrar → Cloudflare DNS)
- Auth + DB: Supabase (PostgreSQL)
- Email: Resend (custom HMAC-signed 6-digit code flow, stateless)
- Backend: Cloudflare Pages Functions (`/functions/api/`)

**Pages that exist (28 pages)**
`/` · `/login` · `/register` · `/forgot-password` · `/reset-password` · `/account` · `/profile` · `/public-profile` · `/listings` · `/listings/genshin` · `/listings/mlbb` · `/listings/valorant` · `/listings/detail` · `/create-listing` · `/sell` · `/seller-dashboard` · `/orders` · `/wallet` · `/messages` · `/disputes` · `/notifications` · `/admin` · `/about` · `/contact` · `/how-it-works` · `/escrow` · `/terms` · `/privacy` · `/banned`

**Working features**
- Landing page, auth-aware nav, register/login (email or username), forgot/reset password
- Email verification via HMAC-signed 6-digit code (Resend)
- Account page: avatar upload, bio, username change (once), email/password change, sessions + remote sign-out
- Browse listings (Genshin, MLBB, Valorant) with real-time sold updates
- Listing detail page with buy flow + real-time availability
- Create listing (server-side, sellers only, input validation, up to 10 images)
- Wallet: balance display, top-up requests, transaction history, withdrawals
- Purchase flow: atomic buy via Postgres `purchase_listing` RPC (row-level locks, no double-spend)
- Escrow system: holding → delivered → confirmed → released
- Orders page: buyer + seller views, file dispute, release payment
- Messaging: real-time conversations, read receipts, unread badge in nav
- Notifications: in-app + email via Resend, real-time unread badge
- Seller onboarding: application flow with ID upload
- Disputes: file dispute, admin resolution
- Admin panel: manage users, freeze/ban, review applications, resolve disputes, top-up actions, send notifications
- Public profile: avatar, bio, tier badge, verified seller badge, active listings (limit 20), reviews, XSS-safe
- Tier system: Iron → Bronze → Silver → Gold → Sapphire → Diamond (based on transaction volume + reviews)
- Push notification subscriptions
- Terms of Service + Privacy Policy (up to date as of 2026-06-06)

**Supabase tables (confirmed)**
- `user_sessions` (RLS ✅)
- `profiles` (RLS ✅)
- `listings` (RLS ✅, realtime enabled)
- `orders` (RLS ✅)
- `wallets` (RLS ✅)
- `transactions` (RLS ✅)
- `messages` (RLS ✅)
- `conversations` (RLS ✅, realtime enabled)
- `notifications` (RLS ✅, realtime enabled)
- `seller_applications` (RLS ✅)
- `disputes` (RLS ✅)
- `reviews`
- `email_rate_limits` (RLS ✅, auto-deletes after 10 min)
- `withdrawal_requests`

**Supabase SQL functions**
- `get_email_by_username` — username → email lookup for login
- `purchase_listing(p_buyer_id, p_listing_id)` — atomic purchase RPC with row locks

**Storage buckets**
- `avatars` (public) — user profile photos
- `listing-images` (public) — listing screenshots
- `id_documents` (private) — seller verification IDs

**Cloudflare env vars set**
`RESEND_API_KEY` · `HMAC_SECRET` · `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_KEY` · `ADMIN_BYPASS_SECRET`

**Security status (full audit completed 2026-06-06)**
- C1–C4 (Critical): ALL FIXED ✅
- H1–H7 (High): ALL FIXED ✅ (H4 via Postgres RPC, H6 via email_rate_limits table)
- M1 (Email regex): FIXED ✅
- M2 (Silent catch blocks): Partially fixed (detail.html, public-profile.html)
- M3 (Listings pagination): FIXED ✅ (limit 20)

**⚠️ Known cleanups / risks**
- `debug-user.js` temp endpoint → **remove before launch**
- M2 (silent catch blocks) not fully fixed across all pages — add error toasts on remaining pages before launch
- Payments provider not yet integrated (wallet top-up is manual admin action for now)

**Not built yet**
- Real payment processing integration (provider undecided — see D-016 in decision.md)
- Referral system (₱50-per-referral) — intentionally deferred
- Favorites / saved listings — intentionally deferred
- Mobile PWA wrapping — intentionally deferred

---

## 🗓️ Change Log (newest first)

### 2026-06-06 (animations session)
- **CSS View Transitions** added to all pages via `nav.js`: `@view-transition { navigation: auto }` — cross-document page-fade (slide up-out / slide down-in, 0.16s/0.22s). Chrome 126+; silent fallback on other browsers.
- **Scroll reveal** (`zlx-reveal` + `zlx-in`) added via Intersection Observer in `nav.js`. Elements fade + slide up when they enter the viewport. Delay variants: `zlx-d1` (70ms), `zlx-d2` (140ms), `zlx-d3` (210ms), `zlx-d4` (290ms).
- **Card stagger** (`zlx-stagger`, CSS `animation-delay: calc(var(--si) * 55ms)`) added to listing cards in `listings.js`. Index `i` passed via `Array.map` — first 8 cards stagger in, rest appear together.
- **Fixed syntax error** in `listings.js` `renderCard` — stray backtick was prematurely closing the template literal at the opening `<div>` tag. Removed.
- **index.html** — `zlx-reveal` classes added to: hero h1, hero-sub, hero-cta, hero-stats (delays d1–d3); section headers + step cards (staggered d1–d2); trust cards (staggered d1–d2); CTA banner.
- Also injected in `nav.js`: listing card hover lift (translateY -5px, green border glow), skeleton shimmer for loading states, `.btn:active` press scale (0.96).

### 2026-06-06 (security audit + polish session)
- **Full codebase security audit** completed. Findings grouped as Critical (C1–C4), High (H1–H7), Medium (M1–M3).
- **C1 + C4 fixed:** Admin bypass (`?admin=on`) now requires matching `ADMIN_BYPASS_SECRET` env var. Added to `_middleware.js`. Also added `ADMIN_BYPASS_SECRET` as a Cloudflare env var.
- **C2 fixed:** JWT verification in `check-session.js`, `track-session.js`, `get-sessions.js`, `revoke-session.js` — all now verify the token via Supabase `/auth/v1/user` endpoint instead of `atob()` decode. Forged JWTs are rejected.
- **C3 fixed:** `check-session.js` now matches sessions by `sessionRowId` (stored in localStorage and passed as a query param) instead of user-agent string, which was fakeable.
- **H1 fixed:** XSS in `public-profile.html` — added `sanitize()` helper; applied to seller bio and all review comments.
- **H2 fixed (non-issue):** `account.html` does not inject bio as innerHTML — original audit finding was a false positive.
- **H3 fixed:** `create-listing.js` now validates `game`, `type`, `currency` against allowed-values lists; enforces title max 100 chars, description max 2000 chars, price max ₱500,000, max 10 images.
- **H4 fixed:** Race condition in `purchase.js` — replaced vulnerable two-step balance-check+PATCH with a call to new Postgres RPC `purchase_listing(p_buyer_id, p_listing_id)`. The function uses `FOR UPDATE` row locks on both the listing and wallet rows, deducts balance using DB arithmetic, marks listing sold, and creates the order — all in one atomic transaction. SQL was run in Supabase. Two simultaneous buyers can no longer both succeed.
- **H5 fixed:** `create-listing.js` now checks `is_frozen` flag and rejects listing creation for frozen sellers.
- **H6 fixed:** Rate limiting added to `send-code.js` and `send-reset.js` — max 5 emails per address per 10 minutes tracked via `email_rate_limits` table. Table confirmed to already exist in Supabase.
- **H7 confirmed fixed:** `public-profile.html` already queries `seller_applications` with `.eq('status','approved')` — verified badge is correctly gated on approved status.
- **M1 fixed:** Email validation in `send-code.js`, `send-reset.js`, and `register.html` now uses proper regex `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` instead of just checking for `@`.
- **Register page fix:** Validation now shows specific error per field — "Please enter a valid email address." / "Please enter a username." / "Password must be at least 8 characters." — instead of one generic message for all failures.
- **Bio + avatar sync fixed:** `profile.html` now writes `bio` to both `user_metadata` and `profiles` table. `account.html` writes `avatar_url` to both `user_metadata` and `profiles` table. Both required because `public-profile.html` reads from `profiles`, not `user_metadata`.
- **M2 partially fixed:** `detail.html` delist/delete catch block now shows a toast error. `public-profile.html` shows "Could not load listings" panel when listings fetch fails instead of blank.
- **M3 fixed:** Listings query in `public-profile.html` now has `.limit(20)`.
- **Terms of Service updated:** Added Section 7 (Wallet & Top-Up), Section 11 (Account Restrictions — frozen/suspended/banned). Updated escrow flow, added tier system mention, added ₱500,000 listing cap, updated all dates to June 6, 2026.
- **Privacy Policy updated:** Added rows to data table for wallet/financial info, session & device info, notification data, tier & activity data, email rate data. Section 8 renamed to "Cookies & Local Storage" — accurately explains localStorage tokens, session row ID, HttpOnly cookies, and confirms no tracking/analytics scripts. Updated dates to June 6, 2026.
- **Tests passed:** TEST 001–022 all approved. TEST 023 N/A (delist removed from site). TEST 024–026 approved.

### 2026-06-04 (session 4)
- Created `about.html` — About page with mission statement, supported games, and values. Fixes 404 on `/about` footer link.
- Created `contact.html` — Contact page with four contact cards (general support, disputes, seller applications, abuse). Email addresses use `@zenlootexchange.com` domain. Fixes 404 on `/contact` footer link.
- Updated `disputes.html` — Added a "My Disputes" live section at the top. Queries `disputes` table where `filed_by = user.id`, renders status badges (Under Review / Refunded / Released to Seller / Resolved), shows reason preview, order ID, time ago, and resolution outcome. Section is hidden for logged-out visitors. Static info content preserved below.
- Created `functions/api/upload-listing-image.js` — Server-side image upload proxy for listing images. Verifies seller auth, enforces 5 MB limit and path scoping, uploads to `listing-images` bucket using SUPABASE_SERVICE_KEY, returns public URL. Updated `create-listing.html` to call this instead of direct browser storage upload.
- Created `functions/api/upload-id-doc.js` — Server-side upload proxy for seller ID documents. Verifies auth, enforces 10 MB limit, uploads to `id_documents` bucket (private) using service key, returns path only (no public URL). Updated `sell.html` to call this instead of direct browser storage upload.
- Created `functions/api/file-dispute.js` — Server-side dispute handler. Verifies auth, confirms user is buyer/seller of the order, inserts into `disputes` table, and updates `orders.escrow_status` to 'disputed' — all via service key. Fixes security issue where the browser was directly modifying escrow_status via anon key. Updated `orders.html` to call this function.
- NOTE: Both `listing-images` and `id_documents` storage buckets must exist in Supabase (Storage dashboard). `listing-images` should be public; `id_documents` should be private (no public read). `disputes` table also needs an RLS SELECT policy: `filed_by = auth.uid()` for the My Disputes section to show data.
- Created `functions/api/create-listing.js` — listing creation now fully server-side (service key). Validates seller + frozen status. Inserts listing + notification. `create-listing.html` now calls `/api/create-listing` instead of direct Supabase client writes.
- RLS enabled on `notifications` (SELECT own, UPDATE own, DELETE own) and `seller_applications` (SELECT own, INSERT own) via SQL run in Supabase. All 3 medium-severity issues (#6, #7, #8) from the audit are now resolved.

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
