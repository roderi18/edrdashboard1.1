import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import { useRouter, usePathname, useSearchParams } from 'src/routes/hooks';

import { PANTALLAS_EVEREST } from 'src/utils/everest/colecciones.mjs';
import { bloquePorId, BLOQUES_EVEREST } from 'src/utils/everest/bloques.mjs';
import { destinoDeVuelta, estadosDeLosBloques } from 'src/utils/everest/estado-del-bloque.mjs';

import {
  publicarBloque,
  obtenerPublicado,
  volverBloqueAlOriginal,
} from 'src/services/everest-service';
import {
  obtenerBorradores,
  guardarBorradorDeBloque,
  descartarBorradorDeBloque,
} from 'src/services/everest-borradores-service';

import { FABRICA_DE_PORTADA } from 'src/sections/principal/fabrica-de-portada';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// TODO LO QUE SABE Y HACE LA PANTALLA DEL DESIGNER.
//
// Lee lo publicado y los borradores, recuerda que bloque esta abierto —en la
// direccion, para que un lapiz pueda llevar directo a el— y ofrece las acciones:
// publicar, descartar el borrador y volver al original.
//
// Y ofrece `cambiarContenido`, la entrada de los editores de cada bloque. Lo que
// llega por ahi se ve AL MOMENTO en la vista previa y se guarda solo como
// borrador poco despues de dejar de escribir: guardar en cada tecla gastaria una
// escritura por letra, y esperar al boton haria perder lo escrito al cerrar.
// ----------------------------------------------------------------------

const PANTALLA = PANTALLAS_EVEREST.principal;

export const ESPERA_AUTOGUARDADO_MS = 1500;

const PRIMER_BLOQUE = BLOQUES_EVEREST[0].id;

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
  // Lo que se esta escribiendo y todavia no se guardo, por bloque.
  const [ediciones, setEdiciones] = useState({});
  const [guardando, setGuardando] = useState({});
  const [accion, setAccion] = useState('');

  const temporizadores = useRef({});
  const pendientes = useRef({});

  const idEnDireccion = searchParams.get('bloque');
  const idSeleccionado = bloquePorId(idEnDireccion) ? idEnDireccion : PRIMER_BLOQUE;
  const volver = destinoDeVuelta(searchParams.get('volver'));

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const [nuevoPublicado, nuevosBorradores] = await Promise.all([
        obtenerPublicado(PANTALLA, { lanzarSiFalla: true }),
        obtenerBorradores(PANTALLA),
      ]);

      setPublicado(nuevoPublicado);
      setBorradores(nuevosBorradores);
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

  // LO QUE SE VE: los borradores guardados MAS lo que se esta escribiendo.
  const borradoresEnPantalla = useMemo(() => {
    if (!Object.keys(ediciones).length) return borradores;

    const ahora = new Date().toISOString();

    return {
      ...(borradores ?? {}),
      bloques: {
        ...(borradores?.bloques ?? {}),
        ...Object.fromEntries(
          Object.entries(ediciones).map(([idBloque, contenido]) => [
            idBloque,
            { ...(borradores?.bloques?.[idBloque] ?? {}), contenido, guardadoEn: ahora },
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

      const contenido = pendientes.current[idBloque];

      delete pendientes.current[idBloque];
      setGuardando((actual) => ({ ...actual, [idBloque]: true }));

      try {
        const guardadoEn = await guardarBorradorDeBloque({
          pantalla: PANTALLA,
          idBloque,
          contenido,
          usuario: user,
        });

        setBorradores((actual) => ({
          ...(actual ?? {}),
          bloques: {
            ...(actual?.bloques ?? {}),
            [idBloque]: { ...(actual?.bloques?.[idBloque] ?? {}), contenido, guardadoEn },
          },
        }));
        // Si mientras tanto se siguio escribiendo, lo nuevo se queda en `ediciones`.
        setEdiciones((actual) => {
          if (actual[idBloque] !== contenido) return actual;

          return sinBloque(actual, idBloque);
        });
      } catch (causa) {
        console.error('[everest] no se pudo guardar el borrador', causa);
        // Se devuelve a pendientes para no perderlo: el siguiente cambio lo reintenta.
        if (!(idBloque in pendientes.current)) pendientes.current[idBloque] = contenido;
        setError(causa);
      } finally {
        setGuardando((actual) => ({ ...actual, [idBloque]: false }));
      }
    },
    [user]
  );

  /** La entrada de los editores: se ve al momento, se guarda al dejar de escribir. */
  const cambiarContenido = useCallback(
    (idBloque, contenido) => {
      setEdiciones((actual) => ({ ...actual, [idBloque]: contenido }));
      pendientes.current[idBloque] = contenido;
      clearTimeout(temporizadores.current[idBloque]);
      temporizadores.current[idBloque] = setTimeout(
        () => guardarYa(idBloque),
        ESPERA_AUTOGUARDADO_MS
      );
    },
    [guardarYa]
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
        await tarea();
        await recargar();
      } finally {
        setAccion('');
      }
    },
    [recargar]
  );

  const publicar = useCallback(
    (idBloque) =>
      ejecutar('publicar', async () => {
        await guardarYa(idBloque);

        const estado = estados.find((item) => item.idBloque === idBloque);

        if (!estado?.borrador?.valido) {
          throw new Error('El borrador todavía tiene datos que no se pueden publicar.');
        }

        await publicarBloque({
          pantalla: PANTALLA,
          idBloque,
          contenido: estado.borrador.contenido,
          usuario: user,
        });
        // Publicado lo que habia en el borrador: el borrador ya no hace falta.
        await descartarBorradorDeBloque({ pantalla: PANTALLA, idBloque, usuario: user });
        setEdiciones((actual) => sinBloque(actual, idBloque));
      }),
    [ejecutar, estados, guardarYa, user]
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

  return {
    cargando,
    error,
    estados,
    estadoSeleccionado: estados.find((item) => item.idBloque === idSeleccionado) ?? null,
    idSeleccionado,
    volver,
    guardando,
    accion,
    seleccionar,
    recargar,
    cambiarContenido,
    publicar,
    descartarBorrador,
    volverAlOriginal,
  };
}
