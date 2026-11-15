// Panel "Crop Rotation · Next stage": formulario + ranking para la próxima siembra.
import { CRITERIOS, MESES, type rankear } from "@/lib/ranking";
import { CULTIVOS } from "@/lib/cultivos";
import { Tarjeta, colorEstado, type Respuestas } from "./ui";

type Resultado = ReturnType<typeof rankear>;

export function PanelRotacion({
  resp,
  cambiar,
  resultado,
}: {
  resp: Respuestas;
  cambiar: <K extends keyof Respuestas>(clave: K, valor: Respuestas[K]) => void;
  resultado: Resultado | null;
}) {
  return (
    <>
      <Tarjeta titulo="Your field">
        <label className="block text-sm">
          What is planted now (or was last)?
          <div className="mt-1 flex gap-2">
            <select
              value={resp.cultivoActual}
              onChange={(e) => cambiar("cultivoActual", e.target.value)}
              className="campo flex-1"
            >
              <option value="ninguno">Nothing</option>
              {Object.entries(CULTIVOS).map(([k, c]) => (
                <option key={k} value={k}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {resp.cultivoActual !== "ninguno" && (
              <select
                value={resp.mesSiembraActual}
                onChange={(e) => cambiar("mesSiembraActual", Number(e.target.value))}
                className="campo"
                aria-label="Month it was planted"
              >
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    planted in {m}
                  </option>
                ))}
              </select>
            )}
          </div>
        </label>

        {resp.tieneRiego && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            Irrigation:
            <input
              type="number"
              min={0}
              step={50}
              value={resp.riegoMm}
              onChange={(e) => cambiar("riegoMm", Math.max(0, Number(e.target.value) || 0))}
              className="campo w-20"
              aria-label="Irrigation water per year in mm"
            />
            mm/year in
            <select
              value={resp.riegoEn}
              onChange={(e) => cambiar("riegoEn", e.target.value as Respuestas["riegoEn"])}
              className="campo"
              aria-label="Irrigation season"
            >
              <option value="invierno">winter (Oct–Mar)</option>
              <option value="verano">summer (Apr–Sep)</option>
              <option value="todo el año">all year</option>
            </select>
          </div>
        )}

        <p className="mt-3 text-sm font-semibold">How important is…</p>
        <Prioridad etiqueta="Saving water" valor={resp.prioridadAgua} onChange={(v) => cambiar("prioridadAgua", v)} />
        <Prioridad etiqueta="Improving soil" valor={resp.prioridadSuelo} onChange={(v) => cambiar("prioridadSuelo", v)} />
        <Prioridad etiqueta="Income" valor={resp.prioridadIngresos} onChange={(v) => cambiar("prioridadIngresos", v)} />

        <p className="mt-3 text-sm font-semibold">Crops you can’t or won’t plant</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {Object.entries(CULTIVOS).map(([k, c]) => {
            const fuera = resp.excluir.includes(k);
            return (
              <button
                key={k}
                onClick={() => cambiar("excluir", fuera ? resp.excluir.filter((x) => x !== k) : [...resp.excluir, k])}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  fuera ? "border-red-400 bg-red-50 text-red-700 line-through" : "border-gray-300 hover:bg-gray-100"
                }`}
                aria-pressed={fuera}
              >
                {c.nombre}
              </button>
            );
          })}
        </div>
      </Tarjeta>

      {!resultado && <p className="text-sm text-gray-500">Loading NASA data for this field…</p>}
      {resultado && (
        <>
          <h3 className="mt-1 font-bold text-gray-900">Best crops for your next planting</h3>
          <p className="-mt-2 text-xs text-gray-600">{resultado.campoLibre}</p>
          <ol className="space-y-2">
            {resultado.ranking.map((r) => (
              <li
                key={r.clave}
                className={`rounded-lg border bg-white p-3 ${r.posicion === 1 ? "border-2 border-[#2e9d4f]" : "border-gray-200"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold">
                    {r.posicion}. {r.cultivo} <span className="text-xs font-normal text-gray-500">({r.familia})</span>
                  </h4>
                  <span
                    className="rounded px-2 font-bold text-white"
                    style={{ background: colorEstado(r.puntaje / 100, 0.7, 0.5) }}
                  >
                    {r.puntaje}
                  </span>
                </div>
                <p className="mt-1 text-sm">
                  Plant in <b>{r.siembra}</b>
                  {r.esperaMeses > 0 ? ` (in ${r.esperaMeses} months)` : " (this month)"} · grows {r.meses}
                  {r.riegoMm > 0 && ` · ${r.riegoMm} mm irrigation`}
                </p>
                <p className="text-xs text-gray-600">
                  Planting window: {r.ventana} · covers {Math.round(r.aguaCubierta * 100)} % of its water
                  {r.mejorMes && ` · waiting until ${r.mejorMes.siembra} raises it to ${r.mejorMes.puntaje}`}
                </p>
                <div className="mt-2 grid grid-cols-[56px_1fr_30px] items-center gap-x-2 gap-y-0.5 text-xs">
                  {Object.entries(r.subpuntajes).map(([k, v]) => (
                    <Barra key={k} etiqueta={CRITERIOS[k as keyof typeof CRITERIOS] ?? k} valor={v} />
                  ))}
                </div>
                <p className="mt-2 text-xs">
                  <b>Strongest:</b> {r.loMejor}
                </p>
                {r.riesgos.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-xs text-gray-700">
                    {r.riesgos.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {resultado.descartados.length > 0 && (
            <div className="text-xs text-gray-600">
              <b>Not recommended:</b>
              <ul className="list-disc pl-4">
                {resultado.descartados.map((d) => (
                  <li key={d.cultivo}>
                    {d.cultivo}: {d.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs italic text-gray-500">
            Decision-support tool: crop values are examples. Validate with a local agronomist and your own experience.
          </p>
        </>
      )}
    </>
  );
}

function Prioridad({ etiqueta, valor, onChange }: { etiqueta: string; valor: number; onChange: (v: number) => void }) {
  const textos = ["None", "Low", "Mid", "High"];
  return (
    <div className="mt-1 flex items-center justify-between gap-2 text-sm">
      <span>{etiqueta}</span>
      <div className="flex overflow-hidden rounded border border-gray-300" role="radiogroup" aria-label={etiqueta}>
        {textos.map((t, i) => (
          <button
            key={t}
            role="radio"
            aria-checked={valor === i}
            onClick={() => onChange(i)}
            className={`px-2 py-0.5 text-xs ${valor === i ? "bg-[#b3151c] text-white" : "hover:bg-gray-100"}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Barra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <>
      <span>{etiqueta}</span>
      <span className="h-2 overflow-hidden rounded bg-gray-200">
        <span className="block h-full" style={{ width: `${Math.round(valor * 100)}%`, background: colorEstado(valor) }} />
      </span>
      <span className="text-right tabular-nums">{valor.toFixed(2)}</span>
    </>
  );
}
