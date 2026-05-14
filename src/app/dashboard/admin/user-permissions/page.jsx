import Box from '@mui/material/Box';

import { CONFIG } from 'src/global-config';

import { EmptyContent } from 'src/components/empty-content';

// ----------------------------------------------------------------------

export const metadata = { title: `Permisos a usuarios | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <Box sx={{ minHeight: 360 }}>
      <EmptyContent
        filled
        title="Permisos a usuarios"
        description="Todavia no hay permisos de usuarios para mostrar."
        sx={{ py: 10 }}
      />
    </Box>
  );
}
