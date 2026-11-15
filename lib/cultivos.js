// Tabla de cultivos.
//
// ⚠️ VALORES DE EJEMPLO, aproximados: hay que verificarlos con FAO ECOCROP,
// FAO-56 y las guías locales (en México: SIAP e INIFAP) antes de presentarlos.
//
// Campos:
//   icono          emoji para la interfaz
//   familia        familia botánica (criterio de plagas)
//   ciclo          meses de siembra a cosecha
//   aguaMm         agua total que necesita en el ciclo (mm)
//   tMinCrecer     temperatura media mínima para crecer (°C)
//   tMaxLimite     temperatura máxima a partir de la cual se daña (°C)
//   tMinTolerada   noche más fría que aguanta (°C). 0 = no tolera heladas;
//                  -4 = aguanta heladas ligeras; -12 = aguanta heladas fuertes
//   fijaN          ¿fija nitrógeno? (leguminosas)
//   raiz           "superficial" | "media" | "profunda"
//   residuo        paja que deja: "bajo" | "medio" | "alto"
//   valor          valor de mercado relativo, 0–1

/** @type {Record<string, {nombre: string, icono: string, familia: string, ciclo: number, aguaMm: number, tMinCrecer: number, tMaxLimite: number, tMinTolerada: number, fijaN: boolean, raiz: "superficial"|"media"|"profunda", residuo: "bajo"|"medio"|"alto", valor: number}>} */
export const CULTIVOS = {
  maiz:     { nombre: "Corn", icono: "🌽",      familia: "grass",      ciclo: 5, aguaMm: 550, tMinCrecer: 10, tMaxLimite: 35, tMinTolerada: 0,   fijaN: false, raiz: "media",       residuo: "alto",  valor: 0.8 },
  trigo:    { nombre: "Wheat", icono: "🌾",     familia: "grass",      ciclo: 5, aguaMm: 450, tMinCrecer: 5,  tMaxLimite: 30, tMinTolerada: -12, fijaN: false, raiz: "media",       residuo: "alto",  valor: 0.6 },
  sorgo:    { nombre: "Sorghum", icono: "🎋",   familia: "grass",      ciclo: 4, aguaMm: 450, tMinCrecer: 12, tMaxLimite: 38, tMinTolerada: 0,   fijaN: false, raiz: "profunda",    residuo: "alto",  valor: 0.6 },
  avena:    { nombre: "Oats", icono: "🌱",      familia: "grass",      ciclo: 4, aguaMm: 400, tMinCrecer: 5,  tMaxLimite: 28, tMinTolerada: -8,  fijaN: false, raiz: "media",       residuo: "medio", valor: 0.5 },
  frijol:   { nombre: "Beans", icono: "🫘",     familia: "legume",     ciclo: 4, aguaMm: 350, tMinCrecer: 12, tMaxLimite: 32, tMinTolerada: 0,   fijaN: true,  raiz: "superficial", residuo: "bajo",  valor: 0.9 },
  garbanzo: { nombre: "Chickpea", icono: "🧆",  familia: "legume",     ciclo: 5, aguaMm: 350, tMinCrecer: 5,  tMaxLimite: 30, tMinTolerada: -4,  fijaN: true,  raiz: "profunda",    residuo: "bajo",  valor: 0.8 },
  haba:     { nombre: "Faba bean", icono: "🫛", familia: "legume",     ciclo: 5, aguaMm: 400, tMinCrecer: 5,  tMaxLimite: 27, tMinTolerada: -6,  fijaN: true,  raiz: "media",       residuo: "medio", valor: 0.6 },
  chile:    { nombre: "Chili", icono: "🌶️",     familia: "nightshade", ciclo: 5, aguaMm: 600, tMinCrecer: 15, tMaxLimite: 32, tMinTolerada: 0,   fijaN: false, raiz: "media",       residuo: "bajo",  valor: 1.0 },
  calabaza: { nombre: "Squash", icono: "🎃",    familia: "gourd",      ciclo: 4, aguaMm: 450, tMinCrecer: 15, tMaxLimite: 35, tMinTolerada: 0,   fijaN: false, raiz: "media",       residuo: "bajo",  valor: 0.7 },
  girasol:  { nombre: "Sunflower", icono: "🌻", familia: "aster",      ciclo: 4, aguaMm: 450, tMinCrecer: 10, tMaxLimite: 35, tMinTolerada: -2,  fijaN: false, raiz: "profunda",    residuo: "medio", valor: 0.6 },
};
