// PotugApp · función "comer"
// Gastos de comer fuera (restaurante y delivery), tope de cada mes y saldados entre Lidia y Miguel.
// Las tablas solo las toca esta función (clave de servicio); la app entra con la clave familiar
// en la cabecera x-familia, igual que el calendario y la compra.
//
// GET  /functions/v1/comer                 → estado completo (todos los gastos, topes y saldados)
// POST /functions/v1/comer  {acciones:[…]} → aplica las acciones en orden y devuelve el estado completo
//
// Acciones (si no hay conexión la app las guarda y las envía después; repetir una no duplica nada):
//   {tipo:"gasto", id, fecha:"2026-11-16", importe, sitio, clase:"r"|"d", paga:"L"|"M"|"F", quien?}  → crea o corrige
//   {tipo:"borrar", id}
//   {tipo:"tope", mes:"2026-11", tope}
//   {tipo:"saldar", id, quien?}   → guarda el saldo de ese momento (lo calcula la función) y lo deja a 0

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
// Supabase devuelve como mucho 1000 filas por consulta: se piden por tandas
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
const euros = (v: unknown) => Math.round(Number(String(v ?? "").replace(",", ".")) * 100) / 100;

async function estado() {
  const [gastos, topes, saldados] = await Promise.all([
    todo("comer_gastos?select=id,fecha,importe,sitio,tipo,paga,apuntado_por,creado&order=fecha.desc,creado.desc"),
    rest("GET", "comer_topes?select=mes,tope&order=mes"),
    todo("comer_saldados?select=id,fecha,importe,quien&order=fecha"),
  ]);
  for (const g of gastos) g.importe = Number(g.importe);
  for (const t of topes) t.tope = Number(t.tope);
  for (const s of saldados) s.importe = Number(s.importe);
  return { gastos, topes, saldados, ahora: ahora() };
}

// Saldo actual: la mitad de lo que ha pagado cada uno de su bolsillo, menos lo ya saldado
async function saldoActual() {
  const [g, s] = await Promise.all([
    todo("comer_gastos?select=importe,paga&paga=in.(L,M)&order=id"),
    todo("comer_saldados?select=importe&order=id"),
  ]);
  let v = 0;
  for (const x of g) v += (x.paga === "L" ? 1 : -1) * Number(x.importe) / 2;
  for (const x of s) v -= Number(x.importe);
  return Math.round(v * 100) / 100;
}

async function aplicar(a: Record<string, unknown>) {
  const id = limpio(a.id, 40);
  switch (a.tipo) {
    case "gasto": {
      const fecha = String(a.fecha || "");
      const importe = euros(a.importe), sitio = limpio(a.sitio);
      const tipo = a.clase === "d" ? "d" : "r", paga = ["L", "M", "F"].indexOf(String(a.paga)) >= 0 ? String(a.paga) : null;
      if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !(importe > 0 && importe < 10000) || !sitio || !paga) throw new Error("gasto incompleto");
      const datos = { fecha, importe, sitio, tipo, paga, actualizado: ahora() };
      const cambiado = await rest("PATCH", `comer_gastos?id=eq.${encodeURIComponent(id)}&select=id`, datos, "return=representation");
      if (!cambiado.length) await rest("POST", "comer_gastos?on_conflict=id", [{ id, ...datos, apuntado_por: limpio(a.quien, 10) || null }], "resolution=ignore-duplicates,return=minimal");
      return;
    }
    case "borrar":
      await rest("DELETE", `comer_gastos?id=eq.${encodeURIComponent(id)}`, undefined, "return=minimal");
      return;
    case "tope": {
      const mes = String(a.mes || ""), tope = euros(a.tope);
      if (!/^\d{4}-\d{2}$/.test(mes) || !(tope > 0 && tope < 100000)) throw new Error("tope incorrecto");
      await rest("POST", "comer_topes?on_conflict=mes", [{ mes, tope }], "resolution=merge-duplicates,return=minimal");
      return;
    }
    case "saldar": {
      if (!id) return;
      const ya = await rest("GET", `comer_saldados?select=id&id=eq.${encodeURIComponent(id)}`);
      if (ya.length) return;
      const v = await saldoActual();
      if (Math.abs(v) < 0.01) return;
      await rest("POST", "comer_saldados?on_conflict=id", [{ id, importe: v, quien: limpio(a.quien, 10) || null }], "resolution=ignore-duplicates,return=minimal");
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
