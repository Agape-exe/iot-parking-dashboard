import type { Metadata } from "next";
import { AppShell } from "@/app/components/AppShell";
import { AuthGate } from "@/app/components/AuthGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "IoT Parking Dashboard",
  description: "Sistema de gestion inteligente para estacionamiento vehicular mediante IoT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
