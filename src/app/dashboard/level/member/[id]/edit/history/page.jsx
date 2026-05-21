'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import { getMemberFullName } from 'src/utils/get-member-fullname';

import { getMembers } from 'src/services/member-service';

import { MemberHistoryLog } from 'src/sections/member/history/member-history-log';

const LOCAL_DEMO_MEMBER_CODE = 'DO-SD-111111017';

const isLocalhost = () =>
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

const isLocalDemoMember = (member, id) =>
  [id, member?.id, member?.memberId, member?.codigoMiembro].some(
    (value) => String(value || '').toUpperCase() === LOCAL_DEMO_MEMBER_CODE
  );

const getLocalDemoHistoryLogs = (memberName) => {
  const displayMemberName = memberName || 'Daniel Alejandro Peña Rosario';

  const logs = [
    {
      id: 'demo-history-001',
      fecha: '20/05/2026',
      hora: '09:12 A.M.',
      modulo: 'Información general',
      afectado: 'Teléfono',
      antes: '(829) 787-8833',
      despues: '(829) 787-8844',
      realizadoPor: 'Administrador local',
    },
    {
      id: 'demo-history-002',
      fecha: '20/05/2026',
      hora: '09:18 A.M.',
      modulo: 'Información general',
      afectado: 'Dirección',
      antes: 'Calle Principal 12',
      despues: 'Calle Duarte 18',
      realizadoPor: 'Administrador local',
    },
    {
      id: 'demo-history-003',
      fecha: '20/05/2026',
      hora: '09:31 A.M.',
      modulo: 'Información general',
      afectado: 'Correo',
      antes: 'daniel.demo@correo.com',
      despues: 'daniel.pena@correo.com',
      realizadoPor: 'Administrador local',
    },
    {
      id: 'demo-history-004',
      fecha: '20/05/2026',
      hora: '10:05 A.M.',
      modulo: 'Información general',
      afectado: 'Destacamento',
      antes: 'Dest. Desconocido',
      despues: 'Tribu De Judá 183',
      realizadoPor: 'Coordinador',
    },
    {
      id: 'demo-history-005',
      fecha: '20/05/2026',
      hora: '10:22 A.M.',
      modulo: 'Información general',
      afectado: 'División',
      antes: 'Navegantes',
      despues: 'Liderazgo',
      realizadoPor: 'Coordinador',
    },
    {
      id: 'demo-history-006',
      fecha: '20/05/2026',
      hora: '11:03 A.M.',
      modulo: 'Dispensa médica',
      afectado: 'Seguro médico',
      antes: 'Sin documento',
      despues: 'Seguro Médico.pdf',
      realizadoPor: 'Secretaría',
    },
    {
      id: 'demo-history-007',
      fecha: '20/05/2026',
      hora: '11:40 A.M.',
      modulo: 'Sistema de Ascenso',
      afectado: 'Seguridad y Primeros Auxilios',
      antes: 'No iniciado',
      despues: 'Completado',
      realizadoPor: 'Instructor',
    },
    {
      id: 'demo-history-008',
      fecha: '20/05/2026',
      hora: '12:14 P.M.',
      modulo: 'Sistema de Ascenso',
      afectado: 'Certificado',
      antes: 'Sin certificado',
      despues: 'Certificado Seguridad.pdf',
      realizadoPor: 'Instructor',
    },
    {
      id: 'demo-history-009',
      fecha: '20/05/2026',
      hora: '01:02 P.M.',
      modulo: 'Información general',
      afectado: 'Foto de perfil',
      antes: 'Sin foto',
      despues: 'Foto actualizada',
      realizadoPor: 'Administrador local',
    },
    {
      id: 'demo-history-010',
      fecha: '20/05/2026',
      hora: '02:20 P.M.',
      modulo: 'Información general',
      afectado: 'Nombre del miembro',
      antes: 'Daniel Peña',
      despues: displayMemberName,
      realizadoPor: 'Administrador local',
    },
  ];

  return logs.reverse();
};

export default function Page() {
  const { id } = useParams();
  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);

  useEffect(() => {
    const load = async () => {
      const allMembers = await getMembers();
      const member =
        allMembers.find(
          (item) =>
            String(item.id) === String(id) ||
            String(item.memberId) === String(id) ||
            String(item.codigoMiembro) === String(id)
        ) || null;

      setCurrentMember(member);
      setHydrated(true);
    };

    load();
  }, [id]);

  if (!hydrated) return null;

  const memberName = getMemberFullName(currentMember);
  const memberId = currentMember?.id || id;

  return (
    <MemberHistoryLog
      memberId={memberId}
      memberName={memberName}
      demoLogs={
        isLocalhost() && isLocalDemoMember(currentMember, id)
          ? getLocalDemoHistoryLogs(memberName)
          : []
      }
    />
  );
}
