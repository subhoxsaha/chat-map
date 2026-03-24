export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js routes)
     * - login (custom login page)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - marker-icon.png 
     */
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico|marker-icon.png).*)',
  ],
}
