// Piezas visuales compartidas por los paneles.
import type { ReactNode } from "react";
import type { obtenerClima } from "@/lib/nasa/power";
import type { rankear } from "@/lib/ranking";

export type Clima = Awaited<ReturnType<typeof obtenerClima>>;
export type Formulario = Parameters<typeof rankear>[0];
export type Respuestas = Omit<Formulario, "lat" | "lon">;

export const COLOR = {
  navy: "#0b1d3a",
  navy2: "#10284d",
  rojo: "#b3151c",
  granate: "#6e0b24", // logo de Field Shift
  dorado: "#e8a816", // logo de Field Shift
  favorable: "#2e9d4f",
  caution: "#e3b505",
  risk: "#d0312d",
};

/** Verde / amarillo / rojo según un valor de 0 a 1. */
export function colorEstado(valor: number, favorable = 0.7, precaucion = 0.4) {
  return valor >= favorable ? COLOR.favorable : valor >= precaucion ? COLOR.caution : COLOR.risk;
}

export function Tarjeta({ titulo, children, className = "" }: { titulo?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-3 ${className}`}>
      {titulo && <h3 className="mb-2 font-bold text-gray-900">{titulo}</h3>}
      {children}
    </section>
  );
}

export function PorQueImporta({ children }: { children: ReactNode }) {
  return (
    <section className="flex gap-2 rounded-lg bg-[#fdf6c8] p-3 text-[13px] text-gray-900">
      <span aria-hidden className="text-2xl leading-none">🌾</span>
      <p>
        <b>Why it matters for crop rotation:</b> {children}
      </p>
    </section>
  );
}

export function Fuente({ nasa, children }: { nasa: boolean; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs text-gray-700">
      <span
        className={`rounded px-2 py-0.5 font-bold text-white ${nasa ? "bg-[#0b3d91]" : "bg-gray-500"}`}
      >
        {nasa ? "NASA" : "Non-NASA"}
      </span>
      {children}
    </p>
  );
}

export function Dato({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-600">{etiqueta}</p>
      <p className="text-lg font-bold leading-tight text-gray-900">{valor}</p>
      {nota && <p className="text-xs text-gray-500">{nota}</p>}
    </div>
  );
}
