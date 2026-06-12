import { ArrowRight, Building2, FileCheck2, Send } from "lucide-react";
import Link from "next/link";
import ThemeToggle from "./components/ThemeToggle";

export default function Home() {
  return (
    <main className="app-bg min-h-screen text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--app-primary)] text-white shadow-lg shadow-blue-500/20">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xl font-semibold tracking-tight">
                eRačunko
              </span>
              <span className="app-muted block text-sm">Mikro ERP</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/login" className="secondary-button h-10 px-4 text-sm">
              Prijava
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1fr_440px]">
          <div>
            <div className="status-pill mb-6 inline-flex">eRačunko MVP</div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">
              Najhitrejši način za izdajo in pošiljanje e-računov.
            </h1>
            <p className="app-muted mt-6 max-w-2xl text-lg leading-8">
              Ustvari račun, pripravi eSLOG XML, pošlji prek bizBox omrežja in
              spremljaj povratnice v enem mirnem ERP vmesniku.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="primary-button h-12 px-6">
                Začni s prijavo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/register" className="secondary-button h-12 px-6">
                Registracija
              </Link>
            </div>
          </div>

          <aside className="glass-panel rounded-[2rem] p-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              Mikro ERP osnova
            </h2>
            <p className="app-muted mt-2">
              Fokus na izdajo, pošiljanje in status e-računov za manjša
              podjetja.
            </p>

            <div className="mt-6 space-y-4">
              <Feature icon={FileCheck2} title="eSLOG priprava" text="Račun, XML in osnovne kontrole pred pošiljanjem." />
              <Feature icon={Send} title="bizBox DEMO" text="Pošiljanje dokumentov in pregled statusov." />
              <Feature icon={Building2} title="Podjetja in stranke" text="Aktivno podjetje, eImenik in hitra izdaja računa." />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="solid-panel rounded-[1.25rem] p-4">
      <Icon className="h-5 w-5 text-[var(--app-primary)]" aria-hidden="true" />
      <div className="mt-3 font-semibold">{title}</div>
      <div className="app-muted mt-1 text-sm">{text}</div>
    </div>
  );
}
