'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

import { puedeVerMiembrosDelDestacamento } from 'src/utils/member-access';

import { getMemberDirectoryMetadata } from 'src/services/member-context-service';

import { Iconify } from 'src/components/iconify';

import { MemberListView } from 'src/sections/member/view';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

// LOS MIEMBROS DE ESTE DESTACAMENTO.
//
// La lista general (/member) enseña los del destacamento propio; a los de otro
// se llega por aqui, que es donde esta dicho de quien son. Reutiliza la MISMA
// vista de miembros —sus filtros, su paginacion, sus tarjetas en el movil— y
// solo le dice de que destacamento.
//
// El candado del layout deja entrar a la ficha del destacamento a quien la puede
// consultar; ver a su GENTE es otra pregunta, y la responde el alcance de sus
// cargos. Por eso hay una segunda puerta aqui.

export function DestMembersView() {
  const params = useParams();
  const destId = String(params?.id ?? '').trim();
  const { user, loading } = useAuthContext();

  const [estructura, setEstructura] = useState(null);

  useEffect(() => {
    let cancelado = false;

    getMemberDirectoryMetadata()
      .then((metadata) => {
        if (!cancelado) setEstructura(metadata);
      })
      .catch(() => {
        // Sin estructura no se puede resolver la seccion ni la region de este
        // destacamento; se responde con lo que haya, que para un cargo del
        // propio destacamento ya alcanza.
        if (!cancelado) setEstructura({ dests: [], churches: [], sectionals: [] });
      });

    return () => {
      cancelado = true;
    };
  }, []);

  if (loading || !estructura) return null;

  const puedeVerlos = puedeVerMiembrosDelDestacamento(user, destId, {
    dests: estructura.dests || [],
    churches: estructura.churches || [],
    sectionals: estructura.sectionals || [],
  });

  if (!puedeVerlos) {
    return (
      <Card sx={{ p: 5, textAlign: 'center' }}>
        <Iconify
          icon="solar:users-group-rounded-bold"
          width={40}
          sx={{ mb: 1, color: 'text.disabled' }}
        />
        <Typography variant="subtitle1">Los miembros de este destacamento no son tuyos</Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          Tu cargo llega hasta la ficha del destacamento, pero no hasta su gente.
        </Typography>
      </Card>
    );
  }

  return <MemberListView destId={destId} />;
}
