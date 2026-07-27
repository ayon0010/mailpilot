import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "./lib/auth-config";

const { auth } = NextAuth(authConfig);

const publicRoutes = ["/", "/signup"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  const isPublicRoute = publicRoutes.includes(pathname);

  console.log(isLoggedIn);
  

  // Public routes
  if (isPublicRoute) {
    // Admins should not access login/signup pages
    if (isLoggedIn && role === "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Guests can access public routes
    return NextResponse.next();
  }

  // Protected routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Only admins can access protected routes
  if (role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
