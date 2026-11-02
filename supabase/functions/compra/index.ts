// PotugApp · función "compra"
// Guarda la lista de la compra y los básicos. Las tablas solo las toca esta función (clave de servicio);
// la app entra con la clave familiar en la cabecera x-familia, igual que el calendario.
//
// GET  /functions/v1/compra                 → estado completo
// POST /functions/v1/compra  {acciones:[…]} → aplica las acciones en orden y devuelve el estado completo
//
// Acciones (las manda la app; si no hay conexión las guarda y las envía después, por eso
// cada artículo de la lista lleva un id generado en el aparato y repetir una acción no duplica nada):
//   {tipo:"anadir", id, nombre, basico_id?, grupo_id?, quien?, guardar_basico?}
//   {tipo:"tachar", id, hecho, quien?}
//   {tipo:"nota", id, nota}
//   {tipo:"quitar", id}
//   {tipo:"terminar"}                          → borra lo tachado (y sus notas)
//   {tipo:"basico_nuevo", nombre, grupo_id}
//   {tipo:"basico_editar", id, nombre}
//   {tipo:"basico_borrar", id}
//   {tipo:"grupo_nuevo", nombre}

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
const limpio = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
const ahora = () => new Date().toISOString();

async function estado() {
  const [grupos, basicos, lista] = await Promise.all([
    rest("GET", "compra_grupos?select=id,nombre,orden&order=orden,id"),
    rest("GET", "compra_basicos?select=id,grupo_id,nombre,orden,veces&order=orden,nombre"),
    rest("GET", "compra_lista?select=id,nombre,basico_id,grupo_id,quien,nota,hecho,tachado_por,creado&order=creado"),
  ]);
  return { grupos, basicos, lista, ahora: ahora() };
}

async function basicoPorNombre(nombre: string, grupo_id: number) {
  const f = await rest("GET", `compra_basicos?select=id&grupo_id=eq.${grupo_id}&nombre=eq.${encodeURIComponent(nombre)}`);
  if (f.length) return f[0].id;
  const n = await rest("POST", "compra_basicos?select=id", { nombre, grupo_id, orden: 999 }, "return=representation");
  return n[0].id;
}

async function aplicar(a: Record<string, unknown>) {
  const id = limpio(a.id);
  switch (a.tipo) {
    case "anadir": {
      const nombre = limpio(a.nombre);
      if (!id || !nombre) return;
      let basico_id = a.basico_id ? Number(a.basico_id) : null;
      let grupo_id = a.grupo_id ? Number(a.grupo_id) : null;
      if (!basico_id && a.guardar_basico && grupo_id) basico_id = await basicoPorNombre(nombre, grupo_id);
      if (basico_id) {
        // Un básico solo puede estar una vez pendiente en la lista
        const ya = await rest("GET", `compra_lista?select=id&basico_id=eq.${basico_id}&hecho=eq.false&id=neq.${encodeURIComponent(id)}`);
        if (ya.length) return;
        if (!grupo_id) {
          const b = await rest("GET", `compra_basicos?select=grupo_id&id=eq.${basico_id}`);
          grupo_id = b.length ? b[0].grupo_id : null;
        }
      }
      const nuevo = await rest("POST", "compra_lista?on_conflict=id&select=id", [{ id, nombre, basico_id, grupo_id, quien: limpio(a.quien) || null, actualizado: ahora() }],
        "resolution=ignore-duplicates,return=representation");
      // Cuenta para los «habituales» (solo si de verdad se ha añadido ahora)
      if (basico_id && nuevo && nuevo.length) {
        const b = await rest("GET", `compra_basicos?select=veces&id=eq.${basico_id}`);
        if (b.length) await rest("PATCH", `compra_basicos?id=eq.${basico_id}`, { veces: (b[0].veces || 0) + 1 }, "return=minimal");
      }
      return;
    }
    case "tachar":
      await rest("PATCH", `compra_lista?id=eq.${encodeURIComponent(id)}`, { hecho: !!a.hecho, tachado_por: a.hecho ? (limpio(a.quien) || null) : null, actualizado: ahora() }, "return=minimal");
      return;
    case "nota":
      await rest("PATCH", `compra_lista?id=eq.${encodeURIComponent(id)}`, { nota: String(a.nota ?? "").trim().slice(0, 300) || null, actualizado: ahora() }, "return=minimal");
      return;
    case "quitar":
      await rest("DELETE", `compra_lista?id=eq.${encodeURIComponent(id)}`, undefined, "return=minimal");
      return;
    case "terminar":
      await rest("DELETE", "compra_lista?hecho=eq.true", undefined, "return=minimal");
      return;
    case "basico_nuevo": {
      const nombre = limpio(a.nombre), grupo_id = Number(a.grupo_id);
      if (nombre && grupo_id) await basicoPorNombre(nombre, grupo_id);
      return;
    }
    case "basico_editar": {
      const nombre = limpio(a.nombre);
      if (nombre) await rest("PATCH", `compra_basicos?id=eq.${Number(a.id)}`, { nombre }, "return=minimal");
      return;
    }
    case "basico_borrar":
      await rest("DELETE", `compra_basicos?id=eq.${Number(a.id)}`, undefined, "return=minimal");
      return;
    case "grupo_nuevo": {
      const nombre = limpio(a.nombre);
      if (!nombre) return;
      const g = await rest("GET", "compra_grupos?select=orden&order=orden.desc&limit=1");
      await rest("POST", "compra_grupos?on_conflict=nombre", [{ nombre, orden: (g.length ? g[0].orden : 0) + 1 }], "resolution=ignore-duplicates,return=minimal");
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
