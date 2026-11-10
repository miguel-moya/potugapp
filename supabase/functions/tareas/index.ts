// PotugApp · función "tareas"
// Tareas de casa: catálogo (frecuencia, puntos, formas de hacerlas) y registro de quién hizo qué.
// Las tablas solo las toca esta función (clave de servicio); la app entra con la clave familiar
// en la cabecera x-familia, igual que la compra y comer fuera.
//
// GET  /functions/v1/tareas                 → estado (tareas y lo hecho en los últimos 400 días)
// POST /functions/v1/tareas  {acciones:[…]} → aplica las acciones en orden y devuelve el estado
//
// Acciones (si no hay conexión la app las guarda y las envía después; repetir una no duplica nada):
//   {tipo:"tarea", id, nombre, puntos, veces, periodo:"s"|"m"|"a", formas:[{n,p}], pausada}  → crea o corrige
//   {tipo:"borrar_tarea", id}
//   {tipo:"hecha", id, tarea, quien:"L"|"M", forma?, dia:"2026-11-12"}  → los puntos (y el rescate) los calcula la función
//   {tipo:"deshacer", id}                     → quita un registro
//   {tipo:"posponer", id, hasta:"2026-11-13"} → la tarea no sale como pendiente hasta ese día

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-familia, content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

async function rest(metodo: string, ruta: string, cuerpo?: unknown, prefer?: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${ruta}`, {
    method: metodo,
    headers: prefer ? { ...H, Prefer: prefer } : H,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta.split("?")[0]}: ${r.status} ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}
async function todo(ruta: string) {
  const out: Record<string, unknown>[] = [];
  for (let desde = 0; ; desde += 1000) {
    const t = await rest("GET", `${ruta}&limit=1000&offset=${desde}`);
    out.push(...t);
    if (t.length < 1000) return out;
  }
}
const limpio = (s: unknown, n = 60) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const ahora = () => new Date().toISOString();
const esDia = (s: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const DIAS_PERIODO: Record<string, number> = { s: 7, m: 30.44, a: 365.25 };
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
const PUNTOS = [50, 100, 150, 200];
const puntosOk = (p: unknown) => PUNTOS.indexOf(Number(p)) >= 0 ? Number(p) : null;

async function estado() {
  const desde = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
  const [tareas, hechas] = await Promise.all([
    rest("GET", "tareas?select=id,nombre,puntos,veces,periodo,formas,pausada,pospuesta,orden,creado&borrada=eq.false&order=orden,creado"),
    todo(`tareas_hechas?select=id,tarea_id,nombre,dia,quien,puntos,forma,rescate,creado&dia=gte.${desde}&order=dia,creado`),
  ]);
  return { tareas, hechas, ahora: ahora() };
}

async function aplicar(a: Record<string, unknown>) {
  const id = limpio(a.id, 40);
  if (!id) throw new Error("sin id");
  switch (a.tipo) {
    case "tarea": {
      const nombre = limpio(a.nombre, 60);
      const periodo = ["s", "m", "a"].indexOf(String(a.periodo)) >= 0 ? String(a.periodo) : "s";
      const veces = Math.max(1, Math.min(31, Math.round(Number(a.veces) || 1)));
      const formas = (Array.isArray(a.formas) ? a.formas : []).slice(0, 6)
        .map((f: Record<string, unknown>) => ({ n: limpio(f && f.n, 30), p: puntosOk(f && f.p) }))
        .filter((f: { n: string; p: number | null }) => f.n && f.p);
      const puntos = formas.length ? null : puntosOk(a.puntos);
      if (!nombre || (!formas.length && !puntos)) throw new Error("tarea incompleta");
      const datos = { nombre, puntos, veces, periodo, formas, pausada: !!a.pausada, actualizado: ahora() };
      const cambiado = await rest("PATCH", `tareas?id=eq.${encodeURIComponent(id)}&select=id`, datos, "return=representation");
      if (!cambiado.length) {
        const ult = await rest("GET", "tareas?select=orden&order=orden.desc&limit=1");
        await rest("POST", "tareas?on_conflict=id", [{ id, ...datos, orden: (ult.length ? ult[0].orden : 0) + 1 }], "resolution=ignore-duplicates,return=minimal");
      }
      return;
    }
    case "borrar_tarea":
      await rest("PATCH", `tareas?id=eq.${encodeURIComponent(id)}`, { borrada: true, actualizado: ahora() }, "return=minimal");
      return;
    case "posponer":
      if (!esDia(a.hasta)) throw new Error("fecha incorrecta");
      await rest("PATCH", `tareas?id=eq.${encodeURIComponent(id)}`, { pospuesta: a.hasta, actualizado: ahora() }, "return=minimal");
      return;
    case "deshacer":
      await rest("DELETE", `tareas_hechas?id=eq.${encodeURIComponent(id)}`, undefined, "return=minimal");
      return;
    case "hecha": {
      const ya = await rest("GET", `tareas_hechas?select=id&id=eq.${encodeURIComponent(id)}`);
      if (ya.length) return;
      const tid = limpio(a.tarea, 40), dia = String(a.dia || ""), quien = String(a.quien || "");
      if (!esDia(dia) || ["L", "M"].indexOf(quien) < 0) throw new Error("registro incompleto");
      const t = (await rest("GET", `tareas?select=id,nombre,puntos,veces,periodo,formas,pospuesta&id=eq.${encodeURIComponent(tid)}`))[0];
      if (!t) throw new Error("tarea desconocida");
      const formas = Array.isArray(t.formas) ? t.formas : [];
      let forma: { n: string; p: number } | null = null;
      if (formas.length) forma = formas.find((f: { n: string }) => f.n === a.forma) || formas[0];
      const base = forma ? Number(forma.p) : Number(t.puntos) || 0;
      // Rescate: la última vez fue hace más de 1,3 intervalos (y no estaba pospuesta)
      const ult = await rest("GET", `tareas_hechas?select=dia&tarea_id=eq.${encodeURIComponent(tid)}&dia=lte.${dia}&order=dia.desc&limit=1`);
      const intervalo = DIAS_PERIODO[t.periodo] / Math.max(1, t.veces);
      const rescate = ult.length > 0 && diasEntre(ult[0].dia, dia) / intervalo > 1.3 && !(t.pospuesta && t.pospuesta > dia);
      await rest("POST", "tareas_hechas?on_conflict=id", [{
        id, tarea_id: tid, nombre: t.nombre, dia, quien, forma: forma ? forma.n : null, rescate,
        puntos: Math.round(base * (rescate ? 1.5 : 1)),
      }], "resolution=ignore-duplicates,return=minimal");
      if (t.pospuesta) await rest("PATCH", `tareas?id=eq.${encodeURIComponent(tid)}`, { pospuesta: null }, "return=minimal");
      return;
    }
  }
}

async function atender(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
  const clave = Deno.env.get("FAMILY_KEY");
  if (!clave || req.headers.get("x-familia") !== clave) return json({ error: "clave" }, 401);
  try {
    const errores: string[] = [];
    if (req.method === "POST") {
      const cuerpo = await req.json().catch(() => ({}));
      const acciones = Array.isArray(cuerpo.acciones) ? cuerpo.acciones.slice(0, 200) : [];
      // Una acción que falla no bloquea las demás (si no, una mala dejaría la cola del aparato atascada)
      for (const a of acciones) { try { await aplicar(a); } catch (e) { errores.push(`${a && a.tipo}: ${(e as Error).message}`); } }
    }
    return json({ ...(await estado()), errores });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}

if (typeof Deno !== "undefined" && Deno.serve) Deno.serve(atender);
