import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import type { Role } from "@sge/types";
import { ROLE_HIERARCHY } from "@/lib/auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    orgId?: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role;
      orgId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    orgId?: string;
  }
}

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // TODO: Replace with real DB lookup via @sge/db
        // Example stub — remove before production
        const stubUsers: Array<{
          id: string;
          email: string;
          password: string;
          name: string;
          role: Role;
          orgId?: string;
        }> = [
          {
            id: "usr_super_1",
            email: "admin@sge.foundation",
            password: "changeme",
            name: "SGE Admin",
            role: "super_admin",
          },
          {
            id: "usr_partner_1",
            email: "partner@example.com",
            password: "changeme",
            name: "Partner User",
            role: "partner_admin",
            orgId: "org_1",
          },
        ];

        const user = stubUsers.find(
          (u) => u.email === credentials.email && u.password === credentials.password
        );

        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgId: user.orgId,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; role: Role }).role;
        token.orgId = (user as { id: string; role: Role; orgId?: string }).orgId;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.orgId = token.orgId;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

export function generateStaticParams() {
  return [];
}
