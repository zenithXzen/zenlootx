# ZenLootX — Memory & Change Log

> **Purpose:** Persistent memory across `/clear`. At the start of any session, read this to know the current state. Whenever you make changes, add a new dated entry under "Change Log" (newest at top).
>
> **Owner context:** New to coding, strong at marketing. Explain simply; confirm before big or irreversible steps.

---

## 📍 Current State (snapshot — last updated 2026-06-08)

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
- Browse listings (Genshin, MLBB, Valorant) with real-time sold updates — expired listings filtered out
- Listing detail page with buy flow + real-time availability
- Create listing (server-side, sellers only, input validation, up to 10 images, 30-day expiry set on creation)
- Listing expiry: listings expire after 30 days; sellers can renew from dashboard (Renew button appears ≤7 days left)
- Wallet: balance display, top-up requests, transaction history, withdrawals
- Purchase flow: atomic buy via Postgres `purchase_listing` RPC (row-level locks, no double-spend)
- Escrow system: holding → confirmed → released; auto-releases after 72h if no dispute or manual release
- Orders page: buyer + seller views, file dispute, release payment, countdown timer showing time until auto-release
- Messaging: real-time conversations, read receipts, unread badge in nav
- Notifications: in-app + email via Resend, real-time unread badge
- Seller onboarding: application flow with ID upload
- Disputes: file dispute, admin resolution
- Admin panel: manage users, freeze/ban, review applications, resolve disputes, top-up actions, send notifications
- Public profile: avatar, bio, tier badge, verified seller badge, active listings (limit 20), reviews, XSS-safe
- Seller dashboard: stats, chart, active/inactive listings only (sold hidden), expiry column, recent sales
- Tier system: Iron → Bronze → Silver → Gold → Sapphire → Diamond (based on transaction volume + reviews)
- Push notifications (Web Push / VAPID): order placed → seller notified; payment released → seller notified; dispute opened → both parties notified. Full aes128gcm encryption, no npm deps, all via Web Crypto API in Cloudflare Workers.
- Terms of Service + Privacy Policy (up to date as of 2026-06-06)
- Report listing: buyers can report fraudulent listings (duplicate prevention, goes to admin queue)

**Supabase tables (confirmed)**
- `user_sessions` (RLS ✅)
- `profiles` (RLS ✅)
- `listings` (RLS ✅, realtime enabled) — `expires_at` column added (30-day expiry)
- `orders` (RLS ✅)
- `wallets` (RLS ✅)
- `transactions` (RLS ✅) — `hold_until` column added (not actively used — feature removed at owner request)
- `messages` (RLS ✅)
- `conversations` (RLS ✅, realtime enabled)
- `notifications` (RLS ✅, realtime enabled)
- `seller_applications` (RLS ✅)
- `disputes` (RLS ✅)
- `reviews`
- `email_rate_limits` (RLS ✅) — also used for verify-code attempt tracking (prefix `vfy::`)
- `push_subscriptions` (RLS ✅, service key only) — ⚠️ must be created manually in Supabase (see 2026-06-09 session notes)
- `withdrawal_requests`

**Supabase SQL functions**
- `get_email_by_username` — username → email lookup for login
- `purchase_listing(p_buyer_id, p_listing_id)` — atomic purchase RPC with row locks

**Storage buckets**
- `avatars` (public) — user profile photos
- `listing-images` (public) — listing screenshots
- `id_documents` (private) — seller verification IDs

**Cloudflare env vars set**
`RESEND_API_KEY` · `HMAC_SECRET` · `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_KEY` · `ADMIN_BYPASS_SECRET` · `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY`
- VAPID_PUBLIC_KEY = `BKUJriuZ7hXGLjRGvL0uvAkUlIwZJTvbZv4XFaDZGhn7kF09FLORhRgVag3kkdC3tFuSNJBjMOW6tQjYGK37g5o`
- VAPID_PRIVATE_KEY = `6RzCHCpmeU5nitmPa-ThOvh99kf9tHRD5QkU768tAOM`
⚠️ VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be added to Cloudflare Pages Settings → Environment Variables before push notifications work.

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

**Not built yet (priority order)**
1. Fee system — ZenLootX earns ₱0 per trade. Needs platform % cut inside `purchase_listing` RPC.
2. Admin analytics dashboard — GMV, new users, dispute rate, earnings
3. MFA / 2FA for sellers — TOTP option for high-value accounts
4. Search on listings — full-text keyword search across titles/descriptions
5. Referral system (₱50-per-referral) — intentionally deferred
6. Favorites / saved listings — intentionally deferred
7. Real payment processing — provider undecided (see decision.md D-022)
8. Mobile PWA wrapping — intentionally deferred

---

## 🗓️ Change Log (newest first)

### 2026-06-09 (push notifications + mobile audit)
- **Web Push notifications (full VAPID + aes128gcm):** Created `functions/api/push-helper.js` — complete Web Push implementation using only Web Crypto API (no npm). Exports `sendPushToUser(userId, env, {title,body,url})`. Reads subscriptions from Supabase `push_subscriptions` table, encrypts payload per RFC 8291, signs VAPID JWT, posts to browser push endpoint.
- **Push wired into 3 events:** `purchase.js` → seller notified when listing sold; `release-payment.js` → seller notified when payment released; `file-dispute.js` → both buyer and seller notified when dispute opened.
- **Push subscription endpoint:** `functions/api/push/subscribe.js` updated to store `endpoint` as a separate column alongside the subscription JSON — required for `unique(user_id, endpoint)` upsert to work with PostgREST.
- **Push registration in nav.js:** Moved from one-off in `index.html` to `initNav()` call in `nav.js` → every logged-in page now registers the service worker and subscribes. VAPID public key updated to new key.
- **Mobile audit completed:** Checked all 28 pages. Pages already mobile-friendly: messages, wallet, orders, create-listing, notifications, account, profile, index, listings/* (all have breakpoints). Fixed: seller-dashboard.html (table overflow + column hiding at 480px/768px), wallet.html (tx-row too cramped at 360px → hide status badge, shrink icon/text at ≤600px), listings/detail.html (detail-grid collapses to 1 col at 900px).
- **⚠️ Pending manual steps (user must do):**
  1. Run SQL in Supabase to create `push_subscriptions` table (see TEST 050 setup below)
  2. Add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to Cloudflare Pages env vars

### 2026-06-08 (seller unresponsive escalation)
- **Feature #3 — Seller unresponsive escalation:** Created `functions/api/notify-unresponsive-sellers.js`. When either party visits /orders, it silently checks for orders in `holding` that are 24–72 hours old. For each unnotified order, it sends: (1) a `seller_reminder` notification to the seller warning them the buyer may dispute, and (2) a `seller_reminder` notification to the buyer telling them they can now dispute. Uses the notification `link` field as the idempotency key so each order only gets one reminder. Buyer's Orders page also shows a yellow warning banner on any holding order that's 24+ hours old.

### 2026-06-08 (security hardening session — round 2)
- **Reverted reset link to 15 min:** Owner preference. Reverted 300000 → 900000 in send-reset.js and reset-password.js; UI text back to "15 minutes".
- **CSP fixed for Cloudflare analytics:** Added `https://static.cloudflareinsights.com` to script-src and `https://cloudflareinsights.com` to connect-src. Cloudflare Pages injects a beacon script automatically which was being blocked.
- **Login wall added to all listings pages:** Unauthenticated users visiting /listings, /listings/genshin, /listings/mlbb, /listings/valorant, or /listings/detail are now redirected to /login. Changed listings.html, listings/listings.js (initNav), and listings/detail.html.
- **Message button added to orders page:** Purchases, Sales, and Disputes tabs now all have a "💬 Message [Seller/Buyer]" button that opens /messages?with=<otherId>. Disputes query updated to include buyer_id and seller_id so the correct other party is identified.

### 2026-06-08 (security hardening session)
- **Fix #3 — Dispute amount validation:** `file-dispute.js` now fetches `amount` from the order row and validates `amount > 0` before a dispute can be filed. Prevents zero-refund disputes.
- **Fix #4 — Username lookup rate limiting:** `check-username.js` now rate-limits by IP (10 checks per minute per IP) using the `email_rate_limits` table with key prefix `ipck::`. Blocks user enumeration via brute-force username lookup.
- **Fix #5 — Reset link window 15 min → 5 min:** `send-reset.js` and `reset-password.js` both changed from 900000ms (15 min) to 300000ms (5 min) window. `forgot-password.html` and the reset email template updated to say "5 minutes".
- **Fix #6 — Email enumeration in reset-password.js:** "Account not found." 404 response changed to "Reset link is invalid or has expired." 400 — same generic message used for all failure modes.
- **Fix #7 — CSP + security headers:** `_headers` now includes `Content-Security-Policy` (script/style unsafe-inline, Google Fonts, Supabase origin, JSDelivr CDN, WSS for realtime), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Fix #2 — Admin audit log:** All 9 admin action files updated. `verifyAdmin()` now returns the user object (not just true/false). Added `logAdminAction()` helper to all admin files. Every action (ban, unban, freeze, unfreeze, dispute resolve, topup approve/reject, withdrawal approve/reject, seller approve/reject, delete listing, dismiss report, send notification) is logged to `admin_logs` table with: admin_id, action name, target_id, target_type, details JSON, timestamp. **SQL must be run in Supabase — see session notes below.**
- **SQL to run:** Create `admin_logs` table (see instructions in session response).
- **Security status note:** Issue #1 (verify-code brute force) was already fixed 2026-06-07. Issue #6 (email enumeration on send-reset) was already handled — frontend always shows success regardless of API response.

### 2026-06-07
- **Feature 1 — Auto-release escrow:** Created `functions/api/auto-release-orders.js`. Orders in `holding` for 72+ hours with no open dispute are automatically released when either party visits the orders page. Seller and buyer both receive in-app notifications. Auto-released funds also get a 72h `hold_until` on the seller credit transaction.
- **Feature 3 — Verify-code rate limiting:** `verify-code.js` now tracks failed code attempts in `email_rate_limits` table under key `vfy::${email}`. Max 5 wrong attempts per 10 minutes → 429 error with clear message.
- **Feature 5 — Seller withdrawal hold period:** `release-payment.js` now stamps `hold_until = now + 72h` on the seller's credit transaction when payment is released. `request-withdrawal.js` calculates held amount and subtracts from available balance. Sellers see a clear error message if trying to withdraw held funds.
- **Feature 7 — Listing expiry (30 days):** `create-listing.js` now sets `expires_at = now + 30 days` on every new listing. `listings.js` browse query filters out expired listings. `seller-dashboard.html` shows expiry days and a "Renew" button for listings expiring within 7 days. `functions/api/renew-listing.js` created — extends expiry by 30 days.
- **SQL run in Supabase:** `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS hold_until timestamptz` · `ALTER TABLE listings ADD COLUMN IF NOT EXISTS expires_at timestamptz`

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
