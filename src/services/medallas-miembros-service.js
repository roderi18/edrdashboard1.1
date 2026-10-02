import { conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import { configuracionDeMedallas, construirMedallasAsignadas } from 'src/utils/medallas-perfil.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

import { escribirOrdenDeMedallas, escribirMedallasDeMiembro } from './medallas-miembros-apply';

// ----------------------------------------------------------------------
// MEDALLAS DEL PERFIL (`medallas_miembros/{idMiembros}`) Y SU ORDEN GLOBAL.
//
// Igual que las cintas: hoy solo las pone a mano el Administrador Global, y todo
// pasa por la puerta de cambios —se aplica en el acto y queda en Historial—.
// ----------------------------------------------------------------------

const quienEs = (usuario) => String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '');

const asegurarFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');
};

async function guardarMedallasDeMiembroDirecto({
  idMiembros,
  anteriores = [],
  elegidas = [],
  usuario = {},
  nombre = '',
}) {
  asegurarFirebase();

  const medallas = construirMedallasAsignadas(anteriores, elegidas, new Date().toISOString());
  // "1-medalla-al-valor [movimiento: soplo 1x/1x; brillo: destello 1x/1x]"
  // (velocidad/fuerza o intensidad): el Historial registra también un cambio
  // solo de efectos o de sus perillas.
  const describir = (lista) =>
    [...configuracionDeMedallas(lista)]
      .map(
        ([id, efectos]) =>
          `${id} [movimiento: ${efectos.efectoMovimiento} ${efectos.velocidadMovimiento}x/${efectos.amplitudMovimiento}x; brillo: ${efectos.efectoBrillo} ${efectos.velocidadBrillo}x/${efectos.intensidadBrillo}x]`
      )
      .join(', ') || 'Ninguna';
  const antes = describir(anteriores);
  const despues = describir(medallas);

  if (antes === despues) return medallas;

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.cintasMiembro,
    entidad: { tipo: 'miembro', id: String(idMiembros), nombre },
    cambios: [{ campo: 'medallas', etiqueta: 'Medallas del perfil', antes, despues }],
    usuario,
    descripcion: `Medallas de prueba${nombre ? ` de ${nombre}` : ''}: ${despues}.`,
    aplicar: () => escribirMedallasDeMiembro(idMiembros, medallas, quienEs(usuario)),
  });

  return medallas;
}

async function guardarOrdenDeMedallasDirecto({ orden = [], anterior = [], usuario = {} }) {
  asegurarFirebase();

  const antes = anterior.join(', ');
  const despues = orden.join(', ');

  if (antes === despues) return orden;

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.cintasMiembro,
    entidad: {
      tipo: 'configuracion_cintas',
      id: 'orden-medallas',
      nombre: 'Orden de las medallas',
    },
    cambios: [{ campo: 'orden', etiqueta: 'Orden de las medallas', antes, despues }],
    usuario,
    descripcion: `Nuevo orden global de las medallas: ${despues}.`,
    aplicar: () => escribirOrdenDeMedallas(orden, quienEs(usuario)),
  });

  return orden;
}

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const guardarMedallasDeMiembro = conInvalidacion(guardarMedallasDeMiembroDirecto, [], ['medallas:']);
export const guardarOrdenDeMedallas = conInvalidacion(guardarOrdenDeMedallasDirecto, [], ['medallas:']);
