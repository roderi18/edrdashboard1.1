'use client';

import { useState, useEffect } from 'react';

import { filterDestsByMemberScope, filterSectionalsByMemberScope } from 'src/utils/member-access';

import { getDestsApi } from 'src/services/dest-service';
import { getChurches } from 'src/services/church-service';
import { getSectionals } from 'src/services/sectional-service';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// ¿Esta entidad esta dentro de lo que ve?
//
// La lista ya muestra solo lo suyo, pero eso no impide llegar con el enlace
// pegado: la ficha de una seccion o un destacamento ajenos se abria escribiendo
// la URL. Aqui se hace la MISMA pregunta que hace la lista —los mismos filtros,
// no una regla paralela que se desincronice— antes de pintar nada.
//
// Devuelve 'resolviendo' mientras carga la estructura: pintar la ficha y
// quitarla despues seria enseñar justo lo que no se puede ver.
// ----------------------------------------------------------------------

export function useEntidadEnSuAlcance({ tipo, id }) {
  const { user } = useAuthContext();
  const [estado, setEstado] = useState('resolviendo');

  useEffect(() => {
    let cancelado = false;

    const resolver = async () => {
      if (!id) {
        if (!cancelado) setEstado('fuera');
        return;
      }

      const [dests, churches, sectionals] = await Promise.all([
        getDestsApi({ includePhotos: false }).catch(() => []),
        getChurches().catch(() => []),
        getSectionals({ includePhotos: false }).catch(() => []),
      ]);

      if (cancelado) return;

      const buscado = String(id).trim();
      const dentro =
        tipo === 'destacamento'
          ? filterDestsByMemberScope(dests, user, { churches, sectionals }).some((dest) =>
              [dest?.id, dest?.idDestacamento, dest?.destId]
                .map((valor) => String(valor ?? '').trim())
                .includes(buscado)
            )
          : filterSectionalsByMemberScope(sectionals, user, { dests, churches }).some((seccion) =>
              [seccion?.id, seccion?.idSeccion, seccion?.sectionalId]
                .map((valor) => String(valor ?? '').trim())
                .includes(buscado)
            );

      setEstado(dentro ? 'dentro' : 'fuera');
    };

    resolver();

    return () => {
      cancelado = true;
    };
  }, [tipo, id, user]);

  return estado;
}
