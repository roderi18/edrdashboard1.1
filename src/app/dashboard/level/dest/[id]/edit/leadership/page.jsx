'use client';

import { useParams } from 'src/routes/hooks';
import { MEMBERS } from 'src/_mock/assets';
import { getStorageCollection } from 'src/utils/storage-service';
import { _leadershipRolesByLevel } from 'src/_mock/_leadership';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { useEffect, useState } from 'react';
import { getMembers } from 'src/services/member-service';

export default function Page() {

    const params = useParams();
    const destId = params?.id;
    const roles = _leadershipRolesByLevel.dest;
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const LEADERSHIP_ASSIGNMENTS =
        getStorageCollection('leadershipAssignments') || [];
    if (!mounted) return null;

    const allMembers = getMembers();

    return (
        <DestEditLayout>

            <div style={{ position: 'relative' }}>

                <h2>Directiva del destacamento</h2>
                <h2>EN DESARROLLO</h2>

                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: 700
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            bgcolor: 'background.paper',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            boxShadow: 1,
                            fontWeight: 600,
                            zIndex: 2
                        }}
                    >
                        Imagen de ejemplo.
                    </Typography>

                    <Typography
                        component="a"
                        href="https://minimals.cc/components/extra/organization-chart"
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                            position: 'absolute',
                            top: 30,
                            right: 8,
                            fontSize: 12,
                            color: 'primary.main',
                            textDecoration: 'underline',
                            zIndex: 2
                        }}
                    >
                        Ver enlace
                    </Typography>

                    <img
                        src="/assets/images/organization-chart.png"
                        alt="organization chart"
                        style={{
                            width: '100%',
                            display: 'block'
                        }}
                    />
                </Box>

            </div>

            {roles.map((role) => {

                const assignment = LEADERSHIP_ASSIGNMENTS.find(

                    (a) =>
                        a.level === 'dest' &&
                        a.entityId === destId &&
                        a.role === role.value
                );

                const member = allMembers.find(
                    (m) => m.id === assignment?.memberId
                );

                return (
                    <div key={role.value}>
                        <strong>{role.label}</strong> —{member ? `${member.firstName} ${member.lastName}` : 'Sin asignar'}
                    </div>
                );
            })}

        </DestEditLayout>
    );
}