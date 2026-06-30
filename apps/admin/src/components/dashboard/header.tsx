"use client";

import Link from "next/link";
import { AuthUser } from "@/lib/client-api";
import { UserAvatar } from "@/components/users/user-avatar";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type DashboardHeaderProps = {
  title: string;
  subtitle?: string;
  user: AuthUser;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
};

function formatDate() {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function DashboardHeader({
  title,
  subtitle,
  user,
  actions,
  filters,
}: DashboardHeaderProps) {
  return (
    <>
      <header
        className={`dashboard-topbar${filters ? " dashboard-topbar--with-filters" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle capitalize">{subtitle ?? formatDate()}</p>
        </div>

        <div className="dashboard-topbar-actions flex items-center gap-2 flex-wrap justify-end shrink-0">
          {actions}
          {filters && <div className="dashboard-topbar-filters">{filters}</div>}
          <ThemeToggle />
          <NotificationBell />

          <Link
            href="/dashboard/profile"
            className="flex items-center gap-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-[var(--shadow-sm)] hover:border-[var(--accent)] transition-colors"
          >
            <UserAvatar src={user.avatarUrl} name={user.name} size="sm" />
            <div className="hidden md:block">
              <p className="text-sm font-semibold leading-tight">{user.name}</p>
              <p className="text-[11px] text-[var(--muted)]">Mon profil</p>
            </div>
          </Link>
        </div>
      </header>
      <div
        className={`dashboard-topbar-spacer${filters ? " dashboard-topbar-spacer--with-filters" : ""}`}
        aria-hidden="true"
      />
    </>
  );
}
