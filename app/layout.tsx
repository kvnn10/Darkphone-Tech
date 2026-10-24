import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Darkphone Tech | Gestión integral",
  description: "Inventario, ventas, caja y servicio técnico en un solo lugar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><AppShell>{children}</AppShell></body></html>;
}
