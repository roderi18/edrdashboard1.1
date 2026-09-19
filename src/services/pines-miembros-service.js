import { construirPinesAsignados } from 'src/utils/pines-perfil.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

import { escribirOrdenDePines, escribirPinesDeMiembro } from './pines-miembros-apply';

// ----------------------------------------------------------------------
// PINES DEL PERFIL (`pines_miembros/{idMiembros}`) Y SU ORDEN GLOBAL.
//
// Igual que cintas y medallas: hoy solo los pone a mano el Administrador Global,
// y todo pasa por la puerta de cambios —se aplica en el acto y queda en Historial—.
// ----------------------------------------------------------------------

const quienEs = (usuario) => String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '');

const asegurarFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');
};

const describir = (lista = []) =>
  (Array.isArray(lista) ? lista : []).map((entrada) => String(entrada?.id ?? entrada)).join(', ') ||
  'Ninguno';

export async function guardarPinesDeMiembro({
  idMiembros,
  anteriores = [],
  elegidos = [],
  usuario = {},
  nombre = '',
}) {
  asegurarFirebase();

  const pines = construirPinesAsignados(anteriores, elegidos, new Date().toISOString());
  const antes = describir(anteriores);
  const despues = describir(pines);

  if (antes === despues) return pines;

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.cintasMiembro,
    entidad: { tipo: 'miembro', id: String(idMiembros), nombre },
    cambios: [{ campo: 'pines', etiqueta: 'Pines del perfil', antes, despues }],
    usuario,
    descripcion: `Pines de prueba${nombre ? ` de ${nombre}` : ''}: ${despues}.`,
    aplicar: () => escribirPinesDeMiembro(idMiembros, pines, quienEs(usuario)),
  });

  return pines;
}

export async function guardarOrdenDePines({ orden = [], anterior = [], usuario = {} }) {
  asegurarFirebase();

  const antes = anterior.join(', ');
  const despues = orden.join(', ');

  if (antes === despues) return orden;

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.cintasMiembro,
    entidad: { tipo: 'configuracion_cintas', id: 'orden-pines', nombre: 'Orden de los pines' },
    cambios: [{ campo: 'orden', etiqueta: 'Orden de los pines', antes, despues }],
    usuario,
    descripcion: `Nuevo orden global de los pines: ${despues}.`,
    aplicar: () => escribirOrdenDePines(orden, quienEs(usuario)),
  });

  return orden;
}
