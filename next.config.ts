import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En desarrollo Next sólo sirve sus archivos JS a "localhost". Para abrir la
  // app con la IP de "Network" (o desde otro equipo de la red) hay que permitirla aquí.
  allowedDevOrigins: ["192.168.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
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
