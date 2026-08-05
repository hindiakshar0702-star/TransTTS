import type { DefaultSession } from "next-auth";

/**
 * Module augmentation for the extra fields the app rides on the Auth.js session
 * and JWT: the DB user id, role (user/admin), tokenVersion (revocation), and
 * the sign-up provider.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      tv: number;
      provider: string;
    } & DefaultSession["user"];
  }

  // Shape returned by Credentials.authorize / set on Google sign-in.
  interface User {
    role?: string;
    tv?: number;
    provider?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    tv?: number;
    provider?: string;
  }
}
