export default function SentInvoicesPage() {
  const invoices = [
    {
      number: "2026-001",
      receiver: "ABC d.o.o.",
      amount: "122,00 €",
      status: "Dostavljeno",
      date: "02.06.2026",
    },
    {
      number: "2026-002",
      receiver: "Testni kupec d.o.o.",
      amount: "244,00 €",
      status: "Čaka povratnico",
      date: "02.06.2026",
    },
    {
      number: "2026-003",
      receiver: "Demo podjetje d.o.o.",
      amount: "89,90 €",
      status: "Napaka",
      date: "01.06.2026",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-900 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">eRačunko</h1>
            <p className="text-sm text-slate-400">e-računi brez komplikacij</p>
          </div>

          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🏠 Dashboard</a>
            <a href="/inbox" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📥 Inbox</a>
            <a href="/sent" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">📤 Poslani računi</a>
            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">➕ Nov račun</a>
            <a href="/customers" className="block rounded-lg px-4 py-3 hover:bg-slate-800">👥 Stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>

          <div className="mt-10 border-t border-slate-800 pt-6">
            <a href="/login" className="block rounded-lg px-4 py-3 text-red-300 hover:bg-slate-800">🚪 Odjava</a>
          </div>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold">Poslani računi</h2>
              <p className="mt-2 text-slate-400">
                Pregled poslanih e-računov, statusov in povratnic.
              </p>
            </div>

            <a
              href="/invoices/new"
              className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
            >
              + Nov račun
            </a>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900">
            <div className="grid grid-cols-5 border-b border-slate-800 px-6 py-4 text-sm text-slate-400">
              <div>Številka</div>
              <div>Prejemnik</div>
              <div>Znesek</div>
              <div>Status</div>
              <div>Datum</div>
            </div>

            {invoices.map((invoice) => (
              <div
                key={invoice.number}
                className="grid grid-cols-5 border-b border-slate-800 px-6 py-4 last:border-b-0"
              >
                <div className="font-medium">{invoice.number}</div>
                <div className="text-slate-300">{invoice.receiver}</div>
                <div className="text-slate-300">{invoice.amount}</div>
                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm ${
                      invoice.status === "Dostavljeno"
                        ? "bg-green-500/10 text-green-300"
                        : invoice.status === "Napaka"
                        ? "bg-red-500/10 text-red-300"
                        : "bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>
                <div className="text-slate-300">{invoice.date}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}