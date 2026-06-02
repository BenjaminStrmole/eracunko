export default function CustomersPage() {
  const customers = [
    {
      name: "ABC d.o.o.",
      vat: "SI12345678",
      email: "racuni@abc.si",
      status: "Aktiven",
    },
    {
      name: "Testni kupec d.o.o.",
      vat: "SI87654321",
      email: "info@test.si",
      status: "Osnutek",
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
            <a href="#" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📥 Inbox</a>
            <a href="#" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📤 Poslani računi</a>
            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">➕ Nov račun</a>
            <a href="/customers" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">👥 Stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>

          <div className="mt-10 border-t border-slate-800 pt-6">
            <a href="/login" className="block rounded-lg px-4 py-3 text-red-300 hover:bg-slate-800">🚪 Odjava</a>
          </div>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold">Stranke</h2>
              <p className="mt-2 text-slate-400">
                Upravljajte kupce, ki jim pošiljate račune.
              </p>
            </div>

            <a
              href="/customers/new"
              className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
            >
              + Nova stranka
            </a>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900">
            <div className="grid grid-cols-4 border-b border-slate-800 px-6 py-4 text-sm text-slate-400">
              <div>Naziv</div>
              <div>Davčna</div>
              <div>E-pošta</div>
              <div>Status</div>
            </div>

            {customers.map((customer) => (
              <div
                key={customer.vat}
                className="grid grid-cols-4 border-b border-slate-800 px-6 py-4 last:border-b-0"
              >
                <div className="font-medium">{customer.name}</div>
                <div className="text-slate-300">{customer.vat}</div>
                <div className="text-slate-300">{customer.email}</div>
                <div>
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-200">
                    {customer.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}