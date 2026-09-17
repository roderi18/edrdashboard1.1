import { vecesPorCinta, construirCintasAsignadas } from 'src/utils/cintas-perfil.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

import { escribirCintasDeMiembro } from './cintas-miembros-apply';

// ----------------------------------------------------------------------
// CINTAS DEL PERFIL DE UN MIEMBRO (`cintas_miembros/{idMiembros}`).
//
// Hoy solo las pone a mano el Administrador Global, para pruebas, mientras no
// se conecta cada award con su cinta. Pasa por la puerta de cambios: se aplica
// en el acto y queda en Historial qué cintas tenía y cuáles tiene.
// ----------------------------------------------------------------------

export async function guardarCintasDeMiembro({
  idMiembros,
  anteriores = [],
  elegidas = [],
  usuario = {},
  nombre = '',
}) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado.');
  }

  const cintas = construirCintasAsignadas(anteriores, elegidas, new Date().toISOString());
  // "3, 27 ×4": en Historial también se ve cuántas veces.
  const describir = (lista) =>
    [...vecesPorCinta(lista)]
      .map(([id, veces]) => (veces > 1 ? `${id} ×${veces}` : id))
      .join(', ') || 'Ninguna';
  const antes = describir(anteriores);
  const despues = describir(cintas);

  if (antes === despues) return cintas;

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.cintasMiembro,
    entidad: { tipo: 'miembro', id: String(idMiembros), nombre },
    cambios: [{ campo: 'cintas', etiqueta: 'Cintas del perfil', antes, despues }],
    usuario,
    descripcion: `Cintas de prueba${nombre ? ` de ${nombre}` : ''}: ${despues}.`,
    aplicar: () =>
      escribirCintasDeMiembro(
        idMiembros,
        cintas,
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });

  return cintas;
}
