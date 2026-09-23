# Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sign-in with Discord or Google through Supabase Auth, a public nickname, an account page with sign-out and deletion, the draft-history insert removed, and the privacy policy and terms updated to match.

**Architecture:** Pure helpers in `src/lib/auth/` (nickname rules, safe redirect path, current user). OAuth runs server-side: `/auth/login` asks Supabase for the provider URL and redirects, `/auth/callback` exchanges the code and routes to the nickname page when needed. Account mutations are Server Actions in `src/app/compte/actions.ts`. A session-refresh middleware keeps cookies fresh. The header receives the current user from its page through a shared async `SiteShell`.

**Tech Stack:** Next.js 15.5 App Router (typedRoutes on, Server Actions, `useActionState`), React 19, `@supabase/ssr` 0.6 and `@supabase/supabase-js` 2.105, zod 3, Vitest + Testing Library (jsdom), Tailwind with tokens from `src/app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-09-24-draftforme-accounts-design.md`

## Deviations from the spec, decided while planning

1. **OAuth scopes are Supabase's defaults, not narrowed.** Supabase (GoTrue) always requests its default scopes for each provider (Discord `identify email`; Google includes `email` and `profile`), and `options.scopes` can only add to them. So the login route passes no `scopes`, and the privacy policy says the account stores "the profile information the provider sends (username or name, profile picture)", which is true for both providers. Task 11 checks what a local instance actually stores.
2. **Deleting the account is confirmed by typing `SUPPRIMER`, not the nickname.** A user who never chose a nickname must still be able to delete their account (GDPR), so the confirmation word is the same for everyone.
3. **A `danger` colour token is added** (`--danger`, mapped as `danger` in Tailwind) for form errors; the palette had none.
4. **`SiteShell`**: an async server component (`src/components/marketing/site-shell.tsx`) renders header, `<main>` and footer with the current user. The `(legal)` layout and the new `(account)` layout both use it, instead of duplicating the user lookup.

## Conventions every task follows

- Code, comments, identifiers, commits in English; every user-facing string in French, true, and never inventing data.
- Colours only through Tailwind token names (`text-ink`, `text-ink-muted`, `text-ink-faint`, `bg-surface`, `border-rule`, `text-accent`, `bg-accent`, `text-on-accent`, `text-danger`…). Never hex, `rgb()`, `text-white`, `bg-stone-*` in components.
- typedRoutes is on: a dynamic `href` needs `as Route` (`import type { Route } from "next"`).
- Checks: `npx vitest run --exclude "**/.claude/**" <paths>` (a sibling git worktree under `.claude/worktrees/` duplicates tests and fails there; that is an environment artifact), `npx next typegen && npx tsc --noEmit`, and `npm run lint`.
- Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git add` explicit paths; quote paths containing parentheses.
- Never touch the production Supabase project, never push, never run anything against the Riot API.

## File map

| File | Status | Task |
|---|---|---|
| `src/lib/auth/safe-next-path.ts` (+ test) | Create | 1 |
| `src/lib/auth/nickname.ts` (+ test) | Create | 1 |
| `supabase/migrations/0004_accounts.sql` | Create | 2 |
| `src/lib/supabase/types.ts` | Modify: add `profiles`, `delete_my_account` | 2 |
| `src/lib/auth/current-user.ts` (+ test) | Create | 3 |
| `src/app/auth/login/route.ts` (+ test rewritten) | Modify | 4 |
| `src/app/auth/callback/route.ts` (+ new test) | Modify | 4 |
| `src/middleware.ts` | Create | 5 |
| `src/app/compte/actions.ts` (+ test) | Create | 6 |
| `src/app/globals.css`, `tailwind.config.ts` | Modify: `danger` token | 7 |
| `src/components/auth/nickname-form.tsx` (+ test) | Create | 7 |
| `src/components/auth/delete-account-form.tsx` (+ test) | Create | 7 |
| `src/components/auth/account-menu.tsx` (+ test) | Create | 8 |
| `src/components/marketing/site-header.tsx` (+ test) | Modify: `user` prop, `AccountMenu` | 8 |
| `src/components/marketing/site-shell.tsx` | Create | 8 |
| `src/app/(legal)/layout.tsx`, `src/app/page.tsx`, `src/app/draft/page.tsx` | Modify: pass the user | 8 |
| `src/app/(account)/layout.tsx`, `connexion/page.tsx`, `compte/page.tsx`, `compte/pseudo/page.tsx` | Create | 9 |
| `src/app/api/recommend/route.ts` (+ test) | Modify: drop session insert | 10 |
| `src/lib/legal/site-info.ts` (+ test), `src/components/legal/privacy-policy.tsx` (+ test), `terms-of-use.tsx` (+ test) | Modify | 10 |

Note on routes: `src/app/compte/actions.ts` lives outside the `(account)` group on purpose (it is not a route; `src/app/(account)/compte/...` are the pages). Both resolve fine: `actions.ts` is a plain module, not a page.

---

### Task 1: Pure helpers — safe redirect path and nickname rules

**Files:**
- Create: `src/lib/auth/safe-next-path.ts`, `src/lib/auth/safe-next-path.test.ts`
- Create: `src/lib/auth/nickname.ts`, `src/lib/auth/nickname.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/auth/safe-next-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it.each(["/", "/draft", "/compte?x=1", "/mentions-legales#editeur"])("keeps the internal path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "draft",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/%0a/evil.com\n"
  ])("falls back to / for %j", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});
```

`src/lib/auth/nickname.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateNickname } from "./nickname";

describe("validateNickname", () => {
  it.each(["abc", "Faker", "the_best-mid", "a".repeat(20), "Zed2026"])("accepts %s", (value) => {
    expect(validateNickname(value)).toEqual({ ok: true, nickname: value });
  });

  it("trims surrounding spaces", () => {
    expect(validateNickname("  Faker  ")).toEqual({ ok: true, nickname: "Faker" });
  });

  it("rejects a nickname shorter than 3 characters", () => {
    expect(validateNickname("ab")).toEqual({ ok: false, error: "Le pseudo doit faire au moins 3 caractères." });
  });

  it("rejects a nickname longer than 20 characters", () => {
    expect(validateNickname("a".repeat(21))).toEqual({ ok: false, error: "Le pseudo doit faire au plus 20 caractères." });
  });

  it.each(["with space", "élodie", "emoji🙂", "dot.name", "at@name"])("rejects the characters in %s", (value) => {
    expect(validateNickname(value)).toEqual({
      ok: false,
      error: "Utilisez seulement des lettres sans accent, des chiffres, « _ » et « - »."
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude "**/.claude/**" src/lib/auth`
Expected: FAIL, cannot resolve `./safe-next-path` and `./nickname`.

- [ ] **Step 3: Implement**

`src/lib/auth/safe-next-path.ts`:

```ts
// Where to send the user after signing in. Only a path on this site is
// accepted: anything that a browser could read as another origin ("//host",
// "/\host", a scheme, or control characters that browsers strip) falls back
// to the home page, so the sign-in flow can never become an open redirect.
const PROBE_ORIGIN = "http://draftforme.invalid";

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return "/";

  try {
    return new URL(value, PROBE_ORIGIN).origin === PROBE_ORIGIN ? value : "/";
  } catch {
    return "/";
  }
}
```

`src/lib/auth/nickname.ts`:

```ts
import { z } from "zod";

// Mirrors the check constraint in supabase/migrations/0004_accounts.sql;
// change both together.
export const nicknameSchema = z
  .string()
  .trim()
  .min(3, "Le pseudo doit faire au moins 3 caractères.")
  .max(20, "Le pseudo doit faire au plus 20 caractères.")
  .regex(/^[A-Za-z0-9_-]+$/, "Utilisez seulement des lettres sans accent, des chiffres, « _ » et « - ».");

export type NicknameResult = { ok: true; nickname: string } | { ok: false; error: string };

export function validateNickname(value: string): NicknameResult {
  const parsed = nicknameSchema.safeParse(value);
  return parsed.success ? { ok: true, nickname: parsed.data } : { ok: false, error: parsed.error.issues[0].message };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run --exclude "**/.claude/**" src/lib/auth`
Expected: PASS (all cases). If `"emoji🙂"` or another value first fails on length instead of characters, change only that sample so it is 3-20 characters long; the test is about the character rule.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/safe-next-path.ts src/lib/auth/safe-next-path.test.ts src/lib/auth/nickname.ts src/lib/auth/nickname.test.ts
git commit -m "feat: add the sign-in redirect guard and nickname rules"
```

---

### Task 2: Migration 0004 and database types

**Files:**
- Create: `supabase/migrations/0004_accounts.sql`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0004_accounts.sql`:

```sql
-- Accounts: a public nickname per profile, and self-service account deletion.
-- See docs/superpowers/specs/2026-09-24-draftforme-accounts-design.md.

-- Nicknames: same rule as src/lib/auth/nickname.ts, and unique ignoring case
-- so "Faker" and "faker" cannot both exist. NULL (not chosen yet) is allowed.
alter table public.profiles
  add constraint profiles_display_name_format check (display_name ~ '^[A-Za-z0-9_-]{3,20}$');

create unique index profiles_display_name_lower on public.profiles (lower(display_name));

-- The Riot ID was rejected (unverifiable without the Riot API); these columns
-- were never written.
alter table public.profiles drop column riot_name;
alter table public.profiles drop column riot_tag;

-- Deletes the caller's own auth user and nothing else. The on delete cascade
-- foreign keys from 0001 remove profiles, user_preferences and
-- champion_pool_entries; recommendation_sessions keeps its rows with a null
-- user_id. security definer is needed to reach auth.users; the empty
-- search_path and the fully qualified name keep it from being hijacked.
create function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
```

- [ ] **Step 2: Add the types**

In `src/lib/supabase/types.ts`, add this entry inside `Tables`, right before `champions`:

```ts
      profiles: TableDefinition<
        {
          user_id: string;
          display_name: string | null;
          default_region: string;
          default_role: string;
          created_at: string;
          updated_at: string;
        },
        {
          user_id: string;
          display_name?: string | null;
          default_region?: string;
          default_role?: string;
          created_at?: string;
          updated_at?: string;
        },
        Partial<{
          user_id: string;
          display_name: string | null;
          default_region: string;
          default_role: string;
          created_at: string;
          updated_at: string;
        }>
      >;
```

and replace `Functions: Record<string, never>;` with:

```ts
    Functions: {
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
    };
```

- [ ] **Step 3: Typecheck**

Run: `npx next typegen && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_accounts.sql src/lib/supabase/types.ts
git commit -m "feat: add the accounts migration (nickname rules, account deletion)"
```

(The migration is checked against a real local database in Task 11.)

---

### Task 3: Current user

**Files:**
- Create: `src/lib/auth/current-user.ts`, `src/lib/auth/current-user.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/auth/current-user.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./current-user";

function stubSupabase({ user, displayName }: { user: { id: string } | null; displayName?: string | null }) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: displayName === undefined ? null : { display_name: displayName },
    error: null
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from
  } as never);
  return { from, eq };
}

describe("getCurrentUser", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("returns null when nobody is signed in", async () => {
    stubSupabase({ user: null });
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns the id and the nickname from the profile", async () => {
    const { from, eq } = stubSupabase({ user: { id: "user-1" }, displayName: "Faker" });

    expect(await getCurrentUser()).toEqual({ id: "user-1", nickname: "Faker" });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("returns a null nickname when the profile does not exist yet", async () => {
    stubSupabase({ user: { id: "user-1" } });
    expect(await getCurrentUser()).toEqual({ id: "user-1", nickname: null });
  });

  it("treats an unreachable Supabase as signed out rather than breaking the page", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("Missing NEXT_PUBLIC_SUPABASE_URL"));
    expect(await getCurrentUser()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --exclude "**/.claude/**" src/lib/auth/current-user.test.ts`
Expected: FAIL, cannot resolve `./current-user`.

- [ ] **Step 3: Implement**

`src/lib/auth/current-user.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; nickname: string | null };

// Every public page renders the header with this. Supabase being down or
// unconfigured must not take the page with it: it is treated as signed out.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
    return { id: user.id, nickname: (data as { display_name: string | null } | null)?.display_name ?? null };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run --exclude "**/.claude/**" src/lib/auth/current-user.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck and commit**

Run: `npx next typegen && npx tsc --noEmit` — Expected: no errors.

```bash
git add src/lib/auth/current-user.ts src/lib/auth/current-user.test.ts
git commit -m "feat: add getCurrentUser"
```

---

### Task 4: OAuth login and callback routes

**Files:**
- Modify: `src/app/auth/login/route.ts` (whole file), `src/app/auth/login/route.test.ts` (whole file)
- Modify: `src/app/auth/callback/route.ts` (whole file)
- Create: `src/app/auth/callback/route.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/app/auth/login/route.test.ts` (replaces the stub's test):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

function stubOAuth(result: { data: { url: string | null }; error: Error | null }) {
  const signInWithOAuth = vi.fn().mockResolvedValue(result);
  vi.mocked(createClient).mockResolvedValue({ auth: { signInWithOAuth } } as never);
  return signInWithOAuth;
}

describe("GET /auth/login", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it.each(["discord", "google"] as const)("redirects to the %s authorization page", async (provider) => {
    const signInWithOAuth = stubOAuth({ data: { url: "https://provider.example/authorize?x=1" }, error: null });

    const response = await GET(new Request(`https://draftforme.test/auth/login?provider=${provider}&next=/draft`));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://provider.example/authorize?x=1");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider,
      options: {
        redirectTo: "https://draftforme.test/auth/callback?next=%2Fdraft",
        skipBrowserRedirect: true
      }
    });
  });

  it("rejects an unknown provider without contacting Supabase", async () => {
    const response = await GET(new Request("https://draftforme.test/auth/login?provider=github"));

    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("sanitises the return path", async () => {
    const signInWithOAuth = stubOAuth({ data: { url: "https://provider.example/authorize" }, error: null });

    await GET(new Request("https://draftforme.test/auth/login?provider=discord&next=//evil.com"));

    expect(signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe("https://draftforme.test/auth/callback?next=%2F");
  });

  it("sends the user back to the sign-in page when Supabase fails", async () => {
    stubOAuth({ data: { url: null }, error: new Error("provider disabled") });

    const response = await GET(new Request("https://draftforme.test/auth/login?provider=google"));

    expect(response.headers.get("location")).toBe("https://draftforme.test/connexion?erreur=1");
  });
});
```

`src/app/auth/callback/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

function stubCallback({
  exchangeError = null,
  displayName
}: {
  exchangeError?: Error | null;
  displayName?: string | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: displayName === undefined ? null : { display_name: displayName },
    error: null
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { user: exchangeError ? null : { id: "user-1" } },
        error: exchangeError
      })
    },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) }))
  } as never);
}

const location = (response: Response) => response.headers.get("location");

describe("GET /auth/callback", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("fails back to the sign-in page without a code", async () => {
    const response = await GET(new Request("https://draftforme.test/auth/callback?next=/draft"));
    expect(location(response)).toBe("https://draftforme.test/connexion?erreur=1");
  });

  it("fails back to the sign-in page when the exchange fails", async () => {
    stubCallback({ exchangeError: new Error("bad code") });
    const response = await GET(new Request("https://draftforme.test/auth/callback?code=abc&next=/draft"));
    expect(location(response)).toBe("https://draftforme.test/connexion?erreur=1");
  });

  it("asks for a nickname first when the profile has none", async () => {
    stubCallback({});
    const response = await GET(new Request("https://draftforme.test/auth/callback?code=abc&next=/draft"));
    expect(location(response)).toBe("https://draftforme.test/compte/pseudo?next=%2Fdraft");
  });

  it("returns to the requested page when the nickname exists", async () => {
    stubCallback({ displayName: "Faker" });
    const response = await GET(new Request("https://draftforme.test/auth/callback?code=abc&next=/draft"));
    expect(location(response)).toBe("https://draftforme.test/draft");
  });

  it("never follows an unsafe return path", async () => {
    stubCallback({ displayName: "Faker" });
    const response = await GET(new Request("https://draftforme.test/auth/callback?code=abc&next=//evil.com"));
    expect(location(response)).toBe("https://draftforme.test/");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude "**/.claude/**" src/app/auth`
Expected: FAIL (the stub login route redirects home; the callback has no error path).

- [ ] **Step 3: Implement the login route**

`src/app/auth/login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

const PROVIDERS = ["discord", "google"] as const;
type Provider = (typeof PROVIDERS)[number];

function isProvider(value: string | null): value is Provider {
  return PROVIDERS.includes(value as Provider);
}

// No `scopes` option: Supabase always requests its own default scopes for each
// provider and `scopes` could only add to them. The privacy policy describes
// what those defaults send.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  if (!isProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }

  const callback = new URL("/auth/callback", url.origin);
  callback.searchParams.set("next", safeNextPath(url.searchParams.get("next")));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true }
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/connexion?erreur=1", url.origin));
  }

  return NextResponse.redirect(data.url);
}
```

- [ ] **Step 4: Implement the callback route**

`src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const failure = NextResponse.redirect(new URL("/connexion?erreur=1", url.origin));

  if (!code) return failure;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return failure;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!(profile as { display_name: string | null } | null)?.display_name) {
    const nicknamePage = new URL("/compte/pseudo", url.origin);
    nicknamePage.searchParams.set("next", next);
    return NextResponse.redirect(nicknamePage);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --exclude "**/.claude/**" src/app/auth`
Expected: PASS, 11 tests.

- [ ] **Step 6: Typecheck and commit**

Run: `npx next typegen && npx tsc --noEmit` — Expected: no errors.

```bash
git add src/app/auth/login/route.ts src/app/auth/login/route.test.ts src/app/auth/callback/route.ts src/app/auth/callback/route.test.ts
git commit -m "feat: sign in with Discord or Google through Supabase OAuth"
```

---

### Task 5: Session-refresh middleware

**Files:**
- Create: `src/middleware.ts`

This is framework glue with no logic of its own (the standard `@supabase/ssr` pattern); it has no unit test. Task 11 checks it on a running instance.

- [ ] **Step 1: Write the middleware**

`src/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on every page request, so Server
// Components (which cannot write cookies) always see a live session. It does
// not guard anything: pages that need a user check for one themselves.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  // getUser (not getSession) revalidates the token with Supabase, which is what
  // triggers the refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};
```

- [ ] **Step 2: Typecheck, lint, full suite**

Run: `npx next typegen && npx tsc --noEmit` — Expected: no errors.
Run: `npm run lint` — Expected: no errors.
Run: `npx vitest run --exclude "**/.claude/**"` — Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: refresh the Supabase session in middleware"
```

---

### Task 6: Account Server Actions

**Files:**
- Create: `src/app/compte/actions.ts`, `src/app/compte/actions.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/compte/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  })
}));

import { createClient } from "@/lib/supabase/server";
import { deleteAccount, saveNickname, signOut } from "./actions";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function stubSupabase({
  user = { id: "user-1" } as { id: string } | null,
  upsertError = null as { code: string } | null,
  rpcError = null as Error | null
} = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: upsertError });
  const rpc = vi.fn().mockResolvedValue({ error: rpcError });
  const signOutFn = vi.fn().mockResolvedValue({ error: null });
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }), signOut: signOutFn },
    from: vi.fn(() => ({ upsert })),
    rpc
  } as never);
  return { upsert, rpc, signOut: signOutFn };
}

describe("saveNickname", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("refuses an invalid nickname without touching the database", async () => {
    const { upsert } = stubSupabase();
    expect(await saveNickname({ error: null }, form({ nickname: "ab" }))).toEqual({
      error: "Le pseudo doit faire au moins 3 caractères."
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("saves the nickname and goes to the requested page", async () => {
    const { upsert } = stubSupabase();

    await expect(saveNickname({ error: null }, form({ nickname: " Faker ", next: "/draft" }))).rejects.toThrow(
      "REDIRECT:/draft"
    );
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: "user-1", display_name: "Faker" });
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: "user_id" });
  });

  it("says when the nickname is taken", async () => {
    stubSupabase({ upsertError: { code: "23505" } });
    expect(await saveNickname({ error: null }, form({ nickname: "Faker" }))).toEqual({
      error: "Ce pseudo est déjà pris."
    });
  });

  it("gives a generic message on any other database error", async () => {
    stubSupabase({ upsertError: { code: "08006" } });
    expect(await saveNickname({ error: null }, form({ nickname: "Faker" }))).toEqual({
      error: "Une erreur est survenue. Réessayez plus tard."
    });
  });

  it("sends a signed-out visitor to the sign-in page", async () => {
    stubSupabase({ user: null });
    await expect(saveNickname({ error: null }, form({ nickname: "Faker" }))).rejects.toThrow(
      "REDIRECT:/connexion?next=%2Fcompte"
    );
  });
});

describe("deleteAccount", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("refuses without the exact confirmation word", async () => {
    const { rpc } = stubSupabase();
    expect(await deleteAccount({ error: null }, form({ confirmation: "supprimer" }))).toEqual({
      error: "Tapez SUPPRIMER pour confirmer."
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("deletes the account, signs out and goes home", async () => {
    const { rpc, signOut: signOutFn } = stubSupabase();

    await expect(deleteAccount({ error: null }, form({ confirmation: "SUPPRIMER" }))).rejects.toThrow("REDIRECT:/");
    expect(rpc).toHaveBeenCalledWith("delete_my_account");
    expect(signOutFn).toHaveBeenCalledWith({ scope: "local" });
  });

  it("keeps the session and reports the failure when deletion fails", async () => {
    const { signOut: signOutFn } = stubSupabase({ rpcError: new Error("down") });
    expect(await deleteAccount({ error: null }, form({ confirmation: "SUPPRIMER" }))).toEqual({
      error: "Une erreur est survenue. Réessayez plus tard."
    });
    expect(signOutFn).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("signs out and goes home", async () => {
    const { signOut: signOutFn } = stubSupabase();
    await expect(signOut()).rejects.toThrow("REDIRECT:/");
    expect(signOutFn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --exclude "**/.claude/**" src/app/compte/actions.test.ts`
Expected: FAIL, cannot resolve `./actions`.

- [ ] **Step 3: Implement**

`src/app/compte/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateNickname } from "@/lib/auth/nickname";
import { DELETE_CONFIRMATION } from "@/lib/auth/delete-confirmation";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

// A "use server" file may only export async functions (and types), so the
// confirmation word lives in src/lib/auth/delete-confirmation.ts.
export type FormState = { error: string | null };

const GENERIC_ERROR = "Une erreur est survenue. Réessayez plus tard.";
const UNIQUE_VIOLATION = "23505";

export async function saveNickname(_previous: FormState, formData: FormData): Promise<FormState> {
  const result = validateNickname(String(formData.get("nickname") ?? ""));
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/compte")}`);

  // The profiles row is created here the first time: the insert and update
  // policies from 0001 limit it to the user's own row.
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, display_name: result.nickname, updated_at: new Date().toISOString() } as never, {
      onConflict: "user_id"
    });

  if (error) {
    return { error: (error as { code?: string }).code === UNIQUE_VIOLATION ? "Ce pseudo est déjà pris." : GENERIC_ERROR };
  }

  revalidatePath("/", "layout");
  redirect(safeNextPath(String(formData.get("next") ?? "/compte")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function deleteAccount(_previous: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("confirmation") !== DELETE_CONFIRMATION) {
    return { error: `Tapez ${DELETE_CONFIRMATION} pour confirmer.` };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: GENERIC_ERROR };

  // The auth user no longer exists, so only the local cookies are cleared; a
  // global sign-out would call Supabase about a user it has already deleted.
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/");
}
```

`src/lib/auth/delete-confirmation.ts`:

```ts
// The word a user types to confirm deleting their account.
export const DELETE_CONFIRMATION = "SUPPRIMER";
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run --exclude "**/.claude/**" src/app/compte/actions.test.ts`
Expected: PASS, 9 tests. (`redirect` from `next/navigation` is typed `never`, so `if (!user) redirect(...)` narrows `user` for TypeScript.)

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx next typegen && npx tsc --noEmit` and `npm run lint` — Expected: no errors. If `supabase.rpc("delete_my_account")` fails to typecheck against the hand-written `Database` type, call it as `supabase.rpc("delete_my_account" as never)` like the codebase does for inserts, and keep the test unchanged.

```bash
git add src/app/compte/actions.ts src/app/compte/actions.test.ts src/lib/auth/delete-confirmation.ts
git commit -m "feat: add Server Actions to set the nickname, sign out and delete the account"
```

---

### Task 7: Danger token and the two forms

**Files:**
- Modify: `src/app/globals.css` (inside `:root`, after `--spark`), `tailwind.config.ts` (colors)
- Create: `src/components/auth/nickname-form.tsx`, `src/components/auth/nickname-form.test.tsx`
- Create: `src/components/auth/delete-account-form.tsx`, `src/components/auth/delete-account-form.test.tsx`

- [ ] **Step 1: Add the token**

In `src/app/globals.css`, inside `:root`, right after the `--spark: #0ac8b9;` line:

```css
  --danger: #e05a4a;
```

In `tailwind.config.ts`, add to `theme.extend.colors` after `spark`:

```ts
        danger: "var(--danger)",
```

- [ ] **Step 2: Write the failing tests**

`src/components/auth/nickname-form.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const saveNickname = vi.hoisted(() => vi.fn());
vi.mock("@/app/compte/actions", () => ({ saveNickname }));

import { NicknameForm } from "./nickname-form";

describe("NicknameForm", () => {
  it("prefills the current nickname and carries the return path", () => {
    const { container } = render(<NicknameForm defaultValue="Faker" next="/draft" />);

    expect(screen.getByLabelText("Pseudo")).toHaveValue("Faker");
    expect(container.querySelector('input[name="next"]')).toHaveValue("/draft");
    expect(screen.getByText(/visible publiquement/)).toBeInTheDocument();
  });

  it("shows the error the action returns", async () => {
    saveNickname.mockResolvedValue({ error: "Ce pseudo est déjà pris." });
    render(<NicknameForm next="/" />);

    fireEvent.change(screen.getByLabelText("Pseudo"), { target: { value: "Faker" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Ce pseudo est déjà pris.");
  });
});
```

`src/components/auth/delete-account-form.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const deleteAccount = vi.hoisted(() => vi.fn());
vi.mock("@/app/compte/actions", () => ({ deleteAccount }));

import { DeleteAccountForm } from "./delete-account-form";

describe("DeleteAccountForm", () => {
  it("explains what is deleted and asks for the confirmation word", () => {
    render(<DeleteAccountForm />);

    expect(screen.getByText(/définitive/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tapez SUPPRIMER/)).toBeInTheDocument();
  });

  it("shows the error the action returns", async () => {
    deleteAccount.mockResolvedValue({ error: "Tapez SUPPRIMER pour confirmer." });
    render(<DeleteAccountForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Tapez SUPPRIMER pour confirmer.");
  });
});
```

If React's form actions do not fire from a click in jsdom (the second test of each file times out), replace the click with `fireEvent.submit(screen.getByRole("button", { name: … }).closest("form")!)`; if that still does not call the mocked action, delete only the "shows the error" test in both files and report it: the action's messages are already covered by `actions.test.ts`.

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run --exclude "**/.claude/**" src/components/auth`
Expected: FAIL, cannot resolve the components.

- [ ] **Step 4: Implement**

`src/components/auth/nickname-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { saveNickname, type FormState } from "@/app/compte/actions";

const INITIAL: FormState = { error: null };

export function NicknameForm({ defaultValue, next }: { defaultValue?: string; next: string }) {
  const [state, action, pending] = useActionState(saveNickname, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <label htmlFor="nickname" className="block text-sm font-medium text-ink">
        Pseudo
      </label>
      <input
        id="nickname"
        name="nickname"
        defaultValue={defaultValue}
        required
        minLength={3}
        maxLength={20}
        autoComplete="nickname"
        aria-describedby="nickname-help"
        className="w-full max-w-sm rounded-md border border-rule bg-surface px-3 py-2 text-ink focus:border-accent focus:outline-none"
      />
      <p id="nickname-help" className="text-xs text-ink-faint">
        3 à 20 caractères : lettres sans accent, chiffres, « _ » et « - ». Il sera visible publiquement.
      </p>
      <input type="hidden" name="next" value={next} />
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-opacity duration-200 disabled:opacity-60"
      >
        Enregistrer
      </button>
    </form>
  );
}
```

`src/components/auth/delete-account-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { deleteAccount, type FormState } from "@/app/compte/actions";
import { DELETE_CONFIRMATION } from "@/lib/auth/delete-confirmation";

const INITIAL: FormState = { error: null };

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-ink-muted">
        La suppression est définitive : votre compte et votre pseudo sont effacés immédiatement.
      </p>
      <label htmlFor="confirmation" className="block text-sm text-ink">
        Tapez {DELETE_CONFIRMATION} pour confirmer
      </label>
      <input
        id="confirmation"
        name="confirmation"
        autoComplete="off"
        className="w-full max-w-sm rounded-md border border-rule bg-surface px-3 py-2 text-ink focus:border-accent focus:outline-none"
      />
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger transition-opacity duration-200 disabled:opacity-60"
      >
        Supprimer mon compte
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Run them to verify they pass**

Run: `npx vitest run --exclude "**/.claude/**" src/components/auth`
Expected: PASS, 4 tests (or 2 if the fallback in Step 2 applied; report it).

- [ ] **Step 6: Typecheck, lint, commit**

Run: `npx next typegen && npx tsc --noEmit` and `npm run lint` — Expected: no errors.

```bash
git add src/app/globals.css tailwind.config.ts src/components/auth/nickname-form.tsx src/components/auth/nickname-form.test.tsx src/components/auth/delete-account-form.tsx src/components/auth/delete-account-form.test.tsx
git commit -m "feat: add the nickname and account deletion forms"
```

---

### Task 8: Account menu in the header, and the shared page shell

**Files:**
- Create: `src/components/auth/account-menu.tsx`, `src/components/auth/account-menu.test.tsx`
- Modify: `src/components/marketing/site-header.tsx`, `src/components/marketing/site-header.test.tsx`
- Create: `src/components/marketing/site-shell.tsx`
- Modify: `src/app/(legal)/layout.tsx`, `src/app/page.tsx`, `src/app/draft/page.tsx`

- [ ] **Step 1: Write the failing tests**

`src/components/auth/account-menu.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/compte/actions", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/draft" }));

import { AccountMenu } from "./account-menu";

describe("AccountMenu", () => {
  it("offers to sign in, coming back to the current page", () => {
    render(<AccountMenu user={null} />);
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/connexion?next=%2Fdraft");
  });

  it("shows the nickname, the account link and sign-out when signed in", () => {
    render(<AccountMenu user={{ id: "user-1", nickname: "Faker" }} />);

    expect(screen.getByRole("link", { name: "Faker" })).toHaveAttribute("href", "/compte");
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Se connecter" })).not.toBeInTheDocument();
  });

  it("asks a signed-in user without a nickname to choose one", () => {
    render(<AccountMenu user={{ id: "user-1", nickname: null }} />);
    expect(screen.getByRole("link", { name: "Choisir un pseudo" })).toHaveAttribute(
      "href",
      "/compte/pseudo?next=%2Fdraft"
    );
  });
});
```

Add at the top of `src/components/marketing/site-header.test.tsx`, after the existing imports:

```tsx
vi.mock("@/app/compte/actions", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
```

(add `vi` to its `vitest` import), and this case inside its `describe`:

```tsx
  it("shows the account menu for the user it is given", () => {
    render(<SiteHeader current="home" user={{ id: "user-1", nickname: "Faker" }} />);
    expect(screen.getByRole("link", { name: "Faker" })).toHaveAttribute("href", "/compte");
  });

  it("offers to sign in when nobody is signed in", () => {
    render(<SiteHeader current="home" user={null} />);
    expect(screen.getByRole("link", { name: "Se connecter" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude "**/.claude/**" src/components/auth/account-menu.test.tsx src/components/marketing/site-header.test.tsx`
Expected: FAIL, `AccountMenu` missing and the header has no `user` prop.

- [ ] **Step 3: Implement the menu**

`src/components/auth/account-menu.tsx`:

```tsx
"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/compte/actions";
import type { CurrentUser } from "@/lib/auth/current-user";

const LINK = "rounded-md px-3 py-2 text-sm text-ink-muted transition-colors duration-200 hover:text-ink";

export function AccountMenu({ user }: { user: CurrentUser | null }) {
  const next = encodeURIComponent(usePathname() ?? "/");

  if (!user) {
    return (
      <Link href={`/connexion?next=${next}` as Route} className={LINK}>
        Se connecter
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {user.nickname ? (
        <Link href="/compte" className={`${LINK} font-medium text-ink`}>
          {user.nickname}
        </Link>
      ) : (
        <Link href={`/compte/pseudo?next=${next}` as Route} className={LINK}>
          Choisir un pseudo
        </Link>
      )}
      <form action={signOut}>
        <button type="submit" className={LINK}>
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Wire it into the header**

In `src/components/marketing/site-header.tsx`:
- add imports `import { AccountMenu } from "@/components/auth/account-menu";` and `import type { CurrentUser } from "@/lib/auth/current-user";`;
- change the signature to
  `export function SiteHeader({ context, current, user = null }: { context?: string; current?: "home" | "draft"; user?: CurrentUser | null }) {`;
- in the right-hand `<div className="flex items-center gap-4">`, add `<AccountMenu user={user} />` as the last child, after the "Lancer une draft" block.

- [ ] **Step 5: Add the shell and pass the user everywhere**

`src/components/marketing/site-shell.tsx`:

```tsx
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

// Header, main and footer for pages that have no header context of their own
// (legal and account pages). Async because the header shows the signed-in user.
export async function SiteShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
```

`src/app/(legal)/layout.tsx` becomes:

```tsx
import type { ReactNode } from "react";
import { SiteShell } from "@/components/marketing/site-shell";

export default function LegalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SiteShell>{children}</SiteShell>;
}
```

In `src/app/page.tsx`: import `getCurrentUser` from `@/lib/auth/current-user`, replace `const example = await loadExampleOrEmpty();` with
`const [example, user] = await Promise.all([loadExampleOrEmpty(), getCurrentUser()]);`
and pass `user={user}` to `<SiteHeader current="home" … />`.

In `src/app/draft/page.tsx`: the same two changes, with `<SiteHeader current="draft" … />`.

- [ ] **Step 6: Run the tests, typecheck, lint**

Run: `npx vitest run --exclude "**/.claude/**"` — Expected: all pass.
Run: `npx next typegen && npx tsc --noEmit` and `npm run lint` — Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/auth/account-menu.tsx src/components/auth/account-menu.test.tsx src/components/marketing/site-header.tsx src/components/marketing/site-header.test.tsx src/components/marketing/site-shell.tsx "src/app/(legal)/layout.tsx" src/app/page.tsx src/app/draft/page.tsx
git commit -m "feat: show the account menu in the header"
```

---

### Task 9: Sign-in, nickname and account pages

**Files:**
- Create: `src/app/(account)/layout.tsx`
- Create: `src/app/(account)/connexion/page.tsx`
- Create: `src/app/(account)/compte/pseudo/page.tsx`
- Create: `src/app/(account)/compte/page.tsx`

These pages only compose tested pieces (`getCurrentUser`, `safeNextPath`, the forms, the actions); they have no unit test of their own. Task 11 checks them in the browser.

- [ ] **Step 1: Layout**

`src/app/(account)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { SiteShell } from "@/components/marketing/site-shell";

export default function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SiteShell>{children}</SiteShell>;
}
```

- [ ] **Step 2: Sign-in page**

`src/app/(account)/connexion/page.tsx`:

```tsx
import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/safe-next-path";

export const metadata: Metadata = {
  title: "Connexion — DraftForMe",
  description: "Connectez-vous à DraftForMe avec Discord ou Google."
};

const BUTTON =
  "block w-full rounded-md border border-rule bg-surface px-4 py-3 text-center text-sm font-medium text-ink transition-colors duration-200 hover:border-accent";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; erreur?: string }>;
}) {
  const { next, erreur } = await searchParams;
  const safeNext = safeNextPath(next);

  if (await getCurrentUser()) redirect(safeNext as Route);

  const loginHref = (provider: "discord" | "google") =>
    `/auth/login?provider=${provider}&next=${encodeURIComponent(safeNext)}`;

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">Connexion</h1>
      <p className="mt-3 text-sm text-ink-muted">
        Un compte vous permettra bientôt de donner votre avis sur les matchups. L&apos;outil de draft reste
        utilisable sans compte.
      </p>
      {erreur && (
        <p role="alert" className="mt-6 text-sm text-danger">
          La connexion a échoué. Réessayez.
        </p>
      )}
      <div className="mt-8 space-y-3">
        {/* Plain <a>: these are route handlers that redirect to the provider, not pages to prefetch. */}
        <a href={loginHref("discord")} className={BUTTON}>
          Continuer avec Discord
        </a>
        <a href={loginHref("google")} className={BUTTON}>
          Continuer avec Google
        </a>
      </div>
      <p className="mt-8 text-xs text-ink-faint">
        En vous connectant, vous acceptez les{" "}
        <Link href="/conditions-utilisation" className="underline underline-offset-2 hover:text-ink">
          conditions d&apos;utilisation
        </Link>{" "}
        et la{" "}
        <Link href="/confidentialite" className="underline underline-offset-2 hover:text-ink">
          politique de confidentialité
        </Link>
        .
      </p>
    </div>
  );
}
```

("bientôt": reviews ship in the next piece of work; the page must not claim they exist yet.)

- [ ] **Step 3: Nickname page**

`src/app/(account)/compte/pseudo/page.tsx`:

```tsx
import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { NicknameForm } from "@/components/auth/nickname-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/safe-next-path";

export const metadata: Metadata = {
  title: "Choisir un pseudo — DraftForMe"
};

export default async function NicknamePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);
  const user = await getCurrentUser();

  if (!user) redirect(`/connexion?next=${encodeURIComponent("/compte/pseudo")}` as Route);

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">
        {user.nickname ? "Changer de pseudo" : "Choisissez votre pseudo"}
      </h1>
      <p className="mt-3 mb-8 text-sm text-ink-muted">
        C&apos;est le seul nom affiché sur le site. Votre nom Discord ou Google n&apos;est jamais montré.
      </p>
      <NicknameForm defaultValue={user.nickname ?? undefined} next={safeNext} />
    </div>
  );
}
```

- [ ] **Step 4: Account page**

`src/app/(account)/compte/page.tsx`:

```tsx
import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/compte/actions";
import { DeleteAccountForm } from "@/components/auth/delete-account-form";
import { NicknameForm } from "@/components/auth/nickname-form";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Mon compte — DraftForMe"
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/compte")}` as Route);

  return (
    <div className="mx-auto max-w-lg space-y-12 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">Mon compte</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Pseudo</h2>
        <NicknameForm defaultValue={user.nickname ?? undefined} next="/compte" />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Session</h2>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-rule px-4 py-2 text-sm text-ink-muted transition-colors duration-200 hover:text-ink"
          >
            Se déconnecter
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Supprimer mon compte</h2>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck, lint, full suite**

Run: `npx next typegen && npx tsc --noEmit`, `npm run lint`, `npx vitest run --exclude "**/.claude/**"` — Expected: all clean. If typedRoutes rejects `redirect(... as Route)`, drop the `as Route` on `redirect` calls only (redirect takes a plain string); keep it on `Link` hrefs.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(account)/layout.tsx" "src/app/(account)/connexion/page.tsx" "src/app/(account)/compte/pseudo/page.tsx" "src/app/(account)/compte/page.tsx"
git commit -m "feat: add the sign-in, nickname and account pages"
```

---

### Task 10: Stop recording drafts, and update the legal pages

**Files:**
- Modify: `src/app/api/recommend/route.ts` (remove the `if (user) { … recommendation_sessions … }` block), `src/app/api/recommend/route.test.ts` (replace the insert test)
- Modify: `src/lib/legal/site-info.ts` (+ `site-info.test.ts`), `src/components/legal/privacy-policy.tsx` (+ test), `src/components/legal/terms-of-use.tsx` (+ test)

- [ ] **Step 1: Replace the draft-history test (failing first)**

In `src/app/api/recommend/route.test.ts`, replace the whole test `it("inserts enemy champion ids, not pick objects, into the session row", …)` and the comment above it with:

```ts
  // Accounts must not start a silent collection: a signed-in user's drafts are
  // not recorded (see docs/superpowers/specs/2026-09-24-draftforme-accounts-design.md).
  it("does not record the draft of a signed-in user", async () => {
    const tablesTouched: string[] = [];

    const supabaseStub = {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }) },
      from: (table: string) => {
        tablesTouched.push(table);
        return {
          ...makeQuery({ data: [], error: null }),
          insert: () => Promise.resolve({ data: null, error: null })
        };
      }
    };

    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(supabaseStub as never);

    const { POST } = await import("./route");
    await POST(
      new Request("http://localhost/api/recommend", {
        method: "POST",
        body: JSON.stringify({
          role: "mid",
          region: "euw",
          tier: "emerald_plus",
          enemyPicks: [{ championId: "zed", role: "mid" }],
          allyPicks: [],
          bans: []
        })
      })
    );

    expect(tablesTouched).not.toContain("recommendation_sessions");
  });
```

Run: `npx vitest run --exclude "**/.claude/**" src/app/api/recommend` — Expected: this test FAILS.

- [ ] **Step 2: Remove the insert**

In `src/app/api/recommend/route.ts`, delete the block:

```ts
  if (user) {
    await supabase.from("recommendation_sessions").insert({
      …
    } as never);
  }
```

Keep `user` (still used for the champion pool query) and `enemyChampionIds` (still used for `alreadyPickedChampionIds`).

Run: `npx vitest run --exclude "**/.claude/**" src/app/api/recommend` — Expected: PASS.

Commit:

```bash
git add src/app/api/recommend/route.ts src/app/api/recommend/route.test.ts
git commit -m "fix: stop recording signed-in users' drafts"
```

- [ ] **Step 3: Database host lookup**

In `src/lib/legal/site-info.ts`, add after `getSiteHost`:

```ts
export function getDatabaseHost(info: SiteInfo): Host {
  const host = info.hosts.find((candidate) => candidate.role === "database");
  if (!host) throw new Error('SiteInfo has no host with role "database".');
  return host;
}
```

and set `lastUpdated: "2026-09-24"`. In `src/lib/legal/site-info.test.ts` add, mirroring the existing `getSiteHost` tests:

```ts
describe("getDatabaseHost", () => {
  it("returns Supabase for the real config", () => {
    expect(getDatabaseHost(SITE_INFO).name).toBe("Supabase Pte. Ltd.");
  });

  it("throws when no database host is configured", () => {
    expect(() => getDatabaseHost({ ...SITE_INFO, hosts: SITE_INFO.hosts.filter((h) => h.role !== "database") })).toThrow(
      /role "database"/
    );
  });
});
```

(import `getDatabaseHost` in the test).

- [ ] **Step 4: Update the privacy policy tests (failing first)**

In `src/components/legal/privacy-policy.test.tsx`:
- in "has every expected section", add `"Compte"` to the list (between "Données traitées" and "Vos droits");
- replace the test "states that no cookie is set" with:

```tsx
  it("says only session cookies are set, and only when signing in", () => {
    render(<PrivacyPolicy info={noContact} />);
    expect(screen.getByText(/cookies de session/)).toBeInTheDocument();
    expect(screen.getByText(/exemptés de consentement/)).toBeInTheDocument();
    expect(screen.queryByText(/ne propose ni compte/)).not.toBeInTheDocument();
  });

  it("describes the account data, its basis, its retention and the processors", () => {
    render(<PrivacyPolicy info={noContact} />);

    expect(screen.getByText(/article 6\.1\.b du RGPD/)).toBeInTheDocument();
    expect(screen.getByText(/jusqu'à la suppression de votre compte/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /politique de confidentialité de Discord/ })).toHaveAttribute(
      "href",
      "https://discord.com/privacy"
    );
    expect(screen.getByRole("link", { name: /politique de confidentialité de Google/ })).toHaveAttribute(
      "href",
      "https://policies.google.com/privacy?hl=fr"
    );
    expect(screen.getByRole("link", { name: /politique de confidentialité de Supabase/ })).toHaveAttribute(
      "href",
      "https://supabase.com/privacy"
    );
    expect(screen.getAllByRole("link", { name: "Mon compte" })[0]).toHaveAttribute("href", "/compte");
  });

  it("no longer announces accounts as upcoming", () => {
    render(<PrivacyPolicy info={noContact} />);
    expect(screen.queryByText(/création de comptes/)).not.toBeInTheDocument();
  });
```

Run: `npx vitest run --exclude "**/.claude/**" src/components/legal/privacy-policy.test.tsx` — Expected: FAIL.

- [ ] **Step 5: Update the privacy policy**

In `src/components/legal/privacy-policy.tsx`:
- import `Link` from `next/link`, `getDatabaseHost` from `@/lib/legal/site-info`, and `LEGAL_LINK_CLASS` from `./legal-page`; add `const databaseHost = getDatabaseHost(info);` next to `siteHost`.
- Replace the first paragraph of "Données traitées" with:

```tsx
        <p>
          Si vous n&apos;avez pas de compte, aucune donnée vous concernant n&apos;est enregistrée dans la base de{" "}
          {info.siteName}. Deux traitements techniques ont lieu pour tous les visiteurs ; la section « Compte »
          décrit ce qui s&apos;y ajoute si vous vous connectez.
        </p>
```

- Insert this section between "Données traitées" and "Vos droits":

```tsx
      <LegalSection title="Compte">
        <p>
          Si vous vous connectez avec Discord ou Google, {info.siteName} enregistre l&apos;identifiant de votre compte
          chez ce fournisseur, votre adresse e-mail, les informations de profil que le fournisseur transmet (nom
          d&apos;utilisateur ou nom, photo de profil), les dates de création du compte et de dernière connexion, et le
          pseudo que vous choisissez. Seul ce pseudo est affiché sur le site.
        </p>
        <p>
          Finalité : vous permettre de vous connecter et d&apos;utiliser les fonctions réservées aux comptes. Base
          légale : l&apos;exécution du service que vous demandez en créant un compte (article 6.1.b du RGPD). Durée
          de conservation : jusqu&apos;à la suppression de votre compte, que vous pouvez faire à tout moment depuis la
          page{" "}
          <Link href="/compte" className={LEGAL_LINK_CLASS}>
            Mon compte
          </Link>
          .
        </p>
        <p>
          Ces données sont stockées par {databaseHost.name}, sous-traitant de l&apos;éditeur (
          <ExternalLink href={databaseHost.privacyPolicy}>politique de confidentialité de Supabase</ExternalLink>).
          La connexion elle-même est traitée par Discord ou Google selon leurs propres règles :{" "}
          <ExternalLink href="https://discord.com/privacy">politique de confidentialité de Discord</ExternalLink>,{" "}
          <ExternalLink href="https://policies.google.com/privacy?hl=fr">
            politique de confidentialité de Google
          </ExternalLink>
          .
        </p>
      </LegalSection>
```

- In "Vos droits", the first paragraph becomes (the contact part is unchanged):

```tsx
        <p>
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
          limitation et d&apos;opposition sur les données vous concernant. Vous pouvez aussi supprimer votre compte
          vous-même depuis la page{" "}
          <Link href="/compte" className={LEGAL_LINK_CLASS}>
            Mon compte
          </Link>
          .
          {info.contactEmail && (
            <>
              {" "}
              Pour les exercer, écrivez à <ContactLink email={info.contactEmail} />.
            </>
          )}
        </p>
```
- Replace the "Cookies" paragraph with:

```tsx
        <p>
          {info.siteName} ne dépose aucun cookie de mesure d&apos;audience ni publicitaire. Si vous vous connectez,
          des cookies de session sont déposés pour vous garder connecté : ils sont strictement nécessaires au service
          que vous demandez, donc exemptés de consentement, et sont supprimés à la déconnexion. Aucun consentement ne
          vous est donc demandé.
        </p>
```

- Replace the "Évolutions à venir" paragraph with:

```tsx
        <p>
          Des avis sur les matchups sont prévus. Cette politique sera mise à jour avant leur ouverture pour décrire les
          données qu&apos;ils impliquent.
        </p>
```

Run: `npx vitest run --exclude "**/.claude/**" src/components/legal` — Expected: PASS, including the existing punctuation test (no "..", no space before "." or ","). The Supabase sentence renders as "…sous-traitant de l'éditeur (politique de confidentialité de Supabase (nouvel onglet)). La connexion…"; the "(nouvel onglet)" is the screen-reader-only suffix of `ExternalLink`.

- [ ] **Step 6: Update the terms (test first)**

In `src/components/legal/terms-of-use.test.tsx`, add `"Compte"` to the section list (after "Accès au service") and add:

```tsx
  it("sets the account rules", () => {
    render(<TermsOfUse info={SITE_INFO} />);
    expect(screen.getByText(/au moins 13 ans/)).toBeInTheDocument();
    expect(screen.getByText(/usurper l'identité/)).toBeInTheDocument();
    expect(screen.getByText(/renommer ou supprimer un compte/)).toBeInTheDocument();
  });
```

Run it — Expected: FAIL. Then in `src/components/legal/terms-of-use.tsx`:
- replace the "Accès au service" paragraph's first sentence "Le site est gratuit et accessible sans inscription." with "Le site est gratuit. Ses outils sont accessibles sans inscription ; un compte n'est nécessaire que pour les fonctions qui le précisent." (with `&apos;` escapes in JSX);
- insert after "Accès au service":

```tsx
      <LegalSection title="Compte">
        <p>
          Vous pouvez créer un compte avec Discord ou Google si vous avez au moins 13 ans. Vous choisissez un pseudo
          public : il ne doit ni usurper l&apos;identité d&apos;une autre personne, ni être injurieux, haineux ou
          contraire à la loi. L&apos;éditeur peut renommer ou supprimer un compte qui enfreint ces règles. Vous pouvez
          supprimer votre compte à tout moment depuis la page{" "}
          <Link href="/compte" className={LEGAL_LINK_CLASS}>
            Mon compte
          </Link>
          .
        </p>
      </LegalSection>
```

Run: `npx vitest run --exclude "**/.claude/**" src/components/legal src/lib/legal` — Expected: PASS.

- [ ] **Step 7: Full checks and commit**

Run: `npx vitest run --exclude "**/.claude/**"`, `npx next typegen && npx tsc --noEmit`, `npm run lint` — Expected: all clean.

```bash
git add src/lib/legal/site-info.ts src/lib/legal/site-info.test.ts src/components/legal/privacy-policy.tsx src/components/legal/privacy-policy.test.tsx src/components/legal/terms-of-use.tsx src/components/legal/terms-of-use.test.tsx
git commit -m "docs: describe accounts in the privacy policy and terms of use"
```

---

### Task 11: Check against a real local Supabase (controller, not a subagent)

Needs Docker running and `.env.local` pointing at the local instance; the owner's production project is never used.

- [ ] **Step 1:** `npx supabase start`, then `npx supabase db reset` (applies 0001-0004 and the seed). If Docker or the CLI is unavailable, skip Steps 1-3 and record in the spec that the migration was not run locally.
- [ ] **Step 2:** In `npx supabase db` SQL (psql via `docker exec` or the Studio SQL editor at the printed URL), as the service role: create two auth users, insert profiles `Faker` and `faker` → the second must fail with `23505`; insert `ab` → fails the check constraint; call `delete_my_account()` with `request.jwt.claims` set to the first user (`select set_config('request.jwt.claims', '{"sub":"<id>","role":"authenticated"}', true); set role authenticated; select public.delete_my_account();`) → only the first user and its profile disappear.
- [ ] **Step 3:** Verify as `anon` that `select public.delete_my_account();` is denied.
- [ ] **Step 4:** Start the dev server against the local instance and check in the browser: header shows "Se connecter"; `/connexion` renders both buttons and the `?erreur=1` message; `/compte` and `/compte/pseudo` redirect to `/connexion?next=…` when signed out; mobile width has no horizontal scroll; the privacy policy and terms pages render the new sections. OAuth itself cannot be completed locally without the owner's provider apps; record that.
- [ ] **Step 5:** `npx supabase stop`. Update the spec with what was verified and anything that could not be, and commit `docs: record the accounts verification`.
