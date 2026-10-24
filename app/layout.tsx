import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  title: "DarkPhone Tech | Gestión integral",
  description: "Inventario, ventas, caja y servicio técnico en un solo lugar.",
  applicationName: "DarkPhone",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DarkPhone",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/darkphone-mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/darkphone-mark.svg", sizes: "180x180", type: "image/svg+xml" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#08090b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><AppShell>{children}</AppShell></body></html>;
}
