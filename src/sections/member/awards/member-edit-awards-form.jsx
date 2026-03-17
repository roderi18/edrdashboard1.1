'use client';

import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';

// Importa el view principal del ZIP de awards
import { AwardsManagerView } from 'src/sections/member/awards/view/awards-manager-view';

// ----------------------------------------------------------------------

export function MemberEditAwardsForm({ currentMember }) {
    const memberId = currentMember?.id;

    // Seguridad básica
    if (!memberId) {
        return null;
    }

    return (
        <Box sx={{ width: '100%' }}>
            <AwardsManagerView memberId={memberId} />
        </Box>

    );
}
