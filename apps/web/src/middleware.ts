import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function resolveLocale(request: NextRequest): string {
  // 1. Explicit user preference (set by profile update)
  const userLocale = request.cookies.get("user-language")?.value;
  if (userLocale === "en" || userLocale === "nl") return userLocale;

  // 2. Accept-Language header
  const acceptLang = request.headers.get("accept-language") || "";
  if (acceptLang.startsWith("en")) return "en";

  // 3. Default to Dutch
  return "nl";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths - no auth needed
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/magic-link") ||
    pathname.startsWith("/api")
  ) {
    const response = NextResponse.next();
    const locale = resolveLocale(request);
    response.cookies.set("NEXT_LOCALE", locale, { path: "/" });
    return response;
  }

  // Check for session cookie (Better Auth uses "better-auth.session_token" cookie)
  const sessionCookie = request.cookies.get("better-auth.session_token");
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  const locale = resolveLocale(request);
  response.cookies.set("NEXT_LOCALE", locale, { path: "/" });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
