'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import {
  canEditMembers,
  esMiembroDeSuAlcance,
  canMemberManageMembers,
  puedeEditarSuPropiaFicha,
} from 'src/utils/member-access';

import {
  getMemberDirectoryMetadata,
  getResolvedMemberByIdentifier,
} from 'src/services/member-context-service';

import { SplashScreen } from 'src/components/loading-screen';

import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberCreateEditForm } from 'src/sections/member/member-create-edit-form';

import { useAuthContext } from 'src/auth/hooks';

export default function Page() {
  const { id } = useParams();
  const { user, loading } = useAuthContext();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [availableDests, setAvailableDests] = useState([]);
  // Editar la ficha exige `miembros.editar` del catálogo, igual que Dispensa
  // Médica con `salud.editar` y Ascenso con `ascenso.editar`. Sin esta condición
  // toda sesión de administrador editaba, incluidos los cargos de supervisión
  // (sección, región y Consejo Nacional), que son de solo consulta.
  // El permiso dice que sabe editar fichas; el alcance, de quien. Sin la segunda
  // condicion, sumar los cargos de alguien —correcto— le abria la ficha de
  // cualquier miembro de la organizacion.
  const canManage =
    (!user || user.role !== 'member' ? true : canMemberManageMembers(user)) &&
    canEditMembers(user) &&
    esMiembroDeSuAlcance(user, currentMember);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [metadata, member] = await Promise.all([
          getMemberDirectoryMetadata(),
          getResolvedMemberByIdentifier(id, { includeMetadata: true, includePhoto: true }),
        ]);

        if (cancelled) return;

        setAvailableDests(metadata?.dests || []);
        setCurrentMember(member);
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
    return <SplashScreen title="Cargando miembro" subtitle="Preparando su perfil..." />;
  }

  if (loading) {
    return <SplashScreen title="Verificando acceso" subtitle="Casi listo..." />;
  }

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  return (
    <MemberEditLayout member={currentMember}>
      <MemberCreateEditForm
        currentMember={currentMember}
        // Su propia ficha nunca se le enmascara, aunque no gestione miembros.
        // Lo que cambie ahi va a aprobacion, no directo a la base de datos.
        readOnly={!canManage && !puedeEditarSuPropiaFicha(user, currentMember)}
        availableDests={availableDests}
      />
    </MemberEditLayout>
  );
}
