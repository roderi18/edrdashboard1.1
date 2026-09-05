'use client';

import { useState, useEffect, useCallback } from 'react';

import {
  guardarDisenoDirectiva,
  obtenerDisenoDirectiva,
} from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Persistencia del diseno del organigrama en `disenosDirectiva`.
//
// La coleccion estaba declarada desde el principio y nunca se escribio: mover un
// nodo o ajustar el alto del lienzo solo cambiaba el estado de React, y cada
// visita empezaba de cero. Se guarda por nivel + entidad, y solo lo escribe el
// administrador global.
// ----------------------------------------------------------------------

export function useLeadershipLayoutStorage({
  editor,
  nivel,
  idEntidad,
  nombreEntidad = '',
  canManage = false,
  defaultNodeOffsets = {},
  defaultContainerHeightOffset = 0,
  defaultContainerWidthOffset = 0,
  defaultConnectionGroups = [],
}) {
  const [guardando, setGuardando] = useState(false);
  const { applyLayout } = editor;

  useEffect(() => {
    let cancelled = false;

    const cargar = async () => {
      const diseno = await obtenerDisenoDirectiva({ nivel, idEntidad }).catch(() => null);

      if (cancelled || !diseno) return;

      // Los valores por defecto siguen siendo el punto de partida: el diseno
      // guardado solo sustituye los nodos que alguien movio de verdad.
      applyLayout({
        nodeOffsets: { ...defaultNodeOffsets, ...diseno.nodeOffsets },
        containerHeightOffset: diseno.containerHeightOffset || defaultContainerHeightOffset,
        containerWidthOffset: diseno.containerWidthOffset || defaultContainerWidthOffset,
        connectionGroups: diseno.connectionGroups?.length
          ? diseno.connectionGroups
          : defaultConnectionGroups,
        hiddenConnections: diseno.hiddenConnections,
        extraConnections: diseno.extraConnections,
      });
    };

    if (nivel) {
      cargar();
    }

    return () => {
      cancelled = true;
    };
    // Los valores por defecto son constantes de modulo en cada vista; incluirlos
    // en las dependencias volveria a cargar el diseno en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivel, idEntidad, applyLayout]);

  const guardar = useCallback(async () => {
    if (!canManage) {
      toast.error('Solo el administrador global puede guardar el diseño.');
      return false;
    }

    setGuardando(true);

    try {
      await guardarDisenoDirectiva({
        nivel,
        idEntidad,
        nombreEntidad,
        nodeOffsets: editor.nodeOffsets,
        containerHeightOffset: editor.containerHeightOffset,
        containerWidthOffset: editor.containerWidthOffset,
        connectionGroups: editor.connectionGroups,
        hiddenConnections: editor.hiddenConnections,
        extraConnections: editor.extraConnections,
      });

      toast.success('Diseño del organigrama guardado.');

      return true;
    } catch (error) {
      console.error('[directiva] no se pudo guardar el diseño', error);
      toast.error(error?.message || 'No se pudo guardar el diseño.');

      return false;
    } finally {
      setGuardando(false);
    }
  }, [
    canManage,
    nivel,
    idEntidad,
    nombreEntidad,
    editor.nodeOffsets,
    editor.containerHeightOffset,
    editor.containerWidthOffset,
    editor.connectionGroups,
    editor.hiddenConnections,
    editor.extraConnections,
  ]);

  return { guardar, guardando };
}
