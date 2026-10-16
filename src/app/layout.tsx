import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeSync } from "@/components/ThemeToggle";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Facilita Gastos",
  description: "Registro de Gastos y Captura de Recibos para Empresas",
  manifest: "/manifest.json",
  icons: {
    apple: "/apple-touch-icon.png",
  },
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
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes de pintar para que no parpadee. Por defecto: oscuro. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fg-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${outfit.className} bg-app text-zinc-50 antialiased min-h-screen selection:bg-[#8CC63F]/30`}>
        <ThemeSync />
        {children}
        <script
          dangerouslySetInnerHTML={{
            // En desarrollo no se registra (cachearía archivos que cambian a cada rato)
            // y se desregistra cualquiera que haya quedado de antes.
            __html: process.env.NODE_ENV === 'production'
              ? `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function(registration) {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                  }, function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `
              : `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  regs.forEach(function(reg) { reg.unregister(); });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
