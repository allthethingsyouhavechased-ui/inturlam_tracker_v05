import { NextResponse, type NextRequest } from "next/server.js";
import { IDENTITY_COOKIE } from "@/lib/auth/constants";
import { getActorForSession } from "@/lib/repositories/authSessions";
import { canReviewClientRequests } from "@/lib/requestAccess";

const PUBLIC_PATHS = ["/whoami", "/inturlam-logo.jpg", "/logos"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function unauthenticatedResponse(request: NextRequest, hadCookie: boolean): NextResponse {
  const response = request.method === "GET" || request.method === "HEAD"
    ? NextResponse.redirect(new URL("/whoami", request.url))
    : NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  if (hadCookie) response.cookies.delete(IDENTITY_COOKIE);
  return response;
}

function isClientRequestPath(pathname: string): boolean {
  return pathname === "/requests" || pathname.startsWith("/requests/");
}

function isReportPath(pathname: string): boolean {
  return pathname === "/reports" || pathname.startsWith("/reports/");
}

function isGuestPath(pathname: string): boolean {
  return pathname === "/guest" || pathname.startsWith("/guest/");
}

function forbiddenClientRequestResponse(request: NextRequest): NextResponse {
  return request.method === "GET" || request.method === "HEAD"
    ? NextResponse.redirect(new URL("/", request.url))
    : NextResponse.json({ error: "Bu alan için yetkin yok." }, { status: 403 });
}

export function proxy(request: NextRequest): NextResponse {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();

  const token = request.cookies.get(IDENTITY_COOKIE)?.value;
  const actor = token ? getActorForSession(token) : undefined;
  if (actor?.kind === "guest") {
    if (isGuestPath(request.nextUrl.pathname)) return NextResponse.next();
    return request.method === "GET" || request.method === "HEAD"
      ? NextResponse.redirect(new URL("/guest", request.url))
      : NextResponse.json({ error: "Bu alan için yetkin yok." }, { status: 403 });
  }
  if (actor?.kind === "team") {
    const person = actor.person;
    if (isGuestPath(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (isReportPath(request.nextUrl.pathname) && person.is_manager !== 1) {
      return forbiddenClientRequestResponse(request);
    }
    if (isClientRequestPath(request.nextUrl.pathname) && !canReviewClientRequests(person)) {
      return forbiddenClientRequestResponse(request);
    }
    return NextResponse.next();
  }

  return unauthenticatedResponse(request, Boolean(token));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon\\.jpg|favicon\\.ico|uploads/).*)",
  ],
};
