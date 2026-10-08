import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';

// Esqueleto de la portada: cabecera, franja azul y tarjetas, al instante.
export default function Loading() {
  return (
    <Box sx={{ bgcolor: 'background.neutral', minHeight: '100vh' }}>
      <Skeleton variant="rectangular" height={76} />
      <Skeleton variant="rectangular" height={380} sx={{ bgcolor: 'primary.dark' }} />
      <Container
        maxWidth="lg"
        sx={{
          mt: 6,
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { md: 'repeat(4, 1fr)' },
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={120} />
        ))}
      </Container>
    </Box>
  );
}
