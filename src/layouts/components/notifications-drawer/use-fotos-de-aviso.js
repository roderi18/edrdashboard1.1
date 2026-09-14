import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { obtenerFotoPrincipal } from 'src/utils/firebase-photos';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// LAS DOS FOTOS DE UN AVISO DE PRODUCTO: LA DEL PRODUCTO Y LA DE QUIEN ACTUA.
//
// Los avisos nuevos ya las traen dentro. Los que estaban guardados no: se
// escribieron sin la foto del producto y, en muchos, con `actorFotoURL: ''`, que
// es por lo que la campana pintaba un circulo vacio. Para esos se buscan aqui,
// al pintarlos.
//
// Se guarda lo que se encuentra por id: la campana repinta cada fila varias veces
// y veinte avisos del mismo producto no tienen que pedir veinte veces la misma
// ficha.
// ----------------------------------------------------------------------

const fotosDeProducto = new Map();
const fotosDePersona = new Map();

const buscarFotoDeProducto = async (idProducto) => {
  if (fotosDeProducto.has(idProducto)) return fotosDeProducto.get(idProducto);

  const promesa = getDoc(doc(FIRESTORE, 'productos', String(idProducto)))
    .then((snap) => {
      const data = snap.exists() ? snap.data() : {};
      const imagenes = Array.isArray(data.imagenes) ? data.imagenes : [];

      return data.imagenPortada || imagenes[0] || '';
    })
    .catch(() => '');

  fotosDeProducto.set(idProducto, promesa);
  return promesa;
};

// De la cuenta al miembro y del miembro a su foto: es el mismo camino que sigue
// la sesion para ponerle cara a quien entra.
const buscarFotoDePersona = async (idCuenta) => {
  if (fotosDePersona.has(idCuenta)) return fotosDePersona.get(idCuenta);

  const promesa = getDoc(doc(FIRESTORE, 'usuarios_roles', String(idCuenta)))
    .then(async (snap) => {
      const idMiembros = snap.exists() ? snap.data()?.idMiembros : null;

      if (!idMiembros) return '';

      const foto = await obtenerFotoPrincipal({ tipoEntidad: 'miembro', idEntidad: idMiembros });

      return foto?.urlFoto || '';
    })
    .catch(() => '');

  fotosDePersona.set(idCuenta, promesa);
  return promesa;
};

export function useFotosDeAviso(notification, { activo = true } = {}) {
  const metadatos = notification?.metadatos || {};
  const idProducto = metadatos.productId || notification?.entidadId || '';
  const idCuenta = notification?.actorId || '';
  const fotoProductoGuardada = metadatos.imagenProducto || '';
  const fotoPersonaGuardada = notification?.avatarUrl || '';

  const [fotoProducto, setFotoProducto] = useState(fotoProductoGuardada);
  const [fotoPersona, setFotoPersona] = useState(fotoPersonaGuardada);

  useEffect(() => {
    if (!activo || fotoProductoGuardada || !idProducto || !isFirebaseConfigured || !FIRESTORE) {
      return undefined;
    }

    let vigente = true;

    buscarFotoDeProducto(idProducto).then((url) => {
      if (vigente && url) setFotoProducto(url);
    });

    return () => {
      vigente = false;
    };
  }, [activo, fotoProductoGuardada, idProducto]);

  useEffect(() => {
    if (
      !activo ||
      fotoPersonaGuardada ||
      !idCuenta ||
      idCuenta === 'sistema' ||
      !isFirebaseConfigured ||
      !FIRESTORE
    ) {
      return undefined;
    }

    let vigente = true;

    buscarFotoDePersona(idCuenta).then((url) => {
      if (vigente && url) setFotoPersona(url);
    });

    return () => {
      vigente = false;
    };
  }, [activo, fotoPersonaGuardada, idCuenta]);

  return {
    fotoProducto: fotoProductoGuardada || fotoProducto,
    fotoPersona: fotoPersonaGuardada || fotoPersona,
  };
}
