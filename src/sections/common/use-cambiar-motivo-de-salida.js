'use client';

import { useCallback } from 'react';

import { puedeEditarDirectivaHistorica } from 'src/utils/org-level-access';

import { cambiarMotivoDeSalida } from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// Precisar el motivo de una salida del historial. Solo el Administrador Global
// y la Oficina Nacional: para los demás devuelve null y la lista de Historia no
// enseña el lápiz. La lista se relee sola al guardar (avisos de lecturas).
// ----------------------------------------------------------------------

export function useCambiarMotivoDeSalida() {
  const { user } = useAuthContext();
  const puede = puedeEditarDirectivaHistorica(user);

  const cambiar = useCallback(
    async ({ salida, motivo, nota }) => {
      try {
        await cambiarMotivoDeSalida({ salida, motivo, nota, usuario: user });
        toast.success('Motivo de salida guardado.');
      } catch (error) {
        console.error('[historia] no se pudo guardar el motivo de salida', error);
        toast.error(error?.message || 'No se pudo guardar el motivo.');
      }
    },
    [user]
  );

  return puede ? cambiar : null;
}
