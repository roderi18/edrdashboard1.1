import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';

// Esqueleto de un paso mientras llega su página.
export default function Loading() {
  return (
    <Card sx={{ p: { xs: 2.5, md: 4 } }}>
      <Skeleton width={90} />
      <Skeleton width="55%" height={44} sx={{ mb: 3 }} />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} variant="rounded" height={64} sx={{ mb: 2 }} />
      ))}
    </Card>
  );
}
