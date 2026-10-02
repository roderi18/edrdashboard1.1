import { isAdminGlobal } from 'src/utils/org-level-access';
import { PESTANAS_DESIGNER, documentoDeAccesos } from 'src/utils/accesos-designer.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { escribirAccesosDesigner } from './accesos-designer-apply';
import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';

// ----------------------------------------------------------------------
// GUARDAR LOS ACCESOS DE EXPEDITION DESIGNER (pestaña "Accesos"). Solo el
// Administrador Global: es quien da los permisos. Pasa por `proponerCambio`, así
// que se aplica al momento y en Historial queda quién dio qué a quién.
// ----------------------------------------------------------------------

const NOMBRE_DE_PESTANA = Object.fromEntries(PESTANAS_DESIGNER.map((p) => [p.id, p.nombre]));

const resumen = (regla) =>
  regla
    ? `${regla.nombre}: ${regla.pestanas.map((id) => NOMBRE_DE_PESTANA[id]).join(', ')}${
        regla.acciones.length ? ` (${regla.acciones.join(', ')})` : ' (solo ver)'
      }`
    : null;

export async function guardarAccesosDesigner({ reglas, anteriores = [], usuario }) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');

  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global da accesos a EXPEDITION Designer.');
  }

  const documento = documentoDeAccesos(reglas);
  const antesPorId = new Map(anteriores.map((regla) => [regla.id, regla]));
  const despuesPorId = new Map(documento.reglas.map((regla) => [regla.id, regla]));
  const ids = [...new Set([...antesPorId.keys(), ...despuesPorId.keys()])];
  const cambios = ids
    .map((id) => ({
      campo: id,
      etiqueta: (despuesPorId.get(id) || antesPorId.get(id)).nombre,
      antes: resumen(antesPorId.get(id)),
      despues: resumen(despuesPorId.get(id)),
    }))
    .filter((cambio) => cambio.antes !== cambio.despues);

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      tipo: 'accesos_designer',
      id: 'accesos',
      nombre: 'Accesos de EXPEDITION Designer',
      ruta: '/dashboard/explora-designer?seccion=accesos',
    },
    cambios: cambios.length
      ? cambios
      : [{ campo: 'reglas', etiqueta: 'Accesos', antes: null, despues: 'Sin cambios' }],
    usuario,
    descripcion: `Accesos de EXPEDITION Designer actualizados (${documento.reglas.length} ${
      documento.reglas.length === 1 ? 'regla' : 'reglas'
    }).`,
    aplicarDirecto: true,
    aplicar: () =>
      escribirAccesosDesigner(
        documento,
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });

  return documento;
}
