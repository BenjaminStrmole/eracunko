export default function RegistrationStatusPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <div className="mb-4 text-sm text-blue-300">eRačunko</div>

          <h1 className="text-4xl font-bold">Registracija je v obdelavi</h1>

          <p className="mt-4 text-slate-400">
            Prejeli smo vaše podatke. Trenutno preverjamo podatke podjetja in zaključujemo aktivacijo za pošiljanje e-računov.
          </p>

          <div className="mt-8">
            <div className="mb-2 flex justify-between text-sm text-slate-400">
              <span>Napredek aktivacije</span>
              <span>60%</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-3/5 rounded-full bg-blue-600" />
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div>✓ Uporabniški račun ustvarjen</div>
            <div>✓ Podatki podjetja prejeti</div>
            <div className="text-blue-300">• Čakamo potrditev ponudnika</div>
            <div className="text-slate-500">• Aktivacija pošiljanja</div>
          </div>

          <a
            href="/login"
            className="mt-8 block rounded-lg border border-white/15 px-6 py-3 text-center font-semibold hover:bg-white/10"
          >
            Nazaj na prijavo
          </a>
        </div>
      </div>
    </main>
  );
}