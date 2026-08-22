'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { buildOrgIndex, buildLeadershipMemberOptions } from 'src/utils/leadership-member-options';
import {
  buscarPosicionPorNodo,
  normalizarIdAsignacion,
  construirResumenMiembro,
  resolverMiembroAsignado,
  indexarAsignacionesPorPosicion,
} from 'src/utils/leadership-assignments';

import { getDestsApi } from 'src/services/dest-service';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import {
  guardarAsignacionDirectiva,
  obtenerAsignacionesDirectiva,
  desactivarAsignacionesDirectivaPorNivel,
} from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// Asignacion de miembros en las Directivas de SECCION, REGION y NACION.
//
// El organigrama del destacamento tiene su propia coleccion; los demas niveles se
// apoyan en `asignacionesDirectiva`, que ya es generica por nivel + entidad. Cada
// nodo del diagrama se casa con una posicion del catalogo por `idNodoDiagrama`,
// que es lo que da el `idPosicionDirectiva` con el que se guarda.
//
// FIRESTORE ES LA UNICA FUENTE. `asignacionesDirectiva` es lo que leen las TRES
// pantallas que hablan de cargos: este organigrama, la ficha del miembro y la
// columna "Posicion" de la lista. Escribir aqui basta para que las tres digan lo
// mismo.
//
// Hubo una epoca en que cada cambio se replicaba ademas en `CargosMiembros` (la
// API .NET) porque la ficha leia de alli. Eran dos escrituras sin transaccion
// sobre un endpoint con clave compuesta que ni comprueba duplicados, y bastaba
// que una fallara — o que a alguien se le olvidara un caso, como el ocupante
// desplazado — para que la ficha y el organigrama mostraran cosas distintas. Ya
// nadie lee esa API para cargos, asi que la segunda escritura desaparecio.
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// AQUI SE CAMBIA EL TIEMPO DE LA ESPERA DE "Asignando...".
//
// Espera deliberada entre el clic en "Asignar" y el pintado de la casilla. NO es
// tiempo de trabajo: la escritura viaja por detras y el organigrama podria
// cambiar en el mismo frame del clic — tan rapido que la accion se quedaba sin
// acuse de recibo y no daba la sensacion de haber hecho nada. Estos
// milisegundos, con la barra "Asignando..." del dialogo, son ese acuse.
//
// Solo aplica al ASIGNAR. Remover sigue siendo inmediato.
//
// Rige los CUATRO organigramas: nacion, region y seccion por este hook, y el del
// destacamento importando esta misma constante. Cambiar el numero de abajo los
// cambia todos.
// ----------------------------------------------------------------------
export const RETARDO_ASIGNACION_MS = 600;

const esperar = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const findPositionByNode = (nivel, nodeId) =>
  buscarPosicionPorNodo(DIRECTIVA_POSITIONS, nivel, nodeId);

export function useLeadershipAssignments({
  nivel,
  idEntidad,
  nombreEntidad = '',
  canManage = true,
}) {
  // Quien actua. Sin esto, la puerta de cambios no sabia que quien remueve es el
  // Administrador Global, dejaba el cambio PENDIENTE de aprobacion y la casilla
  // volvia a su estado anterior: se anunciaba "removido" y reaparecia la persona.
  const { user } = useAuthContext();
  const [members, setMembers] = useState([]);
  const [orgIndex, setOrgIndex] = useState(() => buildOrgIndex({}));
  // Asignaciones activas de esta directiva, indexadas por idPosicionDirectiva.
  const [assignments, setAssignments] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [nodoARemover, setNodoARemover] = useState(null);
  // Solo esta en alto durante la espera de `RETARDO_ASIGNACION_MS`, no mientras
  // se escribe: la escritura va por detras y no bloquea la interfaz.
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [memberRows, dests, churches, sectionals, regionals, fotos] = await Promise.all([
        getMembers().catch(() => []),
        getDestsApi({ includePhotos: false }).catch(() => []),
        getChurches().catch(() => []),
        getSectionals({ includePhotos: false }).catch(() => []),
        getRegionals().catch(() => []),
        // Las fotos viven en Firebase, no en la lista que devuelve la API: sin
        // pedirlas aparte, toda persona salia con el avatar generico.
        obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' }).catch(() => ({})),
      ]);

      if (cancelled) return;

      setMembers(
        (Array.isArray(memberRows) ? memberRows : []).map((member) => ({
          ...member,
          avatarUrl: fotos[String(member?.id)]?.urlFoto || member?.avatarUrl || '',
        }))
      );
      setOrgIndex(buildOrgIndex({ dests, churches, sectionals, regionals }));
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadAssignments = useCallback(async () => {
    if (!idEntidad && nivel !== 'nacional') return;

    const rows = await obtenerAsignacionesDirectiva({ nivel, idEntidad }).catch(() => []);

    setAssignments(indexarAsignacionesPorPosicion(rows));
  }, [nivel, idEntidad]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Miembro que ocupa el nodo del diagrama, o null.
  const getAssignedMember = useCallback(
    (nodeId) => {
      const position = findPositionByNode(nivel, nodeId);
      const asignacion = position
        ? assignments[normalizarIdAsignacion(position.idCargo)]
        : null;

      return resolverMiembroAsignado({ asignacion, members });
    },
    [assignments, members, nivel]
  );

  // Cargo que ya ocupa cada miembro dentro de ESTA directiva, para deshabilitarlo
  // en el desplegable.
  const ocupantesPorMiembro = useMemo(() => {
    const porMiembro = new Map();

    Object.values(assignments).forEach((asignacion) => {
      if (!asignacion?.idMiembro) return;

      const position = DIRECTIVA_POSITIONS.find(
        (item) =>
          normalizarIdAsignacion(item.idCargo) ===
          normalizarIdAsignacion(asignacion.idPosicionDirectiva)
      );

      porMiembro.set(
        normalizarIdAsignacion(asignacion.idMiembro),
        position?.nombreCargo || 'un cargo de esta directiva'
      );
    });

    return porMiembro;
  }, [assignments]);

  // Memoizado a proposito: sin esto las opciones se recreaban en cada render y el
  // Autocomplete perdia la seleccion recien hecha.
  const memberOptions = useMemo(() => {
    const asignado = selectedNode ? getAssignedMember(selectedNode.id) : null;

    return buildLeadershipMemberOptions({
      members,
      nivel,
      idEntidad,
      index: orgIndex,
      ocupantesPorMiembro,
      idMiembroActual: normalizarIdAsignacion(asignado?.id ?? asignado?.idMiembros) || null,
    });
  }, [members, nivel, idEntidad, orgIndex, ocupantesPorMiembro, selectedNode, getAssignedMember]);

  const openAssign = useCallback(
    (node) => {
      if (!canManage) return;

      setSelectedNode(node);
      setSelectedMember(getAssignedMember(node?.id) || null);
    },
    [canManage, getAssignedMember]
  );

  const closeAssign = useCallback(() => {
    // Durante la espera de "Asignando..." el dialogo no se cierra: son 400 ms y
    // cerrarlo a medias dejaria la barra huerfana.
    if (isSaving) return;

    setSelectedNode(null);
    setSelectedMember(null);
  }, [isSaving]);

  // El nodo llega por parametro y no desde `selectedNode`: al remover se actua
  // sobre un nodo distinto del que tenga abierto el dialogo, y leerlo del estado
  // daria el valor anterior al render.
  const guardar = useCallback(
    async ({ node, idMiembro, miembro, activo }) => {
      // La comprobacion de verdad esta en firestore.rules; esta solo evita
      // lanzar una escritura que el servidor va a rechazar.
      if (!canManage) {
        toast.error('Solo el administrador global puede modificar la directiva.');
        return false;
      }

      const position = findPositionByNode(nivel, node?.id);

      if (!position) {
        toast.error('Este nodo no está en el catálogo de cargos.');
        return false;
      }

      const clavePosicion = normalizarIdAsignacion(position.idCargo);
      // Estado al que se vuelve si la escritura acaba fallando.
      const asignacionesPrevias = assignments;

      // Espera de cortesia con la barra "Asignando...". Ver RETARDO_ASIGNACION_MS
      // arriba, que es donde se cambia el tiempo. Remover no la lleva: retirar a
      // alguien no necesita que se note el esfuerzo.
      if (activo && idMiembro) {
        setIsSaving(true);
        await esperar(RETARDO_ASIGNACION_MS);
        setIsSaving(false);
      }

      // PINTADO OPTIMISTA. Pasada la espera, la casilla cambia sin aguardar a
      // Firestore ni a la API: el organigrama se redibuja y la escritura viaja
      // por detras. Si falla se revierte y se avisa, mas abajo.
      setAssignments((previas) => {
        const siguientes = { ...previas };

        if (activo && idMiembro) {
          siguientes[clavePosicion] = {
            idPosicionDirectiva: position.idCargo,
            idMiembro: normalizarIdAsignacion(idMiembro),
            idCargo: Number(position.idCargoApi) || null,
            nivel,
            idEntidad,
            division: position.division ?? null,
            orden: position.orden || 1,
            activo: true,
            // Numero, no Timestamp: `aMilisegundos` lo entiende igual y evita
            // depender de Firestore para una entrada que aun no se ha escrito.
            fechaActualizacion: Date.now(),
            ...construirResumenMiembro(miembro || {}),
          };
        } else {
          delete siguientes[clavePosicion];
        }

        return siguientes;
      });

      setSelectedNode(null);
      setSelectedMember(null);

      (async () => {
        try {
          const asignacionGuardada = await guardarAsignacionDirectiva({
            usuario: user,
            nivel,
            idEntidad,
            nombreEntidad,
            idCargo: Number(position.idCargoApi) || null,
            idMiembro,
            idPosicionDirectiva: position.idCargo,
            division: position.division ?? null,
            orden: position.orden || 1,
            origen: 'organigrama-directiva',
            activo,
            ...construirResumenMiembro(miembro || {}),
          });

          // Un miembro ocupa UNA posicion por nivel. El formulario de miembro ya
          // lo aplicaba; el organigrama no, y asignar desde el diagrama dejaba a
          // la persona con cargos activos en dos secciones a la vez.
          if (activo && idMiembro) {
            await desactivarAsignacionesDirectivaPorNivel({
              idMiembro,
              nivel,
              conservarIdAsignacion: asignacionGuardada?.idAsignacion || '',
            }).catch(() => 0);
          }

          // Ya no hay espejo en la API .NET: la ficha del miembro y la lista leen
          // estas mismas asignaciones, asi que escribir aqui es suficiente para
          // que las tres pantallas digan lo mismo.

          // Pendiente de aprobacion: no se ha escrito nada todavia. Se dice y se
          // vuelve a lo que hay, en vez de dejar la casilla pintada como si ya
          // estuviera hecho.
          if (asignacionGuardada?.pendienteDeAprobacion) {
            toast.info('Cambio enviado a la Oficina Nacional. Se aplicará cuando lo apruebe.');
          }

          // Reconcilia el pintado optimista con lo que quedo escrito de verdad.
          await loadAssignments();
        } catch (error) {
          console.error('[directiva] no se pudo guardar la asignación', error);

          // Se deshace el cambio y se relee el servidor, que es la version
          // buena: la instantanea local podria haberse quedado atras.
          setAssignments(asignacionesPrevias);
          loadAssignments().catch(() => { });

          toast.error(
            error?.message || 'No se pudo guardar la asignación. Se deshizo el cambio.'
          );
        }
      })();

      return true;
    },
    [canManage, nivel, idEntidad, nombreEntidad, loadAssignments, assignments, user]
  );

  const asignarMiembro = useCallback(async () => {
    const idMiembro = normalizarIdAsignacion(selectedMember?.id ?? selectedMember?.idMiembros);

    if (!idMiembro) {
      toast.warning('Selecciona un miembro para asignarlo al cargo.');
      return;
    }

    if (await guardar({ node: selectedNode, idMiembro, miembro: selectedMember, activo: true })) {
      toast.success('Miembro asignado correctamente.');
    }
  }, [guardar, selectedMember, selectedNode]);

  // --- Remover: se pide confirmacion antes de liberar el cargo ---

  const pedirRemoverMiembro = useCallback(
    (node) => {
      if (!canManage) return;

      if (!getAssignedMember(node?.id)) {
        toast.info('Este cargo no tiene un miembro asignado.');
        return;
      }

      setNodoARemover(node);
    },
    [canManage, getAssignedMember]
  );

  const cancelarRemover = useCallback(() => {
    setNodoARemover(null);
  }, []);

  const confirmarRemover = useCallback(async () => {
    const asignado = getAssignedMember(nodoARemover?.id);
    const idMiembro = normalizarIdAsignacion(asignado?.id ?? asignado?.idMiembros);

    if (!idMiembro) {
      setNodoARemover(null);
      return;
    }

    if (await guardar({ node: nodoARemover, idMiembro, miembro: asignado, activo: false })) {
      toast.success('Miembro removido del cargo.');
    }

    setNodoARemover(null);
  }, [getAssignedMember, guardar, nodoARemover]);

  return {
    members,
    memberOptions,
    getAssignedMember,
    selectedNode,
    selectedMember,
    setSelectedMember,
    isSaving,
    openAssign,
    closeAssign,
    asignarMiembro,
    nodoARemover,
    pedirRemoverMiembro,
    cancelarRemover,
    confirmarRemover,
  };
}
