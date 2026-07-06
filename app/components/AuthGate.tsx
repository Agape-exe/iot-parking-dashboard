"use client";

import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-client";
import { DEMO_MODE } from "@/lib/config";

type AuthContextValue = {
  session: Session | null;
  token: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const publicRoutes = new Set(["/login"]);

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!DEMO_MODE);

  useEffect(() => {
    if (DEMO_MODE) {
      return;
    }

    supabaseBrowser.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabaseBrowser.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (DEMO_MODE && pathname === "/login") router.replace("/dashboard");
    if (DEMO_MODE) return;
    if (!session && !publicRoutes.has(pathname)) router.replace("/login");
    if (session && pathname === "/login") router.replace("/dashboard");
  }, [loading, pathname, router, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      token: session?.access_token ?? (DEMO_MODE ? "demo" : null),
      loading,
      signOut: async () => {
        if (DEMO_MODE) {
          router.replace("/login");
          return;
        }
        await supabaseBrowser.auth.signOut();
        router.replace("/login");
      },
    }),
    [loading, router, session],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
        Cargando sistema...
      </div>
    );
  }

  if (!DEMO_MODE && !session && !publicRoutes.has(pathname)) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthGate");
  return value;
}
