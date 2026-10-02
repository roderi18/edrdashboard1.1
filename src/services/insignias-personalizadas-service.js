import { conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';
import { puedeEliminarInsignias, puedeGestionarInsignias } from 'src/utils/org-level-access';
import {
  TIPOS_INSIGNIA,
  idDeInsigniaNueva,
  idDeAjusteDeFabrica,
  validarInsigniaNueva,
  limpiarNombreInsignia,
  validarInsigniaEditada,
  insigniaDesdeDocumento,
  documentoDeInsigniaNueva,
  limpiarDescripcionInsignia,
} from 'src/utils/insignias-personalizadas.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';
import {
  escribirInsigniaPersonalizada,
  actualizarInsigniaPersonalizada,
} from './insignias-personalizadas-apply';

// ----------------------------------------------------------------------
// ALTA DE UNA CINTA, MEDALLA O PIN DESDE EXPLORA DESIGNER.
//
// El Administrador Global y la Oficina Nacional. La imagen se sube a
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
const ARTICULO = {
  [TIPOS_INSIGNIA.CINTA]: 'la',
  [TIPOS_INSIGNIA.MEDALLA]: 'la',
  [TIPOS_INSIGNIA.PIN]: 'el',
};
// La pestaña del Designer de cada tipo, para el enlace de Historial.
const SECCION = {
  [TIPOS_INSIGNIA.CINTA]: 'cintas',
  [TIPOS_INSIGNIA.MEDALLA]: 'medallas',
  [TIPOS_INSIGNIA.PIN]: 'pines',
};

async function crearInsigniaPersonalizadaDirecto({ tipo, archivo, nombre, descripcion, usuario }) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');

  if (!puedeGestionarInsignias(usuario)) {
    throw new Error(
      'Solo el Administrador Global y la Oficina Nacional añaden cintas, medallas y pines.'
    );
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
      ruta: `/dashboard/explora-designer?seccion=${SECCION[tipo]}`,
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
// EDITAR Y ELIMINAR (`insignias-personalizadas.mjs`). Una añadida cambia en su
// ficha; una de fábrica, en su AJUSTE (`f-{tipo}-{id}`). La imagen es opcional al
// editar. Eliminar no borra: marca la añadida `activo: false` o la de fábrica
// `oculta: true`, y deja de pintarse en el Designer y en los perfiles.
// ----------------------------------------------------------------------

const quienEs = (usuario) => String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '');

const destinoDe = (tipo, insignia) => {
  if (insignia?.personalizada) return { idDoc: insignia.id, campos: {} };

  const idDoc = idDeAjusteDeFabrica(tipo, insignia?.id);

  return { idDoc, campos: { id: idDoc, fabrica: true, tipo, idFabrica: String(insignia?.id) } };
};

async function editarInsigniaDirecto({ tipo, insignia, archivo, nombre, descripcion, usuario }) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');

  if (!puedeGestionarInsignias(usuario)) {
    throw new Error(
      'Solo el Administrador Global y la Oficina Nacional editan cintas, medallas y pines.'
    );
  }

  const error = validarInsigniaEditada({ nombre, descripcion });

  if (error) throw new Error(error);

  const { idDoc, campos } = destinoDe(tipo, insignia);
  const cambios = {
    ...campos,
    nombre: limpiarNombreInsignia(nombre),
    descripcion: limpiarDescripcionInsignia(descripcion),
  };

  if (archivo) {
    // Ruta nueva: la imagen anterior se queda para Historial y lo ya pintado.
    const subida = await uploadOptimizedImage({
      file: archivo,
      preset: 'general',
      storagePath: `everest/insignias-${tipo}/${idDoc}-${Date.now()}.webp`,
      metadata: { tipo, idInsignia: String(insignia?.id ?? '') },
    });

    cambios.src = subida.downloadUrl;
    cambios.rutaStorage = subida.storagePath;
  }

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      tipo: `insignia_${tipo}`,
      id: idDoc,
      nombre: cambios.nombre,
      ruta: `/dashboard/explora-designer?seccion=${SECCION[tipo]}`,
    },
    cambios: [
      {
        campo: 'nombre',
        etiqueta: 'Nombre',
        antes: insignia?.nombre ?? null,
        despues: cambios.nombre,
      },
      {
        campo: 'descripcion',
        etiqueta: 'Descripción',
        antes: insignia?.descripcion ?? null,
        despues: cambios.descripcion,
      },
      ...(cambios.src
        ? [{ campo: 'src', etiqueta: 'Imagen', antes: insignia?.src ?? null, despues: cambios.src }]
        : []),
    ],
    usuario,
    descripcion: `EXPLORA Designer: se editó ${ARTICULO[tipo]} ${ETIQUETA[tipo]} ${cambios.nombre}.`,
    aplicarDirecto: true,
    aplicar: () => actualizarInsigniaPersonalizada(idDoc, cambios, quienEs(usuario)),
  });

  return cambios;
}

async function eliminarInsigniaDirecto({ tipo, insignia, usuario }) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');

  if (!puedeEliminarInsignias(usuario)) {
    throw new Error('Solo el Administrador Global elimina cintas, medallas y pines.');
  }

  const { idDoc, campos } = destinoDe(tipo, insignia);
  const cambios = insignia?.personalizada ? { activo: false } : { ...campos, oculta: true };

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      tipo: `insignia_${tipo}`,
      id: idDoc,
      nombre: insignia?.nombre || String(insignia?.id ?? ''),
      ruta: `/dashboard/explora-designer?seccion=${SECCION[tipo]}`,
    },
    cambios: [{ campo: 'eliminada', etiqueta: 'Eliminada', antes: false, despues: true }],
    usuario,
    descripcion: `EXPLORA Designer: se eliminó ${ARTICULO[tipo]} ${ETIQUETA[tipo]} ${insignia?.nombre || ''}.`,
    aplicarDirecto: true,
    aplicar: () => actualizarInsigniaPersonalizada(idDoc, cambios, quienEs(usuario)),
  });
}

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const crearInsigniaPersonalizada = conInvalidacion(
  crearInsigniaPersonalizadaDirecto,
  [],
  ['insignias:']
);
export const editarInsignia = conInvalidacion(editarInsigniaDirecto, [], ['insignias:']);
export const eliminarInsignia = conInvalidacion(eliminarInsigniaDirecto, [], ['insignias:']);
