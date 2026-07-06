"use client";

import { FormEvent, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error: loginError } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    if (loginError) setError(loginError.message);
    setLoading(false);
  }

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden bg-[linear-gradient(135deg,#0f766e,#1e293b)] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-100">Universidad IoT</p>
          <h1 className="mt-5 max-w-2xl text-5xl font-semibold leading-tight">Sistema de gestion inteligente para estacionamiento vehicular</h1>
        </div>
        <div className="max-w-xl border-t border-white/20 pt-6 text-sm leading-6 text-teal-50">
          Control academico de ingresos, pagos, salidas, sesiones activas y eventos RFID para pruebas con ESP32 o Wokwi.
        </div>
      </section>
      <section className="flex items-center justify-center bg-slate-50 px-4 py-10">
        <form onSubmit={onSubmit} className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Administrador</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Iniciar sesion</h2>
          <p className="mt-2 text-sm text-slate-600">Usa un usuario creado en Supabase Auth para ingresar al panel.</p>

          <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />

          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="password">
            Contrasena
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />

          {error ? <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Validando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
