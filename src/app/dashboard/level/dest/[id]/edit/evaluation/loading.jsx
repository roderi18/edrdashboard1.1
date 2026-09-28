import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';

// Esqueleto de la pestaña "Evaluación": aparece al instante al pulsarla.
export default function Loading() {
  return (
    <Card sx={{ p: { xs: 2.5, md: 4 } }}>
      <Skeleton width={160} height={32} sx={{ mb: 3 }} />
      <Skeleton variant="rounded" height={56} />
    </Card>
  );
}
