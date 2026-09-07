import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { COLECCIONES_COMERCIO } from 'src/utils/firestore-commerce';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL NUMERO DE LA ORDEN: ORD-26-0148.
//
// Correlativo por año y NUNCA repetido. Antes era el reloj —`ORD-1777776824429`,
// diecisiete caracteres— que ni se dice por telefono ni dice cuantos pedidos van.
//
// El recibo de la compra se queda con este mismo numero: son dos documentos
// —`ordenes` y `recibos`— pero una sola compra, y quien la hizo tiene que poder
// dictar UN numero.
//
// El "nunca se repite" no lo da el formato: lo da la TRANSACCION. Dos personas
// pagando a la vez leian el mismo ultimo numero y se llevaban los dos el 148; con
// `runTransaction`, la segunda vuelve a leer y se lleva el 149. Firestore
// reintenta ella sola cuando hay pelea por el contador.
//
// Cada año empieza en 1 y vive en su propio documento, asi que 2026 y 2027 no se
// estorban.
// ----------------------------------------------------------------------

const PREFIJO = 'ORD';

// Cuatro cifras cubren 9.999 pedidos al año. El diez mil NO vuelve a empezar ni
// se recorta: crece a cinco cifras y sigue siendo unico, que es lo unico que no
// se puede romper.
const CIFRAS_MINIMAS = 4;

// EL CONTADOR SIGUE SIENDO `recibos-`, no `ordenes-`.
//
// La serie ya empezo con ese nombre y ahi esta el ultimo numero entregado.
// Renombrarlo la haria empezar de cero otra vez, y el 0001 saldria dos veces
// —una con cada prefijo—: justo lo que este numero existe para evitar.
const documentoDelContador = (anio) =>
  doc(FIRESTORE, COLECCIONES_COMERCIO.contadores, `recibos-${anio}`);

/** ORD-26-0148 a partir del año completo y el correlativo. */
export const formatearNumeroDeOrden = (anio, secuencia) =>
  [
    PREFIJO,
    String(anio).slice(-2),
    String(secuencia).padStart(CIFRAS_MINIMAS, '0'),
  ].join('-');

/**
 * Reserva el siguiente numero del año y lo devuelve ya formateado.
 *
 * Sube el contador y devuelve el numero en la misma transaccion: un numero
 * entregado no se devuelve nunca al mostrador, aunque el pedido se caiga
 * despues. Un hueco en la serie no le hace daño a nadie; un numero repetido, si.
 */
export const siguienteNumeroDeOrden = async (fecha = new Date()) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('No se puede generar el número de la orden sin conexión con Firebase.');
  }

  const anio = fecha.getFullYear();
  const referencia = documentoDelContador(anio);

  const secuencia = await runTransaction(FIRESTORE, async (transaccion) => {
    const instantanea = await transaccion.get(referencia);
    const ultimo = Number(instantanea.exists() ? instantanea.data()?.ultimo : 0) || 0;
    const siguiente = ultimo + 1;

    transaccion.set(
      referencia,
      { anio, ultimo: siguiente, actualizadoEn: serverTimestamp() },
      { merge: true }
    );

    return siguiente;
  });

  return formatearNumeroDeOrden(anio, secuencia);
};
