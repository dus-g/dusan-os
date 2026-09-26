import type { NextAuthConfig } from "next-auth";

/** Edge-safe config (no Prisma / bcrypt) — shared by middleware and the full auth instance. */
export default {
  pages: { signIn: "/login" },
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 90 }, // 90-day persistent login
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isAuthPage = ["/login", "/register", "/forgot-password", "/reset-password"].some((p) => pathname.startsWith(p));
      const loggedIn = !!auth?.user;
      if (isAuthPage) return loggedIn ? Response.redirect(new URL("/dashboard", request.nextUrl)) : true;
      if (pathname === "/") return Response.redirect(new URL(loggedIn ? "/dashboard" : "/login", request.nextUrl));
      return loggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;