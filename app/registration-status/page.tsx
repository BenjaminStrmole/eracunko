import { Building2, CheckCircle2, Clock3 } from "lucide-react";
import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";

export default function RegistrationStatusPage() {
  return (
    <main className="app-bg min-h-screen text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-6">
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

          <ThemeToggle />
        </header>

        <section className="flex flex-1 items-center justify-center py-12">
          <div className="glass-panel w-full max-w-2xl rounded-[2rem] p-8">
            <div className="status-pill mb-4 inline-flex">Aktivacija</div>

            <h1 className="text-4xl font-semibold tracking-tight">
              Registracija je v obdelavi
            </h1>

            <p className="app-muted mt-4 leading-7">
              Prejeli smo vaše podatke. Trenutno preverjamo podatke podjetja in
              zaključujemo aktivacijo za pošiljanje e-računov.
            </p>

            <div className="mt-8">
              <div className="app-muted mb-2 flex justify-between text-sm">
                <span>Napredek aktivacije</span>
                <span>60%</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-[var(--app-soft)]">
                <div className="h-full w-3/5 rounded-full bg-[var(--app-primary)]" />
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <Step done text="Uporabniški račun ustvarjen" />
              <Step done text="Podatki podjetja prejeti" />
              <Step active text="Čakamo potrditev ponudnika" />
              <Step text="Aktivacija pošiljanja" />
            </div>

            <Link href="/login" className="secondary-button mt-8 h-12 w-full">
              Nazaj na prijavo
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Step({
  text,
  done,
  active,
}: {
  text: string;
  done?: boolean;
  active?: boolean;
}) {
  const Icon = done ? CheckCircle2 : Clock3;

  return (
    <div
      className={`flex items-center gap-3 ${
        active ? "text-[var(--app-primary-strong)]" : "app-muted"
      }`}
    >
      <Icon
        className={`h-5 w-5 ${done ? "text-emerald-500" : ""}`}
        aria-hidden="true"
      />
      <span className={done ? "text-[var(--foreground)]" : ""}>{text}</span>
    </div>
  );
}
