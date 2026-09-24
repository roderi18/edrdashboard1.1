import { conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import {
  configuracionPorCinta,
  normalizarOrdenGlobal,
  construirCintasAsignadas,
} from 'src/utils/cintas-perfil.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

import { escribirOrdenDeCintas, escribirCintasDeMiembro } from './cintas-miembros-apply';

// ----------------------------------------------------------------------
// CINTAS DEL PERFIL DE UN MIEMBRO (`cintas_miembros/{idMiembros}`).
//
// Hoy solo las pone a mano el Administrador Global, para pruebas, mientras no
// se conecta cada award con su cinta. Pasa por la puerta de cambios: se aplica
// en el acto y queda en Historial qué cintas tenía y cuáles tiene.
// ----------------------------------------------------------------------

async function guardarCintasDeMiembroDirecto({
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
  // "3 ×4 [borde: ola; número: destello]": el Historial también registra
  // cambios puramente visuales aunque la cantidad de cintas no cambie.
  const describir = (lista) =>
    [...configuracionPorCinta(lista)]
      .map(([id, configuracion]) => {
        const cantidad = configuracion.veces > 1 ? ` ×${configuracion.veces}` : '';
        // Las perillas solo si se movieron: con todas en 1 el texto queda como antes.
        const perillas = [
          ['velocidad borde', configuracion.velocidadBorde],
          ['intensidad borde', configuracion.intensidadBorde],
          ['velocidad número', configuracion.velocidadNumero],
          ['intensidad número', configuracion.intensidadNumero],
        ]
          .filter(([, valor]) => valor !== 1)
          .map(([perilla, valor]) => `; ${perilla}: ${valor}×`)
          .join('');
        return `${id}${cantidad} [borde: ${configuracion.efectoBorde}; número: ${configuracion.efectoNumero}${perillas}]`;
      })
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

// ----------------------------------------------------------------------
// EL ORDEN GLOBAL DE LAS CINTAS.
//
// Lo pone el Administrador Global arrastrando en EXPLORA Designer y cambia el
// orden en TODOS los perfiles a la vez, así que pasa por la misma puerta: se
// aplica en el acto y queda en Historial el orden de antes y el de después.
// ----------------------------------------------------------------------

async function guardarOrdenDeCintasDirecto({ orden = [], anterior = [], usuario = {} }) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado.');
  }

  const nuevo = normalizarOrdenGlobal(orden);
  const antes = normalizarOrdenGlobal(anterior).join(', ');
  const despues = nuevo.join(', ');

  if (antes === despues) return nuevo;

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.cintasMiembro,
    entidad: { tipo: 'configuracion_cintas', id: 'orden', nombre: 'Orden de las cintas' },
    cambios: [{ campo: 'orden', etiqueta: 'Orden de las cintas', antes, despues }],
    usuario,
    descripcion: `Nuevo orden global de las cintas: ${despues}.`,
    aplicar: () =>
      escribirOrdenDeCintas(
        nuevo,
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });

  return nuevo;
}

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const guardarCintasDeMiembro = conInvalidacion(guardarCintasDeMiembroDirecto, [], ['cintas:']);
export const guardarOrdenDeCintas = conInvalidacion(guardarOrdenDeCintasDirecto, [], ['cintas:']);
