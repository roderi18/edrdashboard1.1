import { useRef, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';

import { isAdminGlobal } from 'src/utils/org-level-access';

import { cambiarAvatarDeBuzon } from 'src/services/chat-buzones-service';

import { toast } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';

import { useAvatarDeBuzon, useAvataresDeBuzones } from './hooks/use-buzones-del-chat';

// ----------------------------------------------------------------------
// CAMBIAR LA FOTO DE UN BUZON COMPARTIDO (Tienda Virtual, Oficina Nacional).
//
// Solo el Administrador Global, y por UN SOLO CAMINO: el menu de su cuenta,
// debajo de "Perfil". La foto queda puesta para todo el mundo —contactos,
// conversaciones y avisos—.
//
// Se cambia desde el chat porque es donde se ve: buscarla en una pantalla de
// ajustes aparte obligaba a saber que existia.
//
// LA FOTO DEL BUZON, EN LA PANTALLA, NO SE PULSA. Tambien se cambiaba pulsandola
// alli donde saliera, y esa foto no es un boton: es de quien escribe. Al tocarla
// —buscando la bandeja, o sin querer— saltaba el selector de archivos pidiendo
// una foto que nadie habia ido a cambiar.
// ----------------------------------------------------------------------

/**
 * El selector de foto, para quien ofrezca cambiarla —hoy, el menu de la cuenta—.
 * Devuelve la funcion que lo abre para un buzon y el `<input>` que hay que
 * pintar una vez.
 */
export function useCambiarFotoDeBuzon() {
  const { user } = useAuthContext();
  const avatares = useAvataresDeBuzones();
  const inputRef = useRef(null);
  const buzonRef = useRef(null);
  const [subiendo, setSubiendo] = useState('');

  const puedeCambiar = isAdminGlobal(user);

  const elegirFoto = useCallback((buzon) => {
    buzonRef.current = buzon;
    inputRef.current?.click();
  }, []);

  const handleArchivo = async (event) => {
    const archivo = event.target.files?.[0];
    const buzon = buzonRef.current;

    // Se vacia para que elegir la misma foto otra vez vuelva a disparar el cambio.
    event.target.value = '';

    if (!archivo || !buzon) return;

    try {
      setSubiendo(buzon.clave);
      await cambiarAvatarDeBuzon({
        buzon,
        archivo,
        avatarAnterior: avatares.get(buzon.clave) || '',
        usuario: user,
      });
      toast.success(`Foto de ${buzon.nombre} actualizada.`);
    } catch (error) {
      console.error('[chat] no se pudo cambiar la foto del buzón', error);
      toast.error(error?.message || 'No se pudo cambiar la foto.');
    } finally {
      setSubiendo('');
    }
  };

  const inputFoto = puedeCambiar ? (
    <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleArchivo} />
  ) : null;

  return { puedeCambiar, elegirFoto, inputFoto, subiendo };
}

export function ChatAvatarDeBuzon({ buzon, size = 48, sx }) {
  const avatarUrl = useAvatarDeBuzon(buzon);

  if (!buzon) return null;

  // Con el nombre: los dos buzones nacen con el mismo logo, y en la cabecera de
  // la lista ya no hay texto al lado que diga en cual de los dos se esta.
  return (
    <Tooltip title={buzon.nombre}>
      <Box sx={[{ flexShrink: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>
        <Avatar alt={buzon.nombre} src={avatarUrl} sx={{ width: size, height: size }} />
      </Box>
    </Tooltip>
  );
}
