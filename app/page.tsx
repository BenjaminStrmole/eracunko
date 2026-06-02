export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-200">
          eRačunko MVP
        </div>

        <h1 className="max-w-4xl text-5xl font-bold md:text-7xl">
          Najhitrejši način za izdelavo in pošiljanje e-računov.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          Ustvari račun, generiraj eSLOG XML in ga pošlji preko bizBox omrežja.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <a
            href="/invoices/new"
            className="rounded-full bg-blue-600 px-8 py-4 font-semibold hover:bg-blue-500"
          >
            Ustvari račun
          </a>

          <a
            href="/login"
            className="rounded-full border border-white/20 px-8 py-4 font-semibold hover:bg-white/10"
          >
            Prijava
          </a>

          <a
            href="/register"
            className="rounded-full border border-blue-400/30 bg-blue-500/10 px-8 py-4 font-semibold text-blue-200 hover:bg-blue-500/20"
          >
            Registracija
          </a>
        </div>
      </div>
    </main>
  );
}