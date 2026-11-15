"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Graticule from "ol/layer/Graticule";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Style, Circle, Fill, Stroke } from "ol/style";
import { fromLonLat, toLonLat } from "ol/proj";
import "ol/ol.css";
import { obtenerClima, rankear } from "@/lib/ranking";
import { PanelAgua, PanelSuelo, PanelTemperatura } from "./paneles";
import { PanelRotacion } from "./PanelRotacion";
import { COLOR, type Clima, type Respuestas } from "./ui";

// ── Capas de NASA GIBS (sin registro) ───────────────────────────────────
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const urlGibs = (capa: string, fecha: string | null, nivel: number, ext: string) =>
  `${GIBS}/${capa}/default/${fecha ? `${fecha}/` : ""}GoogleMapsCompatible_Level${nivel}/{z}/{y}/{x}.${ext}`;

const CAPAS_NASA = {
  ninguna: { nombre: "No layer", capa: null, ext: "", opacidad: 1 },
  // Imagen satelital del día (MODIS Terra, 250 m)
  color: { nombre: "True color", capa: "MODIS_Terra_CorrectedReflectance_TrueColor", ext: "jpg", opacidad: 1 },
  // Índice de vegetación (MODIS Terra, compuesto de 8 días, 250 m)
  ndvi: { nombre: "Vegetation (NDVI)", capa: "MODIS_Terra_NDVI_8Day", ext: "png", opacidad: 0.9 },
} as const;
type CapaNasa = keyof typeof CAPAS_NASA;

// Fecha de hace 2 días: la imagen más reciente que GIBS suele tener completa.
const fechaReciente = () => new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);

const REGIONES = [
  { nombre: "Valle del Yaqui", lat: 27.49, lon: -109.93 },
  { nombre: "Hermosillo", lat: 29.07, lon: -110.96 },
];

type Vista = "temperatura" | "agua" | "suelo" | "rotacion";
const VISTAS: { id: Vista; nombre: string; icono: string; sub?: string }[] = [
  { id: "temperatura", nombre: "Temperature", icono: "🌡️" },
  { id: "agua", nombre: "Water", icono: "💧" },
  { id: "suelo", nombre: "Soil", icono: "🟫" },
  { id: "rotacion", nombre: "Crop Rotation", icono: "🌱", sub: "Next stage" },
];

const RESPUESTAS_INICIALES: Respuestas = {
  cultivoActual: "maiz",
  mesSiembraActual: 6,
  tieneRiego: true,
  riegoMm: 300,
  riegoEn: "invierno",
  prioridadAgua: 3,
  prioridadSuelo: 2,
  prioridadIngresos: 1,
  excluir: [],
};

type Punto = { lat: number; lon: number; nombre: string | null };

export default function MapaCampo() {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const nasaRef = useRef<TileLayer<XYZ> | null>(null);
  const referenciasRef = useRef<TileLayer<XYZ>[]>([]);
  const marcadorRef = useRef<VectorSource | null>(null);
  const [fechaMax] = useState(fechaReciente);
  const [fecha, setFecha] = useState(fechaMax);

  const [vista, setVista] = useState<Vista>("suelo");
  const [capa, setCapa] = useState<CapaNasa>("ndvi");
  const [punto, setPunto] = useState<Punto>({ ...REGIONES[0] });
  const [climaRes, setClimaRes] = useState<{ clave: string; datos?: Clima; error?: string } | null>(null);
  const [resp, setResp] = useState<Respuestas>(RESPUESTAS_INICIALES);
  const [hoy] = useState(() => new Date());
  const [ahora, setAhora] = useState(hoy);
  const [verAviso, setVerAviso] = useState(true);

  const cambiar = <K extends keyof Respuestas>(clave: K, valor: Respuestas[K]) =>
    setResp((r) => ({ ...r, [clave]: valor }));

  // Clima del punto elegido (una consulta a NASA POWER por punto).
  const clave = `${punto.lat},${punto.lon}`;
  const clima = climaRes?.clave === clave ? climaRes.datos : undefined;
  const error = climaRes?.clave === clave ? climaRes.error : undefined;
  const cargando = climaRes?.clave !== clave;
  useEffect(() => {
    let vigente = true;
    obtenerClima(punto.lat, punto.lon)
      .then((datos) => vigente && setClimaRes({ clave, datos }))
      .catch((e) => vigente && setClimaRes({ clave, error: e instanceof Error ? e.message : "NASA POWER error" }));
    return () => {
      vigente = false;
    };
  }, [clave, punto.lat, punto.lon]);

  // Reloj del encabezado.
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!divRef.current) return;
    const nasa = new TileLayer<XYZ>();
    const marcador = new VectorSource();
    // Fronteras, costas y nombres de NASA GIBS encima de la imagen satelital.
    // (Las versiones "_15m" no traen transparencia y tapan el mapa de negro.)
    const referencias = ["Reference_Features", "Reference_Labels"].map(
      (capa) =>
        new TileLayer<XYZ>({
          visible: false,
          source: new XYZ({ url: urlGibs(capa, null, 9, "png"), maxZoom: 9, crossOrigin: "anonymous" }),
        }),
    );
    nasaRef.current = nasa;
    referenciasRef.current = referencias;
    marcadorRef.current = marcador;

    const map = new Map({
      target: divRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        nasa,
        ...referencias,
        new Graticule({
          strokeStyle: new Stroke({ color: "rgba(0,0,0,0.25)", width: 1, lineDash: [2, 4] }),
          showLabels: true,
          wrapX: false,
        }),
        new VectorLayer({
          source: marcador,
          style: new Style({
            image: new Circle({
              radius: 8,
              fill: new Fill({ color: COLOR.rojo }),
              stroke: new Stroke({ color: "#fff", width: 2 }),
            }),
          }),
        }),
      ],
      view: new View({ center: fromLonLat([REGIONES[0].lon, REGIONES[0].lat]), zoom: 8, maxZoom: 12 }),
    });
    mapRef.current = map;

    map.on("singleclick", (e) => {
      const [lon, lat] = toLonLat(e.coordinate).map((n) => +n.toFixed(2));
      setPunto({ lat, lon, nombre: null });
    });

    const observador = new ResizeObserver(() => map.updateSize());
    observador.observe(divRef.current);
    return () => {
      observador.disconnect();
      map.setTarget(undefined);
    };
  }, []);

  // Marcador en el punto elegido.
  useEffect(() => {
    marcadorRef.current?.clear();
    marcadorRef.current?.addFeature(new Feature(new Point(fromLonLat([punto.lon, punto.lat]))));
  }, [punto]);

  // Capa de NASA (cambia con el botón o con la fecha).
  useEffect(() => {
    const c = CAPAS_NASA[capa];
    const nasa = nasaRef.current;
    if (!nasa) return;
    nasa.setOpacity(c.opacidad);
    nasa.setSource(
      c.capa ? new XYZ({ url: urlGibs(c.capa, fecha, 9, c.ext), maxZoom: 9, crossOrigin: "anonymous" }) : null,
    );
    referenciasRef.current.forEach((r) => r.setVisible(c.capa !== null));
  }, [capa, fecha]);

  const irA = (p: Punto) => {
    setPunto(p);
    mapRef.current?.getView().animate({ center: fromLonLat([p.lon, p.lat]), zoom: 9, duration: 600 });
  };

  const miUbicacion = () =>
    navigator.geolocation?.getCurrentPosition((pos) =>
      irA({ lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2), nombre: "My location" }),
    );

  // El ranking usa la fecha de cuando se abrió la página (el reloj de arriba sí avanza).
  const resultado = useMemo(
    () => (clima ? rankear({ ...resp, lat: punto.lat, lon: punto.lon }, clima, hoy) : null),
    [clima, resp, punto.lat, punto.lon, hoy],
  );

  const region = punto.nombre ?? `${punto.lat.toFixed(2)}, ${punto.lon.toFixed(2)}`;
  const mes = hoy.getMonth();
  const vistaActual = VISTAS.find((v) => v.id === vista)!;

  return (
    <div className="flex h-dvh flex-col bg-[#eef1f5] text-gray-900">
      {/* ── Encabezado ───────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-white" style={{ background: COLOR.navy }}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-white text-[9px] font-black leading-tight">
            SPACE
            <br />
            APPS
          </div>
          <div className="italic">
            <p className="text-xl font-black tracking-wide sm:text-2xl">NASA INTERNATIONAL</p>
            <p className="text-sm font-bold tracking-wider">SPACE APPS CHALLENGE</p>
          </div>
        </div>
        <div className="text-right text-xs sm:text-sm">
          <p className="font-bold">{fechaBonita(ahora)}</p>
          <p>Current Region: {region}</p>
          <p className="italic opacity-80">NASA POWER · 25-year monthly averages</p>
        </div>
      </header>
      <div className="bg-black px-4 py-1.5 text-lg font-bold text-white sm:text-2xl">
        Field Shift: Adapting Farms with NASA Data
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* ── Barra lateral ─────────────────────────────────────── */}
        <nav className="flex shrink-0 flex-col gap-1 overflow-y-auto p-3 text-white md:w-56" style={{ background: COLOR.navy2 }}>
          <p className="font-bold">Region</p>
          {REGIONES.map((r) => (
            <BotonLateral key={r.nombre} activo={punto.nombre === r.nombre} onClick={() => irA({ ...r })}>
              {r.nombre}
            </BotonLateral>
          ))}

          <p className="mt-2 font-bold">Farming Mode</p>
          <BotonLateral activo={resp.tieneRiego} onClick={() => cambiar("tieneRiego", true)}>
            Irrigated
          </BotonLateral>
          <BotonLateral activo={!resp.tieneRiego} onClick={() => cambiar("tieneRiego", false)}>
            Rainfed
          </BotonLateral>

          <div className="my-2 border-t border-white/20" />
          {VISTAS.map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-left text-lg ${
                vista === v.id ? "bg-[#b3151c]" : "hover:bg-white/10"
              }`}
              aria-current={vista === v.id}
            >
              <span aria-hidden>{v.icono}</span>
              <span>
                {v.nombre}
                {v.sub && <span className="block text-xs italic opacity-80">{v.sub}</span>}
              </span>
            </button>
          ))}

          <div className="my-2 border-t border-white/20" />
          <p className="font-bold">Data Sources</p>
          {[
            ["NASA POWER", true],
            ["NASA GIBS · MODIS", true],
            ["OpenStreetMap", false],
          ].map(([n, nasa]) => (
            <p key={n as string} className="flex items-center justify-between text-sm">
              {n}
              <span className="rounded border border-white/40 px-1.5 text-[11px]">{nasa ? "NASA" : "Non-NASA"}</span>
            </p>
          ))}
          <div className="mt-2 space-y-0.5 text-sm">
            {[
              [COLOR.favorable, "Favorable"],
              [COLOR.caution, "Caution"],
              [COLOR.risk, "Risk"],
            ].map(([c, t]) => (
              <p key={t} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: c }} />
                {t}
              </p>
            ))}
          </div>

          {verAviso && vista !== "rotacion" && (
            <div className="mt-3 rounded-lg bg-white p-2 text-gray-900">
              <p className="font-bold">🌱 Planning a crop?</p>
              <div className="mt-1 flex gap-1 text-sm">
                <button onClick={() => setVista("rotacion")} className="rounded bg-green-200 px-2 py-0.5 font-semibold">
                  Choose a field
                </button>
                <button onClick={() => setVerAviso(false)} className="rounded px-2 py-0.5 hover:bg-gray-100">
                  Not now
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* ── Mapa ──────────────────────────────────────────────── */}
        <div className="relative flex-1" style={{ position: "relative", flex: 1, minHeight: "45vh" }}>
          <div ref={divRef} style={{ position: "absolute", inset: 0 }} />

          <div className="absolute left-12 right-3 top-2 flex flex-wrap gap-2">
            {(Object.keys(CAPAS_NASA) as CapaNasa[]).map((c) => (
              <button
                key={c}
                onClick={() => setCapa(c)}
                className={`rounded-full px-3 py-1 text-sm font-semibold shadow ${
                  capa === c ? "bg-[#b3151c] text-white" : "bg-white text-gray-900 hover:bg-gray-100"
                }`}
              >
                {CAPAS_NASA[c].nombre}
              </button>
            ))}
            {capa !== "ninguna" && (
              <label className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-semibold shadow">
                Image date
                <input
                  type="date"
                  value={fecha}
                  max={fechaMax}
                  min="2001-01-01"
                  onChange={(e) => e.target.value && setFecha(e.target.value)}
                  className="bg-transparent font-normal"
                />
              </label>
            )}
            <button onClick={miUbicacion} className="ml-auto rounded-full bg-white px-3 py-1 text-sm font-semibold shadow hover:bg-gray-100">
              📍 My location
            </button>
          </div>

          <div className="absolute bottom-8 left-3 rounded bg-white px-3 py-1 text-sm font-bold shadow">
            Lat: {punto.lat.toFixed(2)} · Lon: {punto.lon.toFixed(2)}
          </div>

          {capa === "ndvi" && (
            <div className="absolute bottom-8 right-3 w-56 rounded-lg bg-white px-3 py-2 text-xs shadow">
              <p className="font-bold">Vegetation health (NDVI, MODIS 8-day)</p>
              <div className="mt-1 h-2.5 rounded" style={{ background: "linear-gradient(90deg,#c9b38a,#e8e3a0,#9ccc65,#2e7d32,#0b4f1a)" }} />
              <div className="flex justify-between text-gray-600">
                <span>bare soil</span>
                <span>dense crops</span>
              </div>
              <p className="mt-1 text-gray-500">Week of {fecha}</p>
            </div>
          )}
        </div>

        {/* ── Panel derecho ─────────────────────────────────────── */}
        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto p-3 md:w-[440px]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-2xl font-bold">
              {vistaActual.nombre} — {region}
            </h2>
            <span
              className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-white"
              style={{ background: vista === "rotacion" ? COLOR.rojo : "#0b3d91" }}
            >
              {vista === "rotacion" ? "DEMO CROP DATA" : "NASA DATA"}
            </span>
          </div>

          {cargando && <p className="text-sm">Loading NASA POWER data…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {clima && vista === "suelo" && <PanelSuelo clima={clima} mes={mes} />}
          {clima && vista === "temperatura" && <PanelTemperatura clima={clima} mes={mes} />}
          {clima && vista === "agua" && (
            <PanelAgua
              clima={clima}
              mes={mes}
              riego={resp.tieneRiego ? { mm: resp.riegoMm, temporada: TEMPORADA_EN[resp.riegoEn] } : null}
            />
          )}
          {vista === "rotacion" && <PanelRotacion resp={resp} cambiar={cambiar} resultado={resultado} />}
        </aside>
      </div>

      <style>{`.campo{border:1px solid #9ca3af;border-radius:4px;padding:2px 6px;background:#fff}
        .ol-zoom{top:auto;bottom:6.5rem;left:auto;right:.75rem}`}</style>
    </div>
  );
}

const TEMPORADA_EN: Record<Respuestas["riegoEn"], string> = {
  invierno: "winter (Oct–Mar)",
  verano: "summer (Apr–Sep)",
  "todo el año": "all year",
};

function BotonLateral({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-md border-2 px-3 py-1.5 text-center font-bold ${
        activo ? "border-white bg-[#b3151c] text-white" : "border-transparent bg-white text-gray-900 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

/** "November 15th, Sunday at 1:43 A.M." */
function fechaBonita(d: Date) {
  const dia = d.getDate();
  const sufijo = dia % 10 === 1 && dia !== 11 ? "st" : dia % 10 === 2 && dia !== 12 ? "nd" : dia % 10 === 3 && dia !== 13 ? "rd" : "th";
  const mes = d.toLocaleString("en-US", { month: "long" });
  const semana = d.toLocaleString("en-US", { weekday: "long" });
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mes} ${dia}${sufijo}, ${semana} at ${h % 12 || 12}:${min} ${h < 12 ? "A.M." : "P.M."}`;
}
