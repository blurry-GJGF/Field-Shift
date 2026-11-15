import type { NextConfig } from "next";

// En GitHub Pages la página vive en https://blurry-gjgf.github.io/Field-Shift/,
// así que al construirla para Pages se usa la ruta base "/Field-Shift".
// En tu computadora (npm run dev) la variable no existe y la ruta base queda vacía.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Sitio estático (sólo HTML/CSS/JS): es lo que GitHub Pages sabe servir.
  output: "export",
  basePath,
  // next/image no antepone la ruta base sola; la exponemos para usarla en `src`.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: { unoptimized: true },
  // En desarrollo Next sólo sirve sus archivos JS a "localhost". Para abrir la
  // app con la IP de "Network" (o desde otro equipo de la red) hay que permitirla aquí.
  allowedDevOrigins: ["192.168.*.*"],
  // (Se quitaron cacheComponents y partialPrefetching: necesitan servidor y no
  // funcionan en un sitio estático. Esta app hace todo en el navegador.)
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
