export default function SettingsPage() {
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
            <a href="/inbox" className="block rounded-lg px-4 py-3 hover:bg-slate-800">📤 Poslani računi</a>
            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">➕ Nov račun</a>
            <a href="/stranke" className="block rounded-lg px-4 py-3 hover:bg-slate-800">👥 Stranke</a>
            <a href="/settings" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">⚙️ Nastavitve</a>
          </nav>

          <div className="mt-10 border-t border-slate-800 pt-6">
            <a href="/login" className="block rounded-lg px-4 py-3 text-red-300 hover:bg-slate-800">🚪 Odjava</a>
          </div>
        </aside>

        <section className="flex-1 p-10">
          <h2 className="text-4xl font-bold">Nastavitve podjetja</h2>
          <p className="mt-2 text-slate-400">
            Ti podatki bodo uporabljeni pri kreiranju PDF računa in eSLOG XML dokumenta.
          </p>

          <div className="mt-8 max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Naziv podjetja</label>
                <input className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="Moje podjetje d.o.o." />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Davčna številka</label>
                <input className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="SI12345678" />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Matična številka</label>
                <input className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="1234567000" />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">IBAN</label>
                <input className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="SI56 1234 5678 9012 345" />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm text-slate-300">Naslov</label>
              <input className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="Ulica 1, 1000 Ljubljana" />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">E-pošta</label>
                <input className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="info@podjetje.si" />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Telefon</label>
                <input className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="+386 40 000 000" />
              </div>
            </div>

            <button className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500">
              Shrani nastavitve
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}