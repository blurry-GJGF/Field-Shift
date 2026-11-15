// NASA GIBS (Global Imagery Browse Services): mosaicos de imagen satelital, sin registro.
// Docs: https://nasa-gibs.github.io/gibs-api-docs/  ·  Capas: WMTSCapabilities.xml de
// https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml

// ── Capas de NASA GIBS (sin registro) ───────────────────────────────────
export const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
export const urlGibs = (capa: string, fecha: string | null, nivel: number, ext: string) =>
  `${GIBS}/${capa}/default/${fecha ? `${fecha}/` : ""}GoogleMapsCompatible_Level${nivel}/{z}/{y}/{x}.${ext}`;

export const CAPAS_NASA = {
  ninguna: { nombre: "No layer", capa: null, ext: "", opacidad: 1 },
  // Imagen satelital del día (MODIS Terra, 250 m). Encima se pone HLS (30 m) cuando hay.
  color: { nombre: "True color", capa: "MODIS_Terra_CorrectedReflectance_TrueColor", ext: "jpg", opacidad: 1 },
  // Índice de vegetación (MODIS Terra, compuesto de 8 días, 250 m)
  ndvi: { nombre: "Vegetation (NDVI)", capa: "MODIS_Terra_NDVI_8Day", ext: "png", opacidad: 1 },
} as const;
export type CapaNasa = keyof typeof CAPAS_NASA;

// Fecha de hace 2 días: la imagen más reciente que GIBS suele tener completa.
export const fechaReciente = () => new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);

// ── HLS (Landsat + Sentinel-2 armonizados, 30 m) ───────────────────────
// Cada fecha sólo cubre parte del mundo, así que buscamos la imagen más reciente
// que tenga datos en el punto elegido (revisando un mosaico de zoom 10).
export const HLS = ["HLS_S30_Nadir_BRDF_Adjusted_Reflectance", "HLS_L30_Nadir_BRDF_Adjusted_Reflectance"] as const;
export type ImagenHls = { fecha: string; producto: (typeof HLS)[number] };

export async function buscarImagenHls(lat: number, lon: number, hasta: string, dias = 24): Promise<ImagenHls | null> {
  const n = 2 ** 10;
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  const fin = new Date(`${hasta}T12:00:00Z`).getTime();
  const fechas = Array.from({ length: dias }, (_, i) => new Date(fin - i * 86_400_000).toISOString().slice(0, 10));

  const pruebas = await Promise.all(
    fechas.flatMap((fecha) =>
      HLS.map(async (producto) => {
        try {
          const r = await fetch(`${GIBS}/${producto}/default/${fecha}/GoogleMapsCompatible_Level12/10/${y}/${x}.png`);
          // Un mosaico vacío pesa unos cientos de bytes; uno con imagen, decenas de KB.
          return r.ok && (await r.blob()).size > 20_000 ? { fecha, producto } : null;
        } catch {
          return null;
        }
      }),
    ),
  );
  return pruebas.find((p) => p !== null) ?? null; // ya vienen de la más reciente a la más vieja
}
