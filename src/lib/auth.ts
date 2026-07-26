import NextAuth, { DefaultSession } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { loginSchema } from "@/schemas/login";
import authConfig from "./auth-config";
import { Role } from "@prisma/client";

export type ExtendedUSer = DefaultSession["user"] & {
  role: Role;
};

declare module "next-auth" {
  interface Session {
    user: ExtendedUSer;
  }
}

declare module "next-auth" {
  interface JWT {
    role: Role;
  }
}

// callback theke token and session generate hoy

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  ...authConfig,
  callbacks: {
    async signIn({ user }) {
      const getUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      if (!getUser) {
        return false;
      }
      return true;
    },

    async session({ token, session }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        const getUser = await prisma.user.findUnique({
          where: { id: token.sub },
        });
        if (getUser) {
          token.role = getUser.role;
          session.user.role = getUser?.role;
        }
      }
      return session;
    },

    async jwt({ token }) {
      if (!token.sub) return token;
      const getUser = await prisma.user.findUnique({
        where: { id: token.sub },
      });
      if (!getUser) return token;
      token.role = getUser?.role;
      return token;
    },
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      async authorize(credentials) {
        const validateFields = loginSchema.safeParse(credentials);
        if (!validateFields.success) {
          throw new Error(validateFields.error.message);
        }
        const { email, password } = validateFields.data;
        const user = await prisma.user.findUnique({
          where: {
            email,
          },
        });
        if (!user || !user.hashedPassword) return null;
        const matchPassword = await bcrypt.compare(
          password,
          user.hashedPassword,
        );
        if (!matchPassword) return null;
        return user;
      },
    }),
  ],
});
