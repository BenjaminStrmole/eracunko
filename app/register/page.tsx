import { Building2, UserPlus } from "lucide-react";
import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";

export default function RegisterPage() {
  return (
    <main className="app-bg min-h-screen text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-6">
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
          <div className="w-full max-w-2xl">
            <div className="mb-8 text-center">
              <div className="status-pill mb-4 inline-flex">Aktivacija</div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Ustvari račun
              </h1>
              <p className="app-muted mt-3">
                Vnesite osnovne podatke za pripravo aktivacije e-računov.
              </p>
            </div>

            <div className="glass-panel rounded-[2rem] p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <input className="field-input" placeholder="Ime" />
                <input className="field-input" placeholder="Priimek" />
              </div>

              <input className="field-input mt-4" placeholder="E-pošta" />
              <input
                type="password"
                className="field-input mt-4"
                placeholder="Geslo"
              />

              <div className="mt-6 border-t border-[var(--app-border)] pt-6">
                <input className="field-input" placeholder="Naziv podjetja" />
                <input
                  className="field-input mt-4"
                  placeholder="Davčna številka, npr. SI12345678"
                />

                <select className="field-input mt-4">
                  <option>Vaša vloga v podjetju</option>
                  <option>Direktor / lastnik</option>
                  <option>Računovodstvo</option>
                  <option>Zunanji računovodski servis</option>
                  <option>IT / integrator</option>
                  <option>Drugo</option>
                </select>

                <select className="field-input mt-4">
                  <option>Koliko računov pošljete mesečno?</option>
                  <option>1-10</option>
                  <option>11-50</option>
                  <option>51-200</option>
                  <option>200+</option>
                </select>
              </div>

              <Link
                href="/registration-status"
                className="primary-button mt-6 h-12 w-full"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Nadaljuj z registracijo
              </Link>

              <p className="app-muted mt-4 text-center text-sm">
                Že imate račun?{" "}
                <Link href="/login" className="font-semibold text-[var(--app-primary-strong)]">
                  Prijava
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
