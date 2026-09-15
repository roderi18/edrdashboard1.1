import { collection, onSnapshot } from 'firebase/firestore';

import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';
import { avatarDeBuzonValido, COLECCION_BUZONES_CHAT } from 'src/utils/chat-buzones.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { escribirAvatarDeBuzon } from './chat-buzones-apply';
import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';

// ----------------------------------------------------------------------
// LA FOTO DE LOS BUZONES COMPARTIDOS DEL CHAT, en el navegador.
//
// El Administrador Global la cambia desde el propio chat —pasando el raton por la
// foto del buzon— y la ve todo el mundo: el servidor la pone en contactos,
// conversaciones y avisos. Quien la cambia la ve en el acto gracias a la escucha
// de abajo; el resto, en cuanto el servidor renueva su copia (un minuto).
//
// Se escribe POR LA PUERTA, como todo en este proyecto: la cara con la que la
// Tienda o la Oficina hablan a toda la organizacion no cambia sin que conste
// quien la cambio.
// ----------------------------------------------------------------------

/** Escucha las fotos de todos los buzones: recibe un mapa clave -> URL. */
export const escucharAvataresDeBuzones = (alCambiar) => {
  if (!isFirebaseConfigured || !FIRESTORE) return () => {};

  return onSnapshot(
    collection(FIRESTORE, COLECCION_BUZONES_CHAT),
    (snapshot) =>
      alCambiar(
        new Map(
          snapshot.docs
            .map((item) => [item.id, avatarDeBuzonValido(item.data()?.avatarUrl)])
            .filter(([, url]) => url)
        )
      ),
    (error) => console.error('[chat] no se pudieron leer las fotos de los buzones', error)
  );
};

export const cambiarAvatarDeBuzon = async ({
  buzon,
  archivo,
  avatarAnterior = '',
  usuario = {},
}) => {
  if (!buzon || !archivo) throw new Error('Elige una foto para el buzón.');

  if (!String(archivo.type || '').startsWith('image/')) {
    throw new Error('La foto tiene que ser una imagen.');
  }

  const subida = await uploadOptimizedImage({
    file: archivo,
    storagePath: `chat-buzones/${buzon.clave}/avatar-${Date.now()}.webp`,
    preset: 'avatar',
    metadata: { tipoEntidad: 'buzon_chat', buzon: buzon.clave },
  });

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.buzonChat,
    entidad: {
      tipo: 'buzon_chat',
      id: buzon.clave,
      nombre: buzon.nombre,
      ruta: `/dashboard/chat?bandeja=${buzon.clave}`,
    },
    cambios: [
      {
        campo: 'avatarUrl',
        etiqueta: 'Foto',
        antes: avatarAnterior || buzon.avatarPorDefecto,
        despues: subida.downloadUrl,
      },
    ],
    usuario,
    aplicarDirecto: true,
    descripcion: `Foto de ${buzon.nombre} en el chat cambiada.`,
    aplicar: () =>
      escribirAvatarDeBuzon({ clave: buzon.clave, avatarUrl: subida.downloadUrl, usuario }),
  });

  return subida.downloadUrl;
};
