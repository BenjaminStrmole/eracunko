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
import HelpWidget from "./HelpWidget";
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
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-sidebar)] px-5 py-7 shadow-[var(--app-shadow-soft)] backdrop-blur-2xl lg:flex">
          <div className="mb-12 px-1">
            <Link href="/dashboard" className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-[var(--app-primary)] text-white shadow-lg shadow-blue-500/20">
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

          <div className="mb-3 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">
            Delo z računi
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium ${
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

          <div className="mt-auto pt-6">
            <ThemeToggle />
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-[70] border-b border-[var(--app-border)] bg-[var(--app-surface-strong)]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-primary)] text-white">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                </span>
                eRačunko
              </Link>
              <ThemeToggle />
            </div>
            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Glavna navigacija">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                      active
                        ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-white"
                        : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <div className="p-4 sm:p-6 lg:p-10 xl:p-12">{children}</div>
        </section>
      </div>
      <HelpWidget />
    </main>
  );
}
