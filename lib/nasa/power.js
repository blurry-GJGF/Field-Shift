// NASA POWER (Prediction Of Worldwide Energy Resources) · Climatology API
// Docs: https://power.larc.nasa.gov/docs/services/api/temporal/climatology/
//
// Una sola consulta por punto devuelve los promedios mensuales de largo plazo
// (hoy: enero 2001 – diciembre 2025, el periodo viene en header.range de la respuesta).
// Los datos salen del reanálisis MERRA-2 de NASA (malla de ~0.5° × 0.625°, unos 50 km),
// así que describen la región, no una parcela concreta.
//
// Ojo: en POWER, T2M_MIN y T2M_MAX conservan el valor horario EXTREMO a lo largo de la
// jerarquía temporal (no son el promedio de las mínimas/máximas de cada día).
// Por eso se leen como "la hora más fría / más caliente típica del mes".
// Ver https://power.larc.nasa.gov/docs/methodology/data/processing/

const URL_POWER = "https://power.larc.nasa.gov/api/temporal/climatology/point";

/** Parámetros que pedimos (comunidad AG = agricultura). */
export const PARAMETROS_POWER = ["T2M", "T2M_MIN", "T2M_MAX", "PRECTOTCORR", "GWETTOP", "GWETROOT", "TS"];

const MESES_POWER = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
// Días de cada mes para pasar la lluvia de mm/día a mm/mes (febrero promedia años bisiestos).
const DIAS_MES = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * @typedef {{tmed: number, tmin: number, tmax: number, lluvia: number,
 *   humedadSuperficie: number, humedadRaiz: number, tSuperficie: number}} MesClima
 */

/**
 * Promedios mensuales de largo plazo de NASA POWER para un punto.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<MesClima[] & { periodo: string }>}
 */
export async function obtenerClima(lat, lon) {
  const url = `${URL_POWER}?parameters=${PARAMETROS_POWER.join(",")}&community=AG&latitude=${lat}&longitude=${lon}&format=JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NASA POWER responded ${res.status}`);
  const json = await res.json();
  const p = json.properties.parameter;

  // POWER marca los datos que no tiene con un valor de relleno (-999): no los usamos como si fueran reales.
  const relleno = json.header?.fill_value ?? -999;
  const faltan = PARAMETROS_POWER.filter((k) => MESES_POWER.some((m) => typeof p[k]?.[m] !== "number" || p[k][m] === relleno));
  if (faltan.length) throw new Error(`NASA POWER has no data for ${faltan.join(", ")} at this point.`);

  const meses = MESES_POWER.map((k, i) => ({
    tmed: p.T2M[k], // °C, temperatura media del aire a 2 m
    tmin: p.T2M_MIN[k], // °C, hora más fría típica del mes (extremo)
    tmax: p.T2M_MAX[k], // °C, hora más caliente típica del mes (extremo)
    lluvia: Math.round(p.PRECTOTCORR[k] * DIAS_MES[i]), // mm/día → mm/mes
    humedadSuperficie: p.GWETTOP[k], // 0–1, fracción de saturación del suelo (0–5 cm)
    humedadRaiz: p.GWETROOT[k], // 0–1, zona de raíces (0–100 cm)
    tSuperficie: p.TS[k], // °C, temperatura de la piel de la Tierra ("Earth Skin Temperature")
  }));
  return Object.assign(meses, { periodo: String(json.header?.range ?? "") });
}

/** "25-year … (January 2001 - December 2025)" → "2001–2025 monthly averages". */
export function resumenPeriodo(periodo) {
  const anios = periodo.match(/(\d{4})\s*-\s*\w+\s+(\d{4})/);
  return anios ? `${anios[1]}–${anios[2]} monthly averages` : "long-term monthly averages";
}
