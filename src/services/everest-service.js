import { query, where, getDoc, getDocs, collection } from 'firebase/firestore';

import { paths } from 'src/routes/paths';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { bloquePorId } from 'src/utils/everest/bloques.mjs';
import { comunicadosNuevos } from 'src/utils/everest/avisos.mjs';
import { COLECCIONES_EXPLORA } from 'src/utils/everest/colecciones.mjs';
import { conCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import { campanasDe, prepararCampana } from 'src/utils/everest/campanas.mjs';
import {
  resolverPortada,
  ORIGEN_DEL_BLOQUE,
  prepararPublicacion,
} from 'src/utils/everest/portada.mjs';
import {
  claveDeVersion,
  prepararVersion,
  ordenarVersiones,
  ACCIONES_DE_VERSION,
  diferenciasDelBloque,
} from 'src/utils/everest/versiones.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { FABRICA_DE_PORTADA } from 'src/sections/principal/fabrica-de-portada';

import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';
import { crearNotificacionComunicadosPublicados } from './notification-service';
import {
  quitarCampana,
  escribirCampana,
  referenciaDePublicado,
  quitarBloquePublicado,
  escribirBloquePublicado,
} from './everest-apply';

// ----------------------------------------------------------------------
// EXPLORA DESIGNER: LEER Y PUBLICAR LA PORTADA.
//
// Lo que se publica aqui lo ve toda la organizacion, asi que pasa por la puerta
// de cambios (`proponerCambio`), igual que la Paleta y los Sonidos: se aplica en
// el acto —lo publica el Administrador Global, no espera a nadie— pero queda en
// Historial quien publico que bloque y cuando.
//
// La comprobacion de rol de aqui es para dar un error claro en pantalla. La que
// de verdad protege es la de `firestore.rules`: solo el Administrador Global
// escribe en `everest_publicado`.
//
// Desde la fase 5, Historial guarda el antes y el despues de cada campo, y cada
// cambio deja una version en `everest_versiones` para poder volver a ella.
//
// Desde la fase 7, las campañas —un bloque distinto durante unas fechas, y si se
// quiere solo para una parte de la organizacion— pasan por la misma puerta.
// ----------------------------------------------------------------------

const asegurarPuedePublicar = (usuario) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado.');
  }

  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global publica desde EXPLORA Designer.');
  }
};

/**
 * El documento publicado de una pantalla, tal cual, o `null` si no existe.
 *
 * Por defecto tampoco lanza si no se pudo leer: quien lo use pinta el valor de
 * fabrica con un `null`. `lanzarSiFalla` es para quien necesita distinguir "no
 * hay nada publicado" de "no se pudo leer": la portada, que con una red caida no
 * debe tirar la copia buena y volver a lo de fabrica.
 */
async function obtenerPublicadoSinCache(pantalla, { lanzarSiFalla = false } = {}) {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  try {
    const documento = await getDoc(referenciaDePublicado(pantalla));

    return documento.exists() ? documento.data() : null;
  } catch (error) {
    if (lanzarSiFalla) throw error;

    return null;
  }
}

const describirOrigen = (publicado, idBloque) =>
  publicado?.bloques?.[idBloque]
    ? `Publicado el ${publicado.bloques[idBloque].publicadoEn || 'fecha desconocida'}`
    : 'Original del código';

const entidadDelBloque = (pantalla, bloque) => ({
  tipo: 'everest_bloque',
  id: `${pantalla}/${bloque.id}`,
  nombre: `EXPLORA Designer · ${bloque.nombre}`,
  ruta: `${paths.dashboard.everest}?bloque=${bloque.id}`,
});

/** Lo que se pinta HOY en ese bloque (contenido y diseño): lo publicado si vale, o lo de fabrica. */
const enVivo = (publicado, pantalla, idBloque) =>
  resolverPortada({ publicado, fabrica: FABRICA_DE_PORTADA, pantalla })[idBloque];

/**
 * Los cambios para Historial, campo a campo: los del contenido y los del diseño
 * (estos con `diseno_` delante, para no confundir el "titulo" de la actividad con
 * el "titulo" fijo de la tarjeta). Si no cambio nada que se vea —publicar dos
 * veces lo mismo—, queda igual una linea: la accion si ocurrio y tiene que constar.
 */
const cambiosParaHistorial = ({ idBloque, bloque, anterior, antes, despues, textoDespues }) => {
  const diferencias = [
    ...diferenciasDelBloque({ idBloque, antes: antes?.contenido, despues: despues?.contenido }),
    ...diferenciasDelBloque({
      idBloque,
      antes: antes?.diseno ?? {},
      despues: despues?.diseno ?? {},
    }).map((cambio) => ({
      ...cambio,
      campo: `diseno_${cambio.campo}`,
      etiqueta: `${bloque.nombre} · diseño · ${cambio.campo}`,
    })),
  ];

  return diferencias.length
    ? diferencias
    : [
        {
          campo: idBloque,
          etiqueta: bloque.nombre,
          antes: describirOrigen(anterior, idBloque),
          despues: textoDespues,
        },
      ];
};

/**
 * Avisa en la campana de los comunicados nuevos. NUNCA tumba la publicacion: lo
 * publicado ya esta en la portada, y un aviso que no sale no es motivo para
 * decir que no se publico.
 */
const avisarComunicados = async ({ comunicados, audiencia, usuario }) => {
  if (!comunicados.length) return 0;

  try {
    const aviso = await crearNotificacionComunicadosPublicados({ comunicados, audiencia, usuario });

    return aviso ? comunicados.length : 0;
  } catch (error) {
    console.error('[everest] no se pudo avisar de los comunicados', error);

    return 0;
  }
};

/**
 * Publica un bloque. Devuelve lo escrito, ya limpio y firmado.
 *
 * `avisar` (solo comunicados): manda a la campana los comunicados que no estaban.
 * `avisados` en lo devuelto dice cuantos se avisaron.
 */
async function publicarBloqueDirecto({
  pantalla,
  idBloque,
  contenido,
  diseno,
  usuario,
  avisar = false,
}) {
  asegurarPuedePublicar(usuario);

  // Lanza si el bloque no existe o el contenido o el diseño no pasan el saneado:
  // se enseña el error y no se publica a medias.
  const publicacion = prepararPublicacion({ idBloque, contenido, diseno, usuario });
  const bloque = bloquePorId(idBloque);
  // Leer lo de antes es obligatorio: sin ello, Historial diria que antes no
  // habia nada. Si falla, no se publica.
  const anterior = await obtenerPublicado(pantalla, { lanzarSiFalla: true });
  const version = prepararVersion({
    pantalla,
    idBloque,
    accion: ACCIONES_DE_VERSION.publicar,
    contenido: publicacion.contenido,
    diseno: publicacion.diseno,
    usuario,
    // La misma hora que la publicacion: asi el panel reconoce cual esta en vivo.
    ahora: new Date(publicacion.publicadoEn),
  });

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: entidadDelBloque(pantalla, bloque),
    cambios: cambiosParaHistorial({
      idBloque,
      bloque,
      anterior,
      antes: enVivo(anterior, pantalla, idBloque),
      despues: publicacion,
      textoDespues: 'Publicado desde EXPLORA Designer',
    }),
    usuario,
    descripcion: `Publicó "${bloque.nombre}" en la pantalla ${pantalla} desde EXPLORA Designer.`,
    aplicar: () => escribirBloquePublicado(pantalla, idBloque, publicacion, version),
  });

  const avisados =
    avisar && idBloque === 'comunicados'
      ? await avisarComunicados({
          comunicados: comunicadosNuevos(
            enVivo(anterior, pantalla, idBloque)?.contenido,
            publicacion.contenido
          ),
          usuario,
        })
      : 0;

  return { ...publicacion, origen: ORIGEN_DEL_BLOQUE.designer, avisados };
}

/** Quita lo publicado de un bloque: vuelve a pintarse el del codigo. */
async function volverBloqueAlOriginalDirecto({ pantalla, idBloque, usuario }) {
  asegurarPuedePublicar(usuario);

  const bloque = bloquePorId(idBloque);

  if (!bloque || bloque.externo) {
    throw new Error(`"${idBloque}" no es un bloque que se publique desde el Designer.`);
  }

  const anterior = await obtenerPublicado(pantalla, { lanzarSiFalla: true });

  // Ya esta en su original: no hay nada que registrar en Historial.
  if (!anterior?.bloques?.[idBloque]) return;

  const version = prepararVersion({
    pantalla,
    idBloque,
    accion: ACCIONES_DE_VERSION.original,
    usuario,
  });

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: entidadDelBloque(pantalla, bloque),
    cambios: cambiosParaHistorial({
      idBloque,
      bloque,
      anterior,
      antes: enVivo(anterior, pantalla, idBloque),
      despues: { contenido: FABRICA_DE_PORTADA[idBloque], diseno: {} },
      textoDespues: 'Original del código',
    }),
    usuario,
    descripcion: `Devolvió "${bloque.nombre}" a su diseño original desde EXPLORA Designer.`,
    aplicar: () => quitarBloquePublicado(pantalla, idBloque, version),
  });
}

/**
 * Las versiones de un bloque, de la mas nueva a la mas vieja. Se buscan por una
 * sola igualdad (`clave`) y se ordenan aqui: ordenar en la consulta pediria un
 * indice compuesto que habria que crear a mano en la consola. Un bloque tiene
 * pocas versiones.
 *
 * LANZA si no se pudo leer: el panel tiene que decirlo, no enseñar "sin versiones".
 */
async function obtenerVersionesDeBloqueSinCache({ pantalla, idBloque, usuario }) {
  asegurarPuedePublicar(usuario);

  const resultado = await getDocs(
    query(
      collection(FIRESTORE, COLECCIONES_EXPLORA.versiones),
      where('clave', '==', claveDeVersion(pantalla, idBloque))
    )
  );

  return ordenarVersiones(
    resultado.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
  );
}

// ----------------------------------------------------------------------
// CAMPAÑAS (fases 7 y 8)
// ----------------------------------------------------------------------

const describirCampana = (campana) => {
  const { audiencia } = campana;
  const destino =
    audiencia.tipo === 'todos'
      ? 'toda la organización'
      : `${audiencia.tipo}: ${(audiencia.nombres?.length ? audiencia.nombres : audiencia.ids).join(', ')}`;

  return `${campana.nombre} · del ${campana.desde} al ${campana.hasta} · ${destino}`;
};

/**
 * Programa una campaña para un bloque. No cambia nada hasta su fecha de inicio;
 * desde ese dia manda sobre lo publicado, y al pasar su fecha de fin deja de
 * existir para la portada sola.
 *
 * `avisar` (solo comunicados): el aviso sale al programarla, a quien va dirigida.
 */
async function programarCampanaDirecto({
  pantalla,
  idBloque,
  nombre,
  desde,
  hasta,
  audiencia,
  contenido,
  diseno,
  usuario,
  avisar = false,
}) {
  asegurarPuedePublicar(usuario);

  // Lanza con un mensaje claro si algo no vale: no se programa a medias.
  const campana = prepararCampana({
    idBloque,
    nombre,
    desde,
    hasta,
    audiencia,
    contenido,
    diseno,
    usuario,
  });
  const bloque = bloquePorId(idBloque);
  const anterior = await obtenerPublicado(pantalla, { lanzarSiFalla: true });

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      ...entidadDelBloque(pantalla, bloque),
      id: `${pantalla}/${idBloque}/${campana.id}`,
      nombre: `EXPLORA Designer · ${bloque.nombre} · campaña ${campana.nombre}`,
    },
    cambios: [
      {
        campo: `campana_${campana.id}`,
        etiqueta: `${bloque.nombre} · campaña`,
        antes: '—',
        despues: describirCampana(campana),
      },
    ],
    usuario,
    descripcion: `Programó la campaña "${campana.nombre}" en "${bloque.nombre}" desde EXPLORA Designer.`,
    aplicar: () => escribirCampana(pantalla, campana),
  });

  const avisados =
    avisar && idBloque === 'comunicados'
      ? await avisarComunicados({
          comunicados: comunicadosNuevos(
            enVivo(anterior, pantalla, idBloque)?.contenido,
            campana.contenido
          ),
          audiencia: campana.audiencia,
          usuario,
        })
      : 0;

  return { ...campana, avisados };
}

/** Quita una campaña: su bloque vuelve a lo publicado o a lo de fabrica. */
async function quitarCampanaProgramadaDirecto({ pantalla, idCampana, usuario }) {
  asegurarPuedePublicar(usuario);

  const anterior = await obtenerPublicado(pantalla, { lanzarSiFalla: true });
  const campana = campanasDe(anterior).find((item) => item.id === idCampana);

  // Ya no esta: no hay nada que registrar.
  if (!campana && !anterior?.campanas?.[idCampana]) return;

  const bloque = bloquePorId(campana?.idBloque);

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      tipo: 'everest_campana',
      id: `${pantalla}/${idCampana}`,
      nombre: `EXPLORA Designer · campaña ${campana?.nombre ?? idCampana}`,
      ruta: bloque ? `${paths.dashboard.everest}?bloque=${bloque.id}` : paths.dashboard.everest,
    },
    cambios: [
      {
        campo: `campana_${idCampana}`,
        etiqueta: `${bloque?.nombre ?? 'Bloque'} · campaña`,
        antes: campana ? describirCampana(campana) : idCampana,
        despues: 'Quitada',
      },
    ],
    usuario,
    descripcion: `Quitó la campaña "${campana?.nombre ?? idCampana}" desde EXPLORA Designer.`,
    aplicar: () => quitarCampana(pantalla, idCampana),
  });
}

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const obtenerPublicado = conCache('everest:obtenerPublicado', obtenerPublicadoSinCache);
export const obtenerVersionesDeBloque = conCache('everest:obtenerVersionesDeBloque', obtenerVersionesDeBloqueSinCache);
export const publicarBloque = conInvalidacion(publicarBloqueDirecto, [], ['everest:']);
export const volverBloqueAlOriginal = conInvalidacion(volverBloqueAlOriginalDirecto, [], ['everest:']);
export const programarCampana = conInvalidacion(programarCampanaDirecto, [], ['everest:']);
export const quitarCampanaProgramada = conInvalidacion(quitarCampanaProgramadaDirecto, [], ['everest:']);
