export default function InboxPage() {
  const documents = [
    {
      number: "PREJ-2026-001",
      sender: "Dobavitelj d.o.o.",
      type: "eRačun",
      status: "Prejet",
      date: "02.06.2026",
    },
    {
      number: "PREJ-2026-002",
      sender: "Test partner d.o.o.",
      type: "Dobropis",
      status: "V obdelavi",
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
            <a href="/inbox" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">📥 Inbox</a>
            <a href="/inbox" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📤 Poslani računi</a>
            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">➕ Nov račun</a>
            <a href="/customers" className="block rounded-lg px-4 py-3 hover:bg-slate-800">👥 Stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <h2 className="text-4xl font-bold">Inbox</h2>
          <p className="mt-2 text-slate-400">
            Pregled prejetih dokumentov in statusov.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900">
            <div className="grid grid-cols-5 border-b border-slate-800 px-6 py-4 text-sm text-slate-400">
              <div>Številka</div>
              <div>Pošiljatelj</div>
              <div>Tip</div>
              <div>Status</div>
              <div>Datum</div>
            </div>

            {documents.map((doc) => (
              <div
                key={doc.number}
                className="grid grid-cols-5 border-b border-slate-800 px-6 py-4 last:border-b-0"
              >
                <div className="font-medium">{doc.number}</div>
                <div className="text-slate-300">{doc.sender}</div>
                <div className="text-slate-300">{doc.type}</div>
                <div>
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-200">
                    {doc.status}
                  </span>
                </div>
                <div className="text-slate-300">{doc.date}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}