"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

const navItems = [
  { href: "/dashboard", label: "Domov", icon: "🏠" },
  { href: "/inbox", label: "Prejeti računi", icon: "📥" },
  { href: "/acknowledgments", label: "Povratnice", icon: "📨" },
  { href: "/sent", label: "Poslani računi", icon: "📤" },
  { href: "/drafts", label: "Osnutki", icon: "📝" },
  { href: "/invoices/new", label: "Nov račun", icon: "🧾" },
  { href: "/customers", label: "Moje stranke", icon: "👥" },
  { href: "/settings", label: "Nastavitve", icon: "⚙️" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (href === "/invoices/new") return pathname.startsWith("/invoices");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-900 p-6">
          <div className="mb-10">
            <Link href="/dashboard" className="block text-2xl font-bold">
              eRačunko
            </Link>
            <p className="text-sm text-slate-400">e-računi brez komplikacij</p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-4 py-3 ${
                    active
                      ? "bg-blue-600/20 text-blue-200"
                      : "hover:bg-slate-800"
                  }`}
                >
                  <span className="mr-2" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}

            <LogoutButton />
          </nav>
        </aside>

        <section className="flex-1 p-10">{children}</section>
      </div>
    </main>
  );
}
