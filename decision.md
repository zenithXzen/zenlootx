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

---

## Open / Upcoming Decisions (not yet made)

### D-015 · Mobile app approach (future)
- **Leaning toward:** Wrap the web app into an installable app (**PWA** via PWABuilder/Bubblewrap) to reuse the web code and cover Android + iPhone + desktop at once.
- **Status:** 🟡 Not decided / not started.

### D-016 · Payments provider ⚠️
- **Open question:** Which payment processor, and how to handle escrow + payouts to sellers across countries.
- **⚠️ Must research first:** Selling game accounts may violate game ToS and some app-store / payment-processor policies. Research this before committing to a provider.
- **Status:** 🔴 Open — needs research.
