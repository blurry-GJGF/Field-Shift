// Paneles de datos del lugar: Soil, Temperature y Water.
// Todo sale de la misma consulta a NASA POWER (promedios mensuales de largo plazo).
import { MESES } from "@/lib/ranking";
import { COLOR, Dato, Fuente, PorQueImporta, Tarjeta, colorEstado, type Clima } from "./ui";

const pct = (x: number) => `${Math.round(x * 100)} %`;
const lista = (meses: number[]) => meses.map((m) => MESES[m]).join(", ") || "none";

// ────────────────────────────────────────────────────────────────────────
// SOIL
// ────────────────────────────────────────────────────────────────────────
export function PanelSuelo({ clima, mes }: { clima: Clima; mes: number }) {
  const ahora = clima[mes];
  const secos = clima.flatMap((m, i) => (m.humedadSuperficie < 0.2 ? [i] : []));
  const estadoRaiz = ahora.humedadRaiz >= 0.5 ? "Moist" : ahora.humedadRaiz >= 0.3 ? "Moderate" : "Dry";

  return (
    <>
      <Tarjeta titulo={`Soil moisture by depth · ${MESES[mes]} average`}>
        <div className="flex items-center gap-4">
          {/* Dibujo del perfil del suelo */}
          <div className="w-16 shrink-0" aria-hidden>
            <div className="text-center text-xl leading-none">🌱</div>
            <div className="h-4 rounded-t bg-[#8a5a2b]" />
            <div className="h-5 bg-[#b5763a]" />
            <div className="h-6 rounded-b bg-[#d9a066]" />
          </div>
          <table className="flex-1 text-sm">
            <tbody>
              <tr>
                <td className="py-0.5">Surface · 0–5 cm</td>
                <td className="text-right font-bold">{pct(ahora.humedadSuperficie)}</td>
              </tr>
              <tr>
                <td className="py-0.5">Root zone · 0–100 cm</td>
                <td className="text-right font-bold">{pct(ahora.humedadRaiz)}</td>
              </tr>
            </tbody>
          </table>
          <span
            className="rounded-md px-3 py-1 text-sm font-bold"
            style={{ background: `${colorEstado(ahora.humedadRaiz, 0.5, 0.3)}33` }}
          >
            {estadoRaiz}
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-500">% = how saturated the soil is (100 % = fully wet).</p>
      </Tarjeta>

      <Tarjeta titulo="Root-zone moisture through the year">
        <Barras
          valores={clima.map((m) => m.humedadRaiz)}
          maximo={1}
          color={(v) => colorEstado(v, 0.5, 0.3)}
          texto={(v) => `${Math.round(v * 100)}`}
          resaltar={mes}
        />
      </Tarjeta>

      <Tarjeta titulo={`Current conditions · ${MESES[mes]} average`}>
        <div className="grid grid-cols-2 divide-x divide-gray-200">
          <div className="flex items-center gap-2 pr-2">
            <span className="text-2xl" aria-hidden>💧</span>
            <Dato etiqueta="Moisture" valor={pct(ahora.humedadSuperficie)} nota="0–5 cm" />
          </div>
          <div className="flex items-center gap-2 pl-3">
            <span className="text-2xl" aria-hidden>🌡️</span>
            <Dato etiqueta="Soil surface temp." valor={`${ahora.tSuperficie.toFixed(0)} °C`} />
          </div>
        </div>
      </Tarjeta>

      <PorQueImporta>
        the topsoil is driest in <b>{lista(secos)}</b>. Avoid sowing shallow-rooted crops then; deep-rooted or
        drought-tolerant crops (sorghum, chickpea) and legumes that add nitrogen help protect the soil.
      </PorQueImporta>

      <Fuente nasa>NASA POWER (MERRA-2): GWETTOP, GWETROOT, TS</Fuente>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// TEMPERATURE
// ────────────────────────────────────────────────────────────────────────
export function PanelTemperatura({ clima, mes }: { clima: Clima; mes: number }) {
  const minimo = Math.min(...clima.map((m) => m.tmin));
  const maximo = Math.max(...clima.map((m) => m.tmax));
  const frio = clima.findIndex((m) => m.tmin === minimo);
  const calor = clima.findIndex((m) => m.tmax === maximo);
  const media = clima.reduce((s, m) => s + m.tmed, 0) / 12;
  const heladas = clima.flatMap((m, i) => (m.tmin <= 0 ? [i] : []));
  const extremos = clima.flatMap((m, i) => (m.tmax > 38 ? [i] : []));
  const bajo = Math.floor(Math.min(minimo, 0) / 5) * 5;
  const alto = Math.ceil(maximo / 5) * 5;
  const y = (t: number) => ((alto - t) / (alto - bajo)) * 100; // % desde arriba

  return (
    <>
      <Tarjeta>
        <div className="grid grid-cols-3 gap-2">
          <Dato etiqueta="Annual mean" valor={`${media.toFixed(1)} °C`} />
          <Dato etiqueta="Coldest night" valor={`${minimo.toFixed(1)} °C`} nota={MESES[frio]} />
          <Dato etiqueta="Hottest day" valor={`${maximo.toFixed(1)} °C`} nota={MESES[calor]} />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Monthly range: coldest night → hottest day">
        <div className="relative h-40">
          {/* línea de 0 °C */}
          {bajo < 0 && (
            <div className="absolute inset-x-0 border-t border-dashed border-blue-400" style={{ top: `${y(0)}%` }}>
              <span className="absolute -top-4 right-0 text-[10px] text-blue-600">0 °C</span>
            </div>
          )}
          <div className="absolute inset-0 grid grid-cols-12 gap-1">
            {clima.map((m, i) => (
              <div key={i} className="relative" title={`${MESES[i]}: ${m.tmin}–${m.tmax} °C`}>
                <div
                  className="absolute left-1/2 w-2.5 -translate-x-1/2 rounded-full"
                  style={{
                    top: `${y(m.tmax)}%`,
                    bottom: `${100 - y(m.tmin)}%`,
                    background: `linear-gradient(${m.tmax > 38 ? COLOR.risk : COLOR.caution}, ${m.tmin <= 0 ? "#3b82f6" : COLOR.favorable})`,
                    outline: i === mes ? "2px solid #111" : undefined,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        <EjeMeses resaltar={mes} />
      </Tarjeta>

      <Tarjeta>
        <p className="text-sm">
          ❄️ <b>Frost months:</b> {lista(heladas)}
        </p>
        <p className="mt-1 text-sm">
          🔥 <b>Days above 38 °C:</b> {lista(extremos)}
        </p>
      </Tarjeta>

      <PorQueImporta>
        frost-sensitive crops (corn, beans, squash) can only grow outside <b>{lista(heladas)}</b>; very hot months stress
        flowering in beans, wheat and chickpea.
      </PorQueImporta>

      <Fuente nasa>NASA POWER (MERRA-2): T2M, T2M_MIN, T2M_MAX</Fuente>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// WATER
// ────────────────────────────────────────────────────────────────────────
export function PanelAgua({
  clima,
  mes,
  riego,
}: {
  clima: Clima;
  mes: number;
  riego: { mm: number; texto: string } | null;
}) {
  const anual = clima.reduce((s, m) => s + m.lluvia, 0);
  const humedo = clima.reduce((best, m, i) => (m.lluvia > clima[best].lluvia ? i : best), 0);
  const secos = clima.flatMap((m, i) => (m.lluvia < 30 ? [i] : []));

  return (
    <>
      <Tarjeta>
        <div className="grid grid-cols-3 gap-2">
          <Dato etiqueta="Annual rainfall" valor={`${anual} mm`} />
          <Dato etiqueta="Wettest month" valor={MESES[humedo]} nota={`${clima[humedo].lluvia} mm`} />
          <Dato etiqueta="Dry months" valor={`${secos.length}`} nota="under 30 mm" />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Monthly rainfall (mm)">
        <Barras
          valores={clima.map((m) => m.lluvia)}
          maximo={Math.max(...clima.map((m) => m.lluvia), 1)}
          color={(v) => (v >= 60 ? COLOR.favorable : v >= 30 ? COLOR.caution : COLOR.risk)}
          texto={(v) => `${v}`}
          resaltar={mes}
        />
      </Tarjeta>

      <Tarjeta titulo="Your water">
        <p className="text-sm">
          {riego ? (
            <>
              💧 Irrigated: you can water your next crop <b>{riego.texto.toLowerCase()}</b> (≈ {riego.mm} mm).
            </>
          ) : (
            <>🌧️ Rainfed: your crops depend only on rain.</>
          )}
        </p>
      </Tarjeta>

      <PorQueImporta>
        most rain falls in <b>{lista(clima.flatMap((m, i) => (m.lluvia >= 60 ? [i] : [])))}</b>. Outside those months a
        crop needs irrigation; low-water crops like chickpea or sorghum reduce demand.
      </PorQueImporta>

      <Fuente nasa>NASA POWER (MERRA-2): PRECTOTCORR</Fuente>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
function Barras({
  valores,
  maximo,
  color,
  texto,
  resaltar,
}: {
  valores: number[];
  maximo: number;
  color: (v: number) => string;
  texto: (v: number) => string;
  resaltar: number;
}) {
  return (
    <>
      <div className="grid h-28 grid-cols-12 items-end gap-1">
        {valores.map((v, i) => (
          <div key={i} className="flex h-full flex-col justify-end text-center" title={`${MESES[i]}: ${texto(v)}`}>
            <span className="text-[10px] text-gray-600">{texto(v)}</span>
            <div
              className="rounded-t"
              style={{
                height: `${Math.max(2, (v / maximo) * 85)}%`,
                background: color(v),
                outline: i === resaltar ? "2px solid #111" : undefined,
              }}
            />
          </div>
        ))}
      </div>
      <EjeMeses resaltar={resaltar} />
    </>
  );
}

function EjeMeses({ resaltar }: { resaltar: number }) {
  return (
    <div className="mt-1 grid grid-cols-12 gap-1 text-center text-[10px] text-gray-600">
      {MESES.map((m, i) => (
        <span key={m} className={i === resaltar ? "font-bold text-gray-900" : ""}>
          {m[0]}
        </span>
      ))}
    </div>
  );
}
