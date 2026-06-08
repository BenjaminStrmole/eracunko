import LogoutButton from "../components/LogoutButton";
import CompanySelector from "../components/CompanySelector";

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
            <a href="/dashboard" className="block rounded-lg bg-blue-600/20 px-4 py-3 text-blue-200">
              🏠 Dashboard
            </a>

            <a href="/inbox" className="block rounded-lg px-4 py-3 hover:bg-slate-800">
              📥 Inbox
            </a>

            <a href="/sent" className="block rounded-lg px-4 py-3 hover:bg-slate-800">
              📤 Poslani računi
            </a>

            <a href="/drafts" className="block rounded-lg px-4 py-3 hover:bg-slate-800">
              📝 Osnutki
            </a>

            <a href="/invoices/new" className="block rounded-lg px-4 py-3 hover:bg-slate-800">
              ➕ Nov račun
            </a>

            <a href="/customers" className="block rounded-lg px-4 py-3 hover:bg-slate-800">
              👥 Stranke
            </a>

            <a href="/settings" className="block rounded-lg px-4 py-3 hover:bg-slate-800">
              ⚙️ Nastavitve
            </a>

            <LogoutButton />
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold">Dashboard</h2>
              <p className="mt-2 text-slate-400">
                Dobrodošli v eRačunko. Tukaj izbereš aktivno podjetje in spremljaš račune.
              </p>
            </div>

            <a
              href="/invoices/new"
              className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
            >
              + Nov račun
            </a>
          </div>

          <div className="mb-8">
            <CompanySelector />
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <a href="/sent" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800">
              <div className="text-slate-400">Poslani računi</div>
              <div className="mt-3 text-4xl font-bold">3</div>
            </a>

            <a href="/inbox" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800">
              <div className="text-slate-400">Prejeti dokumenti</div>
              <div className="mt-3 text-4xl font-bold">2</div>
            </a>

            <a href="/drafts" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800">
              <div className="text-slate-400">Osnutki</div>
              <div className="mt-3 text-4xl font-bold">2</div>
            </a>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="text-slate-400">Napake</div>
              <div className="mt-3 text-4xl font-bold">1</div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
            <h3 className="text-xl font-bold text-blue-100">
              Status povezave z bizBox DEMO okoljem
            </h3>

            <p className="mt-3 text-slate-300">
              Aplikacija je povezana z bizBox okoljem. Aktivno podjetje se uporablja kot pošiljatelj pri kreiranju računa.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}