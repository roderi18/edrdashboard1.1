import { useMemo, useSyncExternalStore } from 'react';

import { useSearchParams } from 'src/routes/hooks';

import { escucharAvataresDeBuzones } from 'src/services/chat-buzones-service';

import { useAuthContext } from 'src/auth/hooks';

import { bandejaAbierta, buzonesQueAtiende } from '../utils/buzones-del-chat';

// ----------------------------------------------------------------------
// LOS BUZONES COMPARTIDOS, DESDE LA PANTALLA DEL CHAT.
//
// La bandeja va en la direccion (`?bandeja=tienda`, `?bandeja=oficina`) y no en
// un estado de la pantalla: asi un aviso de "mensaje para la Oficina" abre la
// conversacion ya dentro de su buzon, y recargar la pagina no te saca de el a
// mitad de respuesta.
//
// Lo usan la pantalla, la lista y la caja de texto, y todos preguntan lo mismo:
// que buzones atiende esta sesion y en cual esta ahora.
// ----------------------------------------------------------------------

export function useBuzonesDelChat() {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();
  const claveEnDireccion = searchParams.get('bandeja');

  const buzones = useMemo(() => buzonesQueAtiende(user), [user]);
  const buzonActual = useMemo(
    () => bandejaAbierta(user, claveEnDireccion),
    [user, claveEnDireccion]
  );

  return {
    buzones,
    buzonActual,
    // La clave de la bandeja abierta, o '' en "Mis chats".
    bandeja: buzonActual?.clave ?? '',
    puedeAtender: buzones.length > 0,
    enBuzon: Boolean(buzonActual),
  };
}

// ----------------------------------------------------------------------
// LAS FOTOS DE LOS BUZONES, EN VIVO.
//
// Una sola escucha para toda la pantalla, por muchos componentes que pregunten:
// la foto sale en la cabecera, en la lista y en la conversacion, y abrir una
// escucha por cada sitio multiplicaba las lecturas por nada.
// ----------------------------------------------------------------------

let avatares = new Map();
let cancelarEscucha = null;
const suscriptores = new Set();

const suscribir = (avisar) => {
  suscriptores.add(avisar);

  if (!cancelarEscucha) {
    cancelarEscucha = escucharAvataresDeBuzones((siguientes) => {
      avatares = siguientes;
      suscriptores.forEach((aviso) => aviso());
    });
  }

  return () => {
    suscriptores.delete(avisar);

    if (!suscriptores.size && cancelarEscucha) {
      cancelarEscucha();
      cancelarEscucha = null;
    }
  };
};

const SIN_AVATARES = new Map();

/** Las fotos de todos los buzones: clave -> URL (solo las cambiadas). */
export function useAvataresDeBuzones() {
  return useSyncExternalStore(
    suscribir,
    () => avatares,
    () => SIN_AVATARES
  );
}

/** La foto actual de un buzon: la elegida por el Administrador Global o la de siempre. */
export function useAvatarDeBuzon(buzon) {
  const mapa = useAvataresDeBuzones();

  return buzon ? mapa.get(buzon.clave) || buzon.avatarPorDefecto : '';
}
