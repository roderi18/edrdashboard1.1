import { useState, useEffect } from 'react';

import { getDestsApi } from 'src/services/dest-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import { DIRECTIVA_LEVELS } from 'src/catalogs/directiva-positions';

// ----------------------------------------------------------------------
// Los cargos del usuario, listos para mostrar: "Coordinador Asistente de
// Destacamento Tribu de Judá 18".
//
// El cargo guardado solo trae el id de su entidad, asi que el nombre se resuelve
// aqui contra los listados —que ya vienen cacheados de otras pantallas— y una
// sola vez por sesion.
// ----------------------------------------------------------------------

const nombreDeDestacamento = (dest) =>
  `${dest?.name ?? dest?.nombre ?? ''} ${dest?.destNumber ?? dest?.numero ?? ''}`.trim();

const mismoId = (entidad, id) =>
  [entidad?.id, entidad?.idDestacamento, entidad?.idSeccion, entidad?.idRegion, entidad?.regionId]
    .filter((valor) => valor !== undefined && valor !== null && valor !== '')
    .some((valor) => String(valor) === String(id));

export function useCargosDelUsuario(user) {
  const cargos = user?.cargos;
  const [conNombre, setConNombre] = useState([]);

  useEffect(() => {
    if (!Array.isArray(cargos) || !cargos.length) {
      setConNombre([]);
      return undefined;
    }

    let activo = true;

    const resolver = async () => {
      const necesita = (nivel) => cargos.some((cargo) => cargo.nivel === nivel && !cargo.nombreEntidad);

      const [dests, secciones, regiones] = await Promise.all([
        necesita(DIRECTIVA_LEVELS.destacamento)
          ? getDestsApi({ includePhotos: false }).catch(() => [])
          : [],
        necesita(DIRECTIVA_LEVELS.seccional)
          ? getSectionals({ includePhotos: false }).catch(() => [])
          : [],
        necesita(DIRECTIVA_LEVELS.regional)
          ? getRegionals({ includePhotos: false }).catch(() => [])
          : [],
      ]);

      if (!activo) return;

      setConNombre(
        cargos.map((cargo) => {
          if (cargo.nombreEntidad) return cargo;

          const listado =
            {
              [DIRECTIVA_LEVELS.destacamento]: dests,
              [DIRECTIVA_LEVELS.seccional]: secciones,
              [DIRECTIVA_LEVELS.regional]: regiones,
            }[cargo.nivel] ?? [];
          const entidad = (Array.isArray(listado) ? listado : []).find((candidata) =>
            mismoId(candidata, cargo.idEntidad)
          );

          const nombre =
            cargo.nivel === DIRECTIVA_LEVELS.destacamento
              ? nombreDeDestacamento(entidad)
              : entidad?.sectionalName ?? entidad?.regionalName ?? entidad?.name ?? entidad?.nombre ?? '';

          return { ...cargo, nombreEntidad: String(nombre || '').trim() };
        })
      );
    };

    resolver();

    return () => {
      activo = false;
    };
  }, [cargos]);

  return conNombre.length ? conNombre : (cargos ?? []);
}

/** "Coordinador Asistente de Destacamento Tribu de Judá 18" */
export const etiquetaDeCargo = (cargo) =>
  [cargo?.nombreCargo, cargo?.nombreDivision ? `(${cargo.nombreDivision})` : '', cargo?.nombreEntidad]
    .filter(Boolean)
    .join(' ')
    .trim();
