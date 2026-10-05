'use client';

import { useMemo } from 'react';

import { useAuthContext } from 'src/auth/hooks';

import { buzonesQueAtiende } from './utils/buzones-del-chat';
import { usePresenceHeartbeat } from './hooks/use-presence-heartbeat';

// ----------------------------------------------------------------------
// CONECTADO A LA APLICACION = EN LINEA EN EL CHAT.
//
// El latido de presencia solo corria con la pantalla de Chat abierta: quien
// estaba en otra pantalla de la aplicacion caducaba a los dos minutos y medio y
// salia en gris, y volvia a verde al entrar al chat. Ahora late desde el panel,
// en cualquier pantalla. Publica tambien los buzones compartidos que atiende
// (Oficina Nacional, Tienda Virtual), que salen en linea si alguno de quienes
// los atienden lo esta.
// ----------------------------------------------------------------------

export default function PresenciaEnLaAplicacion({ idMiembros }) {
  const { user } = useAuthContext();
  const atiende = useMemo(() => buzonesQueAtiende(user).map((buzon) => buzon.clave), [user]);

  usePresenceHeartbeat(idMiembros, { atiende });

  return null;
}
