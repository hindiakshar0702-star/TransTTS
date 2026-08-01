"use client";
import { useCallback, useEffect, useState } from "react";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  image: string | null;
  provider: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  phone: string | null;
}

/**
 * Client-side session hook. Reads the current user from /api/auth/me (which
 * validates the httpOnly session cookie server-side). Returns the user, a
 * loading flag, and a refresh() to re-fetch after login/logout.
 */
export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, loading, refresh };
}

/** Clear the server session cookie. Caller handles navigation afterward. */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* best-effort; cookie also expires on its own */
  }
}
