"use client";

import { ArrowRight, Building2, Lock, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import ThemeToggle from "../components/ThemeToggle";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (loading) return;

    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      setMessage("Vnesi uporabniško ime in geslo.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setMessage(data.message || "Prijava ni uspela.");
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setMessage("Napaka pri povezavi s strežnikom.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-bg min-h-screen text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6">
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

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1fr_460px]">
          <section>
            <div className="status-pill mb-5 inline-flex">bizBox DEMO prijava</div>
            <h1 className="max-w-2xl text-5xl font-semibold tracking-tight md:text-6xl">
              Vstop v e-račune brez računovodskega balasta.
            </h1>
            <p className="app-muted mt-5 max-w-xl text-lg leading-8">
              Prijavi se z bizBox demo uporabniškim imenom, izberi podjetje,
              pripravi račun in spremljaj povratnice na enem mestu.
            </p>

            <div className="mt-8 grid max-w-2xl gap-4 md:grid-cols-3">
              <TrustItem icon={ShieldCheck} title="Varna seja" text="GUID se shrani v varni cookie." />
              <TrustItem icon={Building2} title="Podjetja" text="Aktivno podjetje iz bizBoxa." />
              <TrustItem icon={ArrowRight} title="Hiter tok" text="Račun, XML, pošiljanje." />
            </div>
          </section>

          <section className="glass-panel rounded-[2rem] p-7">
            <div className="mb-7">
              <h2 className="text-3xl font-semibold tracking-tight">Prijava</h2>
              <p className="app-muted mt-2">
                Vpiši svoje bizBox demo uporabniško ime in geslo.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <Field label="Uporabniško ime" icon={User}>
                <input
                  id="username"
                  name="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                  className="field-input pl-11 disabled:opacity-60"
                  placeholder="npr. DEMO.USER"
                />
              </Field>

              <Field label="Geslo" icon={Lock}>
                <input
                  id="password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  disabled={loading}
                  className="field-input pl-11 disabled:opacity-60"
                  placeholder="••••••••"
                />
              </Field>

              {message && (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-500">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="primary-button h-12 w-full disabled:opacity-60"
              >
                {loading ? "Preverjam prijavo..." : "Prijava"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between gap-4 text-sm">
              <span className="app-muted">Nimaš še dostopa?</span>
              <Link
                href="/register"
                className="font-semibold text-[var(--app-primary-strong)]"
              >
                Registracija
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="app-muted mb-2 block text-sm font-medium">{label}</label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 app-muted"
          aria-hidden="true"
        />
        {children}
      </div>
    </div>
  );
}

function TrustItem({
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
      <div className="app-muted mt-1 text-sm leading-5">{text}</div>
    </div>
  );
}
