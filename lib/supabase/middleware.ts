import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Refresh the auth session on every request and enforce that all routes
// except /login (and static assets, handled by the matcher) require a user.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  // Inbound webhooks authenticate with a shared secret (see the route), not an
  // app session, and must be reachable by third parties like GoHighLevel.
  const isPublicWebhook = pathname.startsWith("/api/webhooks/");

  if (isPublicWebhook) {
    return supabaseResponse;
  }

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // Per-request DB check of the caller's live profile. A Supabase ban does NOT
  // invalidate an already-issued access token (it only blocks new logins and
  // refresh), so we cannot rely on getUser() to reflect deactivation mid-
  // session. Instead we read profiles over PostgREST via fetch — which IS
  // available on the Edge runtime, unlike a Postgres driver — using the service
  // role. This makes deactivation take effect on the user's very NEXT request,
  // and gates the admin-only area against the DB role (the source of truth).
  if (user) {
    const status = await fetchProfileStatus(user.id);

    if (status?.deactivated) {
      // Kill the session immediately: expire the auth cookies and bounce to
      // login. Clearing the cookies is what breaks the redirect loop (the next
      // request is unauthenticated, so /login renders normally).
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("deactivated", "1");
      const res = NextResponse.redirect(url);
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith("sb-")) res.cookies.delete(c.name);
      }
      return res;
    }

    if (
      pathname.startsWith("/settings/users") &&
      status &&
      status.role !== "admin"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

/**
 * Read a user's live { role, deactivated } from profiles via PostgREST. Uses
 * the service role (server-side env var, never shipped to the client) to bypass
 * RLS. Fails OPEN (returns null) on any error so a transient blip can't lock
 * everyone out — deactivation is also enforced at login, in the app layout, and
 * in every Server Action.
 */
async function fetchProfileStatus(
  userId: string,
): Promise<{ role: string; deactivated: boolean } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/profiles?id=eq.${userId}&select=role,deactivated_at`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      role: string;
      deactivated_at: string | null;
    }[];
    const row = rows[0];
    if (!row) return null;
    return { role: row.role, deactivated: row.deactivated_at != null };
  } catch {
    return null;
  }
}
