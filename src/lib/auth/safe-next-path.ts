// Where to send the user after signing in. Only a path on this site is
// accepted: anything that a browser could read as another origin ("//host",
// "/\host", a scheme, or control characters that browsers strip) falls back
// to the home page, so the sign-in flow can never become an open redirect.
const PROBE_ORIGIN = "http://draftforme.invalid";

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return "/";

  try {
    const url = new URL(value, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return "/";

    const normalised = `${url.pathname}${url.search}${url.hash}`;
    return normalised.startsWith("//") ? "/" : normalised;
  } catch {
    return "/";
  }
}
