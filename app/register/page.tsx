export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center">
          <div className="mb-4 text-sm text-blue-300">eRačunko</div>
          <h1 className="text-4xl font-bold">Ustvari račun</h1>
          <p className="mt-3 text-slate-400">
            Vnesite osnovne podatke za pripravo aktivacije e-računov.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <input className="rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="Ime" />
            <input className="rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="Priimek" />
          </div>

          <input className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="E-pošta" />
          <input type="password" className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="Geslo" />

          <div className="mt-6 border-t border-slate-800 pt-6">
            <input className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="Naziv podjetja" />
            <input className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" placeholder="Davčna številka, npr. SI12345678" />

            <select className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-800 p-3">
              <option>Vaša vloga v podjetju</option>
              <option>Direktor / lastnik</option>
              <option>Računovodstvo</option>
              <option>Zunanji računovodski servis</option>
              <option>IT / integrator</option>
              <option>Drugo</option>
            </select>

            <select className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-800 p-3">
              <option>Koliko računov pošljete mesečno?</option>
              <option>1–10</option>
              <option>11–50</option>
              <option>51–200</option>
              <option>200+</option>
            </select>
          </div>

          <a
            href="/registration-status"
            className="mt-6 block w-full rounded-lg bg-blue-600 px-6 py-3 text-center font-semibold hover:bg-blue-500"
          >
            Nadaljuj z registracijo
          </a>

          <p className="mt-4 text-center text-sm text-slate-400">
            Že imate račun? <a href="/login" className="text-blue-300">Prijava</a>
          </p>
        </div>
      </div>
    </main>
  );
}