import LogoutButton from "../components/LogoutButton";
export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-900 p-6">
          <div className="mb-10">
            <h1 className="text-2xl font-bold">eRačunko</h1>
            <p className="text-sm text-slate-400">e-računi brez komplikacij</p>
          </div>

          <nav className="space-y-2">
            <a
              href="/dashboard"
              className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200"
            >
              🏠 Dashboard
            </a>

            <a
              href="/inbox"
              className="block rounded-lg px-4 py-3 hover:bg-slate-800"
            >
              📥 Inbox
            </a>

            <a
              href="/sent"
              className="block rounded-lg px-4 py-3 hover:bg-slate-800"
            >
              📤 Poslani računi
            </a>

            <a
              href="/drafts"
              className="block rounded-lg px-4 py-3 hover:bg-slate-800"
            >
              📝 Osnutki
            </a>

            <a
              href="/invoices/new"
              className="block rounded-lg px-4 py-3 hover:bg-slate-800"
            >
              ➕ Nov račun
            </a>

            <a
              href="/customers"
              className="block rounded-lg px-4 py-3 hover:bg-slate-800"
            >
              👥 Stranke
            </a>

            <a
              href="/settings"
              className="block rounded-lg px-4 py-3 hover:bg-slate-800"
            >
              ⚙️ Nastavitve
            </a>
            <LogoutButton />
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold">Dashboard</h2>
              <p className="mt-2 text-slate-400">
                Dobrodošli v eRačunko. Tukaj spremljate račune, osnutke in statuse.
              </p>
            </div>

            <a
              href="/invoices/new"
              className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
            >
              + Nov račun
            </a>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <a
              href="/sent"
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800"
            >
              <div className="text-slate-400">Poslani računi</div>
              <div className="mt-3 text-4xl font-bold">3</div>
            </a>

            <a
              href="/inbox"
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800"
            >
              <div className="text-slate-400">Prejeti dokumenti</div>
              <div className="mt-3 text-4xl font-bold">2</div>
            </a>

            <a
              href="/drafts"
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800"
            >
              <div className="text-slate-400">Osnutki</div>
              <div className="mt-3 text-4xl font-bold">2</div>
            </a>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="text-slate-400">Napake</div>
              <div className="mt-3 text-4xl font-bold">1</div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="text-xl font-bold">Zadnji poslani računi</h3>

              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <div className="font-medium">2026-001</div>
                    <div className="text-sm text-slate-400">ABC d.o.o.</div>
                  </div>
                  <span className="rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-300">
                    Dostavljeno
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <div className="font-medium">2026-002</div>
                    <div className="text-sm text-slate-400">Testni kupec d.o.o.</div>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
                    Čaka povratnico
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">2026-003</div>
                    <div className="text-sm text-slate-400">Demo podjetje d.o.o.</div>
                  </div>
                  <span className="rounded-full bg-red-500/10 px-3 py-1 text-sm text-red-300">
                    Napaka
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
              <h3 className="text-xl font-bold text-blue-100">
                Status povezave z omrežjem
              </h3>

              <p className="mt-3 text-slate-300">
                Račun je pripravljen za testno pošiljanje prek DEMO okolja. Pred produkcijo bo potrebna aktivacija pri ponudniku.
              </p>

              <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-3/5 rounded-full bg-blue-600" />
              </div>

              <div className="mt-3 text-sm text-blue-200">
                60% pripravljeno
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}