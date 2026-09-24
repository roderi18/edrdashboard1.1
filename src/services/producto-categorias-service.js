import { isAdminGlobal } from 'src/utils/org-level-access';
import { canManageStoreProducts } from 'src/utils/member-access';
import { conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import {
  slugificarCategoriaProducto,
  validarCategoriaProductoNueva,
  documentoDeCategoriaProductoNueva,
} from 'src/utils/producto-categorias-personalizadas.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

import { existeCategoriaProducto, escribirCategoriaProducto } from './producto-categorias-apply';

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

export const crearCategoriaProducto = conInvalidacion(crearCategoriaProductoDirecto, [], ['tienda-categorias:']);
