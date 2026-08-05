'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import { canEditHealth } from 'src/utils/member-access';

import { getResolvedMemberByIdentifier } from 'src/services/member-context-service';

import { SplashScreen } from 'src/components/loading-screen';

import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberEditHealthForm } from 'src/sections/member/member-edit-health-form';

import { useAuthContext } from 'src/auth/hooks';

export default function Page() {
  const { id } = useParams();
  const { user, loading } = useAuthContext();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  // Editar la Dispensa Médica exige el permiso `salud.editar` del catálogo
  // (igual que Ascenso con `ascenso.editar`), para que el panel de "Administrar
  // permisos" pueda dejarla en solo lectura.
  const canManage = canEditHealth(user);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const member = await getResolvedMemberByIdentifier(id, {
          includeMetadata: false,
          includePhoto: true,
        });

        if (!cancelled) {
          setCurrentMember(member);
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!hydrated) {
    return <SplashScreen title="Cargando salud" subtitle="Preparando el expediente..." />;
  }

  if (loading) {
    return <SplashScreen title="Verificando acceso" subtitle="Casi listo..." />;
  }

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  return (
    <MemberEditLayout member={currentMember}>
      <MemberEditHealthForm currentMember={currentMember} readOnly={!canManage} />
    </MemberEditLayout>
  );
}
