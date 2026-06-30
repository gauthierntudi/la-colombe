"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthUser, clearSession, getUser } from "@/lib/client-api";
import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);

    function onUserUpdated(event: Event) {
      const detail = (event as CustomEvent<AuthUser>).detail;
      if (detail) setUser(detail);
    }

    window.addEventListener("ges-user-updated", onUserUpdated);
    return () => window.removeEventListener("ges-user-updated", onUserUpdated);
  }, [router, pathname]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--muted)]">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Sidebar user={user} onLogout={logout} />
      <main
        className="min-h-screen p-6 lg:p-8"
        style={{ marginLeft: "var(--sidebar-w)" }}
      >
        {children}
      </main>
    </div>
  );
}
