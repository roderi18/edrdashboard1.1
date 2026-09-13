'use client';

import { useMemo, useState, useEffect } from 'react';

import { getChurches } from 'src/services/church-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import { getDests, getDestsApi } from 'src/services/dest-service';
import { resolverRolesPorAsignaciones } from 'src/catalogs/directiva-roles';
import { obtenerAsignacionesDirectivaMiembros } from 'src/services/directivas-organizacionales-service';

// ----------------------------------------------------------------------
// LO QUE NECESITAN LAS DOS PANTALLAS DE ADMINISTRADORES.
//
// `/dashboard/admin` y `/dashboard/admin/new` ensenan LAS MISMAS COLUMNAS, asi que
// necesitan los mismos datos: los catalogos para traducir el destacamento de una
// persona a su seccion y su region, y sus cargos para listarlos.
//
// Estaba duplicado —cada vista cargaba los destacamentos por su cuenta— y fue lo
// que dejo las dos tablas distintas: se cambiaba una y la otra seguia igual.
// ----------------------------------------------------------------------

/** Las columnas, una sola vez. Si se toca una tabla se tocan las dos. */
export const COLUMNAS_DE_ADMINISTRADORES = [
  { id: 'name', label: 'Nombre' },
  { id: 'nivelOrganizacional', label: 'Nivel organizacional' },
  { id: 'rolesOrganizacionales', label: 'Roles organizacionales' },
  { id: 'rol', label: 'Rol administrativo' },
  { id: '', width: 88 },
];

const texto = (valor) => String(valor ?? '').trim().toLowerCase();

/** Las llaves con las que una asignacion de directiva encuentra a su persona. */
const llavesDeAsignacion = (asignacion = {}) =>
  [asignacion?.idMiembro, asignacion?.idMiembros, asignacion?.codigoMiembro]
    .map(texto)
    .filter(Boolean);

const llavesDePersona = (persona = {}) =>
  [
    persona?.uid,
    persona?.idUsuario,
    persona?.adminId,
    persona?.idMiembros,
    persona?.memberId,
    persona?.id,
    persona?.memberCode,
    persona?.codigoMiembro,
    persona?.email,
    persona?.correo,
  ]
    .map(texto)
    .filter(Boolean);

export function useDatosDeAdministradores() {
  // Destacamentos: del almacenamiento si ya estan, y de la API si no.
  const [dests, setDests] = useState(() => getDests());
  const [catalogos, setCatalogos] = useState({ churches: [], sectionals: [], regionals: [] });
  // Los cargos de cada persona, sacados de sus casillas en las directivas.
  const [cargosPorPersona, setCargosPorPersona] = useState(() => new Map());

  useEffect(() => {
    if (dests.length) return undefined;

    let cancelado = false;

    getDestsApi({ includePhotos: false })
      .then((datos) => {
        if (!cancelado) setDests(Array.isArray(datos) ? datos : []);
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [dests.length]);

  useEffect(() => {
    let cancelado = false;

    // Los tres a la vez y sin bloquear la tabla: si uno falla, su columna sale
    // incompleta pero la lista se pinta igual.
    Promise.all([
      getChurches().catch(() => []),
      getSectionals({ includePhotos: false }).catch(() => []),
      getRegionals().catch(() => []),
    ]).then(([churches, sectionals, regionals]) => {
      if (cancelado) return;

      setCatalogos({
        churches: Array.isArray(churches) ? churches : [],
        sectionals: Array.isArray(sectionals) ? sectionals : [],
        regionals: Array.isArray(regionals) ? regionals : [],
      });
    });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    // LOS CARGOS SALEN DE LAS DIRECTIVAS, QUE ES DONDE SE PONEN.
    //
    // Antes se leian de `usuarios_roles`, donde la sincronizacion de la sesion
    // deja una COPIA. Esa copia no siempre existe: a la cuenta del selector de rol
    // no se le escribe nunca, y a quien no ha vuelto a entrar desde que le dieron
    // la casilla tampoco. La columna salia "-" para gente que si tiene cargo.
    //
    // Todas de una vez y agrupadas aqui: preguntarlo fila por fila eran tantas
    // consultas como personas en la tabla.
    obtenerAsignacionesDirectivaMiembros()
      .then((asignaciones) => {
        if (cancelado) return;

        const porPersona = new Map();

        (Array.isArray(asignaciones) ? asignaciones : []).forEach((asignacion) => {
          llavesDeAsignacion(asignacion).forEach((llave) => {
            if (!porPersona.has(llave)) porPersona.set(llave, []);

            porPersona.get(llave).push(asignacion);
          });
        });

        setCargosPorPersona(porPersona);
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Completa cada fila con los cargos que ejerce.
   *
   * La lista de miembros no los trae —viene de la API .NET, que no sabe de
   * cargos—, y la de administradores solo trae los que hubiera cacheado la
   * sesion. `resolverRolesPorAsignaciones` es la misma funcion con la que la
   * aplicacion decide que cargos ejerce alguien, asi que la columna ensena
   * exactamente lo que los guardas tienen en cuenta.
   */
  const conCargos = useMemo(
    () => (filas = []) =>
      filas.map((fila) => {
        const suyas = llavesDePersona(fila)
          .map((llave) => cargosPorPersona.get(llave))
          .find((encontradas) => Array.isArray(encontradas) && encontradas.length);

        if (!suyas) return fila;

        return { ...fila, cargos: resolverRolesPorAsignaciones(suyas) };
      }),
    [cargosPorPersona]
  );

  return { dests, catalogos, conCargos };
}
