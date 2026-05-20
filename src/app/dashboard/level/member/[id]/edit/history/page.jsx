'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import { getMemberFullName } from 'src/utils/get-member-fullname';

import { getMembers } from 'src/services/member-service';
import { listarHistorialMiembro } from 'src/services/member-history-service';

import { MemberHistoryLog } from 'src/sections/member/history/member-history-log';

export default function Page() {
  const { id } = useParams();
  const [hydrated, setHydrated] = useState(false);
  const [logs, setLogs] = useState([]);
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

      const memberId = member?.id || id;
      const historyLogs = await listarHistorialMiembro(memberId);

      setCurrentMember(member);
      setLogs(historyLogs);
      setHydrated(true);
    };

    load();
  }, [id]);

  if (!hydrated) return null;

  return <MemberHistoryLog memberName={getMemberFullName(currentMember)} logs={logs} />;
}
