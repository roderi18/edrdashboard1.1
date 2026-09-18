import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher } from 'src/lib/axios';

// ----------------------------------------------------------------------
// EL CATALOGO DEL BUSCADOR, UNA VEZ Y PARA TODA LA SESION.
//
// Son unos 600 nombres con sus miniaturas: pesa poco y filtrar en el navegador
// es instantaneo. Lo contrario —consultar al escribir— obligaba a esperar por
// cada pulsacion y a leer Firestore una vez por persona y por letra.
//
// Se pide la PRIMERA vez que alguien abre el buscador, no al cargar la pantalla:
// quien nunca busca no se lo descarga. Despues no se vuelve a pedir en toda la
// sesion, salvo que pasen cinco minutos y se vuelva a abrir.
// ----------------------------------------------------------------------

const ENDPOINT = '/api/buscador';

const VACIO = { productos: [], premios: [] };

export function useCatalogoDelBuscador(activo = false) {
  const { data, isLoading } = useSWR(activo ? ENDPOINT : null, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
    dedupingInterval: 5 * 60_000,
    keepPreviousData: true,
  });

  return useMemo(
    () => ({
      productos: data?.productos ?? VACIO.productos,
      premios: data?.premios ?? VACIO.premios,
      catalogoCargando: isLoading,
    }),
    [data, isLoading]
  );
}

// ----------------------------------------------------------------------
// MIEMBROS, DESTACAMENTOS, SECCIONES Y REGIONES.
//
// Mismo trato que el catalogo: se pide la primera vez que se abre el buscador y
// se filtra en memoria. Va con sesion (la ruta la exige), y contra este mismo
// servidor aunque Axios apunte a otro por defecto.
//
// Las fotos salen de `fotos` en Firestore, una consulta por tipo y en paralelo,
// tambien solo al abrir: son las mismas que pintan las listas, y quedan en su
// cache.
// ----------------------------------------------------------------------

const ORGANIZACION_VACIA = { miembros: [], destacamentos: [], secciones: [], regiones: [] };

const TIPOS_CON_FOTO = ['miembro', 'destacamento', 'seccion', 'region'];

const opcionesDeUnaVez = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  revalidateOnReconnect: false,
  dedupingInterval: 5 * 60_000,
  keepPreviousData: true,
};

const leerFotosDelBuscador = async () => {
  const { obtenerFotosPrincipalesPorEntidad } = await import('src/utils/firebase-photos');
  const porTipo = await Promise.all(
    TIPOS_CON_FOTO.map((tipoEntidad) =>
      obtenerFotosPrincipalesPorEntidad({ tipoEntidad }).catch(() => ({}))
    )
  );

  return Object.fromEntries(
    TIPOS_CON_FOTO.map((tipo, indice) => [
      tipo,
      Object.fromEntries(
        Object.entries(porTipo[indice] ?? {}).map(([id, foto]) => [id, foto?.urlFoto || ''])
      ),
    ])
  );
};

export function useOrganizacionDelBuscador(activo = false) {
  const { data } = useSWR(
    activo && typeof window !== 'undefined'
      ? ['/api/buscador/organizacion/', { baseURL: window.location.origin }]
      : null,
    fetcher,
    opcionesDeUnaVez
  );
  const { data: fotos } = useSWR(activo ? 'fotos-del-buscador' : null, leerFotosDelBuscador, {
    ...opcionesDeUnaVez,
  });

  return useMemo(
    () => ({
      ...ORGANIZACION_VACIA,
      ...(data ?? {}),
      fotos: fotos ?? {},
    }),
    [data, fotos]
  );
}
