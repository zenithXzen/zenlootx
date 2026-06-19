# ZenLootX — Memory & Change Log

> **Purpose:** Persistent memory across `/clear`. At the start of any session, read this to know the current state. Whenever you make changes, add a new dated entry under "Change Log" (newest at top).
>
> **Owner context:** New to coding, strong at marketing. Explain simply; confirm before big or irreversible steps.
>
> **Housekeeping rule:** Keep this file's Change Log to roughly the last 10–12 entries / most recent couple of weeks of work. When it grows past that, move the oldest entries to `memory-archive.md` (newest-first there too) and leave a one-line pointer here. The "Current State" snapshot below must always reflect what's actually live — update it every session, not just the log.

---

## 📍 Current State (snapshot — last updated 2026-06-18)

**Live stack**
- Frontend: Static HTML/CSS/JS (Vite) — Geist font, dark theme (accent `#19C37D`)
- Hosting: Cloudflare Pages (repo `zenithXzen/zenlootx`)
- Domain: zenlootexchange.com (Namecheap registrar → Cloudflare DNS)
- Auth + DB: Supabase (PostgreSQL)
- Email: Resend (custom HMAC-signed 6-digit code flow, stateless)
- Backend: Cloudflare Pages Functions (`/functions/api/`, ~53 route files)

**Pages that exist (29 pages)**
`/` · `/login` · `/register` · `/forgot-password` · `/reset-password` · `/account` · `/profile` · `/public-profile` · `/listings` · `/listings/genshin` · `/listings/mlbb` · `/listings/valorant` · `/listings/detail` · `/create-listing` · `/sell` · `/seller-dashboard` · `/orders` · `/wallet` · `/messages` · `/disputes` · `/notifications` · `/admin` · `/about` · `/contact` · `/how-it-works` · `/escrow` · `/terms` · `/privacy` · `/banned`

**Working features**
- Landing page, auth-aware nav, register/login (email or username), forgot/reset password
- Email verification via HMAC-signed 6-digit code (Resend)
- Account page: avatar upload, bio, username change (once), email/password change, sessions + remote sign-out
- Browse listings (Genshin, MLBB, Valorant) with real-time sold updates — expired listings filtered out
- Listing detail page with buy flow + real-time availability
- Create listing (server-side, sellers only, input validation, up to 10 images, 30-day expiry set on creation). Price is PHP-only — USD/SGD/MYR are visibly disabled as "Coming soon."
- Listing expiry: listings expire after 30 days; sellers can renew from dashboard (Renew button appears ≤7 days left)
- Wallet: balance display, top-up requests (manual admin approval), transaction history, withdrawals via GCash/Maya/Bank/Binance/Wise. Wise withdrawal collects: destination currency (dropdown of ~48 currencies Wise can convert PHP into), bank/e-wallet name, full name, account number/IBAN, and an optional "additional details" field for SWIFT/branch/routing info.
- Purchase flow: atomic buy via Postgres `purchase_listing` RPC (row-level locks, no double-spend)
- Escrow system: holding → confirmed → released; auto-releases after 72h if no dispute or manual release
- Orders page: buyer + seller views, file dispute, release payment, countdown timer showing time until auto-release, yellow warning banner on holding orders 24h+ old
- Messaging: real-time conversations, read receipts, unread badge in nav
- Notifications: in-app + email via Resend, real-time unread badge
- Seller onboarding: application flow with ID upload
- Disputes: file dispute, admin resolution
- Admin panel: manage users, freeze/ban, review applications, resolve disputes, top-up actions, send notifications, message any user (auto-creates a conversation if none exists)
- Public profile: avatar, bio, tier badge, verified seller badge, active listings (limit 20), reviews, XSS-safe
- Seller dashboard: stats, chart, active/inactive listings only (sold hidden), expiry column, recent sales, reminder to delete listings sold off-platform
- Tier system: Iron → Bronze → Silver → Gold → Sapphire → Diamond (based on transaction volume + reviews)
- Push notifications (Web Push / VAPID): order placed → seller notified; payment released → seller notified; dispute opened → both parties notified. Full aes128gcm encryption, no npm deps, all via Web Crypto API in Cloudflare Workers.
- 5% platform fee: charged at release time (not at purchase), shown transparently to sellers in listing preview, listing detail, and emails. Logged per-sale to `platform_earnings`.
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
- `reviews` — ⚠️ RLS status not confirmed in this file, verify in Supabase before launch
- `email_rate_limits` (RLS ✅) — also used for verify-code attempt tracking (prefix `vfy::`) and per-IP username-lookup throttling (prefix `ipck::`)
- `push_subscriptions` (RLS ✅, service key only)
- `withdrawal_requests` — ⚠️ RLS status not confirmed in this file, verify in Supabase before launch
- `platform_earnings` (RLS ✅, admin only) — logs every completed sale: gross_amount, fee_percent, fee_amount, net_amount per order
- `topup_requests` (RLS ✅) — user top-up requests, pending/approved/rejected
- `admin_logs` (RLS ✅, admin only) — audit log for all 9 admin actions

**Supabase SQL functions**
- `get_email_by_username` — username → email lookup for login
- `purchase_listing(p_buyer_id, p_listing_id)` — atomic purchase RPC with row locks

**Storage buckets**
- `avatars` (public) — user profile photos
- `listing-images` (public) — listing screenshots
- `id_documents` (private) — seller verification IDs

**Cloudflare env vars set**
`RESEND_API_KEY` · `HMAC_SECRET` · `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_KEY` · `ADMIN_BYPASS_SECRET` · `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY`
⚠️ VAPID keys rotated 2026-06-09 (old private key was accidentally committed). New values are in Cloudflare env vars only — never store key values in this file.

**Security status**
- C1–C4 (Critical), H1–H7 (High), M1 (email regex), M3 (listings pagination): all fixed ✅ — see decision.md D-010, D-015 through D-020.
- M2 (silent catch blocks): still only partially fixed (detail.html, public-profile.html). Other pages may swallow API errors without telling the user.

**⚠️ Known cleanups / risks**
- `reviews` and `withdrawal_requests` tables don't show a confirmed RLS marker — verify and enable in Supabase before launch (see decision.md D-010).
- M2 (silent catch blocks) not fully fixed across all pages — add error toasts on remaining pages before launch.
- Two backend files hardcode the owner's personal Gmail address as the VAPID "subject" sent in push-notification headers: `functions/api/push-helper.js` (canonical sender) and `functions/api/push/test.js` (debug endpoint, not yet confirmed for deletion — see decision.md D-022 area). Low risk, but should move to an env var (e.g. `VAPID_SUBJECT`) next time push code is touched.
- `functions/api/admin/freeze-user.js`'s seller-balance-deduction block still does manual read-then-PATCH instead of the atomic `incrementBalance` RPC helper (same race risk pattern fixed elsewhere 2026-06-19) — not yet fixed, wasn't in that session's approved scope.
- Phase 5 of the 2026-06-19 cleanup plan (tier system, currency/date/status formatters, isBanned/timeAgo helpers — still duplicated across several pages) not started yet.
- Payments provider not yet integrated (wallet top-up is manual admin action for now) — see decision.md D-022.

**Not built yet (priority order)**
1. ~~Fee system~~ — ✅ DONE. 5% platform fee applied at release. `platform_earnings` table logs every sale.
2. Admin analytics dashboard — GMV, new users, dispute rate, earnings
3. MFA / 2FA for sellers — TOTP option for high-value accounts
4. Search on listings — full-text keyword search across titles/descriptions
5. Referral system (₱50-per-referral) — intentionally deferred
6. Favorites / saved listings — intentionally deferred
7. Real payment processing — provider undecided (see decision.md D-022)
8. Mobile PWA wrapping — intentionally deferred

---

## 🗓️ Change Log (newest first)

> Older entries live in **`memory-archive.md`** once this list passes ~10–12 entries. Currently archived: the 2026-06-03 and 2026-06-04 sessions.

### 2026-06-20 (live-site test pass on Phases 1–4 — found and fixed a real money bug)
Owner ran TEST 051–066 against the live site after the 2026-06-19 cleanup deployed. Results: most passed; 3 issues raised, 1 was a genuine bug, 1 was a wrong test instruction (not a code bug), 1 was a one-line content removal. 3 items deferred to a later UI/mobile redesign pass (not bugs — owner plans to redesign messages.html spacing, login.html error styling, and add horizontal swipe to the 3 listing pages).

**Real bug fixed — dispute resolution didn't claw back seller's balance ([functions/api/admin/resolve-dispute.js](functions/api/admin/resolve-dispute.js#L34)):** Filing a dispute (`file-dispute.js`) always overwrites `orders.escrow_status` to `'disputed'`, even on an already-released order (it only blocks filing on `'disputed'/'refunded'/'cancelled'`, not `'released'`). `resolve-dispute.js` was using `order.escrow_status === 'released'` to decide whether the seller's spendable balance needed clawing back when refunding the buyer — but by resolution time that flag was always `'disputed'`, so it always took the "never released" branch and skipped the clawback. Net effect: buyer got refunded in full AND seller kept the money they'd already been paid — a real double-payout. Fixed by checking the `transactions` ledger for an actual `type='credit'` row for that order+seller (ground truth of whether money moved) instead of trusting `escrow_status`. TEST 056 failed before this fix; needs retest.

**Not a bug — test instruction was wrong:** TEST 052's "click Dismiss" was inaccurate; the actual button on a pending report is labeled **"Mark reviewed"** (`admin.html:884`). The dismiss-report backend code and logging were already correct. Owner couldn't find a "Dismiss" button so never triggered the action, which is also why no `admin_logs` row appeared. Needs retest with the correct button.

**Content removal:** `sell.html` — removed the "Contact support" mailto button from the rejected-application screen, keeping only "Re-apply" (TEST 051).

**Deferred to redesign pass (not fixed, owner's explicit choice):** `messages.html` mobile spacing (buttons/names crowding the screen on phone), `login.html` error message styling, `listings/genshin.html`/`mlbb.html`/`valorant.html` — owner wants horizontal swipe/slide instead of current layout.

**Retest results (same day):** TEST 056 and TEST 052 both passed after the fixes above.

**Phase 3/4 test results — TEST 067–074:** TEST 068, 070, 071, 074 passed. TEST 067 (ban user) and TEST 069 (seller application approve/reject) intentionally skipped by owner — only has 1 test device/account, can't safely test account-locking actions without risking their own access. TEST 073 not yet tested. **TEST 072 failed — push notifications not arriving** (covers both the order-released push and admin broadcast push, both built on the same `functions/api/push-helper.js` sender consolidated in Phase 3).

**TEST 072 diagnosis — root-caused, likely already fixed, needs final retest.** Used Playwright MCP (now active) to log into zenlootexchange.com as the test account, pull the Supabase access token from `localStorage`, and POST it to `/api/push/test`. Result: `subscriptions_found: 1`, `fcmStatus: 201`, `err: null` — the test push was actually delivered and received on the owner's device. This proves the push sender itself (VAPID JWT signing, aes128gcm encryption, FCM delivery in `push-helper.js`) works correctly right now, and all three real call sites (`order-released.js`, `release-payment.js`, `admin/send-notification.js`) call that exact same helper — so there's no code bug left to fix there.

Most likely explanation for the original TEST 072 failure: it was run with a subscription row created by `profile.html`'s old standalone `initPush()`, which used a **stale, pre-rotation VAPID key** (see Phase 4 entry below, fixed 2026-06-19). That subscription would have silently failed to deliver. Once any page using the shared `nav.js` was visited, the browser silently re-subscribed with the correct key — which is why the test push just now succeeded.

**Not fully closed:** couldn't verify the `admin/send-notification.js` broadcast path end-to-end — the test account isn't an admin, so the actual admin UI broadcast flow wasn't fired live. Code is identical to the proven path, but TEST 076 below should confirm it for real.

### 2026-06-19 (full codebase cleanup: bug fixes + dead code + duplication consolidation, Phases 1–4)
Approved plan: `bug fixes + safe deletions + duplication consolidation` (6-part parallel audit → fix). Tests for this session start at **TEST 051**.

**Phase 1 — real bugs fixed:**
- `sell.html` — "Re-apply" crash fixed (`const formData` reassignment → cleared in place instead).
- `admin.html` — `dismissReport()` now calls `/api/admin/dismiss-report` instead of writing to Supabase directly, so it gets logged to `admin_logs` like every other admin action.
- `profile.html` — removed the broken "Report user" button/modal entirely (it was reporting yourself — `reporter_id === reported_user_id`, no real target ID was ever available on your own profile page).
- **Money atomicity:** `release-payment.js`, `auto-release-orders.js`, `resolve-dispute.js` now use the `increment_balance` Postgres RPC for every wallet balance mutation instead of "read balance → add/subtract in JS → PATCH" — removes a lost-update race where two near-simultaneous mutations could overwrite each other.
- `notifications.html` and `nav.js` notification queries now have explicit `.eq('user_id', user.id)` as defense-in-depth.

**Phase 2 — safe dead-code deletions (zero behavior change):** removed unused `getDeviceInfo()`/`trophySVG()` (account.html), a no-op self-assignment (public-profile.html), dead placeholder vars (messages.html, orders.html), the fully-dead login attempt-badge (login.html), unused `--game-color` CSS vars (3 listing pages), a dead branch in admin.html, two dead blocks in sell.html, the empty `claude_new_extracted/` folder, the orphaned `functions/api/check-email.js`, and the top-level `listings.html` redirect shim (index.html's 4 links now point straight at `/listings/genshin`, `/listings/mlbb`, `/listings/valorant`).

**Phase 3 — backend duplication consolidated into `functions/api/admin/_shared.js`:**
- New shared exports: `verifyAdmin` (standardized on the user-object-returning variant, since 9+ callers need `admin.id`), `logAdminAction`, `notify` (link param now **required**, no more inconsistent `/wallet` vs `/orders` defaults), `sb`, and `incrementBalance` (atomic RPC wrapper with manual-fallback) — replacing copies that were duplicated across all 14 `functions/api/admin/*.js` files.
- `functions/api/push-helper.js` gained a new `sendPushToUsers(userId, env, notification)` export (userId optional → broadcasts to everyone, returns `{sent, total}`), built on a shared internal sender so the VAPID-JWT-signing/aes128gcm-encryption code (~90–130 lines) no longer needed separate copies in `functions/api/hooks/order-released.js` and `functions/api/admin/send-notification.js` — both now just import and call it. Net effect: the owner's personal Gmail (used as the VAPID push "subject") now only appears in 2 files instead of 3 (`push-helper.js` canonical + the still-untouched `push/test.js` debug endpoint).
- `freeze-user.js`'s seller-balance-deduction block still does manual read-then-PATCH (same race pattern as the 3 files fixed in Phase 1) — **left untouched**, wasn't in the originally-approved scope. Flagged here as a candidate for a follow-up fix, not done yet.

**Phase 4 — frontend `initNav` consolidation (the riskiest part of this session):**
- `profile.html` had its own stripped-down copy of the nav dropdown (missing heartbeat, message/notification badges, frozen-account banner) plus a separate `initPush()` using a **stale, pre-rotation VAPID key**. Deleted both; the page now calls the shared `initNav(user)` from `nav.js` (already loaded via `<script src="/nav.js?v=4">`), which restores all of the above for free and fixes the stale-key bug as a side effect.
- `listings/listings.js` (powers `/listings/genshin`, `/listings/mlbb`, `/listings/valorant`) had the same problem, but worse: **`nav.js` wasn't even loaded on those three pages** — they had no `<script src="/nav.js">` tag at all, hence the full local reimplementation. Added the nav.js script tag to all 3 HTML shells (before `listings.js`), renamed the local function to `initNavGate()` (does the session check + redirect-to-login, exactly like it did before) which now calls the shared `initNav(session.user)` instead of rendering its own dropdown. `listings.css`'s old `.user-dropdown`/`.dropdown-item` rules were left in place (harmless — nav.js's dropdown uses inline styles + JS-driven hover, so those classes are now inert) rather than risk a CSS removal pass without a visual check first.
- **Not yet done (Phase 5, separate task):** tier system (`TIERS`/`getTierIcon`), currency/date/status formatters, and `isBanned()`/`timeAgo()` helpers are still duplicated across multiple pages — deferred to a follow-up pass, not part of this entry.

### 2026-06-18 (memory file cleanup)
- **Reorganized `memory.md` and `decision.md` for accuracy and maintainability.** No code changed — this was a documentation-only pass after a full read-through of the live codebase (every HTML page and every `functions/` file).
- **Fixed wrong dates on six change-log entries.** A past session mislabeled a single big day of work (2026-06-06) across four different fake dates (06-07, 06-08 ×2, 06-09 ×2) — verified against actual git commit timestamps and corrected: the escrow-automation, both security-hardening rounds, seller-unresponsive-escalation, push-notification, and fee-system entries were all really 2026-06-06. The Wise currency-picker entry was actually 2026-06-08, not 06-07.
- **Fixed a "documented but not live" feature.** The "animations session" entry described CSS view-transitions/scroll-reveal/card-stagger as shipped, but git history shows that work was added and then reverted 5 minutes later the same session (commit `42cae2a`) — `nav.js` has no animation code today. Entry rewritten to say so.
- **Added two missing change-log entries** reconstructed from commit history: the 2026-06-07 messages.html bug-fix marathon (12 commits, never logged) and the 2026-06-08 Wise withdrawal IBAN/account-number + "additional details" field (commits `f15f37f`, `7403a4e`, never logged).
- **Fixed the "Current State" snapshot**, which still said "last updated 2026-06-08" — now reflects the Wise withdrawal fields, corrected page count (29, not 28), removed the already-resolved `debug-user.js` cleanup item (file no longer exists), and flagged two tables (`reviews`, `withdrawal_requests`) whose RLS status isn't confirmed in this file.
- **Restructured `decision.md`** into "Active & Resolved Decisions" vs. "Open Questions" sections (D-023 was sitting between the two with no heading of its own) and added a note that `D-0xx` numbers are permanent and never get renumbered, since other files reference them by number.
- **Split off `memory-archive.md`** for entries older than ~2 weeks, with a pointer left here, so this file stays short enough to actually read each session.

### 2026-06-08 (Wise withdrawal — account number/IBAN + additional details)
- Replaced the Wise withdrawal "contact email" field with an account number/IBAN field, since that's what's actually needed to route the payout. Added an optional "additional details" textarea for SWIFT/BIC code, branch, routing number, or anything else needed to send the payout correctly. Commits `f15f37f`, `7403a4e`.

### 2026-06-08 (Wise withdrawal currency picker)
- **Wise cash-out now supports any currency Wise can deliver locally:** Withdraw modal's Wise option in `wallet.html` ([wallet.html:667-672](wallet.html#L667-L672)) now shows: (1) a note explaining the payout is sent in PHP and the amount/currency actually received depends on Wise's conversion at transfer time, (2) a `WISE_CURRENCIES` dropdown of ~48 currencies Wise can convert PHP into and deposit to a local bank/e-wallet (sourced from Wise's official "what currencies can I send to and from" help article), (3) a "Bank or e-wallet name" field, plus existing full-name/email fields. Added a `note` pseudo-field type to `selectMethod()`'s renderer and skipped it in `submitWithdrawal()`'s validation loop. No backend changes needed — `request-withdrawal.js` and the admin withdrawal panel already store/display `details` generically as key-value pairs. Commit `b68083c`.

### 2026-06-07 (messages.html bug-fix marathon)
- Reconstructed from commit history (12 commits between 01:29–06:15, not individually logged at the time): fixed star ratings requiring `review_count > 0` before showing stars; replaced the messages skeleton loader with a proper empty-inbox state (and fixed it being hidden inside the wrong container); fixed mobile session detection in messages (tried `onAuthStateChange`, then reverted to `getSession()` after it caused a mobile redirect bug, then moved to the `INITIAL_SESSION` event for reliability); added silent token-refresh-and-retry on 401s plus auto-signout-and-redirect on truly expired sessions; fixed the nav dropdown positioning on the messages page; fixed a duplicate `const releaseBtn` declaration that was crashing the entire messages script.

### 2026-06-07 (mobile overflow fix + admin messaging + wallet top-up)
- **Listing detail page mobile overflow (the "overlap" bug, TEST 054→055):** Root cause was `.detail-grid { grid-template-columns: 1fr }` inside the `max-width:900px` media query — `1fr` resolves to `minmax(auto,1fr)`, and the `auto` minimum took the thumbnail row's intrinsic content width (~816px for ~10 thumbnails), forcing the whole grid (and page) to render ~834px wide on a 390px phone screen. Fixed by changing to `grid-template-columns: minmax(0,1fr)` at [listings/detail.html:160](listings/detail.html#L160). Verified with Playwright at iPhone 13 viewport — page now measures exactly 390px wide, zero overflow. Owner had been correctly reporting a real bug all along (not zoom, not cache). TEST 055 passed on owner's phone.
- **Admin "Message seller/buyer" button did nothing:** `findOrOpenConvWith()` in messages.html only opened *existing* conversations — fine for buyers/sellers (always have a prior order/thread) but admins usually have no prior thread with a random seller/disputant. Added `functions/api/admin/start-conversation.js` (finds-or-creates a conversation via service key, logs to `admin_logs`) and a client-side fallback gated to `currentUser.app_metadata.is_admin === true`. Admin Listings tab link now passes `&listing=<id>` so the new thread carries listing context. Commit `c3b5ce9`.
- **Reminder to delete listings sold off-platform:** Added a tip box above the listings table on `seller-dashboard.html` — "Sold this account somewhere else? Please delete the listing here too." Reinforces the ToS clause added earlier the same day. Commit `51cc405`.
- **Wallet top-up recommendation on insufficient balance:** The buy modal already showed "Insufficient balance… Top up wallet →" when pre-checking balance on open ([listings/detail.html:514](listings/detail.html#L514)), but the server-side race-condition path (when `/api/purchase` itself rejects with `needTopUp: true` from the `purchase_listing` RPC) only showed plain error text with no link. Updated the `confirmPurchase()` error handler ([listings/detail.html:547-554](listings/detail.html#L547-L554)) to render a "Top up wallet →" link to `/wallet` whenever `data.needTopUp` is true. Commit `62cfd20`.
- Also changed the wallet top-up link text from "Top up wallet" to "Add funds here." Commit `a4af87c`.

### 2026-06-06 (fee system + email notifications + wallet polish)
- **5% platform fee system:** `purchase.js` now puts `netAmount` (price × 0.95) in seller's escrow (not full price). Seller escrow transaction shows fee breakdown in description. `release-payment.js` releases `netAmount` to seller's balance, deducts `netAmount` from escrow, logs to `platform_earnings` table. Fee logged once — at release time (when actually earned), not at purchase. Fee is clearly shown to sellers everywhere.
- **Fee transparency for sellers:** `create-listing.html` preview now shows "You'll receive ₱X after 5% fee" live as seller types the price. `listings/detail.html` shows a fee breakdown note to seller when they view their own listing.
- **Email notifications — payment released:** `release-payment.js` email to seller now shows full breakdown: Sale price / Platform fee (5%) / Credited to your wallet. In-app + push notifications also updated to show net amount.
- **Email notifications — listing purchased:** `purchase.js` email to seller shows fee breakdown box (sale price → fee → you'll receive). In-app + push notifications updated to show net amount.
- **Bug fix — duplicate otherId variable:** `file-dispute.js` had `const otherId` declared twice. Removed the duplicate; the push and email blocks now share the same variable.
- **`platform_earnings` table** created in Supabase. Columns: `order_id`, `listing_id`, `seller_id`, `gross_amount`, `fee_percent` (5), `fee_amount`, `net_amount`, `created_at`. RLS: admin only.

### 2026-06-06 (push notifications + mobile audit)
- **Web Push notifications (full VAPID + aes128gcm):** Created `functions/api/push-helper.js` — complete Web Push implementation using only Web Crypto API (no npm). Exports `sendPushToUser(userId, env, {title,body,url})`. Reads subscriptions from Supabase `push_subscriptions` table, encrypts payload per RFC 8291, signs VAPID JWT, posts to browser push endpoint.
- **Push wired into 3 events:** `purchase.js` → seller notified when listing sold; `release-payment.js` → seller notified when payment released; `file-dispute.js` → both buyer and seller notified when dispute opened.
- **Push subscription endpoint:** `functions/api/push/subscribe.js` updated to store `endpoint` as a separate column alongside the subscription JSON — required for `unique(user_id, endpoint)` upsert to work with PostgREST.
- **Push registration in nav.js:** Moved from one-off in `index.html` to `initNav()` call in `nav.js` → every logged-in page now registers the service worker and subscribes. VAPID public key updated to new key.
- **Mobile audit completed:** Checked all 28 pages (count at the time). Pages already mobile-friendly: messages, wallet, orders, create-listing, notifications, account, profile, index, listings/* (all have breakpoints). Fixed: seller-dashboard.html (table overflow + column hiding at 480px/768px), wallet.html (tx-row too cramped at 360px → hide status badge, shrink icon/text at ≤600px), listings/detail.html (detail-grid collapses to 1 col at 900px).
- **⚠️ Pending manual steps (user must do):**
  1. Run SQL in Supabase to create `push_subscriptions` table.
  2. Add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to Cloudflare Pages env vars.

### 2026-06-06 (seller unresponsive escalation)
- **Feature — Seller unresponsive escalation:** Created `functions/api/notify-unresponsive-sellers.js`. When either party visits /orders, it silently checks for orders in `holding` that are 24–72 hours old. For each unnotified order, it sends: (1) a `seller_reminder` notification to the seller warning them the buyer may dispute, and (2) a `seller_reminder` notification to the buyer telling them they can now dispute. Uses the notification `link` field as the idempotency key so each order only gets one reminder. Buyer's Orders page also shows a yellow warning banner on any holding order that's 24+ hours old. Commit `603783f`.

### 2026-06-06 (security hardening session — round 2)
- **Login wall added to all listings pages:** Unauthenticated users visiting /listings, /listings/genshin, /listings/mlbb, /listings/valorant, or /listings/detail are now redirected to /login. Changed listings.html, listings/listings.js (initNav), and listings/detail.html.
- **Message button added to orders page:** Purchases, Sales, and Disputes tabs now all have a "💬 Message [Seller/Buyer]" button that opens /messages?with=<otherId>. Disputes query updated to include buyer_id and seller_id so the correct other party is identified.
- **CSP fixed for Cloudflare analytics:** Added `https://static.cloudflareinsights.com` to script-src and `https://cloudflareinsights.com` to connect-src. Cloudflare Pages injects a beacon script automatically which was being blocked.
- **Reset link reverted to 15 min:** Owner preference. Reverted 300000 → 900000 in send-reset.js and reset-password.js; UI text back to "15 minutes." Commit `5ce939c`.

### 2026-06-06 (security hardening session — round 1)
- **Fix — Dispute amount validation:** `file-dispute.js` now fetches `amount` from the order row and validates `amount > 0` before a dispute can be filed. Prevents zero-refund disputes.
- **Fix — Username lookup rate limiting:** `check-username.js` now rate-limits by IP (10 checks per minute per IP) using the `email_rate_limits` table with key prefix `ipck::`. Blocks user enumeration via brute-force username lookup.
- **Fix — Reset link window 15 min → 5 min:** (later reverted back to 15 min in round 2, per owner preference)
- **Fix — Email enumeration in reset-password.js:** "Account not found." 404 response changed to "Reset link is invalid or has expired." 400 — same generic message used for all failure modes.
- **Fix — CSP + security headers:** `_headers` now includes `Content-Security-Policy` (script/style unsafe-inline, Google Fonts, Supabase origin, JSDelivr CDN, WSS for realtime), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Fix — Admin audit log:** All 9 admin action files updated. `verifyAdmin()` now returns the user object (not just true/false). Added `logAdminAction()` helper to all admin files. Every action (ban, unban, freeze, unfreeze, dispute resolve, topup approve/reject, withdrawal approve/reject, seller approve/reject, delete listing, dismiss report, send notification) is logged to `admin_logs` table with: admin_id, action name, target_id, target_type, details JSON, timestamp.
- Commit `aa66a38`.

### 2026-06-06 (escrow automation: auto-release, rate limits, listing expiry)
- **Auto-release escrow:** Created `functions/api/auto-release-orders.js`. Orders in `holding` for 72+ hours with no open dispute are automatically released when either party visits the orders page. Seller and buyer both receive in-app notifications. Auto-released funds also get a 72h `hold_until` on the seller credit transaction.
- **Verify-code rate limiting:** `verify-code.js` now tracks failed code attempts in `email_rate_limits` table under key `vfy::${email}`. Max 5 wrong attempts per 10 minutes → 429 error with clear message.
- **Seller withdrawal hold period:** `release-payment.js` now stamps `hold_until = now + 72h` on the seller's credit transaction when payment is released. `request-withdrawal.js` calculates held amount and subtracts from available balance. Sellers see a clear error message if trying to withdraw held funds. (Hold period later removed at owner request — see `transactions.hold_until` note in Current State.)
- **Listing expiry (30 days):** `create-listing.js` now sets `expires_at = now + 30 days` on every new listing. `listings.js` browse query filters out expired listings. `seller-dashboard.html` shows expiry days and a "Renew" button for listings expiring within 7 days. `functions/api/renew-listing.js` created — extends expiry by 30 days.
- **SQL run in Supabase:** `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS hold_until timestamptz` · `ALTER TABLE listings ADD COLUMN IF NOT EXISTS expires_at timestamptz`
- Commit `b115a6c`.

### 2026-06-06 (CSS animations — added then reverted, NOT live)
- Added CSS View Transitions, Intersection-Observer scroll-reveal, and listing-card stagger animations to `nav.js` and `index.html`/`listings.js`. Five minutes later in the same session, **all of it was reverted** (commit `42cae2a`, right after `79d04b8`). `nav.js` has no animation code today — this entry exists only so a future session doesn't re-discover and re-add the same thing without knowing it was tried and rolled back. If you want these animations, they'd need to be re-built from scratch.

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
- **H6 fixed:** Rate limiting added to `send-code.js` and `send-reset.js` — max 5 emails per address per 10 minutes tracked via `email_rate_limits` table.
- **H7 confirmed fixed:** `public-profile.html` already queries `seller_applications` with `.eq('status','approved')` — verified badge is correctly gated on approved status.
- **M1 fixed:** Email validation in `send-code.js`, `send-reset.js`, and `register.html` now uses proper regex `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` instead of just checking for `@`.
- **Register page fix:** Validation now shows specific error per field instead of one generic message for all failures.
- **Bio + avatar sync fixed:** `profile.html` now writes `bio` to both `user_metadata` and `profiles` table. `account.html` writes `avatar_url` to both `user_metadata` and `profiles` table.
- **M2 partially fixed:** `detail.html` delist/delete catch block now shows a toast error. `public-profile.html` shows "Could not load listings" panel when listings fetch fails instead of blank.
- **M3 fixed:** Listings query in `public-profile.html` now has `.limit(20)`.
- **Terms of Service updated:** Added Section 7 (Wallet & Top-Up), Section 11 (Account Restrictions). Updated escrow flow, tier system mention, ₱500,000 listing cap, dates to June 6, 2026.
- **Privacy Policy updated:** Added rows for wallet/financial info, session & device info, notification data, tier & activity data, email rate data. Section 8 renamed to "Cookies & Local Storage." Dates updated to June 6, 2026.
- **Tests passed:** TEST 001–022 all approved. TEST 023 N/A (delist removed from site). TEST 024–026 approved.

---

*Entries before 2026-06-06 (the 2026-06-03 and 2026-06-04 sessions: initial memory system setup, profile.html creation, registration bug fix, unique usernames, real-time listings/messages/notifications) have been moved to `memory-archive.md`.*
