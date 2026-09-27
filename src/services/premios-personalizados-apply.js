import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import {
  DOCUMENTO_NOMBRES,
  DOCUMENTO_IMAGENES,
  DOCUMENTO_ELIMINADOS,
  DOCUMENTO_UBICACIONES,
  COLECCION_CONFIGURACION_PREMIOS,
  COLECCION_PREMIOS_PERSONALIZADOS,
} from 'src/utils/premios-personalizados.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// El brazo que aplica el alta de un premio: `proponerCambio` lo ejecuta después
// de dejarlo en Historial (mismo caso que `insignias-personalizadas-apply.js`).
export const escribirPremioPersonalizado = (documento, creadoPor = '') =>
  setDoc(doc(FIRESTORE, COLECCION_PREMIOS_PERSONALIZADOS, documento.id), {
    ...documento,
    creadoPor,
    creadoEn: serverTimestamp(),
  });

// Mover un premio o una carpeta: una entrada del mapa de ubicaciones.
export const escribirUbicacionDePremio = (idNodo, idDestino, movidoPor = '') =>
  setDoc(
    doc(FIRESTORE, COLECCION_CONFIGURACION_PREMIOS, DOCUMENTO_UBICACIONES),
    { ubicaciones: { [idNodo]: idDestino }, actualizadoPor: movidoPor, actualizadoEn: serverTimestamp() },
    { merge: true }
  );

// Cambiar el nombre de un premio o carpeta: una entrada del mapa de nombres.
export const escribirNombreDePremio = (idNodo, nombre, cambiadoPor = '') =>
  setDoc(
    doc(FIRESTORE, COLECCION_CONFIGURACION_PREMIOS, DOCUMENTO_NOMBRES),
    { nombres: { [idNodo]: nombre }, actualizadoPor: cambiadoPor, actualizadoEn: serverTimestamp() },
    { merge: true }
  );

// Cambiar la imagen de un premio o carpeta: una entrada del mapa de imágenes.
export const escribirImagenDePremio = (idNodo, url, cambiadoPor = '') =>
  setDoc(
    doc(FIRESTORE, COLECCION_CONFIGURACION_PREMIOS, DOCUMENTO_IMAGENES),
    { imagenes: { [idNodo]: url }, actualizadoPor: cambiadoPor, actualizadoEn: serverTimestamp() },
    { merge: true }
  );

// Eliminar premios o carpetas: se marcan en el mapa de eliminados.
export const escribirPremiosEliminados = (ids = [], eliminadoPor = '') =>
  setDoc(
    doc(FIRESTORE, COLECCION_CONFIGURACION_PREMIOS, DOCUMENTO_ELIMINADOS),
    {
      eliminados: Object.fromEntries(ids.map((id) => [id, true])),
      actualizadoPor: eliminadoPor,
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );
