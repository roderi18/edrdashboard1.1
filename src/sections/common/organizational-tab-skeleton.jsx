import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';

export function OrganizationalTabSkeleton() {
  return (
    <Stack spacing={3} aria-label="Cargando contenido" aria-busy="true">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Skeleton variant="rounded" width={180} height={52} />
        <Skeleton variant="rounded" sx={{ flex: 1 }} height={52} />
      </Stack>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { md: 'minmax(280px, 0.42fr) 1fr' } }}>
        <Skeleton variant="rounded" height={320} />
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={72} />
          <Skeleton variant="rounded" height={72} />
          <Skeleton variant="rounded" height={72} />
        </Stack>
      </Box>
    </Stack>
  );
}
