'use client';

import { useSyncExternalStore } from 'react';
import { onSnapshot } from 'firebase/firestore';

import {
  categoriasProductoDesdeDocumentos,
  registrarCategoriasProductoPersonalizadas,
} from 'src/utils/producto-categorias-personalizadas.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { referenciaDeCategoriasProducto } from 'src/services/producto-categorias-apply';

// ----------------------------------------------------------------------
// LAS CATEGORÍAS DE PRODUCTO AÑADIDAS DESDE /product/new, UNA SOLA ESCUCHA POR PÁGINA.
//
// Igual que las cintas y medallas añadidas en EXPLORA Designer
// (`use-insignias-personalizadas.js`): una sola escucha compartida entre el
// formulario y la lista, que se abre con el primero que la pide y se cierra con
// el último. Se registran ANTES de avisar a nadie, para que `etiquetaDeCategoria`
// ya las conozca cuando el componente se vuelve a pintar.
// ----------------------------------------------------------------------

const VACIO = [];

let categorias = VACIO;
let cancelar = null;
const oyentes = new Set();

const suscribir = (oyente) => {
  oyentes.add(oyente);

  if (!cancelar && isFirebaseConfigured && FIRESTORE) {
    cancelar = onSnapshot(
      referenciaDeCategoriasProducto(),
      (instantanea) => {
        categorias = categoriasProductoDesdeDocumentos(
          instantanea.docs.map((fila) => ({ id: fila.id, ...fila.data() }))
        );
        registrarCategoriasProductoPersonalizadas(categorias);
        oyentes.forEach((avisar) => avisar());
      },
      (error) => {
        // Sin permiso o sin red quedan solo las de fábrica: nunca un hueco.
        console.error('[categorias-producto] no se pudieron leer las añadidas', error);
      }
    );
  }

  return () => {
    oyentes.delete(oyente);

    if (!oyentes.size && cancelar) {
      cancelar();
      cancelar = null;
    }
  };
};

const leer = () => categorias;
const leerEnServidor = () => VACIO;

/** Las categorías de producto añadidas desde /product/new, en vivo. */
export const useCategoriasProductoPersonalizadas = () =>
  useSyncExternalStore(suscribir, leer, leerEnServidor);
