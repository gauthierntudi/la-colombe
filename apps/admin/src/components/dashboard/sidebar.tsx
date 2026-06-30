"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tags,
  Warehouse,
  Store,
  Users,
  UserCircle,
  FileText,
  Settings,
  BarChart3,
  HelpCircle,
  LogOut,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AuthUser } from "@/lib/client-api";
import { UserAvatar } from "@/components/users/user-avatar";

const menuItems = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "Produits", icon: Package },
  { href: "/dashboard/inventory", label: "Inventaire", icon: Warehouse },
  { href: "/dashboard/invoices", label: "Factures", icon: FileText },
  { href: "/dashboard/cash-sessions", label: "Sessions caisse", icon: Wallet },
];

const stockItems = [
  { href: "/dashboard/points-of-sale", label: "Points de vente", icon: Store },
];

const adminItems = [
  { href: "/dashboard/users", label: "Utilisateurs", icon: Users },
  { href: "/dashboard/reports", label: "Rapports", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings },
  { href: "/dashboard/categories", label: "Catégories", icon: Tags },
];

const toolsItems = [
  { href: "/dashboard/profile", label: "Mon profil", icon: UserCircle },
];

type SidebarProps = {
  user: AuthUser;
  onLogout: () => void;
};

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();

  function NavLink({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: LucideIcon;
  }) {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`nav-item ${active ? "nav-item-active" : ""}`}
      >
        <Icon size={18} className={active ? "text-white" : "text-[var(--muted)]"} />
        {label}
      </Link>
    );
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-30"
      style={{ width: "var(--sidebar-w)" }}
    >
      <div className="flex flex-col h-full m-3 mr-0 bg-[var(--surface)] rounded-2xl border border-[var(--border-light)] shadow-[var(--shadow-md)] overflow-hidden">
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-[var(--border-light)]">
          <Image
            src="/images/icon-app.png"
            alt=""
            width={36}
            height={36}
            className="w-9 h-9 rounded-xl object-cover shrink-0"
          />
          <div>
            <p className="font-bold text-[15px] tracking-tight">La Colombe</p>
            <p className="text-[10px] text-[var(--muted)] font-medium uppercase tracking-wider">
              Admin
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="nav-section">Menu</p>
          <div className="space-y-0.5">
            {menuItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>

          <p className="nav-section">Stock</p>
          <div className="space-y-0.5">
            {stockItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>

          {user.role === "ADMIN" && (
            <>
              <p className="nav-section">Administration</p>
              <div className="space-y-0.5">
                {adminItems.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            </>
          )}

          <p className="nav-section">Outils</p>
          <div className="space-y-0.5">
            {toolsItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
            <span className="nav-item opacity-50 cursor-not-allowed">
              <HelpCircle size={18} className="text-[var(--muted)]" />
              Aide
            </span>
          </div>
        </nav>

        {/* User */}
        <Link
          href="/dashboard/profile"
          className="px-4 py-3 border-t border-[var(--border-light)] flex items-center gap-2 hover:bg-[var(--bg)] transition-colors"
        >
          <UserAvatar src={user.avatarUrl} name={user.name} size="xs" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{user.name}</p>
            <p className="text-[10px] text-[var(--muted)] truncate">{user.role}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onLogout();
            }}
            className="icon-btn !w-8 !h-8 shrink-0"
            title="Déconnexion"
          >
            <LogOut size={14} />
          </button>
        </Link>
      </div>
    </aside>
  );
}
