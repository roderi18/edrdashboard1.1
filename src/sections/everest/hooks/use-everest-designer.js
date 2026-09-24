import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import { useRouter, usePathname, useSearchParams } from 'src/routes/hooks';

import { campanasDe } from 'src/utils/everest/campanas.mjs';
import { PANTALLAS_EXPLORA } from 'src/utils/everest/colecciones.mjs';
import { publicacionDeVersion } from 'src/utils/everest/versiones.mjs';
import { bloquePorId, BLOQUES_DEL_DESIGNER } from 'src/utils/everest/bloques.mjs';
import { destinoDeVuelta, estadosDeLosBloques } from 'src/utils/everest/estado-del-bloque.mjs';

import { obtenerAnaliticasDePortada } from 'src/services/everest-analiticas-service';
import {
  obtenerBorradores,
  guardarBorradorDeBloque,
  descartarBorradorDeBloque,
} from 'src/services/everest-borradores-service';
import {
  publicarBloque,
  obtenerPublicado,
  programarCampana,
  volverBloqueAlOriginal,
  quitarCampanaProgramada,
  obtenerVersionesDeBloque,
} from 'src/services/everest-service';

import { FABRICA_DE_PORTADA } from 'src/sections/principal/fabrica-de-portada';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// TODO LO QUE SABE Y HACE LA PANTALLA DEL DESIGNER.
//
// Lee lo publicado y los borradores, recuerda que bloque esta abierto —en la
// direccion, para que un lapiz pueda llevar directo a el— y ofrece las acciones:
// publicar, descartar el borrador y volver al original.
//
// Y ofrece `cambiarContenido` y `cambiarDiseno`, la entrada de los editores de
// cada bloque. Lo que llega por ahi se ve AL MOMENTO en la vista previa y se
// guarda solo como borrador poco despues de dejar de escribir: guardar en cada
// tecla gastaria una escritura por letra, y esperar al boton haria perder lo
// escrito al cerrar. Contenido y diseño viajan siempre JUNTOS: un borrador es la
// pareja entera, para que publicar nunca mezcle el diseño de un momento con el
// contenido de otro.
//
// Y las versiones del bloque abierto (fase 5). Volver a una version NO la publica:
// la abre como borrador, se ve en la vista previa y se publica como cualquier
// otro cambio. Asi nada llega a la portada sin haberlo visto antes.
//
// Y las campañas (fases 7 y 8) y lo contado en la portada (fase 8).
// ----------------------------------------------------------------------

const PANTALLA = PANTALLAS_EXPLORA.principal;

export const ESPERA_AUTOGUARDADO_MS = 1500;

const PRIMER_BLOQUE = BLOQUES_DEL_DESIGNER[0].id;

/** Una copia del mapa sin ese bloque. */
const sinBloque = (mapa, idBloque) =>
  Object.fromEntries(Object.entries(mapa).filter(([clave]) => clave !== idBloque));

export function useEverestDesigner() {
  const { user } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [publicado, setPublicado] = useState(null);
  const [borradores, setBorradores] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  // Lo que se esta escribiendo y todavia no se guardo, por bloque: `{ contenido, diseno }`.
  const [ediciones, setEdiciones] = useState({});
  const [guardando, setGuardando] = useState({});
  const [accion, setAccion] = useState('');
  // Versiones del bloque abierto: `{ idBloque, lista, cargando, error }`.
  const [versiones, setVersiones] = useState({
    idBloque: null,
    lista: [],
    cargando: false,
    error: null,
  });
  const [analiticas, setAnaliticas] = useState({ bloques: {}, campanas: {} });

  const temporizadores = useRef({});
  const pendientes = useRef({});

  const idEnDireccion = searchParams.get('bloque');
  const idSeleccionado = bloquePorId(idEnDireccion) ? idEnDireccion : PRIMER_BLOQUE;
  const volver = destinoDeVuelta(searchParams.get('volver'));

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const [nuevoPublicado, nuevosBorradores, nuevasAnaliticas] = await Promise.all([
        obtenerPublicado(PANTALLA, { lanzarSiFalla: true }),
        obtenerBorradores(PANTALLA),
        obtenerAnaliticasDePortada(PANTALLA),
      ]);

      setPublicado(nuevoPublicado);
      setBorradores(nuevosBorradores);
      setAnaliticas(nuevasAnaliticas);
    } catch (causa) {
      console.error('[everest] no se pudo leer la portada', causa);
      setError(causa);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const recargarVersiones = useCallback(
    async (idBloque) => {
      setVersiones((actual) => ({
        idBloque,
        // Mientras carga se sigue viendo la lista de ese mismo bloque, no la de otro.
        lista: actual.idBloque === idBloque ? actual.lista : [],
        cargando: true,
        error: null,
      }));

      try {
        const lista = await obtenerVersionesDeBloque({
          pantalla: PANTALLA,
          idBloque,
          usuario: user,
        });

        setVersiones((actual) =>
          actual.idBloque === idBloque ? { idBloque, lista, cargando: false, error: null } : actual
        );
      } catch (causa) {
        console.error('[everest] no se pudieron leer las versiones', causa);
        setVersiones((actual) =>
          actual.idBloque === idBloque ? { ...actual, cargando: false, error: causa } : actual
        );
      }
    },
    [user]
  );

  useEffect(() => {
    if (!bloquePorId(idSeleccionado)?.externo) recargarVersiones(idSeleccionado);
  }, [idSeleccionado, recargarVersiones]);

  // LO QUE SE VE: los borradores guardados MAS lo que se esta escribiendo.
  const borradoresEnPantalla = useMemo(() => {
    if (!Object.keys(ediciones).length) return borradores;

    const ahora = new Date().toISOString();

    return {
      ...(borradores ?? {}),
      bloques: {
        ...(borradores?.bloques ?? {}),
        ...Object.fromEntries(
          Object.entries(ediciones).map(([idBloque, pareja]) => [
            idBloque,
            { ...(borradores?.bloques?.[idBloque] ?? {}), ...pareja, guardadoEn: ahora },
          ])
        ),
      },
    };
  }, [borradores, ediciones]);

  const estados = useMemo(
    () =>
      estadosDeLosBloques({
        publicado,
        borradores: borradoresEnPantalla,
        fabrica: FABRICA_DE_PORTADA,
      }),
    [publicado, borradoresEnPantalla]
  );

  // El ultimo estado, para leerlo dentro de las acciones sin rehacerlas en cada tecla.
  const estadosRef = useRef(estados);

  estadosRef.current = estados;

  /** Lo que se esta editando de un bloque: el borrador si hay, o lo que esta en vivo. */
  const parejaActual = useCallback((idBloque) => {
    const estado = estadosRef.current.find((item) => item.idBloque === idBloque);

    return {
      contenido: estado?.borrador?.contenido ?? estado?.enVivo?.contenido,
      diseno: estado?.borrador ? estado.borrador.diseno : (estado?.enVivo?.diseno ?? {}),
    };
  }, []);

  const campanas = useMemo(() => campanasDe(publicado), [publicado]);

  const seleccionar = useCallback(
    (idBloque) => {
      const parametros = new URLSearchParams(searchParams.toString());

      parametros.set('bloque', idBloque);
      router.replace(`${pathname}?${parametros.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const guardarYa = useCallback(
    async (idBloque) => {
      clearTimeout(temporizadores.current[idBloque]);

      if (!(idBloque in pendientes.current)) return;

      const pareja = pendientes.current[idBloque];

      delete pendientes.current[idBloque];
      setGuardando((actual) => ({ ...actual, [idBloque]: true }));

      try {
        const guardadoEn = await guardarBorradorDeBloque({
          pantalla: PANTALLA,
          idBloque,
          contenido: pareja.contenido,
          diseno: pareja.diseno,
          usuario: user,
        });

        setBorradores((actual) => ({
          ...(actual ?? {}),
          bloques: {
            ...(actual?.bloques ?? {}),
            [idBloque]: { ...(actual?.bloques?.[idBloque] ?? {}), ...pareja, guardadoEn },
          },
        }));
        // Si mientras tanto se siguio escribiendo, lo nuevo se queda en `ediciones`.
        setEdiciones((actual) => {
          if (actual[idBloque] !== pareja) return actual;

          return sinBloque(actual, idBloque);
        });
      } catch (causa) {
        console.error('[everest] no se pudo guardar el borrador', causa);
        // Se devuelve a pendientes para no perderlo: el siguiente cambio lo reintenta.
        if (!(idBloque in pendientes.current)) pendientes.current[idBloque] = pareja;
        setError(causa);
      } finally {
        setGuardando((actual) => ({ ...actual, [idBloque]: false }));
      }
    },
    [user]
  );

  /** Anota la pareja nueva: se ve al momento, se guarda al dejar de escribir. */
  const anotar = useCallback(
    (idBloque, pareja) => {
      setEdiciones((actual) => ({ ...actual, [idBloque]: pareja }));
      pendientes.current[idBloque] = pareja;
      clearTimeout(temporizadores.current[idBloque]);
      temporizadores.current[idBloque] = setTimeout(
        () => guardarYa(idBloque),
        ESPERA_AUTOGUARDADO_MS
      );
    },
    [guardarYa]
  );

  /** La entrada de los editores de contenido. */
  const cambiarContenido = useCallback(
    (idBloque, contenido) => {
      const actual = pendientes.current[idBloque] ?? parejaActual(idBloque);

      anotar(idBloque, { contenido, diseno: actual.diseno ?? {} });
    },
    [anotar, parejaActual]
  );

  /** La entrada del editor de diseño. */
  const cambiarDiseno = useCallback(
    (idBloque, diseno) => {
      const actual = pendientes.current[idBloque] ?? parejaActual(idBloque);

      anotar(idBloque, { contenido: actual.contenido, diseno });
    },
    [anotar, parejaActual]
  );

  // Al salir de la pantalla con algo a medio guardar, se guarda sin esperar.
  useEffect(
    () => () => {
      Object.keys(pendientes.current).forEach((idBloque) => guardarYa(idBloque));
    },
    [guardarYa]
  );

  const ejecutar = useCallback(
    async (nombre, tarea) => {
      setAccion(nombre);

      try {
        const resultado = await tarea();

        await recargar();
        await recargarVersiones(idSeleccionado);

        return resultado;
      } finally {
        setAccion('');
      }
    },
    [recargar, recargarVersiones, idSeleccionado]
  );

  /** El borrador guardado y valido de un bloque, o un error claro. */
  const borradorParaPublicar = useCallback(
    async (idBloque) => {
      await guardarYa(idBloque);

      const estado = estadosRef.current.find((item) => item.idBloque === idBloque);

      if (!estado?.borrador?.valido) {
        throw new Error('El borrador todavía tiene datos que no se pueden publicar.');
      }

      return estado.borrador;
    },
    [guardarYa]
  );

  /** `avisar` (comunicados): manda a la campana los comunicados nuevos. */
  const publicar = useCallback(
    (idBloque, { avisar = false } = {}) =>
      ejecutar('publicar', async () => {
        const borrador = await borradorParaPublicar(idBloque);

        const resultado = await publicarBloque({
          pantalla: PANTALLA,
          idBloque,
          contenido: borrador.contenido,
          diseno: borrador.diseno,
          usuario: user,
          avisar,
        });
        // Publicado lo que habia en el borrador: el borrador ya no hace falta.
        await descartarBorradorDeBloque({ pantalla: PANTALLA, idBloque, usuario: user });
        setEdiciones((actual) => sinBloque(actual, idBloque));

        return resultado;
      }),
    [borradorParaPublicar, ejecutar, user]
  );

  const descartarBorrador = useCallback(
    (idBloque) =>
      ejecutar('descartar', async () => {
        clearTimeout(temporizadores.current[idBloque]);
        delete pendientes.current[idBloque];
        setEdiciones((actual) => sinBloque(actual, idBloque));
        await descartarBorradorDeBloque({ pantalla: PANTALLA, idBloque, usuario: user });
      }),
    [ejecutar, user]
  );

  const volverAlOriginal = useCallback(
    (idBloque) =>
      ejecutar('original', () =>
        volverBloqueAlOriginal({ pantalla: PANTALLA, idBloque, usuario: user })
      ),
    [ejecutar, user]
  );

  /** Abre una version como borrador del bloque. No publica nada. */
  const abrirVersion = useCallback(
    (idBloque, version) => {
      const pareja = publicacionDeVersion(version);

      if (pareja === null) {
        throw new Error('Esta versión ya no se puede abrir: no cuadra con el bloque de hoy.');
      }

      anotar(idBloque, pareja);
    },
    [anotar]
  );

  /**
   * Programa como campaña lo que se esta editando (el borrador valido) o, sin
   * borrador, lo que esta en vivo. `datos`: `{ nombre, desde, hasta, audiencia, avisar }`.
   * El borrador NO se descarta: la campaña es aparte de lo publicado.
   */
  const programar = useCallback(
    (idBloque, datos) =>
      ejecutar('campana', async () => {
        const estado = estadosRef.current.find((item) => item.idBloque === idBloque);
        const pareja = estado?.borrador
          ? await borradorParaPublicar(idBloque)
          : { contenido: estado?.enVivo?.contenido, diseno: estado?.enVivo?.diseno };

        return programarCampana({
          pantalla: PANTALLA,
          idBloque,
          ...datos,
          contenido: pareja.contenido,
          diseno: pareja.diseno,
          usuario: user,
        });
      }),
    [borradorParaPublicar, ejecutar, user]
  );

  const quitarCampana = useCallback(
    (idCampana) =>
      ejecutar('quitar-campana', () =>
        quitarCampanaProgramada({ pantalla: PANTALLA, idCampana, usuario: user })
      ),
    [ejecutar, user]
  );

  /** Abre una campaña como borrador de su bloque, para reutilizarla. */
  const abrirCampana = useCallback(
    (campana) => {
      anotar(campana.idBloque, { contenido: campana.contenido, diseno: campana.diseno });
      seleccionar(campana.idBloque);
    },
    [anotar, seleccionar]
  );

  const estadoSeleccionado = estados.find((item) => item.idBloque === idSeleccionado) ?? null;

  return {
    cargando,
    error,
    estados,
    estadoSeleccionado,
    idSeleccionado,
    volver,
    guardando,
    accion,
    seleccionar,
    recargar,
    cambiarContenido,
    cambiarDiseno,
    publicar,
    descartarBorrador,
    volverAlOriginal,
    versiones:
      versiones.idBloque === idSeleccionado
        ? versiones
        : { lista: [], cargando: true, error: null },
    recargarVersiones: () => recargarVersiones(idSeleccionado),
    abrirVersion,
    campanas,
    campanasDelBloque: campanas.filter((campana) => campana.idBloque === idSeleccionado),
    programar,
    quitarCampana,
    abrirCampana,
    analiticas,
  };
}
