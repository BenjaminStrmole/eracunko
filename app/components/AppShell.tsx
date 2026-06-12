"use client";

import {
  Building2,
  FileCheck2,
  FileClock,
  FilePlus2,
  Inbox,
  LayoutDashboard,
  Send,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { href: "/dashboard", label: "Domov", icon: LayoutDashboard },
  { href: "/inbox", label: "Prejeti računi", icon: Inbox },
  { href: "/acknowledgments", label: "Povratnice", icon: FileCheck2 },
  { href: "/sent", label: "Poslani računi", icon: Send },
  { href: "/drafts", label: "Osnutki", icon: FileClock },
  { href: "/invoices/new", label: "Nov račun", icon: FilePlus2 },
  { href: "/customers", label: "Moje stranke", icon: Users },
  { href: "/settings", label: "Nastavitve", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (href === "/invoices/new") return pathname.startsWith("/invoices");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="app-bg min-h-screen text-[var(--foreground)]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 h-screen w-72 shrink-0 border-r border-[var(--app-border)] bg-[var(--app-sidebar)] p-5 shadow-[var(--app-shadow-soft)] backdrop-blur-2xl">
          <div className="mb-10">
            <Link href="/dashboard" className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--app-primary)] text-white shadow-lg shadow-blue-500/20">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-2xl font-semibold tracking-tight">
                  eRačunko
                </span>
                <span className="app-muted block text-sm">
                  Mikro ERP za e-račune
                </span>
              </span>
            </Link>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium ${
                    active
                      ? "bg-[var(--app-primary)] text-white shadow-lg shadow-blue-500/20"
                      : "app-muted hover:bg-[var(--app-soft)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}

            <LogoutButton />
          </nav>

          <div className="absolute bottom-5 left-5 right-5">
            <ThemeToggle />
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-6 lg:p-10">{children}</section>
      </div>
    </main>
  );
}
