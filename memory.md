# ZenLootX — Memory & Change Log

> **Purpose:** Persistent memory across `/clear`. Read at the start of every session. After every change, add a dated entry (newest at top).
>
> **Owner context:** New to coding, strong at marketing. Explain simply; confirm before big or irreversible steps.
>
> **Housekeeping rule (token discipline):** Entries must be COMPACT — max ~6 bullet lines, no prose paragraphs. Keep only the last ~8–10 entries here; move older ones verbatim to `memory-archive.md` (full verbose history lives there — open only when needed). Keep this whole file under ~10 KB.

---

## 🗒️ Change Log (newest first)

### 2026-07-02 (phone session, merged `6f33a2d`) — Nav overhaul + guest browsing + SEO (⚠ NEEDS OWNER SQL)
- Nav overhaul: notification bell + unread badge in nav bar, **mobile bottom island tab bar** (hidden on /messages), identity-card dropdown (tier chip + wallet balance card), items renamed (My Profile / Settings), off-screen dropdown fix.
- New `/welcome` post-registration onboarding (buy/sell paths, shows once via metadata flag). Page count now 30.
- Guest browsing: listings + detail pages no longer force login (`?redirect=` on sign-in); seller lookups → `profiles_public` view; public-profile still login-gated. **Guests see EMPTY listings until the SQL in Open threads is run** (no breakage for logged-in users). Do NOT add an anon policy directly on `profiles` (would leak ban/admin/last_active columns).
- SEO: OG/Twitter/canonical meta on index + 3 game pages, `robots.txt`, `sitemap.xml`, new `functions/listings/detail.js` injecting per-listing OG tags (HTMLRewriter, XSS-escaped, anon key, active-only).
- Small fixes: broken zx.png logo on listing pages, hero dot-grid invisible on mobile, profile-header Ban/Report pinning, last-seen removed from public profiles, how-it-works FAQ now discloses the 72h auto-release.
- ⏳ Verify after SQL: incognito game page shows cards · curl `-A facebookexternalhit` a listing URL → real og: tags · island/bell/dropdown regression check. (Full verbose notes: archive "2026-07-02 (later)".)

### 2026-07-02 — Token-diet doc restructure + repo hygiene (docs only, no code)
- Unstaged 210 accidentally-staged local files (impeccable skill ×2, settings, screenshots); `.gitignore` now blocks `.claude/`, `.agents/`, `.impeccable/`, `skills-lock.json`.
- memory.md rewritten compact (79 KB → ~10 KB); ALL verbose entries preserved verbatim in `memory-archive.md`.
- CLAUDE.md session-start ritual slimmed: only memory.md mandatory; decision.md / design-system / database-schema read on-demand.
- Stale notes corrected: `VAPID_SUBJECT` IS set; freeze-user race FIXED; reviews/withdrawal RLS CONFIRMED (all done 2026-06-22); 2026-06-24 fixes WERE committed (`c41dff4`) and `cleanup-security-batch` is merged into master.

### 2026-07-02 — Homepage overhaul: FAQ + how-it-works + footer (ALL LIVE, `ded0729`)
- Wallpaper renames ML.jpg/VAL.jpg (`52a72d0`) · "Why ZenLootX" → FAQ accordion, 6 truthful Q&As (`5520cb7`,`54f21e1`) · legitimacy FAQ + hosted DTI cert `/FAQ/DTI.pdf` (`230f4f9`) · "How it works" → journey timeline (`f7e5c65`) · FAQ contained panel (`dfb97e5`) · footer contrast fixes + real DTI badge, fake "systems operational" removed (`95839c0`) · footer socials FB+Discord + mobile 2×2 (`ded0729`).
- Facts locked: DTI **ZENLOOTX ONLINE SHOP, No. 8247950** (owner's name only inside the cert, never in site text). Fee: **buyer free, seller pays 5%**. FB `https://www.facebook.com/share/1C7g35mnH1/` · Discord `https://discord.gg/zWKgscXVzb`.

### 2026-07-01 — Homepage hero + slideshow overhaul (merged)
- Hero: dot-grid ambient bg, HUD corner brackets, staggered entrance, rotating headline words (2.5s interval).
- Stats strip → cards with SVG icons; scroll-triggered stagger, re-fires on scroll in/out.
- Slideshow: separate `.slide-img` layer (Ken Burns), top-fade overlay, ML.jpg `center 0%` / VAL.jpg `center 60%`, touch swipe + mouse drag (40px threshold).

### 2026-06-24 — Disputes-tab 400 fix + freeze-deduct UI (`c41dff4`, merged & live)
- `orders.html` disputes tab 400 fixed: no FK disputes→orders, now 3 separate queries stitched in JS.
- `admin.html` freeze+deduct UI wired (₱ amount + reason fields → existing API); empty-state template-literal bug fixed.

### 2026-06-22 — Security cleanup batch items 1–5 (`044fb6c`, merged & live)
- `freeze-user.js` deduction → atomic `incrementBalance` RPC · VAPID subject → `VAPID_SUBJECT` env var (✅ set in CF Prod+Preview; value needs `mailto:` prefix).
- Silent-catch fixes: login lockout email, forgot-password submit+resend, register resend-code, admin toasts (top-ups/withdrawals/analytics/approve-deny).
- Helpers consolidated into nav.js (`timeAgo`/`isBanned`/`getTierIcon`) — also fixed public-profile tier icons (tiers 2–9 showed generic icon).
- 🔒 **reviews RLS bug (decision.md D-027):** anyone could insert fake reviews impersonating others; INSERT policies combined into one strict policy, SQL run ✅. `withdrawal_requests` RLS confirmed correct.

### 2026-06-21 — Favicon + navbar logo; merged `preview-login-anim-fixes` → master (`16ebdd5`)
- Square favicon `zx-icon-square.png` (readable on light tabs) on all pages; navbar → single `wow-logo-transparent.png` image on 25 pages; old `zx.png`/`logo.png` deleted permanently. (⚠ 3 listing pages still referenced zx.png — fixed 2026-07-02 phone session.)
- ⚠ Recurring gap: Cloudflare Pages **Preview env does NOT inherit Production secrets** — when a preview branch throws "Server error.", check Preview env vars first.

### 2026-06-20 — Login/OTP animation suite + Phase-1 UX + real-device fixes (4 sessions, condensed)
- login.html: SVG spinner → draw-on checkmark + ring pulse, form shake on fail, 550ms min-loading floor. register.html OTP: digit pop-in, auto-submit at 6th digit, shake+clear on wrong code, green stagger on success. All `prefers-reduced-motion` safe.
- Mobile fixes from iPhone testing: messages purchase-summary card → max 2 rows; game-switcher pills → horizontal scroll; game-switch black flash → loading curtain; chat-header name ellipsis.
- 💰 Money bug fixed: `resolve-dispute.js` double-payout — clawback now checks the `transactions` ledger, not `escrow_status`. Retested ✅.
- ⛔ Do NOT retry "make alert text more premium" without a visual reference from owner (2 attempts rejected).

### 2026-06-19 — Full codebase cleanup Phases 1–4
- Bugs: sell.html re-apply crash; dismissReport → API + audit log; profile self-report removed; wallet mutations → atomic `increment_balance` RPC.
- Admin backend consolidated into `functions/api/admin/_shared.js` (verifyAdmin/logAdminAction/notify/incrementBalance); push sender into `push-helper.js` (`sendPushToUsers`).
- initNav consolidated: profile.html + 3 listings pages now use shared nav.js (fixed stale VAPID key on profile).

> Everything older (2026-06-06 → 2026-06-18: security audit C1–C4/H1–H7/M1–M3, escrow automation, push notifications, 5% fee system, Wise withdrawals, messages bug marathon, doc cleanup) **plus the full verbose versions of every entry above** → **`memory-archive.md`**.

---

## 📍 Current State (snapshot — last updated 2026-07-02)

- **Stack:** see CLAUDE.md. Font in use: **Geist**. 30 pages, ~54 API function files. All branches merged; master = live.
- **Pages:** `/` · login · register · welcome · forgot/reset-password · account · profile · public-profile · listings (+genshin/mlbb/valorant/detail) · create-listing · sell · seller-dashboard · orders · wallet · messages · disputes · notifications · admin · about · contact · how-it-works · escrow · terms · privacy · banned.

**Working features (one line each)**
- Auth: email/username login, HMAC 6-digit email verification (Resend), forgot/reset, sessions + remote sign-out, login lockout, `/welcome` onboarding (once per user).
- Listings: browse w/ realtime sold updates (**guest browsing shipped, pending owner SQL — see Open threads**), 30-day expiry + renew, create (server-side, sellers only, ≤10 images, PHP-only price), report listing, per-listing OG meta for link sharing.
- Money: wallet (manual top-up approval; withdrawals GCash/Maya/Bank/Binance/Wise incl. ~48-currency picker), atomic `purchase_listing` RPC, escrow holding→released w/ 72h auto-release, **5% seller fee at release** (logged to `platform_earnings`), disputes + admin resolution + seller-unresponsive escalation.
- Social/nav: realtime messages w/ read receipts, notifications (in-app + email + web push + nav bell w/ badge), mobile bottom island tab bar, reviews, tier system (Iron→Diamond), public profiles (XSS-safe).
- Admin: users/freeze+deduct/ban, seller applications, disputes, top-ups, withdrawals, broadcast, message-any-user; all 9 actions audit-logged to `admin_logs`.
- SEO: robots.txt, sitemap.xml, OG/Twitter/canonical meta on home + game pages + dynamic per-listing.

**Data / infra**
- All 18 tables RLS ✅: profiles, listings, orders, wallets, transactions, messages, conversations, notifications, seller_applications, disputes, reviews, user_sessions, email_rate_limits, withdrawal_requests, push_subscriptions, platform_earnings, topup_requests, admin_logs. (`reviews` INSERT policy rewritten 2026-06-22, D-027.)
- `email_rate_limits` key prefixes: plain email (send-code), `vfy::` (verify attempts), `ipck::` (per-IP username lookup).
- SQL functions: `get_email_by_username`, `purchase_listing`, `increment_balance`. Buckets: `avatars` (public), `listing-images` (public), `id_documents` (private).
- CF env vars: RESEND_API_KEY · HMAC_SECRET · SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_KEY · ADMIN_BYPASS_SECRET · VAPID_PUBLIC_KEY · VAPID_PRIVATE_KEY · VAPID_SUBJECT (`mailto:` prefix required). VAPID keys rotated 2026-06-09 — values live ONLY in CF.
- ⚠ Preview environment does NOT inherit Production secrets — set vars in both.

**Known risks / cleanups**
- M2 silent catch blocks: fixed on key pages (2026-06-22), not audited everywhere.
- Payments provider not integrated (top-ups manual) — decision.md D-022.
- `transactions.hold_until` exists but unused (feature removed 2026-06-07, owner request).
- Not-built-yet list: see CLAUDE.md roadmap (don't duplicate here).

**Open threads**
- 🔴 **OWNER ACTION — run this in Supabase SQL editor to make guest browsing live** (until then guests see empty listings; logged-in users unaffected):
```sql
create policy "anon_read_active_listings" on public.listings
  for select to anon using (status = 'active');

create or replace view public.profiles_public
  with (security_invoker = off) as
  select id, username, avatar_url, avg_rating, review_count, created_at
  from public.profiles;
revoke all on public.profiles_public from anon, authenticated;
grant select on public.profiles_public to anon, authenticated;
```
- **Last test number used: TEST 200.** (Tests themselves are session-only — never record lists/results here.)
- ⚠ Discovered 2026-07-02: `.gitignore` line 3 (`claude.md`) means **CLAUDE.md is local-only, never pushed to GitHub** — phone/cloud sessions never see project rules; they rely on memory.md only. Same for `claude_extracted/` (design-system, database-schema). Surface to owner before assuming remote sessions know the rules.
