# ZenLootX — Decision Log

> The important choices made building this site, and **why**. The point of this file is so that future-me (and the AI after a `/clear`) understands the reasoning and doesn't accidentally undo a good decision. Newest decisions at the bottom of each section.
>
> Format for each: **what** was decided, **why**, **alternatives** considered, **status**.
>
> **A decision's `D-0xx` number is permanent.** Numbers are assigned once, in the order a decision was first written down, and never reused or renumbered — even if a later cleanup reorders or regroups the sections below. Other files (`CLAUDE.md`, `memory.md`) link to decisions by number (e.g. "see decision.md D-022"), so a number always points to the same decision.

---

## Active & Resolved Decisions

### D-001 · Domain & registrar
- **Decision:** Bought `zenlootexchange.com` on **Namecheap**.
- **Why:** Simple, cheap, well-known registrar.
- **Status:** ✅ Done.

### D-002 · DNS through Cloudflare
- **Decision:** Pointed the domain's nameservers (in Namecheap) to **Cloudflare**, so Cloudflare manages DNS.
- **Why:** Free, fast, gives security/CDN features later, and keeps DNS in one place.
- **Status:** ✅ Done.

### D-003 · Code hosting on GitHub
- **Decision:** Store all code in **GitHub** under `zenithXzen/zenlootx`.
- **Why:** Standard, free, integrates with deploy tools and AI editors.
- **Note:** An earlier placeholder repo `zen` was deleted (no longer needed).
- **Status:** ✅ Done.

### D-004 · Repo visibility & secret handling
- **Decision:** Repo can be public for static frontend code, BUT no secrets ever live in the repo.
- **Why:** Frontend code is visible to browsers anyway. The real risk is leaked secret keys (bots scan public GitHub within minutes). Secrets go in environment variables instead.
- **Going forward:** Consider keeping the repo **private** once it holds the full backend, as an extra safety net.
- **Status:** ✅ Active rule.

### D-005 · Switched hosting: GitHub Pages → Cloudflare Pages ⭐
- **Decision:** Moved site hosting from **GitHub Pages** to **Cloudflare Pages**.
- **Why:** GitHub Pages can only serve static files — it cannot run backend code. The app now needs **serverless functions** (login lookups, email sending, sessions), which Cloudflare Pages Functions provide. Cloudflare also already handles the DNS, so it consolidates the setup.
- **Alternatives:** Stay on GitHub Pages (rejected — no backend), Vercel/Netlify (viable, but Cloudflare was already in use).
- **Status:** ✅ Done — this is now the live host.

### D-006 · Auth + Database: Supabase
- **Decision:** Use **Supabase** for user accounts and the database.
- **Why:** Gives auth, a Postgres database, storage, and realtime out of the box — a lot of backend for a beginner, with a free tier.
- **Status:** ✅ In use.

### D-007 · Custom email flow with Resend
- **Decision:** Use **Resend** for emails and **disabled Supabase's built-in email confirmation** in favor of a custom 6-digit verification-code flow.
- **Why:** More control over branding and the verification experience (dark-themed, ZenLootX green).
- **Tradeoff:** More moving parts to maintain (custom functions for codes/expiry) vs. using Supabase's default emails.
- **Status:** ✅ In use.

### D-008 · Backend via Cloudflare Pages Functions
- **Decision:** Put all server-side logic in **Cloudflare Pages Functions** (`/functions/api/`).
- **Why:** Runs on the same platform as hosting, no separate server to manage, scales automatically.
- **Status:** ✅ In use (send-code, verify-code, sessions, etc.).

### D-009 · Secrets in environment variables only
- **Decision:** Store `RESEND_API_KEY`, `HMAC_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` as Cloudflare environment variables.
- **Why:** Keeps secrets out of the code/repo.
- **Important detail:** The **service key** must only ever be used inside Functions, never exposed to the browser. The **anon key** is safe to be public — but only because RLS protects the data (see D-010).
- **Status:** ✅ Active rule.

### D-010 · Security model: Row Level Security (RLS)
- **Decision:** Enable **RLS** on Supabase tables (currently on `user_sessions`).
- **Why:** Since the anon key is public, RLS is the actual wall protecting your data. Without it, anyone with the anon key could read/write the table.
- **⚠️ Must-do going forward:** Enable RLS on **every** new table (listings, orders, wallet, messages). This is the single most important security habit for this stack.
- **Status:** ⚠️ Mostly done — RLS is confirmed on most core tables (see `memory.md` Current State → Supabase tables list), but `reviews` and `withdrawal_requests` are listed there **without** a confirmed RLS marker. Verify and enable RLS on both before launch.

### D-011 · Design system
- **Decision:** Dark premium theme. bg `#0A0E0C`, accent `#19C37D`, Geist font, 12px/8px/999px radii.
- **Why:** Trustworthy, modern, distinctive — important for a marketplace handling money.
- **Status:** ✅ Active standard.

### D-012 · Integrity standard
- **Decision:** No fake listings, no fake trust badges, no fake ratings.
- **Why:** Trust is the whole product in a money marketplace. Fakes destroy it.
- **Status:** ✅ Active standard.

### D-013 · Username login
- **Decision:** Allow login by username (not just email) via a Cloudflare Function that looks up the email through a Supabase SQL function.
- **Why:** Friendlier for users who don't remember which email they used.
- **Status:** ✅ Done.

### D-014 · Session tracking + remote sign-out
- **Decision:** Track each login device in a `user_sessions` table; allow per-device and "sign out everywhere"; poll every 5s for remote revocation.
- **Why:** Security and user control — important for accounts tied to money/wallets.
- **Status:** ✅ Done.

### D-015 · Atomic purchase via Postgres RPC ⭐
- **Decision:** The entire purchase critical path (balance check + deduct + mark listing sold + create order) runs inside a single **Postgres stored procedure** (`purchase_listing`) using `FOR UPDATE` row locks.
- **Why:** A two-step approach (read balance in JS → PATCH if sufficient) has a race condition: two simultaneous requests can both read the same balance, both pass the check, and both succeed — resulting in a double-spend. The stored procedure acquires row-level locks on the listing and wallet rows so only one request can proceed at a time.
- **Alternatives considered:** Conditional PATCH with `balance=gte.${price}` filter (rejected — still vulnerable because the SET value uses the old JS variable, not the DB value). Client-side debounce (rejected — doesn't protect against concurrent requests from different devices).
- **Status:** ✅ Done — `purchase_listing` function live in Supabase.

### D-016 · Server-side JWT verification only
- **Decision:** All Cloudflare Functions verify the user's JWT by calling Supabase's `/auth/v1/user` endpoint. Client-side `atob()` decoding of JWTs is never trusted for authorization.
- **Why:** `atob()` only decodes the payload — it does not verify the signature. A forged JWT (with any user ID) would pass a client-side decode check. Server-side verification with Supabase confirms the token is genuine and unexpired.
- **Status:** ✅ Done — applied to check-session, track-session, get-sessions, revoke-session, and all other functions that need to know who's calling.

### D-017 · Admin bypass requires secret key
- **Decision:** The `?admin=on` maintenance bypass in `_middleware.js` requires a matching `ADMIN_BYPASS_SECRET` query parameter. Without it, the bypass returns 401.
- **Why:** The original implementation set the bypass cookie for anyone who added `?admin=on` to a URL — no authentication required. Any user who discovered this could bypass maintenance mode.
- **Alternatives:** IP allowlist (rejected — dynamic IPs make this fragile); remove the bypass entirely (rejected — needed for testing in production).
- **Status:** ✅ Done — `ADMIN_BYPASS_SECRET` set as Cloudflare env var.

### D-018 · Session matching by row ID not user-agent
- **Decision:** `check-session.js` verifies a session by matching the `sessionRowId` (stored in localStorage, passed as a query param) against the `user_sessions` table. Previously it matched by user-agent string.
- **Why:** User-agent strings are easily faked — any attacker who knows someone's user-agent can pass the check. The row ID is a UUID generated at login time and is not guessable.
- **Status:** ✅ Done.

### D-019 · Email rate limiting via DB table
- **Decision:** `send-code.js` and `send-reset.js` track email sends in an `email_rate_limits` table (email + timestamp). Max 5 emails per address per 10-minute window. Records are not cleaned up by the app — they expire naturally (old rows are ignored by the query window).
- **Why:** Without rate limiting, an attacker could call the send endpoint in a loop and exhaust the Resend account quota or harass a user with thousands of verification emails.
- **Alternatives:** IP-based rate limiting in Cloudflare Workers (viable but harder to implement without KV storage); Resend's own rate limits (exist but not granular enough per address).
- **Status:** ✅ Done — `email_rate_limits` table confirmed created in Supabase. Later reused for verify-code attempts (`vfy::` prefix) and username-lookup IP throttling (`ipck::` prefix).

### D-020 · XSS protection via sanitize() helper
- **Decision:** All user-generated content rendered into innerHTML (bios, review comments, usernames in dynamic contexts) is passed through a `sanitize()` function that escapes `& < > " '`.
- **Why:** Without escaping, a user could set their bio to `<script>alert(1)</script>` and execute arbitrary JavaScript in the browser of anyone who views their public profile.
- **Applied to:** `public-profile.html` (bio + review comments), `profile.html` (review comments), `admin.html` (seller bio display).
- **Status:** ✅ Done.

### D-024 · Wallet balance mutations always go through `increment_balance` RPC
- **Decision:** Every place that changes a wallet's `balance`/`escrow`/`total_earned` must call the `increment_balance` Postgres RPC (or the shared `incrementBalance()` JS wrapper in `functions/api/admin/_shared.js`, which calls that RPC and only falls back to manual read-then-write if the RPC call itself fails) — never a standalone "read current value in JS → add/subtract → PATCH" sequence.
- **Why:** The manual pattern has a lost-update race: two near-simultaneous mutations (e.g. a withdrawal approval and an auto-release firing close together) can both read the same starting balance and one overwrites the other's change. The RPC does the arithmetic inside Postgres, atomically. This exact bug class was already fixed once for `purchase_listing` (see D-015) — 2026-06-19 extended the same fix to `release-payment.js`, `auto-release-orders.js`, and `resolve-dispute.js`, and centralized the helper so future money code defaults to the safe pattern instead of copy-pasting the unsafe one.
- **Status:** ✅ Active rule going forward — any new code touching wallet balances should use `incrementBalance()`, not manual read-then-write. The known exception (`freeze-user.js`) was fixed 2026-06-22.

### D-025 · Frontend nav/dropdown logic lives only in `nav.js`
- **Decision:** `initNav(user)` (account dropdown, message/notification/admin badges, frozen-account banner, push-subscription opt-in, heartbeat) has exactly one implementation, in `nav.js`. Every page that shows the logged-in nav loads `nav.js` and calls `initNav(user)` after confirming a session — it does not reimplement any part of this locally.
- **Why:** `profile.html` and `listings/listings.js` had each grown their own stripped-down copy over time. Both silently drifted from the canonical version — missing the heartbeat, badges, and frozen-banner, and in `profile.html`'s case carrying a stale pre-rotation VAPID push key that the canonical version had already moved past. `listings/listings.js`'s pages (`/listings/genshin`, `/listings/mlbb`, `/listings/valorant`) didn't even load `nav.js` at all, which is why a local copy existed there in the first place.
- **Status:** ✅ Done for `profile.html` and `listings/listings.js` (2026-06-19). Phase 5 done 2026-06-22: `timeAgo()`, `isBanned()`, `getTierIcon()` consolidated into `nav.js`, removed from all 7 duplicate locations. Currency formatter consolidation investigated and intentionally skipped — not true duplicates (different decimal precision by design, several copies are backend-only Cloudflare Functions unreachable from `nav.js`).

### D-026 · `orders.escrow_status` is not reliable history once a dispute is filed
- **Decision:** Any backend logic that needs to know whether a seller was *already paid* for an order must check the `transactions` ledger for an actual `type='credit'` row (reference = order id, user = seller), not `orders.escrow_status`.
- **Why:** `file-dispute.js` allows filing a dispute on an order regardless of its current status (it only blocks `disputed`/`refunded`/`cancelled` — not `released`), and unconditionally overwrites `escrow_status` to `'disputed'`. This destroys the "was this released" signal. `resolve-dispute.js` used to read `order.escrow_status === 'released'` to decide whether to claw back the seller's balance when refunding a buyer — since that flag is always `'disputed'` by the time a dispute is resolved, the clawback branch was dead code. Real-world effect (found 2026-06-20 via live testing, TEST 056): a buyer disputed an already-released order, admin ruled in the buyer's favor, the buyer was refunded in full, and the seller's balance was never touched — a double payout. Fixed in `resolve-dispute.js` by querying `transactions` instead.
- **Status:** ✅ Active rule — applies to `resolve-dispute.js` now; keep in mind for any future code that branches on whether escrow was released for a disputed order.

### D-027 · `reviews` INSERT policy must combine ownership + duplicate-check + order-completion in ONE policy
- **Decision:** The `reviews` table's `INSERT` row-level-security policy must be a single policy whose `with check` requires ALL of: `auth.uid() = reviewer_id`, no existing review by that reviewer for that `order_id`, and an `orders` row for that `order_id` with `escrow_status = 'released'` where the reviewer is either the buyer (and `reviewee_id` = the seller) or the seller (and `reviewee_id` = the buyer). Never split these into multiple separate `PERMISSIVE` policies for the same command.
- **Why:** Postgres combines multiple `PERMISSIVE` policies for the same command with **OR**, not AND. Found 2026-06-22 while verifying RLS for the cleanup batch (item 1): the live policies were split into `users submit own review` (`auth.uid() = reviewer_id`) and `no duplicate reviews` (checks `auth.uid()` hasn't already reviewed this order — but never checks the new row's `reviewer_id` at all). Because they OR together, satisfying the duplicate-check alone was enough — anyone logged in could insert a review with `reviewer_id` set to a completely different real user's ID (impersonation), for any order, attributing any rating/comment, as long as they personally hadn't already reviewed that order (true almost always). No participation/completion check existed either, so a reviewer didn't even need to have been part of the order. Confirmed via `messages.html:978` that the insert happens directly through the Supabase client with the public anon key — RLS is the only gate, there's no server-side validation layer to fall back on.
- **Status:** ✅ Fixed and live 2026-06-22 — Zen ran the SQL in Supabase SQL Editor. Verify with TEST 111.

### D-023 · Mobile-first design standard ⭐
- **Decision:** Every UI feature and page must be designed and tested for both Android and iPhone screens, starting at 360px wide. Mobile layout is checked before anything ships.
- **Why:** Real users reported overlapping elements and broken layouts on their phones. The marketplace is used by Filipino gamers who primarily browse on Android phones, not desktops. A layout that only works on desktop loses most of the user base.
- **Rule:** Any element that overlaps, clips, or disappears on a phone screen is a bug — not acceptable. Always use `@media (max-width: 600px)` breakpoints, `flex-wrap`, and `width:100%` on mobile as needed.
- **Status:** ✅ Active standard — applies to all future UI work.

---

## Open Questions (not yet decided)

### D-021 · Mobile app approach (future)
- **Leaning toward:** Wrap the web app into an installable app (**PWA** via PWABuilder/Bubblewrap) to reuse the web code and cover Android + iPhone + desktop at once.
- **Status:** 🟡 Not decided / not started.

### D-022 · Payments provider ⚠️
- **Open question:** Which payment processor, and how to handle escrow + payouts to sellers across countries. Wallet top-ups are currently done manually via admin approval.
- **⚠️ Must research first:** Selling game accounts may violate game ToS and some app-store / payment-processor policies. Research this before committing to a provider.
- **Status:** 🔴 Open — needs research.
