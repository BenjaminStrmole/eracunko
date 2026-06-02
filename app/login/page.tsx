export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <div className="mb-8 text-center">
          <div className="mb-4 text-sm text-blue-300">eRačunko</div>
          <h1 className="text-4xl font-bold">Prijava</h1>
          <p className="mt-3 text-slate-400">
            Prijavite se in nadaljujte z ustvarjanjem e-računov.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <label className="mb-2 block text-sm">E-pošta</label>
          <input
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 p-3"
            placeholder="ime@podjetje.si"
          />

          <label className="mb-2 block text-sm">Geslo</label>
          <input
            type="password"
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 p-3"
            placeholder="••••••••"
          />

          <a
            href="/dashboard"
            className="block w-full rounded-lg bg-blue-600 px-6 py-3 text-center font-semibold hover:bg-blue-500"
          >
            Prijava
          </a>

          <div className="mt-5 flex justify-between text-sm">
            <a href="/register" className="text-blue-300 hover:text-blue-200">
              Ustvari račun
            </a>
            <a href="/inbox" className="text-slate-400 hover:text-white">
              Pozabljeno geslo?
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}