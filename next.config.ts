import type { NextConfig } from "next";

// El service worker (public/sw.js) está escrito a mano. next-pwa se quitó: no
// funciona con Turbopack y, bajo webpack, habría sobrescrito public/sw.js.
const nextConfig: NextConfig = {
  turbopack: {}
};

export default nextConfig;
