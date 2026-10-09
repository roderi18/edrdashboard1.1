import { db } from 'src/server/firebase.mjs';
import { leerPadron } from 'src/server/padron.mjs';

export const dynamic = 'force-dynamic';

const API = process.env.API_NET_URL || 'https://systexploradores.somee.com/api';

async function leerLogosRegionales() {
  const [regionesResponse, fotosSnap] = await Promise.all([
    fetch(`${API}/Regiones/GetAllRegiones`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    }),
    db().collection('fotos').where('tipoEntidad', '==', 'region').get(),
  ]);
  if (!regionesResponse.ok) throw new Error(`Regiones: ${regionesResponse.status}`);

  const respuesta = await regionesResponse.json();
  const regiones = respuesta?.data ?? respuesta?.Data ?? respuesta;
  const nombres = new Map(
    (Array.isArray(regiones) ? regiones : []).map((region) => [
      String(region.idRegion),
      region.nombre,
    ])
  );
  const logos = new Map();
  fotosSnap.docs.forEach((doc) => {
    const foto = doc.data();
    if (foto.tipoFoto !== 'perfil' || foto.estado !== 'activo') return;
    const nombre = nombres.get(String(foto.idEntidad));
    const url = foto.urlFotoMiniatura || foto.urlFoto;
    if (nombre && typeof url === 'string' && /^https:\/\//i.test(url)) logos.set(nombre, url);
  });
  return logos;
}

export async function GET(request) {
  try {
    if (new URL(request.url).searchParams.get('imagenes') === '1') {
      const logos = await leerLogosRegionales();
      const imagenes = await Promise.all(
        [...logos].map(async ([region, url]) => {
          const respuesta = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (!respuesta.ok) throw new Error(`Emblema de ${region}: ${respuesta.status}`);
          const tipo = respuesta.headers.get('content-type')?.split(';')[0];
          if (!tipo?.startsWith('image/'))
            throw new Error(`Formato de emblema no válido: ${region}`);
          const datos = Buffer.from(await respuesta.arrayBuffer());
          if (datos.length > 1_000_000) throw new Error(`Emblema demasiado grande: ${region}`);
          return [url, `data:${tipo};base64,${datos.toString('base64')}`];
        })
      );
      return Response.json(Object.fromEntries(imagenes), {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }
    const [padron, snap, habilitadosSnap, logos] = await Promise.all([
      leerPadron(),
      db().collection('membresiasOnerrd2027').get(),
      db().collection('elegibilidadMembresia2027').where('habilitado2027', '==', false).get(),
      leerLogosRegionales().catch((error) => {
        console.warn('[estadisticas] Logos regionales no disponibles:', error.message);
        return new Map();
      }),
    ]);
    const totals = new Map();
    const regionOf = new Map();
    const destacamentoOf = new Map();
    // Cuentan todos los activos y, como un inactivo también paga, los inactivos
    // que ya tienen su membresía en trámite. Fuera, solo los excluidos a mano.
    // (Antes contaba solo los marcados "habilitado" a mano: sin marcas, nada.)
    const excluidos = new Set(habilitadosSnap.docs.map((item) => item.id));
    const conMembresia = new Set(snap.docs.map((item) => item.id));
    padron.forEach((d) => {
      if (!d.region || excluidos.has(d.id)) return;
      if (d.estado !== 'activo' && !conMembresia.has(d.id)) return;
      regionOf.set(d.id, d.region);
      destacamentoOf.set(d.id, d);
      if (!totals.has(d.region))
        totals.set(d.region, {
          region: d.region,
          total: 0,
          pagadas: 0,
          pendientes: 0,
          destacamentos: [],
        });
      totals.get(d.region).total += 1;
    });
    snap.docs.forEach((doc) => {
      const region = regionOf.get(doc.id);
      if (!region) return;
      const row = totals.get(region);
      const datos = doc.data();
      const estado = datos?.estado;
      if (estado === 'confirmada') {
        row.pagadas += 1;
        const destacamento = destacamentoOf.get(doc.id);
        const fecha = datos.confirmadoEn?.toDate?.() || datos.creadoEn?.toDate?.();
        const partesFecha = fecha
          ? new Intl.DateTimeFormat('en-US', {
              year: 'numeric',
              month: '2-digit',
              timeZone: 'America/Santo_Domingo',
            }).formatToParts(fecha)
          : [];
        const periodo = partesFecha.length
          ? `${partesFecha.find((parte) => parte.type === 'year')?.value}-${partesFecha.find((parte) => parte.type === 'month')?.value}`
          : '';
        if (destacamento?.numero) {
          row.destacamentos.push({
            numero: destacamento.numero,
            mes: fecha
              ? new Intl.DateTimeFormat('es-DO', {
                  month: 'long',
                  timeZone: 'America/Santo_Domingo',
                }).format(fecha)
              : '',
            periodo,
            nuevo: destacamento.registradoOfnc === false,
            orden: fecha?.getTime() || 0,
          });
        }
      }
      if (estado === 'pendiente_transferencia' || estado === 'pendiente_revision')
        row.pendientes += 1;
    });
    const rows = [...totals.values()].map((row) => ({
      ...row,
      destacamentos: row.destacamentos
        .sort((a, b) => a.orden - b.orden || Number(a.numero) - Number(b.numero))
        .map(({ numero, mes, periodo, nuevo }) => ({ numero, mes, periodo, nuevo })),
      pendientes: row.total - row.pagadas,
      enValidacion: row.pendientes,
      porcentaje: row.total ? Math.round((row.pagadas / row.total) * 1000) / 10 : 0,
      logoUrl: logos.get(row.region) || null,
    }));
    rows.sort((a, b) => a.region.localeCompare(b.region, 'es'));
    return Response.json(rows, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    });
  } catch (error) {
    console.error('[estadisticas]', error);
    return Response.json({ error: 'No se pudo calcular el avance nacional.' }, { status: 502 });
  }
}
