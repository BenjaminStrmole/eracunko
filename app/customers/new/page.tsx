export default function NewCustomerPage() {
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
            <a href="/customers" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">👥 Stranke</a>
            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">⚙️ Nastavitve</a>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-8">
            <a href="/customers" className="text-sm text-blue-300 hover:text-blue-200">
              ← Nazaj na stranke
            </a>

            <h2 className="mt-4 text-4xl font-bold">Nova stranka</h2>

            <p className="mt-2 text-slate-400">
              Poiščite podjetje po davčni številki in preverite, ali lahko prejema e-račune.
            </p>
          </div>

          <div className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <label className="mb-2 block text-sm text-slate-300">
              Davčna številka
            </label>

            <div className="flex gap-3">
              <input
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 p-3"
                placeholder="SI12345678"
              />

              <button className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500">
                Poišči
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
              <div className="text-sm text-green-300">Podjetje najdeno v eImeniku</div>

              <h3 className="mt-2 text-2xl font-bold">ABC d.o.o.</h3>

              <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                <div>
                  <span className="text-slate-500">Davčna:</span> SI12345678
                </div>
                <div>
                  <span className="text-slate-500">Status:</span> Prejema e-račune
                </div>
                <div>
                  <span className="text-slate-500">eLokacija:</span> C:SI12345678
                </div>
                <div>
                  <span className="text-slate-500">Format:</span> eSLOG 2.0
                </div>
              </div>

              <button className="mt-6 rounded-lg bg-green-600 px-6 py-3 font-semibold hover:bg-green-500">
                Shrani v šifrant strank
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="text-sm text-amber-300">Primer opozorila</div>

              <h3 className="mt-2 text-xl font-bold">
                Podjetje ni pripravljeno za prejem e-računov
              </h3>

              <p className="mt-3 text-slate-300">
                Prejemnika nismo našli v omrežju ali pa trenutno ne sprejema izbranega tipa dokumenta.
                Predlagamo, da se obrnete na stranko in jo obvestite, da ji želite račun poslati
                po elektronski in varni poti.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}