// Panel "Crop Rotation · Next stage": formulario visual + recomendación para la próxima siembra.
"use client";

import { useState } from "react";
import { CRITERIOS, MESES, PARAMETROS, type rankear } from "@/lib/ranking";
import { CULTIVOS } from "@/lib/cultivos";
import { COLOR, colorEstado, type Respuestas } from "./ui";

type Resultado = ReturnType<typeof rankear>;
type Opcion = Resultado["ranking"][number];
type Cambiar = <K extends keyof Respuestas>(clave: K, valor: Respuestas[K]) => void;

// ── Riego: el agricultor contesta en "riegos", el algoritmo recibe mm ───
export const NIVELES_RIEGO = [
  { mm: 0, icono: "🚫", texto: "None", nota: "rain only" },
  { mm: 150, icono: "💧", texto: "1–2 times", nota: "a little help" },
  { mm: 300, icono: "💧💧", texto: "3–4 times", nota: "a normal season" },
  { mm: 500, icono: "💧💧💧", texto: "5 or more", nota: "all it needs" },
];

/** Qué opción de riego corresponde a las respuestas actuales. */
export function nivelRiego(resp: Respuestas) {
  if (!resp.tieneRiego) return 0;
  let mejor = 1;
  NIVELES_RIEGO.forEach((n, i) => {
    if (i > 0 && Math.abs(n.mm - resp.riegoMm) < Math.abs(NIVELES_RIEGO[mejor].mm - resp.riegoMm)) mejor = i;
  });
  return mejor;
}

const riegosTexto = (mm: number) => `~${Math.ceil(mm / PARAMETROS.mmPorRiego)} waterings`;

// ── Textos sencillos a partir de los números ───────────────────────────
function calificacion(puntaje: number) {
  if (puntaje >= 75) return { texto: "Excellent", color: COLOR.favorable };
  if (puntaje >= 60) return { texto: "Good", color: "#7cb342" };
  if (puntaje >= 45) return { texto: "Fair", color: COLOR.caution };
  return { texto: "Poor", color: COLOR.risk };
}

function etiquetas(r: Opcion) {
  const s = r.subpuntajes;
  const buenas: string[] = [];
  const ojo: string[] = [];
  if (r.fijaN) buenas.push("🌱 Adds nitrogen");
  if (s.plagas === 1) buenas.push("🐛 Breaks pest cycle");
  if (r.riegoMm === 0 && s.agua >= 0.7) buenas.push("🌧️ Rain is enough");
  if (r.esperaMeses === 0) buenas.push("📅 Plant this month");
  if (s.ingresos >= 0.8) buenas.push("💰 Good price");
  if (r.riegoMm > 0) ojo.push(`🚿 Needs ${riegosTexto(r.riegoMm)}`);
  if (r.esperaMeses > 0) ojo.push(`⏳ Wait ${r.esperaMeses} months`);
  if (r.mesesCalor.length) ojo.push("🔥 Heat risk");
  if (s.plagas === 0) ojo.push("🐛 Same family as now");
  return { buenas, ojo };
}

function frase(r: Opcion, actual: string | null) {
  const cuando = r.esperaMeses === 0 ? "this month" : `in ${r.siembra}`;
  const razones: string[] = [];
  if (r.fijaN) razones.push("adds natural nitrogen to your soil");
  if (r.subpuntajes.plagas === 1 && actual) razones.push(`breaks the pest cycle of your ${actual.toLowerCase()}`);
  if (r.riegoMm === 0 && r.subpuntajes.agua >= 0.7) razones.push("grows with the rain alone");
  if (r.subpuntajes.ingresos >= 0.8) razones.push("sells at a good price");
  const porque = razones.length
    ? razones.slice(0, 2).join(" and ")
    : "is the best fit for your field's climate and water";
  return `Plant ${r.cultivo.toLowerCase()} ${cuando}: it ${porque}.`;
}

// ════════════════════════════════════════════════════════════════════════
export function PanelRotacion({
  resp,
  cambiar,
  resultado,
}: {
  resp: Respuestas;
  cambiar: Cambiar;
  resultado: Resultado | null;
}) {
  const [editando, setEditando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const actual = resp.cultivoActual === "ninguno" ? null : CULTIVOS[resp.cultivoActual];
  const mejor = resultado?.ranking[0];

  return (
    <>
      <Formulario resp={resp} cambiar={cambiar} editando={editando} setEditando={setEditando} />

      {!resultado && <p className="text-sm text-gray-500">Loading NASA data for this field…</p>}

      {resultado && mejor && (
        <>
          <MejorOpcion r={mejor} actual={actual?.nombre ?? null} onDetalles={() => setAbierto(mejor.clave)} />
          <Calendario resultado={resultado} actual={actual} abierto={abierto} setAbierto={setAbierto} />
          <Lista ranking={resultado.ranking} abierto={abierto} setAbierto={setAbierto} />

          {resultado.descartados.length > 0 && (
            <div className="rounded-lg bg-white p-3 text-xs">
              <p className="mb-1 font-semibold text-gray-700">🚫 Not recommended here</p>
              <div className="flex flex-wrap gap-1">
                {resultado.descartados.map((d) => (
                  <span key={d.cultivo} title={d.motivo} className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                    {d.cultivo} · {d.motivo.replace(/^no viable month in the next 12 \((.*)\)$/, "$1")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {resultado && !mejor && (
        <p className="rounded-lg bg-white p-3 text-sm">
          😕 No crop in our list can grow here with your current water. Try turning on irrigation in the left menu.
        </p>
      )}

      <p className="text-xs italic text-gray-500">
        Decision-support tool with NASA climate data. Crop values are examples: check with a local agronomist.
      </p>
    </>
  );
}

// ── Formulario ─────────────────────────────────────────────────────────
function Formulario({
  resp,
  cambiar,
  editando,
  setEditando,
}: {
  resp: Respuestas;
  cambiar: Cambiar;
  editando: boolean;
  setEditando: (v: boolean) => void;
}) {
  const actual = resp.cultivoActual === "ninguno" ? null : CULTIVOS[resp.cultivoActual];
  const nivel = ["None", "Low", "Mid", "High"];
  const riego = NIVELES_RIEGO[nivelRiego(resp)];
  const elegirRiego = (mm: number) => {
    cambiar("tieneRiego", mm > 0);
    cambiar("riegoMm", mm);
    cambiar("riegoEn", "todo el año");
  };

  if (!editando) {
    return (
      <button
        onClick={() => setEditando(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 text-left text-sm hover:bg-gray-50"
      >
        <span className="flex-1">
          {actual ? `${actual.icono} ${actual.nombre} (planted ${MESES[resp.mesSiembraActual - 1]})` : "⬜ Empty field"}
          {resp.tieneRiego ? ` · 🚿 ${riego.texto}` : " · 🌧️ Rainfed"} · 💧{nivel[resp.prioridadAgua]} 🌱
          {nivel[resp.prioridadSuelo]} 💰{nivel[resp.prioridadIngresos]}
        </span>
        <span className="font-semibold text-[#b3151c]">✏️ Edit</span>
      </button>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-bold">Tell us about your field</h3>
        <button onClick={() => setEditando(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-900">
          Hide ▲
        </button>
      </div>

      <Pregunta icono="🌾" texto="What is in your field now (or was last)?">
        <div className="grid grid-cols-6 gap-1">
          <Ficha activa={resp.cultivoActual === "ninguno"} onClick={() => cambiar("cultivoActual", "ninguno")} icono="⬜" texto="Nothing" />
          {Object.entries(CULTIVOS).map(([k, c]) => (
            <Ficha key={k} activa={resp.cultivoActual === k} onClick={() => cambiar("cultivoActual", k)} icono={c.icono} texto={c.nombre} />
          ))}
        </div>
      </Pregunta>

      {actual && (
        <Pregunta icono="📅" texto={`When did you plant the ${actual.nombre.toLowerCase()}?`}>
          <div className="grid grid-cols-12 gap-0.5">
            {MESES.map((m, i) => (
              <button
                key={m}
                onClick={() => cambiar("mesSiembraActual", i + 1)}
                className={`rounded py-1 text-[11px] font-semibold ${
                  resp.mesSiembraActual === i + 1 ? "bg-[#b3151c] text-white" : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Pregunta>
      )}

      <Pregunta icono="🚿" texto="How many times can you water your next crop?">
        <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Irrigation">
          {NIVELES_RIEGO.map((n) => {
            const activo = riego.mm === n.mm;
            return (
              <button
                key={n.mm}
                role="radio"
                aria-checked={activo}
                onClick={() => elegirRiego(n.mm)}
                className={`rounded-lg border-2 px-1 py-1.5 text-center leading-tight ${
                  activo ? "border-[#b3151c] bg-red-50" : "border-transparent bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <span className="block text-sm">{n.icono}</span>
                <span className="block text-xs font-semibold">{n.texto}</span>
                <span className="block text-[10px] text-gray-500">{n.nota}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          {riego.mm > 0
            ? `≈ ${riego.mm} mm of water (${(riego.mm * 10).toLocaleString("en-US")} m³ per hectare), counting ~${PARAMETROS.mmPorRiego} mm per watering.`
            : "Your crop will depend only on rain."}
        </p>
      </Pregunta>

      <Pregunta icono="⭐" texto="What matters most to you?">
        <Prioridad icono="💧" etiqueta="Saving water" valor={resp.prioridadAgua} onChange={(v) => cambiar("prioridadAgua", v)} />
        <Prioridad icono="🌱" etiqueta="Healthier soil" valor={resp.prioridadSuelo} onChange={(v) => cambiar("prioridadSuelo", v)} />
        <Prioridad icono="💰" etiqueta="More income" valor={resp.prioridadIngresos} onChange={(v) => cambiar("prioridadIngresos", v)} />
      </Pregunta>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold">
          🚫 Crops you can’t or won’t plant {resp.excluir.length > 0 && `(${resp.excluir.length})`}
        </summary>
        <div className="mt-2 grid grid-cols-5 gap-1">
          {Object.entries(CULTIVOS).map(([k, c]) => {
            const fuera = resp.excluir.includes(k);
            return (
              <button
                key={k}
                onClick={() => cambiar("excluir", fuera ? resp.excluir.filter((x) => x !== k) : [...resp.excluir, k])}
                aria-pressed={fuera}
                className={`relative rounded-lg border p-1 text-center text-[11px] ${fuera ? "border-red-300 bg-red-50 opacity-60" : "border-gray-200 hover:bg-gray-50"}`}
              >
                <span className="block text-xl">{c.icono}</span>
                <span className={fuera ? "line-through" : ""}>{c.nombre}</span>
                {fuera && <span className="absolute right-1 top-0 text-red-600">✕</span>}
              </button>
            );
          })}
        </div>
      </details>
    </section>
  );
}

function Pregunta({ icono, texto, children }: { icono: string; texto: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-sm font-semibold">
        {icono} {texto}
      </p>
      {children}
    </div>
  );
}

function Ficha({ activa, onClick, icono, texto }: { activa: boolean; onClick: () => void; icono: string; texto: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activa}
      title={texto}
      className={`rounded-lg border-2 p-1 text-center leading-tight ${activa ? "border-[#b3151c] bg-red-50" : "border-transparent bg-gray-50 hover:bg-gray-100"}`}
    >
      <span className="block text-xl">{icono}</span>
      <span className="block truncate text-[10px]">{texto}</span>
    </button>
  );
}

function Prioridad({
  icono,
  etiqueta,
  valor,
  onChange,
}: {
  icono: string;
  etiqueta: string;
  valor: number;
  onChange: (v: number) => void;
}) {
  const textos = ["None", "Low", "Mid", "High"];
  return (
    <div className="mt-1 flex items-center gap-2 text-sm">
      <span className="w-6 text-center text-lg">{icono}</span>
      <span className="flex-1">{etiqueta}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={etiqueta}>
        {[1, 2, 3].map((i) => (
          <button
            key={i}
            role="radio"
            aria-checked={valor === i}
            aria-label={textos[i]}
            onClick={() => onChange(valor === i ? i - 1 : i)}
            className={`h-5 w-5 rounded-full border-2 md:h-4 md:w-4 ${i <= valor ? "border-[#b3151c] bg-[#b3151c]" : "border-gray-300 bg-white hover:border-[#b3151c]"}`}
          />
        ))}
      </div>
      <span className="w-9 text-right text-xs text-gray-500">{textos[valor]}</span>
    </div>
  );
}

// ── Mejor opción ───────────────────────────────────────────────────────
function MejorOpcion({ r, actual, onDetalles }: { r: Opcion; actual: string | null; onDetalles: () => void }) {
  const { buenas, ojo } = etiquetas(r);
  const cal = calificacion(r.puntaje);
  return (
    <section className="rounded-xl border-2 p-4" style={{ borderColor: cal.color, background: "linear-gradient(135deg,#f1fbf3,#ffffff)" }}>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-600">🏆 Best pick for your next planting</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-5xl leading-none">{r.icono}</span>
        <div className="flex-1">
          <p className="text-2xl font-black leading-tight">{r.cultivo}</p>
          <p className="text-sm text-gray-700">
            Plant <b>{r.siembra}</b> → harvest <b>{r.cosecha}</b>
          </p>
        </div>
        <Anillo puntaje={r.puntaje} color={cal.color} texto={cal.texto} />
      </div>
      <p className="mt-3 text-[15px] leading-snug">{frase(r, actual)}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {buenas.map((t) => (
          <Chip key={t} texto={t} tipo="buena" />
        ))}
        {ojo.map((t) => (
          <Chip key={t} texto={t} tipo="ojo" />
        ))}
      </div>
      <button onClick={onDetalles} className="mt-2 text-xs font-semibold text-gray-600 underline hover:text-gray-900">
        Why this score? ↓
      </button>
    </section>
  );
}

function Anillo({ puntaje, color, texto }: { puntaje: number; color: string; texto: string }) {
  const r = 26;
  const largo = 2 * Math.PI * r;
  return (
    <div className="relative grid h-[68px] w-[68px] shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(puntaje / 100) * largo} ${largo}`}
        />
      </svg>
      <div className="text-center leading-none">
        <p className="text-lg font-black">{Math.round(puntaje)}</p>
        <p className="text-[9px] font-bold" style={{ color }}>
          {texto}
        </p>
      </div>
    </div>
  );
}

function Chip({ texto, tipo }: { texto: string; tipo: "buena" | "ojo" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${tipo === "buena" ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"}`}
    >
      {texto}
    </span>
  );
}

// ── Calendario de 12 meses ─────────────────────────────────────────────
function Calendario({
  resultado,
  actual,
  abierto,
  setAbierto,
}: {
  resultado: Resultado;
  actual: (typeof CULTIVOS)[string] | null;
  abierto: string | null;
  setAbierto: (k: string | null) => void;
}) {
  const { hoyIdx, ocupado } = resultado;
  const filas = resultado.ranking.slice(0, 5);
  const tramo = (inicio: number, fin: number) => {
    const s = Math.max(0, inicio - hoyIdx);
    const e = Math.min(11, fin - hoyIdx);
    return e < s ? null : { gridColumn: `${s + 1} / ${e + 2}` };
  };
  const ahora = ocupado ? tramo(ocupado.inicioIdx, ocupado.finIdx) : null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <h3 className="font-bold">📆 Your next 12 months</h3>
      <p className="mb-2 text-xs text-gray-500">Tap a crop to see its details.</p>
      <div className="grid grid-cols-[88px_1fr] items-center gap-y-1 text-xs">
        <span />
        <div className="grid grid-cols-12 text-center text-[10px] font-semibold text-gray-500">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className={i === 0 ? "text-gray-900" : ""}>
              {MESES[(hoyIdx + i) % 12]}
            </span>
          ))}
        </div>

        {actual && ahora && (
          <>
            <span className="truncate text-gray-500">
              {actual.icono} Now: {actual.nombre}
            </span>
            <div className="grid h-5 grid-cols-12 rounded bg-gray-50">
              <div style={ahora} className="rounded bg-gray-300" title="Still in the field" />
            </div>
          </>
        )}

        {filas.map((r) => {
          const pos = tramo(r.inicioIdx, r.inicioIdx + r.ciclo - 1);
          const cal = calificacion(r.puntaje);
          const sel = abierto === r.clave;
          return (
            <button key={r.clave} onClick={() => setAbierto(sel ? null : r.clave)} className="contents text-left">
              <span className={`truncate ${sel ? "font-bold" : ""}`}>
                {r.icono} {r.cultivo}
              </span>
              <div className={`grid h-5 grid-cols-12 rounded bg-gray-50 ${sel ? "ring-2 ring-gray-900" : ""}`}>
                {pos && (
                  <div
                    style={{ ...pos, background: cal.color }}
                    className="flex items-center justify-between rounded px-1 text-[10px] font-bold text-white"
                    title={`${r.siembra} → ${r.cosecha}`}
                  >
                    <span>🌱</span>
                    <span>✂️</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-500">🌱 planting · ✂️ harvest · color = how good the option is</p>
    </section>
  );
}

// ── Lista de opciones ──────────────────────────────────────────────────
function Lista({
  ranking,
  abierto,
  setAbierto,
}: {
  ranking: Opcion[];
  abierto: string | null;
  setAbierto: (k: string | null) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <h3 className="px-3 pt-3 font-bold">All options</h3>
      <ol className="divide-y divide-gray-100">
        {ranking.map((r) => {
          const cal = calificacion(r.puntaje);
          const { buenas, ojo } = etiquetas(r);
          const sel = abierto === r.clave;
          return (
            <li key={r.clave}>
              <button
                onClick={() => setAbierto(sel ? null : r.clave)}
                aria-expanded={sel}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 ${sel ? "bg-gray-50" : ""}`}
              >
                <span className="w-5 text-center text-xs font-bold text-gray-400">{r.posicion}</span>
                <span className="text-2xl">{r.icono}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <b>{r.cultivo}</b>
                    <span className="text-xs font-bold" style={{ color: cal.color }}>
                      {cal.texto}
                    </span>
                  </span>
                  <span className="mt-0.5 block h-1.5 overflow-hidden rounded bg-gray-200">
                    <span className="block h-full rounded" style={{ width: `${r.puntaje}%`, background: cal.color }} />
                  </span>
                </span>
                <span className="w-9 text-right font-bold tabular-nums">{Math.round(r.puntaje)}</span>
                <span className="text-gray-400">{sel ? "▲" : "▼"}</span>
              </button>

              {sel && (
                <div className="space-y-2 bg-gray-50 px-3 pb-3 text-xs">
                  <p>
                    🌱 Plant <b>{r.siembra}</b> (window: {r.ventana}) · ✂️ harvest <b>{r.cosecha}</b>
                    {r.mejorMes && ` · waiting until ${r.mejorMes.siembra} raises it to ${Math.round(r.mejorMes.puntaje)}`}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {buenas.map((t) => (
                      <Chip key={t} texto={t} tipo="buena" />
                    ))}
                    {ojo.map((t) => (
                      <Chip key={t} texto={t} tipo="ojo" />
                    ))}
                  </div>
                  <div className="grid grid-cols-[64px_1fr_28px] items-center gap-x-2 gap-y-1">
                    {Object.entries(r.subpuntajes).map(([k, v]) => (
                      <Barra key={k} etiqueta={CRITERIOS[k as keyof typeof CRITERIOS] ?? k} valor={v} />
                    ))}
                  </div>
                  {r.riesgos.length > 0 && (
                    <ul className="list-disc pl-4 text-gray-700">
                      {r.riesgos.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Barra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <>
      <span>{etiqueta}</span>
      <span className="h-2 overflow-hidden rounded bg-gray-200">
        <span className="block h-full" style={{ width: `${Math.round(valor * 100)}%`, background: colorEstado(valor) }} />
      </span>
      <span className="text-right tabular-nums">{Math.round(valor * 100)}</span>
    </>
  );
}
