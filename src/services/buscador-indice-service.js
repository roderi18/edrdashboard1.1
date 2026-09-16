import { doc, getDoc, setDoc } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL INDICE DEL BUSCADOR: NOMBRES Y CARAS, EN UN SOLO SITIO.
//
// El buscador de la cabecera enseña productos de la tienda con su foto. Bajar la
// foto de verdad por cada resultado —de 16 a 250 kB— dejaba el desplegable en
// gris mientras se escribe. Aqui se guarda, junto al nombre, una miniatura de
// unos 2 kB como texto (`data:`), asi que pintar un resultado no pide nada.
//
// UN SOLO DOCUMENTO, a proposito: el buscador lo lee entero de una vez, y asi no
// son 87 lecturas cada vez que alguien abre la cabecera. Con ~2,5 kB por producto
// caben unos 350 antes de acercarse al limite de 1 MB de Firestore; cuando la
// tienda crezca hasta ahi habra que partirlo por categoria.
//
// NO pasa por la puerta de cambios: no es un cambio del que haya que responder
// —es la copia pequeña de algo que ya se guardo— y llenaria Historial de ruido.
// ----------------------------------------------------------------------

const COLECCION = 'indice_buscador';
const DOCUMENTO_PRODUCTOS = 'productos';

const referencia = () => doc(FIRESTORE, COLECCION, DOCUMENTO_PRODUCTOS);

export async function obtenerIndiceDeProductos() {
  if (!isFirebaseConfigured || !FIRESTORE) return {};

  const guardado = await getDoc(referencia()).catch(() => null);

  return guardado?.exists() ? (guardado.data()?.articulos ?? {}) : {};
}

/**
 * Guarda (o actualiza) la ficha de un producto en el indice.
 *
 * Se llama al guardar el producto y en el relleno de los que ya existian. Es
 * parcial: solo toca su entrada, para que dos administradores guardando a la vez
 * no se pisen el indice entero.
 */
export async function guardarProductoEnIndice({
  id,
  nombre,
  codigo = '',
  categoria = '',
  miniatura,
}) {
  if (!isFirebaseConfigured || !FIRESTORE || !id || !nombre) return null;

  const ficha = {
    nombre: String(nombre),
    codigo: String(codigo || ''),
    categoria: String(categoria || ''),
    // Sin miniatura NUEVA no se toca la que hubiera: editar el precio de un
    // producto no puede dejarlo sin cara en el buscador.
    ...(miniatura === undefined ? {} : { miniatura: String(miniatura || '') }),
    actualizadoEn: new Date().toISOString(),
  };

  await setDoc(referencia(), { articulos: { [String(id)]: ficha } }, { merge: true });

  return ficha;
}
