import { doc, getDoc, getDocs, collection } from 'firebase/firestore';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';
import { leerConCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import {
  TIPOS_NODO,
  idDePremioNuevo,
  DOCUMENTO_NOMBRES,
  DOCUMENTO_IMAGENES,
  validarPremioNuevo,
  DOCUMENTO_ELIMINADOS,
  premioDesdeDocumento,
  DOCUMENTO_UBICACIONES,
  COLECCION_CONFIGURACION_PREMIOS,
  COLECCION_PREMIOS_PERSONALIZADOS,
} from 'src/utils/premios-personalizados.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';
import {
  escribirImagenDePremio,
  escribirNombreDePremio,
  escribirPremiosEliminados,
  escribirUbicacionDePremio,
  escribirPremioPersonalizado,
} from './premios-personalizados-apply';

// Premios añadidos desde la pestaña de premios (ver `premios-personalizados.mjs`).

/** Todos los premios añadidos, ya como nodos del árbol. */
export function leerPremiosPersonalizados() {
  if (!isFirebaseConfigured || !FIRESTORE) return Promise.resolve([]);
  return leerConCache('premios-personalizados:', async () => {
    const snap = await getDocs(collection(FIRESTORE, COLECCION_PREMIOS_PERSONALIZADOS));
    return snap.docs.map((d) => premioDesdeDocumento({ id: d.id, ...d.data() })).filter(Boolean);
  });
}

async function crearPremioPersonalizadoDirecto({
  tipo = TIPOS_NODO.premio,
  nombre,
  idCarpeta,
  nombreCarpeta,
  archivo,
  usuario,
}) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');
  if (!isAdminGlobal(usuario)) throw new Error('Solo el Administrador Global añade premios.');

  const error = validarPremioNuevo({ nombre, idCarpeta, tipo, tieneImagen: Boolean(archivo) });
  if (error) throw new Error(error);

  const id = idDePremioNuevo();
  const subida = archivo
    ? await uploadOptimizedImage({
        file: archivo,
        preset: 'avatar',
        storagePath: `everest/premios/${id}.webp`,
        metadata: { idPremio: id, idCarpeta },
      })
    : null;
  const documento = {
    id,
    nombre: String(nombre).trim(),
    idCarpeta,
    tipo,
    imagenUrl: subida?.downloadUrl || '',
    rutaStorage: subida?.storagePath || '',
    activo: true,
  };

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: { tipo: tipo === TIPOS_NODO.carpeta ? 'carpeta_premios' : 'premio', id, nombre: documento.nombre, ruta: '' },
    cambios: [{ campo: 'nombre', etiqueta: 'Nombre', antes: null, despues: documento.nombre }],
    usuario,
    descripcion: `${tipo === TIPOS_NODO.carpeta ? 'Nueva carpeta' : 'Nuevo premio'} en ${nombreCarpeta || idCarpeta}: ${documento.nombre}.`,
    aplicarDirecto: true,
    aplicar: () =>
      escribirPremioPersonalizado(
        documento,
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });

  return premioDesdeDocumento(documento);
}

export const crearPremioPersonalizado = conInvalidacion(
  crearPremioPersonalizadoDirecto,
  ['premios-personalizados:']
);

/** id → carpeta nueva de los premios y carpetas que se han movido. */
export function leerUbicacionesDePremios() {
  if (!isFirebaseConfigured || !FIRESTORE) return Promise.resolve({});
  return leerConCache('premios-personalizados:ubicaciones', async () => {
    const snap = await getDoc(doc(FIRESTORE, COLECCION_CONFIGURACION_PREMIOS, DOCUMENTO_UBICACIONES));
    return (snap.exists() && snap.data()?.ubicaciones) || {};
  });
}

async function moverPremioDirecto({ idNodo, nombreNodo, idDestino, nombreDestino, idOrigen, usuario }) {
  if (!isAdminGlobal(usuario)) throw new Error('Solo el Administrador Global mueve premios.');
  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: { tipo: 'premio', id: idNodo, nombre: nombreNodo || idNodo, ruta: '' },
    cambios: [{ campo: 'carpeta', etiqueta: 'Carpeta', antes: idOrigen, despues: idDestino }],
    usuario,
    descripcion: `${nombreNodo || idNodo} movido a ${nombreDestino || idDestino}.`,
    aplicarDirecto: true,
    aplicar: () =>
      escribirUbicacionDePremio(
        idNodo,
        idDestino,
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });
}

export const moverPremio = conInvalidacion(moverPremioDirecto, ['premios-personalizados:']);

/** id → nombre nuevo de los premios y carpetas renombrados. */
export function leerNombresDePremios() {
  if (!isFirebaseConfigured || !FIRESTORE) return Promise.resolve({});
  return leerConCache('premios-personalizados:nombres', async () => {
    const snap = await getDoc(doc(FIRESTORE, COLECCION_CONFIGURACION_PREMIOS, DOCUMENTO_NOMBRES));
    return (snap.exists() && snap.data()?.nombres) || {};
  });
}

async function renombrarPremioDirecto({ idNodo, antes, nombre, usuario }) {
  if (!isAdminGlobal(usuario)) throw new Error('Solo el Administrador Global cambia nombres.');
  const limpio = String(nombre ?? '').trim();
  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: { tipo: 'premio', id: idNodo, nombre: limpio, ruta: '' },
    cambios: [{ campo: 'nombre', etiqueta: 'Nombre', antes, despues: limpio }],
    usuario,
    descripcion: `"${antes}" ahora se llama "${limpio}".`,
    aplicarDirecto: true,
    aplicar: () =>
      escribirNombreDePremio(
        idNodo,
        limpio,
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });
}

export const renombrarPremio = conInvalidacion(renombrarPremioDirecto, ['premios-personalizados:']);

/** id → URL de la imagen nueva de los premios y carpetas que la cambiaron. */
export function leerImagenesDePremios() {
  if (!isFirebaseConfigured || !FIRESTORE) return Promise.resolve({});
  return leerConCache('premios-personalizados:imagenes', async () => {
    const snap = await getDoc(doc(FIRESTORE, COLECCION_CONFIGURACION_PREMIOS, DOCUMENTO_IMAGENES));
    return (snap.exists() && snap.data()?.imagenes) || {};
  });
}

async function cambiarImagenDePremioDirecto({ idNodo, nombreNodo, archivo, usuario }) {
  if (!isAdminGlobal(usuario)) throw new Error('Solo el Administrador Global cambia imágenes.');
  if (!archivo) throw new Error('Elige la imagen.');
  // Nombre nuevo cada vez: la URL anterior puede estar en la caché del navegador.
  const subida = await uploadOptimizedImage({
    file: archivo,
    preset: 'avatar',
    storagePath: `everest/premios/imagen-${idNodo}-${Date.now()}.webp`,
    metadata: { idPremio: idNodo },
  });
  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: { tipo: 'premio', id: idNodo, nombre: nombreNodo || idNodo, ruta: '' },
    cambios: [{ campo: 'imagen', etiqueta: 'Imagen', antes: null, despues: subida.downloadUrl }],
    usuario,
    descripcion: `Nueva imagen para "${nombreNodo || idNodo}".`,
    aplicarDirecto: true,
    aplicar: () =>
      escribirImagenDePremio(
        idNodo,
        subida.downloadUrl,
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });
  return subida.downloadUrl;
}

export const cambiarImagenDePremio = conInvalidacion(cambiarImagenDePremioDirecto, [
  'premios-personalizados:',
]);

/** id → true de los premios y carpetas eliminados. */
export function leerPremiosEliminados() {
  if (!isFirebaseConfigured || !FIRESTORE) return Promise.resolve({});
  return leerConCache('premios-personalizados:eliminados', async () => {
    const snap = await getDoc(doc(FIRESTORE, COLECCION_CONFIGURACION_PREMIOS, DOCUMENTO_ELIMINADOS));
    return (snap.exists() && snap.data()?.eliminados) || {};
  });
}

async function eliminarPremiosDirecto({ nodos = [], usuario }) {
  if (!isAdminGlobal(usuario)) throw new Error('Solo el Administrador Global elimina premios.');
  if (!nodos.length) return;
  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      tipo: 'premio',
      id: nodos.map((n) => n.id).join(','),
      nombre: nodos.map((n) => n.name).join(', '),
      ruta: '',
    },
    cambios: nodos.map((n) => ({ campo: n.id, etiqueta: n.name, antes: 'visible', despues: 'eliminado' })),
    usuario,
    descripcion: `Eliminado: ${nodos.map((n) => n.name).join(', ')}.`,
    aplicarDirecto: true,
    aplicar: () =>
      escribirPremiosEliminados(
        nodos.map((n) => n.id),
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });
}

export const eliminarPremios = conInvalidacion(eliminarPremiosDirecto, ['premios-personalizados:']);
