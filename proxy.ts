import { NextResponse, type NextRequest } from "next/server.js";
import { IDENTITY_COOKIE } from "@/lib/auth/constants";
import { getActorForSession } from "@/lib/repositories/authSessions";
import { canReviewClientRequests } from "@/lib/requestAccess";

// `/manifest.webmanifest` giriş kontrolünün DIŞINDA olmalı: tarayıcı "ana ekrana
// ekle" için onu oturum çerezi olmadan da isteyebiliyor, gate'lenirse istek
// /whoami'ye yönleniyor ve uygulama adı/ikonu hiç okunmuyor. İçinde gizli veri yok.
const PUBLIC_PATHS = [
  "/whoami",
  "/manifest.webmanifest",

  "/inturlam-logo.jpg",
  "/logos",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// Giriş/kimlik seçim ekranları. Oturumu OLAN biri buraya gelirse giriş formu
// gösterilmez, kendi ana ekranına gönderilir: aksi halde uygulama kabuğu
// (sidebar + üst çubuk) çevresinde bir giriş formu çiziliyor ve ekran "hem
// giriş yapmışım hem yapmamışım" gibi görünüyordu.
function isLoginPath(pathname: string): boolean {
  return pathname === "/whoami" || pathname.startsWith("/whoami/");
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
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(IDENTITY_COOKIE)?.value;
  const actor = token ? getActorForSession(token) : undefined;

  // Oturumu olmayan için giriş ekranları ve marka logoları serbest. Bu kontrol
  // aktörü ÇÖZDÜKTEN sonra: giriş yapmış biri giriş ekranına düşmemeli.
  if (!actor && isPublicPath(pathname)) return NextResponse.next();

  if (actor?.kind === "guest") {
    if (isLoginPath(pathname)) return NextResponse.redirect(new URL("/guest", request.url));
    if (isPublicPath(pathname)) return NextResponse.next();
    if (isGuestPath(pathname)) return NextResponse.next();
    return request.method === "GET" || request.method === "HEAD"
      ? NextResponse.redirect(new URL("/guest", request.url))
      : NextResponse.json({ error: "Bu alan için yetkin yok." }, { status: 403 });
  }
  if (actor?.kind === "team") {
    const person = actor.person;
    if (isLoginPath(pathname)) return NextResponse.redirect(new URL("/", request.url));
    if (isPublicPath(pathname)) return NextResponse.next();
    if (isGuestPath(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (isReportPath(pathname) && person.is_manager !== 1) {
      return forbiddenClientRequestResponse(request);
    }
    if (isClientRequestPath(pathname) && !canReviewClientRequests(person)) {
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
