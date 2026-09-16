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
