import {
  doc,
  where,
  query,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  getCountFromServer,
} from 'firebase/firestore';

import { COLECCIONES_COMERCIO } from 'src/utils/firestore-commerce';
import { COLECCION_CATEGORIAS_PRODUCTO } from 'src/utils/producto-categorias-personalizadas.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA una categoría de producto nueva.
//
// Mismo caso que `insignias-personalizadas-apply.js`: aquí solo vive la
// escritura que `proponerCambio` ejecuta DESPUÉS de haberla registrado en
// Historial.
// ----------------------------------------------------------------------

export const referenciaDeCategoriaProducto = (id) =>
  doc(FIRESTORE, COLECCION_CATEGORIAS_PRODUCTO, id);

export const referenciaDeCategoriasProducto = () =>
  collection(FIRESTORE, COLECCION_CATEGORIAS_PRODUCTO);

export const existeCategoriaProducto = async (id) => {
  const instantanea = await getDoc(referenciaDeCategoriaProducto(id));

  return instantanea.exists();
};

export const escribirCategoriaProducto = (documento) =>
  setDoc(referenciaDeCategoriaProducto(documento.id), documento);

export const renombrarCategoriaProductoDoc = (id, nombre) =>
  updateDoc(referenciaDeCategoriaProducto(id), { nombre });

export const borrarCategoriaProductoDoc = (id) => deleteDoc(referenciaDeCategoriaProducto(id));

/** Cuántos productos usan la categoría: con alguno, no se borra. */
export const productosConCategoria = async (id) => {
  const conteo = await getCountFromServer(
    query(collection(FIRESTORE, COLECCIONES_COMERCIO.productos), where('categoria', '==', id))
  );

  return conteo.data().count;
};
