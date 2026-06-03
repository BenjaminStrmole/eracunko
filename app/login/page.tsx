"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-3xl font-bold">Prijava</h1>

        <p className="mt-2 text-slate-400">
          Vpiši svoje bizBox demo uporabniško ime in geslo.
        </p>

        <div className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Uporabniško ime
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3"
              placeholder="npr. DEMO.USER"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Geslo
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3"
            />
          </div>

          {message && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {message}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? "Preverjam prijavo..." : "Prijava"}
          </button>
        </div>
      </div>
    </main>
  );
}