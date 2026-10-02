import { isAdminGlobal } from 'src/utils/org-level-access';
import { canManageStoreProducts } from 'src/utils/member-access';
import { conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import {
  esCategoriaDeCampamento,
  slugificarCategoriaProducto,
  validarCategoriaProductoNueva,
  documentoDeCategoriaProductoNueva,
} from 'src/utils/producto-categorias-personalizadas.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

import {
  productosConCategoria,
  existeCategoriaProducto,
  escribirCategoriaProducto,
  borrarCategoriaProductoDoc,
  renombrarCategoriaProductoDoc,
} from './producto-categorias-apply';

// ----------------------------------------------------------------------
// ALTA DE UNA CATEGORÍA DE PRODUCTO desde /product/new ("+ Nuevo").
//
// La agrega quien administra la tienda (la misma puerta que abre "Crear
// nuevo"), como el resto de la tienda: pasa por `proponerCambio` (ámbito
// `tienda`), se aplica al momento y queda en Historial quién la añadió.
// ----------------------------------------------------------------------

async function crearCategoriaProductoDirecto({ nombre, usuario }) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');

  if (!canManageStoreProducts(usuario) && !isAdminGlobal(usuario)) {
    throw new Error('Solo quien administra la tienda añade categorías.');
  }

  const error = validarCategoriaProductoNueva(nombre);

  if (error) throw new Error(error);

  const id = slugificarCategoriaProducto(nombre);

  if (await existeCategoriaProducto(id)) {
    throw new Error('Ya existe una categoría con ese nombre.');
  }

  const documento = documentoDeCategoriaProductoNueva({ id, nombre });

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.tienda,
    entidad: {
      tipo: 'categoria_producto',
      id,
      nombre: documento.nombre,
      ruta: '/dashboard/product/new',
    },
    cambios: [{ campo: 'nombre', etiqueta: 'Nombre', antes: null, despues: documento.nombre }],
    usuario,
    descripcion: `Nueva categoría de producto en la tienda: ${documento.nombre}.`,
    aplicar: () => escribirCategoriaProducto(documento),
  });

  return { value: id, label: documento.nombre };
}

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const crearCategoriaProducto = conInvalidacion(
  crearCategoriaProductoDirecto,
  [],
  ['tienda-categorias:']
);

// ----------------------------------------------------------------------
// RENOMBRAR Y BORRAR LAS DE CAMPAMENTO (`esCategoriaDeCampamento`).
//
// Igual que el alta: quien administra la tienda o el Administrador Global, por
// `proponerCambio` (se aplica al momento y queda en Historial). Renombrar solo
// cambia el nombre: el id —al que apuntan productos y actividad— no se toca.
// Borrar se niega mientras algún producto la use: lo dejaría sin categoría.
// ----------------------------------------------------------------------

const comprobarQuienGestiona = (usuario, categoria) => {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');

  if (!canManageStoreProducts(usuario) && !isAdminGlobal(usuario)) {
    throw new Error('Solo quien administra la tienda cambia las categorías.');
  }

  if (!esCategoriaDeCampamento(categoria)) {
    throw new Error('Solo se cambian las categorías de campamento.');
  }
};

async function renombrarCategoriaProductoDirecto({ categoria, nombre, usuario }) {
  comprobarQuienGestiona(usuario, categoria);

  const error = validarCategoriaProductoNueva(nombre);

  if (error) throw new Error(error);

  const { nombre: limpio } = documentoDeCategoriaProductoNueva({ id: categoria.value, nombre });

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.tienda,
    entidad: {
      tipo: 'categoria_producto',
      id: categoria.value,
      nombre: limpio,
      ruta: '/dashboard/product/new',
    },
    cambios: [{ campo: 'nombre', etiqueta: 'Nombre', antes: categoria.label, despues: limpio }],
    usuario,
    descripcion: `Categoría de producto renombrada: ${categoria.label} → ${limpio}.`,
    aplicar: () => renombrarCategoriaProductoDoc(categoria.value, limpio),
  });

  return { ...categoria, label: limpio };
}

async function eliminarCategoriaProductoDirecto({ categoria, usuario }) {
  comprobarQuienGestiona(usuario, categoria);

  const enUso = await productosConCategoria(categoria.value);

  if (enUso > 0) {
    throw new Error(
      `No se puede borrar: ${enUso} producto${enUso === 1 ? ' la usa' : 's la usan'}. Cámbiales la categoría antes.`
    );
  }

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.tienda,
    entidad: {
      tipo: 'categoria_producto',
      id: categoria.value,
      nombre: categoria.label,
      ruta: '/dashboard/product/new',
    },
    cambios: [{ campo: 'nombre', etiqueta: 'Nombre', antes: categoria.label, despues: null }],
    usuario,
    descripcion: `Categoría de producto borrada: ${categoria.label}.`,
    aplicar: () => borrarCategoriaProductoDoc(categoria.value),
  });
}

export const renombrarCategoriaProducto = conInvalidacion(
  renombrarCategoriaProductoDirecto,
  [],
  ['tienda-categorias:']
);

export const eliminarCategoriaProducto = conInvalidacion(
  eliminarCategoriaProductoDirecto,
  [],
  ['tienda-categorias:']
);
