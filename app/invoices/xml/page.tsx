"use client";

import { useState } from "react";

export default function InvoiceXmlPage() {
  const [sent, setSent] = useState(false);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:eslog:2.00">
  <M_INVOIC Id="data">
    <S_UNH>
      <D_0062>2026-001</D_0062>
      <C_S009>
        <D_0065>INVOIC</D_0065>
        <D_0052>D</D_0052>
        <D_0054>01B</D_0054>
      </C_S009>
    </S_UNH>

    <S_BGM>
      <C_C002>
        <D_1001>380</D_1001>
      </C_C002>
      <D_1004>2026-001</D_1004>
    </S_BGM>
  </M_INVOIC>
</Invoice>`;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-900 p-6">
          <h1 className="text-2xl font-bold">eRačunko</h1>
          <p className="text-sm text-slate-400">
            e-računi brez komplikacij
          </p>

          <nav className="mt-10 space-y-2">
            <a
              href="/dashboard"
              className="block rounded-lg px-4 py-3 hover:bg-slate-800"
            >
              🏠 Dashboard
            </a>

            <a
              href="/invoices/preview"
              className="block rounded-lg px-4 py-3 hover:bg-slate-800"
            >
              📄 Predogled računa
            </a>

            <a
              href="/invoices/xml"
              className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200"
            >
              🧾 eSLOG XML
            </a>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <h2 className="text-4xl font-bold">eSLOG XML</h2>

          <p className="mt-2 text-slate-400">
            Demo prikaz XML dokumenta, ki bo kasneje poslan prek bizBox DEMO API-ja.
          </p>

          <pre className="mt-8 overflow-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-blue-100">
            {xml}
          </pre>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                const blob = new Blob([xml], {
                  type: "application/xml",
                });

                const url = URL.createObjectURL(blob);

                const a = document.createElement("a");
                a.href = url;
                a.download = "racun-2026-001.xml";
                a.click();

                URL.revokeObjectURL(url);
              }}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
            >
              Prenesi XML
            </button>

            <button
              onClick={() => setSent(true)}
              className="rounded-lg border border-white/15 px-6 py-3 font-semibold hover:bg-white/10"
            >
              Pošlji v bizBox DEMO
            </button>
          </div>

          {sent && (
            <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
              <div className="font-semibold text-green-300">
                ✓ Dokument uspešno oddan v DEMO okolje
              </div>

              <div className="mt-3 text-slate-300">
                Številka dokumenta:
                <span className="font-bold"> DEMO-2026-001</span>
              </div>

              <div className="mt-2 text-amber-300">
                Status: Čaka povratnico
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}