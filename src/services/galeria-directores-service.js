import { getDocs, collection } from 'firebase/firestore';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';
import {
  ordenarGaleria,
  validarDirectorNuevo,
  directorDesdeDocumento,
  COLECCION_GALERIA_DIRECTORES,
} from 'src/utils/galeria-directores.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';
import { escribirDirectorDeGaleria, actualizarDirectorDeGaleria } from './galeria-directores-apply';

// ----------------------------------------------------------------------
// GALERÍA DE DIRECTORES NACIONALES. La leen todos los que entran a Consejo
// Nacional; añade el Administrador Global. La foto ya llega recortada y va a
// `everest/galeria-directores/` (la carpeta del Designer, que solo él escribe);
// la ficha pasa por `proponerCambio` para que quede en Historial.
// ----------------------------------------------------------------------

export async function leerGaleriaDeDirectores() {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const snap = await getDocs(collection(FIRESTORE, COLECCION_GALERIA_DIRECTORES));

  return ordenarGaleria(
    snap.docs.map((d) => directorDesdeDocumento(d.id, d.data())).filter(Boolean)
  );
}

export async function agregarDirectorALaGaleria({
  nombre,
  anio,
  foto,
  usuario,
  placaArriba = '',
  placaAbajo = '',
}) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');
  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global añade directores a la galería.');
  }

  const error = validarDirectorNuevo({ nombre, anio, tieneFoto: Boolean(foto) });
  if (error) throw new Error(error);

  const id = `d${Date.now()}`;
  const subida = await uploadOptimizedImage({
    file: foto,
    preset: 'general',
    storagePath: `everest/galeria-directores/${id}.webp`,
  });
  const director = {
    nombre: String(nombre).trim(),
    anio: String(anio).trim(),
    fotoUrl: subida.downloadUrl,
    rutaStorage: subida.storagePath,
    placaArriba: String(placaArriba).trim(),
    placaAbajo: String(placaAbajo).trim(),
  };

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      tipo: 'galeria_director_nacional',
      id,
      nombre: director.nombre,
      ruta: '/dashboard/level/national?vista=galeria',
    },
    cambios: [
      { campo: 'nombre', etiqueta: 'Nombre', antes: null, despues: director.nombre },
      { campo: 'anio', etiqueta: 'Año', antes: null, despues: director.anio },
    ],
    usuario,
    descripcion: `Nuevo en la Galería de Directores Nacionales: ${director.nombre} (${director.anio}).`,
    aplicarDirecto: true,
    aplicar: () =>
      escribirDirectorDeGaleria(
        id,
        director,
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });

  return { id, ...director };
}

// EDITAR UN DIRECTOR. Nombre y año siempre; la foto solo si se eligió otra (ya
// recortada), que va a una ruta nueva para no pisar la que guarda Historial.
export async function editarDirectorDeLaGaleria({
  director,
  nombre,
  anio,
  foto,
  usuario,
  placaArriba = '',
  placaAbajo = '',
}) {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');
  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global edita la galería.');
  }

  const error = validarDirectorNuevo({
    nombre,
    anio,
    tieneFoto: Boolean(foto || director?.fotoUrl),
  });
  if (error) throw new Error(error);

  const id = director.id;
  const cambios = {
    nombre: String(nombre).trim(),
    anio: String(anio).trim(),
    placaArriba: String(placaArriba).trim(),
    placaAbajo: String(placaAbajo).trim(),
  };

  if (foto) {
    const subida = await uploadOptimizedImage({
      file: foto,
      preset: 'general',
      storagePath: `everest/galeria-directores/${id}-${Date.now()}.webp`,
    });
    cambios.fotoUrl = subida.downloadUrl;
    cambios.rutaStorage = subida.storagePath;
  }

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      tipo: 'galeria_director_nacional',
      id,
      nombre: cambios.nombre,
      ruta: '/dashboard/level/national?vista=galeria',
    },
    cambios: [
      { campo: 'nombre', etiqueta: 'Nombre', antes: director.nombre, despues: cambios.nombre },
      { campo: 'anio', etiqueta: 'Año', antes: director.anio, despues: cambios.anio },
      {
        campo: 'placaArriba',
        etiqueta: 'Placa (arriba)',
        antes: director.placaArriba || null,
        despues: cambios.placaArriba || null,
      },
      {
        campo: 'placaAbajo',
        etiqueta: 'Placa (abajo)',
        antes: director.placaAbajo || null,
        despues: cambios.placaAbajo || null,
      },
      ...(cambios.fotoUrl
        ? [
            {
              campo: 'fotoUrl',
              etiqueta: 'Foto',
              antes: director.fotoUrl,
              despues: cambios.fotoUrl,
            },
          ]
        : []),
    ],
    usuario,
    descripcion: `Galería de Directores Nacionales: editado ${cambios.nombre} (${cambios.anio}).`,
    aplicarDirecto: true,
    aplicar: () =>
      actualizarDirectorDeGaleria(
        id,
        cambios,
        String(usuario?.uid ?? usuario?.id ?? usuario?.codigoMiembro ?? '')
      ),
  });

  return { ...director, ...cambios };
}
