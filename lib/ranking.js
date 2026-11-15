// Ranking de cultivos para la PRÓXIMA siembra.
// Es el mismo cálculo que ranking_siembra.py (ver ranking_siembra_especificacion.md).
// Los textos que ve el usuario están en inglés (diseño de la presentación).
//
// Reglas:
//  * El campo queda libre cuando se cosecha lo sembrado (mes de siembra + ciclo).
//  * Mes de siembra = el primer mes viable desde que el campo queda libre.
//  * Viable = ① ninguna noche más fría de lo que el cultivo aguanta (tMinTolerada),
//             ② T media ≥ mínima, ③ agua ≥ 50 %.
//  * El riego se suma si el mes de siembra cae en la temporada de riego, y sólo
//    se usa el que hace falta. Ahorrar agua = usar menos riego (baja el puntaje de agua).
//  * Plagas = 1 si es otra familia que lo sembrado; 0 si es la misma.
//    Si no hay nada sembrado, plagas no cuenta.

import { CULTIVOS } from "./cultivos.js";

export const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const CRITERIOS = { agua: "Water", clima: "Climate", suelo: "Soil", plagas: "Pests", ingresos: "Income" };

export const TEMPORADAS = {
  invierno: [9, 10, 11, 0, 1, 2], // oct–mar
  verano: [3, 4, 5, 6, 7, 8], // abr–sep
  "todo el año": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const PARAMETROS = {
  lluviaUtil: 0.8,
  minimoViable: 0.5,
  heladaSiTminMenorIgual: 0,
  castigoCalor: 0.5,
  castigoRiego: 0.5, // cuánto baja el puntaje de agua por cada mm de riego usado (relativo a lo que necesita)
  mmPorRiego: 75, // aproximado: un riego por gravedad aplica ~75 mm
  puntosFijaN: 0.3,
  puntosResiduo: { alto: 0.2, medio: 0.1, bajo: 0 },
  puntosRaiz: { profunda: 0.2, media: 0.1, superficial: 0 },
  puntosCoberturaMax: 0.3,
  pesoClima: 2,
  pesoPlagas: 2,
};
const P = PARAMETROS;

/**
 * @typedef {{tmed: number, tmin: number, tmax: number, lluvia: number,
 *   humedadSuperficie: number, humedadRaiz: number, tSuperficie: number}} MesClima
 * @typedef {{lat: number, lon: number, cultivoActual: string, mesSiembraActual: number,
 *   tieneRiego: boolean, riegoMm: number, riegoEn: keyof typeof TEMPORADAS,
 *   prioridadAgua: number, prioridadSuelo: number, prioridadIngresos: number,
 *   excluir: string[]}} Formulario
 */

/**
 * Promedios mensuales de largo plazo de NASA POWER (una sola consulta).
 * @returns {Promise<MesClima[]>}
 */
export async function obtenerClima(lat, lon) {
  const url =
    "https://power.larc.nasa.gov/api/temporal/climatology/point" +
    "?parameters=T2M,T2M_MIN,T2M_MAX,PRECTOTCORR,GWETTOP,GWETROOT,TS" +
    `&community=AG&latitude=${lat}&longitude=${lon}&format=JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NASA POWER responded ${res.status}`);
  const p = (await res.json()).properties.parameter;
  const claves = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return claves.map((k) => ({
    tmed: p.T2M[k],
    tmin: p.T2M_MIN[k], // noche más fría del mes
    tmax: p.T2M_MAX[k], // día más caluroso del mes
    lluvia: Math.round(p.PRECTOTCORR[k] * 30.4), // mm/día → mm/mes
    humedadSuperficie: p.GWETTOP[k], // 0–1, fracción de saturación (0–5 cm)
    humedadRaiz: p.GWETROOT[k], // 0–1, zona de raíces (0–100 cm)
    tSuperficie: p.TS[k], // °C, temperatura de la superficie del suelo
  }));
}

const nombre = (clave) => CULTIVOS[clave].nombre;
const textoMes = (idx) => `${MESES[idx % 12]} ${Math.floor(idx / 12)}`; // idx = año*12 + mes

function riegoPara(mes, form) {
  return form.tieneRiego && TEMPORADAS[form.riegoEn].includes(mes) ? form.riegoMm : 0;
}

/** Viabilidad de sembrar `clave` en el mes `inicio` (0–11). */
function evaluar(clave, inicio, clima, riego) {
  const c = CULTIVOS[clave];
  const meses = Array.from({ length: c.ciclo }, (_, i) => (inicio + i) % 12);
  const v = { inicio, meses, riego, viable: false, motivo: "", lluvia: 0, util: 0, total: 0, pct: 0 };

  if (meses.some((m) => mataLaHelada(c, clima[m].tmin))) return { ...v, motivo: "frost" };

  const frio = meses.find((m) => clima[m].tmed < c.tMinCrecer);
  if (frio !== undefined) return { ...v, motivo: "too cold" };

  const lluvia = meses.reduce((s, m) => s + clima[m].lluvia, 0);
  const util = lluvia * P.lluviaUtil;
  const riegoUsado = Math.min(riego, Math.max(0, c.aguaMm - util)); // sólo el riego que hace falta
  const total = util + riegoUsado;
  const pct = total / c.aguaMm;
  const base = { ...v, riego: riegoUsado, lluvia, util, total, pct };
  if (pct < P.minimoViable) return { ...base, motivo: "not enough water" };
  return { ...base, viable: true, motivo: "viable" };
}

/** ¿La noche más fría del mes (tmin) mata al cultivo? */
function mataLaHelada(c, tmin) {
  return c.tMinTolerada >= 0 ? tmin <= P.heladaSiTminMenorIgual : tmin < c.tMinTolerada;
}

function subpuntajes(clave, v, clima, actual) {
  const c = CULTIVOS[clave];
  const n = v.meses.length;

  // Agua: qué tanto cubre lo que necesita, menos un castigo por el riego que gasta.
  const deficit = Math.max(0, c.aguaMm - v.total);
  const cobertura = 1 - deficit / c.aguaMm;
  const agua = Math.max(0, cobertura - (P.castigoRiego * v.riego) / c.aguaMm);

  let castigos = 0;
  const mesesCalor = [];
  for (const m of v.meses) {
    if (clima[m].tmax > c.tMaxLimite) {
      castigos += P.castigoCalor;
      mesesCalor.push(MESES[m]);
    }
  }
  const climaS = Math.max(0, 1 - castigos / n);

  const suelo = Math.min(
    1,
    (c.fijaN ? P.puntosFijaN : 0) + P.puntosResiduo[c.residuo] + P.puntosRaiz[c.raiz] + (n / 12) * P.puntosCoberturaMax,
  );

  /** @type {Record<string, number>} */
  const sub = { agua, clima: climaS, suelo };
  if (actual) sub.plagas = CULTIVOS[actual].familia === c.familia ? 0 : 1;
  sub.ingresos = c.valor;
  return { sub, deficit, mesesCalor };
}

/** @param {Formulario} form */
export function pesosDe(form) {
  /** @type {Record<string, number>} */
  const pesos = { agua: form.prioridadAgua, clima: P.pesoClima, suelo: form.prioridadSuelo };
  if (form.cultivoActual !== "ninguno") pesos.plagas = P.pesoPlagas;
  pesos.ingresos = form.prioridadIngresos;
  return pesos;
}

function puntaje(sub, pesos) {
  const total = Object.values(pesos).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return (100 * Object.keys(pesos).reduce((s, k) => s + pesos[k] * sub[k], 0)) / total;
}

/** Índice absoluto (año*12 + mes) desde el que el campo está libre, y su explicación. */
export function campoLibreDesde(form, hoy) {
  const hoyIdx = hoy.getFullYear() * 12 + hoy.getMonth();
  if (form.cultivoActual === "ninguno")
    return { desde: hoyIdx, ocupado: null, texto: "Nothing planted: the field is free today." };

  const c = CULTIVOS[form.cultivoActual];
  const mes = form.mesSiembraActual - 1;
  const anio = mes <= hoy.getMonth() ? hoy.getFullYear() : hoy.getFullYear() - 1;
  const siembraIdx = anio * 12 + mes;
  const libreIdx = siembraIdx + c.ciclo;
  const base = `${c.nombre} planted in ${textoMes(siembraIdx)} (${c.ciclo}-month cycle), harvested in ${textoMes(libreIdx - 1)}`;
  const ocupado = { inicioIdx: siembraIdx, finIdx: libreIdx - 1 };
  if (libreIdx <= hoyIdx) return { desde: hoyIdx, ocupado, texto: `${base}. Already harvested: the field is free today.` };
  return { desde: libreIdx, ocupado, texto: `${base}. The field is free from ${textoMes(libreIdx)}.` };
}

function proximaSiembra(clave, clima, form, hoyIdx, desde) {
  const pruebas = [];
  for (let k = 0; k < 12; k++) {
    const idx = desde + k;
    const v = evaluar(clave, idx % 12, clima, riegoPara(idx % 12, form));
    pruebas.push({ ...v, idx, espera: idx - hoyIdx });
  }
  const primero = pruebas.findIndex((v) => v.viable);
  if (primero === -1) {
    return { v: null, ventana: [], motivo: [...new Set(pruebas.map((v) => v.motivo))].join("; ") };
  }
  const ventana = [];
  for (const v of pruebas.slice(primero)) {
    if (!v.viable) break;
    ventana.push(v);
  }
  return { v: pruebas[primero], ventana, motivo: "" };
}

function explicar(r, clave, actual) {
  const sub = r.subpuntajes;
  const fuertes = Object.keys(sub)
    .sort((a, b) => sub[b] - sub[a])
    .slice(0, 2)
    .map((k) => `${CRITERIOS[k]} (${sub[k].toFixed(2)})`);
  const riesgos = Object.entries(sub)
    .filter(([k, s]) => s < 0.6 && k !== "plagas")
    .map(([k, s]) => `low ${CRITERIOS[k].toLowerCase()} score (${s.toFixed(2)})`);
  if (actual && sub.plagas === 0)
    riesgos.push(`same family as ${nombre(actual).toLowerCase()} (${CULTIVOS[actual].familia}): does not break the pest cycle`);
  if (r.mesesCalor.length) riesgos.push(`days above ${CULTIVOS[clave].tMaxLimite} °C in ${r.mesesCalor.join(", ")}`);
  const riegos = `~${Math.ceil(r.riegoMm / P.mmPorRiego)} waterings (${Math.round(r.riegoMm)} mm)`;
  if (r.soloConRiego) riesgos.push(`only viable with irrigation: needs ${riegos}`);
  else if (r.riegoMm > 0) riesgos.push(`needs ${riegos} of irrigation`);
  if (r.esperaMeses > 0) riesgos.push(`${r.esperaMeses}-month wait (bare soil meanwhile)`);
  return { loMejor: fuertes.join(" and "), riesgos };
}

/**
 * Punto de entrada que usa el mapa.
 * @param {Formulario} form
 * @param {MesClima[]} clima
 * @param {Date} hoy
 */
export function rankear(form, clima, hoy) {
  const pesos = pesosDe(form);
  const actual = form.cultivoActual === "ninguno" ? null : form.cultivoActual;
  const hoyIdx = hoy.getFullYear() * 12 + hoy.getMonth();
  const libre = campoLibreDesde(form, hoy);
  const ranking = [];
  const descartados = [];

  for (const clave of Object.keys(CULTIVOS)) {
    if (form.excluir.includes(clave)) {
      descartados.push({ cultivo: nombre(clave), motivo: "excluded by you" });
      continue;
    }
    const { v, ventana, motivo } = proximaSiembra(clave, clima, form, hoyIdx, libre.desde);
    if (!v) {
      descartados.push({ cultivo: nombre(clave), motivo: `no viable month in the next 12 (${motivo})` });
      continue;
    }
    const { sub, deficit, mesesCalor } = subpuntajes(clave, v, clima, actual);
    const pts = puntaje(sub, pesos);
    let mejor = v;
    let ptsMejor = pts;
    for (const w of ventana) {
      const p = puntaje(subpuntajes(clave, w, clima, actual).sub, pesos);
      if (p > ptsMejor) [mejor, ptsMejor] = [w, p];
    }
    const r = {
      clave,
      cultivo: nombre(clave),
      icono: CULTIVOS[clave].icono,
      familia: CULTIVOS[clave].familia,
      fijaN: CULTIVOS[clave].fijaN,
      siembra: textoMes(v.idx),
      cosecha: textoMes(v.idx + CULTIVOS[clave].ciclo - 1),
      inicioIdx: v.idx, // año*12 + mes, para el calendario
      ciclo: CULTIVOS[clave].ciclo,
      esperaMeses: v.espera,
      meses: `${MESES[v.meses[0]]}–${MESES[v.meses[v.meses.length - 1]]}`,
      ventana:
        ventana.length === 1
          ? `${MESES[ventana[0].inicio]} only`
          : `${MESES[ventana[0].inicio]}–${MESES[ventana[ventana.length - 1].inicio]}`,
      riegoMm: v.riego,
      aguaCubierta: v.pct,
      deficitMm: deficit,
      subpuntajes: sub,
      puntaje: Math.round(pts * 10) / 10,
      mejorMes: ptsMejor > pts ? { siembra: textoMes(mejor.idx), puntaje: Math.round(ptsMejor * 10) / 10 } : null,
      soloConRiego: v.riego > 0 && !evaluar(clave, v.inicio, clima, 0).viable,
      mesesCalor,
      posicion: 0,
      loMejor: "",
      /** @type {string[]} */
      riesgos: [],
    };
    Object.assign(r, explicar(r, clave, actual));
    ranking.push(r);
  }

  ranking.sort((a, b) => b.puntaje - a.puntaje);
  ranking.forEach((r, i) => (r.posicion = i + 1));
  return { campoLibre: libre.texto, hoyIdx, libreDesde: libre.desde, ocupado: libre.ocupado, pesos, ranking, descartados };
}
