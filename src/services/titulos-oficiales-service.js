'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';

import {
  asignarTitulo,
  catalogoDeTitulos,
  asignarTituloAVarios,
  agregarTituloAlCatalogo,
  COLECCION_TITULOS_OFICIALES,
  DOCUMENTO_TITULOS_OFICIALES,
} from 'src/utils/titulos-oficiales-nacionales.mjs';

import { useLecturasVivas } from 'src/lib/avisos-de-lecturas';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { obtenerAsignacionesDirectiva } from 'src/services/directivas-organizacionales-service';

// ----------------------------------------------------------------------
// TÍTULOS DE LOS OFICIALES DE LA NACIONAL: lectura en vivo y escritura.
//
// Una sola escucha por página (la tarjeta del árbol y la franja "Ver más" la
// comparten). Las escrituras van en transacción: el "ya lo tiene otro" se
// comprueba contra lo guardado, no contra lo que la pantalla leyó hace un rato.
// Las reglas dejan escribir al Administrador Global y a la Oficina Nacional, y
// solo al primero cambiar la lista de `adicionales`.
// ----------------------------------------------------------------------

const referencia = () => doc(FIRESTORE, COLECCION_TITULOS_OFICIALES, DOCUMENTO_TITULOS_OFICIALES);

const quienEs = (usuario) => String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '');

const VACIO = Object.freeze({
  adicionales: [],
  asignaciones: {},
  catalogo: catalogoDeTitulos(),
  cargando: true,
});

let estado = VACIO;
let cancelar = null;
const oyentes = new Set();

const suscribir = (oyente) => {
  oyentes.add(oyente);

  if (!cancelar && isFirebaseConfigured && FIRESTORE) {
    cancelar = onSnapshot(
      referencia(),
      (instantanea) => {
        const datos = instantanea.data() || {};
        const adicionales = Array.isArray(datos.adicionales) ? datos.adicionales : [];

        estado = {
          adicionales,
          asignaciones:
            datos.asignaciones && typeof datos.asignaciones === 'object' ? datos.asignaciones : {},
          catalogo: catalogoDeTitulos(adicionales),
          cargando: false,
        };
        oyentes.forEach((avisar) => avisar());
      },
      (error) => {
        // Sin permiso o sin red: la lista de fábrica y nadie con título, nunca un hueco.
        console.error('[titulos-oficiales] no se pudo leer', error);
        estado = { ...estado, cargando: false };
        oyentes.forEach((avisar) => avisar());
      }
    );
  }

  return () => {
    oyentes.delete(oyente);

    if (!oyentes.size && cancelar) {
      cancelar();
      cancelar = null;
      estado = VACIO;
    }
  };
};

const leer = () => estado;

export const useTitulosOficiales = () => useSyncExternalStore(suscribir, leer, () => VACIO);

/**
 * PINTADO AL INSTANTE. Pone el título en pantalla antes de que Firestore
 * conteste —la escucha lo confirma después— y devuelve cómo deshacerlo si la
 * escritura falla. Antes el título aparecía uno o dos segundos más tarde que la
 * persona. `titulo` vacío lo quita.
 */
export function pintarTitulosYa({ personas = [], titulo = '' }) {
  const previas = estado.asignaciones;
  const siguientes = { ...previas };

  personas.forEach(({ idMiembro, nombre = '' }) => {
    const id = String(idMiembro ?? '').trim();

    if (!id) return;
    if (titulo) siguientes[id] = { ...(previas[id] || {}), nombre, titulo };
    else delete siguientes[id];
  });

  estado = { ...estado, asignaciones: siguientes };
  oyentes.forEach((avisar) => avisar());

  return () => {
    estado = { ...estado, asignaciones: previas };
    oyentes.forEach((avisar) => avisar());
  };
}

// ----------------------------------------------------------------------
// QUIÉN ES HOY OFICIAL ESPECIAL. Solo la directiva ACTUAL da título: los ids de
// las casillas `nacional-oficial-especial-N` activas en `asignaciones_directiva`.
// La memoria de un cuatrienio pasado no entra aquí, así que no toca el perfil.
// ----------------------------------------------------------------------

const ES_CASILLA_DE_OFICIAL = /^nacional-oficial-especial-(?:[1-9]|1\d|20)$/;

export async function leerOficialesVigentes() {
  const asignaciones = await obtenerAsignacionesDirectiva({
    nivel: 'nacional',
    idEntidad: 'nacional',
  });

  return new Set(
    (Array.isArray(asignaciones) ? asignaciones : [])
      .filter((asignacion) =>
        ES_CASILLA_DE_OFICIAL.test(String(asignacion?.idPosicionDirectiva || ''))
      )
      .map((asignacion) => String(asignacion.idMiembro ?? asignacion.idMiembros ?? '').trim())
      .filter(Boolean)
  );
}

/**
 * Los ids de los Oficiales Especiales vigentes (`null` mientras se leen). Con
 * `activo` apagado no lee nada: el diálogo está montado aunque esté cerrado, y
 * así solo pregunta al abrirse (y vuelve a preguntar en cada apertura).
 */
export function useOficialesVigentes(activo = true) {
  const [vigentes, setVigentes] = useState(null);
  const cambiosDeOtraSesion = useLecturasVivas(['directiva:']);

  useEffect(() => {
    let cancelado = false;

    if (!activo) return undefined;

    leerOficialesVigentes()
      .then((ids) => {
        if (!cancelado) setVigentes(ids);
      })
      .catch((error) => {
        // Sin poder leerlo, nadie lleva título: mejor nada que uno de otra época.
        console.error('[titulos-oficiales] no se pudo leer la directiva actual', error);
        if (!cancelado) setVigentes(new Set());
      });

    return () => {
      cancelado = true;
    };
  }, [activo, cambiosDeOtraSesion]);

  return vigentes;
}

const asegurarFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');
};

/** Da `titulo` a la persona (o se lo quita con ''). */
export async function guardarTituloDeOficial({ idMiembro, nombre = '', titulo, usuario = {} }) {
  asegurarFirebase();

  // Fuera de la transacción: una consulta no puede ir dentro (solo lecturas de
  // documentos). Es la directiva de hoy; quitar el título no la necesita.
  const vigentes = titulo ? await leerOficialesVigentes() : null;

  await runTransaction(FIRESTORE, async (transaccion) => {
    const instantanea = await transaccion.get(referencia());
    const datos = instantanea.data() || {};
    const adicionales = Array.isArray(datos.adicionales) ? datos.adicionales : [];
    const asignaciones = asignarTitulo(datos.asignaciones || {}, {
      idMiembro,
      titulo,
      vigentes,
      catalogo: catalogoDeTitulos(adicionales),
      datos: { nombre, asignadoPor: quienEs(usuario), asignadoEn: new Date().toISOString() },
    });

    transaccion.set(referencia(), {
      adicionales,
      asignaciones,
      actualizadoEn: serverTimestamp(),
      actualizadoPor: quienEs(usuario),
    });
  });
}

/**
 * El mismo título a varias personas ("Asignar miembros"), en una sola
 * transacción: o quedan todas o ninguna. `personas`: `{ idMiembro, nombre }`.
 */
export async function guardarTituloDeVariosOficiales({ personas = [], titulo, usuario = {} }) {
  asegurarFirebase();

  if (!personas.length) return;

  const vigentes = await leerOficialesVigentes();

  await runTransaction(FIRESTORE, async (transaccion) => {
    const instantanea = await transaccion.get(referencia());
    const datos = instantanea.data() || {};
    const adicionales = Array.isArray(datos.adicionales) ? datos.adicionales : [];
    const asignaciones = asignarTituloAVarios(datos.asignaciones || {}, {
      personas,
      titulo,
      vigentes,
      catalogo: catalogoDeTitulos(adicionales),
      datos: { asignadoPor: quienEs(usuario), asignadoEn: new Date().toISOString() },
    });

    transaccion.set(referencia(), {
      adicionales,
      asignaciones,
      actualizadoEn: serverTimestamp(),
      actualizadoPor: quienEs(usuario),
    });
  });
}

/** Suma un título nuevo a la lista (solo el Administrador Global). */
export async function agregarTituloOficial({ nombre, usuario = {} }) {
  asegurarFirebase();

  await runTransaction(FIRESTORE, async (transaccion) => {
    const instantanea = await transaccion.get(referencia());
    const datos = instantanea.data() || {};

    transaccion.set(referencia(), {
      adicionales: agregarTituloAlCatalogo(datos.adicionales, nombre),
      asignaciones: datos.asignaciones || {},
      actualizadoEn: serverTimestamp(),
      actualizadoPor: quienEs(usuario),
    });
  });
}
