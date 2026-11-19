import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { findUser } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

const providers: Provider[] = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push(GitHub);
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);

providers.push(
  Credentials({
    credentials: { username: {}, password: {} },
    async authorize(c) {
      const username = String(c?.username ?? "").trim().toLowerCase();
      const user = await findUser(username);
      if (!user || !verifyPassword(String(c?.password ?? ""), user.password_hash)) return null;
      return { id: user.id, name: user.username };
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account, user }) {
      if (account?.provider === "credentials") token.uid = user.id;
      else if (account) token.uid = `${account.provider}:${account.providerAccountId}`;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
