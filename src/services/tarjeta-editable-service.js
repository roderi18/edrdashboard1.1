import { doc, getDoc } from 'firebase/firestore';

import { puedeEnDesigner } from 'src/utils/org-level-access';
import { sanearTarjeta, COLECCION_TARJETAS_DESARROLLO } from 'src/utils/tarjeta-editable.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { escribirTarjetaEditable } from './tarjeta-editable-apply';
import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';

// ----------------------------------------------------------------------
// TARJETA EDITABLE (Desarrollo · pantalla). Solo el Administrador Global; el
// guardado pasa por `proponerCambio` para que quede en Historial, igual que lo
// demás del Designer.
// ----------------------------------------------------------------------

export async function leerTarjetaEditable(id) {
  if (!isFirebaseConfigured || !FIRESTORE) return null;
  const snap = await getDoc(doc(FIRESTORE, COLECCION_TARJETAS_DESARROLLO, id));
  return snap.exists() ? sanearTarjeta(snap.data()) : null;
}

export async function guardarTarjetaEditable({ id, tarjeta, usuario }) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');
  if (!puedeEnDesigner(usuario, 'tarjeta', 'editar')) {
    throw new Error('No tienes permiso para cambiar la Tarjeta (EXPLORA Designer → Accesos).');
  }

  const limpia = sanearTarjeta(tarjeta);

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      tipo: 'tarjeta_desarrollo',
      id,
      nombre: limpia.titulo || 'Tarjeta editable',
      ruta: '/dashboard/explora-designer?seccion=tarjeta',
    },
    cambios: [{ campo: 'tarjeta', etiqueta: 'Tarjeta', antes: null, despues: limpia.titulo }],
    usuario,
    descripcion: `Tarjeta editable guardada: ${limpia.titulo}.`,
    aplicarDirecto: true,
    aplicar: () =>
      escribirTarjetaEditable(
        id,
        limpia,
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });

  return limpia;
}
