"use client";

import dynamic from "next/dynamic";

// OpenLayers usa APIs del navegador: se carga sólo en el cliente.
const MapaCampo = dynamic(() => import("./MapaCampo"), {
  ssr: false,
  loading: () => <p className="p-4">Cargando mapa…</p>,
});

export default MapaCampo;
