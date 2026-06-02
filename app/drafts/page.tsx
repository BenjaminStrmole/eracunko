export default function DraftsPage() {
  const drafts = [
    {
      number: "OSN-2026-001",
      customer: "ABC d.o.o.",
      amount: "122,00 €",
      updated: "Pred 5 min",
    },
    {
      number: "OSN-2026-002",
      customer: "Testni kupec d.o.o.",
      amount: "488,00 €",
      updated: "Pred 1 uro",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">

        <aside className="w-72 border-r border-slate-800 bg-slate-900 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">eRačunko</h1>
            <p className="text-sm text-slate-400">
              e-računi brez komplikacij
            </p>
          </div>

          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded-lg px-4 py-3 hover:bg-slate-800">🏠 Dashboard</a>
            <a href="/inbox" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📥 Inbox</a>
            <a href="/sent" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📤 Poslani računi</a>
            <a href="/drafts" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">📝 Osnutki</a>
            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">➕ Nov račun</a>
            <a href="/customers" className="block rounded-lg px-4 py-3 hover:bg-slate-800">👥 Stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <h2 className="text-4xl font-bold">Osnutki</h2>

          <p className="mt-2 text-slate-400">
            Nedokončani računi, ki čakajo na nadaljevanje.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900">
            {drafts.map((draft) => (
              <div
                key={draft.number}
                className="border-b border-slate-800 p-6 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">
                      {draft.number}
                    </div>

                    <div className="text-slate-400">
                      {draft.customer}
                    </div>
                  </div>

                  <div className="text-right">
                    <div>{draft.amount}</div>

                    <div className="text-sm text-slate-500">
                      {draft.updated}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}