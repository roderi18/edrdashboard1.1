import { isAdminGlobal } from 'src/utils/org-level-access';
import { conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';
import {
  TIPOS_INSIGNIA,
  idDeInsigniaNueva,
  validarInsigniaNueva,
  insigniaDesdeDocumento,
  documentoDeInsigniaNueva,
} from 'src/utils/insignias-personalizadas.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';
import { escribirInsigniaPersonalizada } from './insignias-personalizadas-apply';

// ----------------------------------------------------------------------
// ALTA DE UNA CINTA, MEDALLA O PIN DESDE EXPLORA DESIGNER.
//
// Solo el Administrador Global, como todo lo del Designer. La imagen se sube a
// `everest/insignias-{tipo}/` —la carpeta del Designer, con su regla de Storage—
// y la ficha pasa por `proponerCambio`: se aplica al momento y queda en Historial
// quién la añadió. Desde ese instante aparece en el Designer, en los perfiles y
// en el diálogo para asignarla (`use-insignias-personalizadas.js`).
// ----------------------------------------------------------------------

const ETIQUETA = {
  [TIPOS_INSIGNIA.CINTA]: 'cinta',
  [TIPOS_INSIGNIA.MEDALLA]: 'medalla',
  [TIPOS_INSIGNIA.PIN]: 'pin',
};
// La pestaña del Designer de cada tipo, para el enlace de Historial.
const SECCION = {
  [TIPOS_INSIGNIA.CINTA]: 'cintas',
  [TIPOS_INSIGNIA.MEDALLA]: 'medallas',
  [TIPOS_INSIGNIA.PIN]: 'pines',
};

async function crearInsigniaPersonalizadaDirecto({ tipo, archivo, nombre, descripcion, usuario }) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');

  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global añade cintas, medallas y pines.');
  }

  const error = validarInsigniaNueva({ tipo, nombre, descripcion, tieneImagen: Boolean(archivo) });

  if (error) throw new Error(error);

  const id = idDeInsigniaNueva();
  // La cinta es una franja apaisada y la medalla alta y estrecha: `general` no
  // las recorta, solo las baja a un tamaño razonable y a WebP.
  const subida = await uploadOptimizedImage({
    file: archivo,
    preset: 'general',
    storagePath: `everest/insignias-${tipo}/${id}.webp`,
    metadata: { tipo, idInsignia: id },
  });
  const documento = documentoDeInsigniaNueva({
    id,
    tipo,
    nombre,
    descripcion,
    src: subida.downloadUrl,
    rutaStorage: subida.storagePath,
  });

  // Lo que no pasaría el saneado al leerla no se guarda: saldría como un hueco.
  if (!insigniaDesdeDocumento(documento)) {
    throw new Error('La imagen no se guardó en la carpeta esperada. Vuelve a intentarlo.');
  }

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      tipo: `insignia_${tipo}`,
      id,
      nombre: documento.nombre,
      ruta: `/dashboard/everest?seccion=${SECCION[tipo]}`,
    },
    cambios: [
      { campo: 'nombre', etiqueta: 'Nombre', antes: null, despues: documento.nombre },
      {
        campo: 'descripcion',
        etiqueta: 'Descripción',
        antes: null,
        despues: documento.descripcion,
      },
    ],
    usuario,
    descripcion: `${tipo === TIPOS_INSIGNIA.PIN ? 'Nuevo' : 'Nueva'} ${ETIQUETA[tipo]} en EXPLORA Designer: ${documento.nombre}.`,
    aplicarDirecto: true,
    aplicar: () =>
      escribirInsigniaPersonalizada(
        documento,
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });

  return documento;
}

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const crearInsigniaPersonalizada = conInvalidacion(crearInsigniaPersonalizadaDirecto, [], ['insignias:']);
