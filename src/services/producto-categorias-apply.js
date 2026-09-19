import { doc, getDoc, setDoc, collection } from 'firebase/firestore';

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
