import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Facilita Gastos",
  description: "Registro de Gastos y Captura de Recibos para Empresas",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Facilita Gastos",
  },
};

export const viewport = {
  themeColor: "#121D38",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${outfit.className} bg-[#121D38] text-zinc-50 antialiased min-h-screen selection:bg-[#8CC63F]/30`}>
        {children}
      </body>
    </html>
  );
}
