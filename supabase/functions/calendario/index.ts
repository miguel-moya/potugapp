// PotugApp · función "calendario" (Supabase Edge Function, Deno)
//
// Lee los 5 calendarios de Google (direcciones privadas iCal guardadas como secretos),
// expande los eventos que se repiten, marca de quién es cada uno y devuelve los de los
// próximos días ya ordenados. La app solo los pinta.
//
// Secretos necesarios (Supabase → Edge Functions → Secrets):
//   FAMILY_KEY      clave familiar
//   CAL_LIDIA, CAL_MIGUEL, CAL_BRUNO, CAL_FAMILIA, CAL_FESTIVOS   direcciones .ics
//
// Petición:  GET /functions/v1/calendario?dias=7    cabecera  x-familia: <clave>
// Respuesta: { generado, desde, dias, eventos: [{dia, hora, fin, todoElDia, titulo, quien, festivo}], errores: [] }

import ICAL from "npm:ical.js@2.2.1";

const ZONA = "Europe/Madrid";
const FUENTES = [
  { secreto: "CAL_LIDIA", quien: "L" },
  { secreto: "CAL_MIGUEL", quien: "M" },
  { secreto: "CAL_BRUNO", quien: "B" },
  { secreto: "CAL_FAMILIA", quien: "F" },
  { secreto: "CAL_FESTIVOS", quien: null, festivo: true },
];
const CACHE_MS = 5 * 60 * 1000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-familia, content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// ---------- utilidades de fecha (siempre en hora de Madrid) ----------
const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
const fmtHora = new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });

export function diaMadrid(d) { return fmtDia.format(d); }            // "2026-11-02"
export function horaMadrid(d) { return fmtHora.format(d); }          // "10:00"
export function sumarDias(dia, n) {
  const [y, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
function diaDeICAL(t) {                                              // para fechas sin hora
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

// ---------- lectura de un calendario ----------
export function eventosDeICS(texto, fuente, desde, hasta) {
  // desde / hasta: "YYYY-MM-DD" (hasta excluido)
  const raiz = new ICAL.Component(ICAL.parse(texto));
  for (const tz of raiz.getAllSubcomponents("vtimezone")) {
    try { ICAL.TimezoneService.register(tz); } catch (_) { /* ya registrada */ }
  }

  // Agrupar por UID para enlazar las excepciones (una repetición movida o editada)
  const porUid = new Map();
  for (const ve of raiz.getAllSubcomponents("vevent")) {
    const ev = new ICAL.Event(ve);
    if (!porUid.has(ev.uid)) porUid.set(ev.uid, { base: null, excepciones: [] });
    const g = porUid.get(ev.uid);
    if (ev.isRecurrenceException()) g.excepciones.push(ev); else g.base = ev;
  }

  const limiteFin = new Date(Date.UTC(...hasta.split("-").map((v, i) => i === 1 ? Number(v) - 1 : Number(v))) + 2 * 864e5);
  const salida = [];

  function anadir(titulo, inicio, fin) {
    // inicio / fin: ICAL.Time
    if (inicio.isDate) {
      // Todo el día (puede durar varios días; el fin es exclusivo)
      let d = diaDeICAL(inicio);
      const f = fin ? diaDeICAL(fin) : sumarDias(d, 1);
      for (let i = 0; d < f && i < 60; i++, d = sumarDias(d, 1)) {
        if (d >= desde && d < hasta) salida.push({ dia: d, hora: null, fin: null, todoElDia: true, titulo, quien: fuente.quien, festivo: !!fuente.festivo });
      }
      return;
    }
    const ini = inicio.toJSDate();
    const d = diaMadrid(ini);
    if (d >= desde && d < hasta) {
      salida.push({ dia: d, hora: horaMadrid(ini), fin: fin ? horaMadrid(fin.toJSDate()) : null, todoElDia: false, titulo, quien: fuente.quien, festivo: !!fuente.festivo });
    }
  }

  for (const { base, excepciones } of porUid.values()) {
    if (!base) { for (const ex of excepciones) anadir(ex.summary || "(sin título)", ex.startDate, ex.endDate); continue; }
    for (const ex of excepciones) base.relateException(ex);

    if (!base.isRecurring()) { anadir(base.summary || "(sin título)", base.startDate, base.endDate); continue; }

    const it = base.iterator();
    let siguiente, vueltas = 0;
    while ((siguiente = it.next()) && vueltas++ < 2000) {
      if (siguiente.toJSDate() > limiteFin) break;
      const det = base.getOccurrenceDetails(siguiente);
      const st = det.item.component.getFirstPropertyValue("status");
      if (st && String(st).toUpperCase() === "CANCELLED") continue;
      anadir(det.item.summary || "(sin título)", det.startDate, det.endDate);
    }
  }
  return salida;
}

export function ordenar(eventos) {
  return eventos.sort((a, b) =>
    a.dia.localeCompare(b.dia) ||
    (a.festivo === b.festivo ? 0 : a.festivo ? -1 : 1) ||        // el festivo primero
    (a.todoElDia === b.todoElDia ? 0 : a.todoElDia ? -1 : 1) ||  // luego los de todo el día
    String(a.hora).localeCompare(String(b.hora)) ||
    a.titulo.localeCompare(b.titulo));
}

// ---------- servidor ----------
let cache = { en: 0, clave: "", datos: null };

async function construir(dias) {
  const desde = diaMadrid(new Date());
  const hasta = sumarDias(desde, dias);
  const errores = [];
  const listas = await Promise.all(FUENTES.map(async (f) => {
    const url = Deno.env.get(f.secreto);
    if (!url) { errores.push(`${f.secreto}: falta el secreto`); return []; }
    try {
      const r = await fetch(url.replace(/^webcal:/i, "https:"));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return eventosDeICS(await r.text(), f, desde, hasta);
    } catch (e) {
      errores.push(`${f.secreto}: ${e.message}`);
      return [];
    }
  }));
  return { generado: new Date().toISOString(), desde, dias, eventos: ordenar(listas.flat()), errores };
}

async function atender(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const clave = Deno.env.get("FAMILY_KEY");
  if (!clave || req.headers.get("x-familia") !== clave) {
    return new Response(JSON.stringify({ error: "clave" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const dias = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get("dias") || "7", 10) || 7, 1), 31);
  const k = `${diaMadrid(new Date())}|${dias}`;
  if (!cache.datos || cache.clave !== k || Date.now() - cache.en > CACHE_MS) {
    cache = { en: Date.now(), clave: k, datos: await construir(dias) };
  }
  return new Response(JSON.stringify(cache.datos), { headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
}

if (typeof Deno !== "undefined") Deno.serve(atender);
