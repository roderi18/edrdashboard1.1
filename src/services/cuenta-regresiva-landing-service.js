import { onSnapshot } from 'firebase/firestore';

import {
  cambiosDeCuentaRegresiva,
  normalizarCuentaRegresiva,
} from 'src/utils/cuenta-regresiva-landing.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

import { escribirCuentaRegresiva, referenciaCuentaRegresiva } from './cuenta-regresiva-landing-apply';

// ----------------------------------------------------------------------
// CUENTA ATRÁS DE LA LANDING DE REGISTRO (ver src/utils/cuenta-regresiva-landing.mjs).
//
// La cambian el Administrador Global y la Oficina Nacional: se aplica en el
// acto y queda en Historial quién movió el cierre y de qué fecha a cuál.
// ----------------------------------------------------------------------

/** Escucha la configuración en vivo: { ...valores, actualizadoPor, actualizadoEn }. */
export function escucharCuentaRegresiva(alCambiar) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    alCambiar({ ...normalizarCuentaRegresiva({}), existe: false });
    return () => {};
  }
  return onSnapshot(
    referenciaCuentaRegresiva(),
    (snap) => {
      const datos = snap.exists() ? snap.data() : {};
      alCambiar({
        ...normalizarCuentaRegresiva(datos),
        existe: snap.exists(),
        actualizadoPor: datos.actualizadoPor || null,
        actualizadoEn: datos.actualizadoEn?.toDate?.() || null,
      });
    },
    () => alCambiar({ ...normalizarCuentaRegresiva({}), existe: false })
  );
}

export async function guardarCuentaRegresiva({ valores, anterior, usuario = {} }) {
  const nueva = normalizarCuentaRegresiva(valores);
  const cambios = cambiosDeCuentaRegresiva(anterior, nueva);
  if (!cambios.length) return { estado: 'sin_cambios' };

  const quien = {
    uid: String(usuario?.uid ?? usuario?.id ?? ''),
    nombre: usuario?.displayName || usuario?.nombre || usuario?.email || '',
  };

  return proponerCambio({
    ambito: AMBITOS_CAMBIO.cuentaRegresivaLanding,
    entidad: {
      tipo: 'landing_registro',
      id: 'cuenta_regresiva',
      nombre: 'Cuenta atrás de la página de registro',
      ruta: '/dashboard/admin/actualizaciones-destacamentos',
    },
    cambios,
    usuario,
    descripcion: 'Cuenta atrás de la página de registro actualizada.',
    aplicar: () => escribirCuentaRegresiva(nueva, quien),
  });
}
