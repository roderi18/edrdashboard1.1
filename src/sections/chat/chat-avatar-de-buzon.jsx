import { varAlpha } from 'minimal-shared/utils';
import { useRef, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';

import { isAdminGlobal } from 'src/utils/org-level-access';

import { cambiarAvatarDeBuzon } from 'src/services/chat-buzones-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { useAvatarDeBuzon, useAvataresDeBuzones } from './hooks/use-buzones-del-chat';

// ----------------------------------------------------------------------
// CAMBIAR LA FOTO DE UN BUZON COMPARTIDO (Tienda Virtual, Oficina Nacional).
//
// Solo el Administrador Global, y desde el propio chat: en el menu de su cuenta,
// debajo de "Perfil", y pasando el raton por la foto del buzon cuando esta en su
// bandeja. La foto queda puesta para todo el mundo —contactos, conversaciones y
// avisos—.
//
// Se cambia desde el chat porque es donde se ve: buscarla en una pantalla de
// ajustes aparte obligaba a saber que existia.
// ----------------------------------------------------------------------

/**
 * El selector de foto, para usarlo desde cualquier sitio: un menu, la propia
 * foto. Devuelve la funcion que lo abre para un buzon y el `<input>` que hay que
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
  const { puedeCambiar, elegirFoto, inputFoto, subiendo } = useCambiarFotoDeBuzon();

  if (!buzon) return null;

  const foto = <Avatar alt={buzon.nombre} src={avatarUrl} sx={{ width: size, height: size }} />;
  const estaSubiendo = subiendo === buzon.clave;

  if (!puedeCambiar) {
    return <Box sx={[{ flexShrink: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>{foto}</Box>;
  }

  return (
    <>
      <Tooltip title={`Cambiar la foto de ${buzon.nombre}`}>
        <ButtonBase
          aria-label={`Cambiar la foto de ${buzon.nombre}`}
          onClick={() => elegirFoto(buzon)}
          disabled={estaSubiendo}
          sx={[
            {
              flexShrink: 0,
              borderRadius: '50%',
              overflow: 'hidden',
              position: 'relative',
              width: size,
              height: size,
              '&:hover .capa-cambiar-foto, &:focus-visible .capa-cambiar-foto': { opacity: 1 },
            },
            ...(Array.isArray(sx) ? sx : [sx]),
          ]}
        >
          {foto}

          <Box
            className="capa-cambiar-foto"
            sx={(theme) => ({
              inset: 0,
              display: 'flex',
              position: 'absolute',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'common.white',
              bgcolor: varAlpha(theme.vars.palette.grey['900Channel'], 0.56),
              opacity: estaSubiendo ? 1 : 0,
              transition: theme.transitions.create('opacity', {
                duration: theme.transitions.duration.shorter,
              }),
            })}
          >
            {estaSubiendo ? (
              <CircularProgress size={size / 2.4} color="inherit" />
            ) : (
              <Iconify icon="solar:camera-add-bold" width={size / 2.4} />
            )}
          </Box>
        </ButtonBase>
      </Tooltip>

      {inputFoto}
    </>
  );
}
