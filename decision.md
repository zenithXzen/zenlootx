# ZenLootX — Decision Log

> The important choices made building this site, and **why**. The point of this file is so that future-me (and the AI after a `/clear`) understands the reasoning and doesn't accidentally undo a good decision. Newest decisions at the bottom.
>
> Format for each: **what** was decided, **why**, **alternatives** considered, **status**.

---

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
- **Status:** ⚠️ Partial — expand to all future tables.

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
- **Status:** ✅ Done — applied to check-session, track-session, get-sessions, revoke-session.

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
- **Status:** ✅ Done — `email_rate_limits` table confirmed created in Supabase.

### D-020 · XSS protection via sanitize() helper
- **Decision:** All user-generated content rendered into innerHTML (bios, review comments, usernames in dynamic contexts) is passed through a `sanitize()` function that escapes `& < > " '`.
- **Why:** Without escaping, a user could set their bio to `<script>alert(1)</script>` and execute arbitrary JavaScript in the browser of anyone who views their public profile.
- **Applied to:** `public-profile.html` (bio + review comments), `profile.html` (review comments), `admin.html` (seller bio display).
- **Status:** ✅ Done.

---

## Open / Upcoming Decisions (not yet made)

### D-021 · Mobile app approach (future)
- **Leaning toward:** Wrap the web app into an installable app (**PWA** via PWABuilder/Bubblewrap) to reuse the web code and cover Android + iPhone + desktop at once.
- **Status:** 🟡 Not decided / not started.

### D-022 · Payments provider ⚠️
- **Open question:** Which payment processor, and how to handle escrow + payouts to sellers across countries. Wallet top-ups are currently done manually via admin approval.
- **⚠️ Must research first:** Selling game accounts may violate game ToS and some app-store / payment-processor policies. Research this before committing to a provider.
- **Status:** 🔴 Open — needs research.
