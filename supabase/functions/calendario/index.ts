// PotugApp · función "calendario" (Supabase Edge Function, Deno)
//
// Lee los 5 calendarios de Google, marca de quién es cada evento y devuelve los de los
// próximos días ya ordenados. La app solo los pinta.
//
// Dos formas de leer cada calendario (según lo que haya en su secreto CAL_*):
//   · ID de calendario (p. ej. nombre@gmail.com)  → API oficial de Google Calendar con una
//     cuenta de servicio (secreto GOOGLE_SA = el JSON de la clave). Recomendado: Google
//     limita (HTTP 429) las descargas .ics desde servidores en la nube.
//   · Dirección .ics (https://… o webcal://…)      → descarga y lectura del iCal.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   FAMILY_KEY, GOOGLE_SA, CAL_LIDIA, CAL_MIGUEL, CAL_BRUNO, CAL_FAMILIA, CAL_FESTIVOS
//
// Petición:  GET /functions/v1/calendario    cabecera  x-familia: <clave>
// Respuesta: { generado, hoy, desde, hasta, eventos: [{dia, hora, fin, todoElDia, titulo, quien, festivo}], errores: [] }
//   Ventana: desde 7 días antes del día 1 del mes actual hasta hoy + 92 días ("3 meses vista"; hasta excluido).

import ICAL from "npm:ical.js@2.2.1";

const ZONA = "Europe/Madrid";
const FUENTES = [
  { secreto: "CAL_LIDIA", quien: "L" },
  { secreto: "CAL_MIGUEL", quien: "M" },
  { secreto: "CAL_BRUNO", quien: "B" },
  { secreto: "CAL_FAMILIA", quien: "F" },
  { secreto: "CAL_FESTIVOS", quien: null, festivo: true },
];
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

// ---------- lectura por la API oficial de Google Calendar ----------
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlTxt = (txt) => b64url(new TextEncoder().encode(txt));
let tokenGoogle = { valor: "", caduca: 0 };

export async function tokenCuentaServicio(sa, pedir = fetch) {
  if (tokenGoogle.valor && Date.now() < tokenGoogle.caduca) return tokenGoogle.valor;
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64urlTxt(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64urlTxt(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token", iat: ahora, exp: ahora + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const clave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", clave, new TextEncoder().encode(`${cab}.${cuerpo}`));
  const r = await pedir("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${cab}.${cuerpo}.${b64url(firma)}`,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`token ${r.status} ${j.error || ""}`);
  tokenGoogle = { valor: j.access_token, caduca: Date.now() + (j.expires_in - 120) * 1000 };
  return tokenGoogle.valor;
}

export async function eventosDeAPI(idCal, fuente, desde, hasta, token, pedir = fetch) {
  const salida = [];
  let pagina = "";
  for (let vueltas = 0; vueltas < 10; vueltas++) {
    const q = new URLSearchParams({
      singleEvents: "true", orderBy: "startTime", maxResults: "2500", timeZone: ZONA,
      timeMin: new Date(`${sumarDias(desde, -1)}T00:00:00Z`).toISOString(),
      timeMax: new Date(`${sumarDias(hasta, 1)}T00:00:00Z`).toISOString(),
    });
    if (pagina) q.set("pageToken", pagina);
    const r = await pedir(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(idCal)}/events?${q}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`API ${r.status}${r.status === 404 ? " (¿calendario compartido con la cuenta de servicio?)" : ""}`);
    const j = await r.json();
    for (const it of j.items || []) {
      if (it.status === "cancelled") continue;
      const titulo = it.summary || "(sin título)";
      if (it.start && it.start.date) {
        const fin = it.end && it.end.date ? it.end.date : sumarDias(it.start.date, 1);
        for (let d = it.start.date, i = 0; d < fin && i < 60; i++, d = sumarDias(d, 1)) {
          if (d >= desde && d < hasta) salida.push({ dia: d, hora: null, fin: null, todoElDia: true, titulo, quien: fuente.quien, festivo: !!fuente.festivo });
        }
      } else if (it.start && it.start.dateTime) {
        const ini = new Date(it.start.dateTime), d = diaMadrid(ini);
        if (d >= desde && d < hasta) salida.push({ dia: d, hora: horaMadrid(ini), fin: it.end && it.end.dateTime ? horaMadrid(new Date(it.end.dateTime)) : null, todoElDia: false, titulo, quien: fuente.quien, festivo: !!fuente.festivo });
      }
    }
    if (!j.nextPageToken) break;
    pagina = j.nextPageToken;
  }
  return salida;
}

// ---------- servidor ----------
// Google limita (HTTP 429) las descargas desde servidores en la nube. Para no depender de cada
// descarga, guardamos lo último que funcionó de cada calendario en la tabla `calendario_cache`
// y solo volvemos a pedirlo a Google cada REFRESCO_MS. Si Google falla, se usa lo guardado.
const REFRESCO_MS = 15 * 60 * 1000;
const VENTANA_DIAS = 92;                              // 3 meses vista
export function ventana(hoy) {
  // desde: 7 días antes del día 1 del mes (cubre la semana en curso y todo el mes del calendario pequeño)
  return { desde: sumarDias(hoy.slice(0, 8) + "01", -7), hasta: sumarDias(hoy, VENTANA_DIAS) };
}
const SB_URL = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : "";
const SB_KEY = typeof Deno !== "undefined" ? (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "") : "";
const SB_HEAD = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

async function leerCache() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/calendario_cache?select=fuente,eventos,actualizado`, { headers: SB_HEAD });
    if (!r.ok) return {};
    const filas = await r.json(), m = {};
    for (const f of filas) {
      const e = f.eventos;
      m[f.fuente] = Array.isArray(e) ? { ...f, ventana: null } : { ...f, eventos: (e && e.lista) || [], ventana: e && e.ventana };
    }
    return m;
  } catch (_) { return {}; }
}
async function guardarCache(fuente, eventos, ventana) {
  try {
    await fetch(`${SB_URL}/rest/v1/calendario_cache?on_conflict=fuente`, {
      method: "POST",
      headers: { ...SB_HEAD, Prefer: "resolution=merge-duplicates,return=minimal" },
      // la ventana se guarda dentro de "eventos" para no tener que cambiar la tabla
      body: JSON.stringify({ fuente, eventos: { ventana, lista: eventos }, actualizado: new Date().toISOString() }),
    });
  } catch (_) { /* si no se puede guardar, seguimos */ }
}
async function descargar(url) {
  const pedir = () => fetch(url.replace(/^webcal:/i, "https:"), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PotugApp/1.0; +https://miguel-moya.github.io/potugapp/)", Accept: "text/calendar, */*" },
  });
  let r = await pedir();
  if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 1500)); r = await pedir(); }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

let cacheMem = { en: 0, datos: null };

async function construir() {
  const hoy = diaMadrid(new Date());
  const { desde: desdeVentana, hasta: hastaVentana } = ventana(hoy);
  const guardado = await leerCache();
  const errores = [];

  const listas = await Promise.all(FUENTES.map(async (f) => {
    const previo = guardado[f.secreto];
    const cubre = previo && Array.isArray(previo.eventos) && previo.ventana === `${desdeVentana}/${hastaVentana}`;
    const fresco = cubre && Date.now() - new Date(previo.actualizado).getTime() < REFRESCO_MS;
    if (fresco) return previo.eventos;
    const url = Deno.env.get(f.secreto);
    if (!url) { errores.push(`${f.secreto}: falta el secreto`); return previo ? previo.eventos : []; }
    try {
      let evs;
      if (/^(https?|webcal):/i.test(url.trim())) {
        evs = eventosDeICS(await descargar(url.trim()), f, desdeVentana, hastaVentana);
      } else {
        const sa = Deno.env.get("GOOGLE_SA");
        if (!sa) throw new Error("falta GOOGLE_SA");
        evs = await eventosDeAPI(url.trim(), f, desdeVentana, hastaVentana, await tokenCuentaServicio(JSON.parse(sa)));
      }
      await guardarCache(f.secreto, evs, `${desdeVentana}/${hastaVentana}`);
      return evs;
    } catch (e) {
      if (previo) return previo.eventos;               // Google falla: usamos lo último bueno, sin avisar
      errores.push(`${f.secreto}: ${e.message}`);
      return [];
    }
  }));

  const eventos = listas.flat().filter((e) => e.dia >= desdeVentana && e.dia < hastaVentana);
  return { generado: new Date().toISOString(), hoy, desde: desdeVentana, hasta: hastaVentana, eventos: ordenar(eventos), errores };
}

async function atender(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const clave = Deno.env.get("FAMILY_KEY");
  if (!clave || req.headers.get("x-familia") !== clave) {
    return new Response(JSON.stringify({ error: "clave" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  if (!cacheMem.datos || cacheMem.datos.hoy !== diaMadrid(new Date()) || Date.now() - cacheMem.en > 60 * 1000) {
    cacheMem = { en: Date.now(), datos: await construir() };
  }
  return new Response(JSON.stringify(cacheMem.datos), { headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
}

if (typeof Deno !== "undefined") Deno.serve(atender);
