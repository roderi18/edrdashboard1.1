import { useMemo } from 'react';

import { useSearchParams } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';

import { BANDEJA_TIENDA, sesionPuedeAtenderBuzonDeTienda } from '../utils/buzon-de-tienda';

export { identidadEnElChat } from '../utils/buzon-de-tienda';

// ----------------------------------------------------------------------
// EL BUZON DE LA TIENDA, DESDE LA PANTALLA DEL CHAT.
//
// La bandeja va en la direccion (`?bandeja=tienda`) y no en un estado de la
// pantalla: asi un aviso de "mensaje para la Tienda" abre la conversacion ya
// dentro del buzon, y recargar la pagina no te saca de el a mitad de respuesta.
// ----------------------------------------------------------------------

export function useBuzonDeTienda() {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();

  const puedeAtender = useMemo(() => sesionPuedeAtenderBuzonDeTienda(user), [user]);
  const enBuzon = puedeAtender && searchParams.get('bandeja') === BANDEJA_TIENDA;

  return { puedeAtender, enBuzon };
}
