import { db } from 'src/server/firebase.mjs';
import { leerPadron } from 'src/server/padron.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [padron, snap, habilitadosSnap] = await Promise.all([
      leerPadron(),
      db().collection('membresiasOnerrd2027').get(),
      db().collection('elegibilidadMembresia2027').where('habilitado2027', '==', true).get(),
    ]);
    const totals = new Map();
    const regionOf = new Map();
    const habilitados = new Set(habilitadosSnap.docs.map((item) => item.id));
    padron.forEach((d) => {
      if (!d.region || d.estado !== 'activo' || !habilitados.has(d.id)) return;
      regionOf.set(d.id, d.region);
      if (!totals.has(d.region)) totals.set(d.region, { region: d.region, total: 0, pagadas: 0, pendientes: 0 });
      totals.get(d.region).total += 1;
    });
    snap.docs.forEach((doc) => {
      const region = regionOf.get(doc.id);
      if (!region) return;
      const row = totals.get(region);
      const estado = doc.data()?.estado;
      if (estado === 'confirmada') row.pagadas += 1;
      if (estado === 'pendiente_transferencia') row.pendientes += 1;
    });
    const rows = [...totals.values()].map((row) => ({ ...row, pendientes: row.total - row.pagadas, enValidacion: row.pendientes, porcentaje: row.total ? Math.round(row.pagadas / row.total * 1000) / 10 : 0 }));
    rows.sort((a, b) => a.region.localeCompare(b.region, 'es'));
    return Response.json(rows, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
  } catch (error) {
    console.error('[estadisticas]', error);
    return Response.json({ error: 'No se pudo calcular el avance nacional.' }, { status: 502 });
  }
}
