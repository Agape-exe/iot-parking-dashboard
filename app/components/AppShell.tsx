"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/components/AuthGate";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/estacionamientos", label: "Estacionamientos" },
  { href: "/vehiculos", label: "Vehiculos dentro" },
  { href: "/reservas", label: "Reservas" },
  { href: "/reportes", label: "Reportes" },
  { href: "/configuracion", label: "Configuracion" },
  { href: "/simulador", label: "Simulador RFID" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, signOut } = useAuth();

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white px-5 py-6 lg:block">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">IoT Parking</p>
          <h1 className="mt-2 text-xl font-semibold leading-7">Gestion inteligente de estacionamiento</h1>
        </div>
        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-6 left-5 right-5 border-t border-slate-200 pt-4">
          <p className="truncate text-xs text-slate-500">{session?.user.email}</p>
          <button
            onClick={signOut}
            className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cerrar sesion
          </button>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="font-semibold">
              IoT Parking
            </Link>
            <button onClick={signOut} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              Salir
            </button>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-md px-3 py-2 text-xs font-medium ${
                  pathname === item.href ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
