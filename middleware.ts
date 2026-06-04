import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const guid = request.cookies.get("bizbox_guid")?.value;

  const pathname = request.nextUrl.pathname;

  const protectedRoutes = [
    "/dashboard",
    "/customers",
    "/invoices",
    "/inbox",
    "/sent",
    "/drafts",
    "/settings",
  ];

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected && !guid) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/invoices/:path*",
    "/inbox/:path*",
    "/sent/:path*",
    "/drafts/:path*",
    "/settings/:path*",
  ],
};