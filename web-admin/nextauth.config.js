/**
 * NextAuth.js (ana) - Web dashboard kimlik doğrulama
 * SuperTokens backend yedek olarak kullanılabilir
 *
 * Kullanım: Next.js projesine ekleyin (npm create next-app)
 * npm install next-auth
 *
 * pages/api/auth/[...nextauth].js:
 *   import NextAuth from "next-auth";
 *   import { nextAuthConfig } from "../../../nextauth.config";
 *   export default NextAuth(nextAuthConfig);
 */
export const nextAuthConfig = {
  providers: [
    {
      id: "google",
      name: "Google",
      type: "oauth",
      authorization: { params: { scope: "openid email profile" } },
      idToken: true,
      checks: ["pkce", "state"],
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    {
      id: "credentials",
      name: "Email",
      type: "credentials",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const res = await fetch(`${process.env.API_URL}/auth/login`, {
          method: "POST",
          body: JSON.stringify({ email: creds.email, password: creds.password }),
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (data?.token) return { id: data.user?.id, email: creds.email, ...data.user };
        return null;
      },
    },
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.user = user;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user = token.user || session.user;
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
};
