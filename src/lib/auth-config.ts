import { Role } from "@prisma/client";
import { DefaultSession, NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role: Role;
    } & DefaultSession["user"];
  }
  interface JWT {
    role: Role;
  }
}

export default {
  providers: [], // Providers are added in auth.ts to keep Edge-incompatible code away
  callbacks: {
    async session({ session, token }) {
      if (token.role && session.user) {
        session.user.role = token.role as Role;
      }
      return session;
    },
    async jwt({ token, user }) {
      return token;
    },
  },
} satisfies NextAuthConfig;
