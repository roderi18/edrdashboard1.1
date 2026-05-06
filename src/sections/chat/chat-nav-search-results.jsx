import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';

// ----------------------------------------------------------------------

export function ChatNavSearchResults({ query, results, onClickResult }) {
  const totalResults = results.length;

  const notFound = !totalResults && !!query;

  const renderNotFound = () => (
    <Box
      sx={{
        p: 3,
        mx: 'auto',
        width: `calc(100% - 40px)`,
        borderRadius: 1.5,
        textAlign: 'center',
        bgcolor: 'background.neutral',
      }}
    >
      <Typography variant="h6">Sin resultados</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        No se encontraron contactos para <strong>{`"${query}"`}</strong>.
      </Typography>
    </Box>
  );

  const renderResults = () => (
    <nav>
      <Box component="ul" sx={{ '& li': { display: 'flex' } }}>
        {results.map((result, index) => (
          <li key={`${result.id ?? result.idMiembros ?? result.codigoMiembro ?? result.name ?? 'contacto'}-${index}`}>
            <ListItemButton
              onClick={() => onClickResult(result)}
              sx={{
                gap: 2,
                py: 1.5,
                px: 2.5,
                typography: 'subtitle2',
              }}
            >
              <Avatar alt={result.name} src={result.avatarUrl} />
              {result.name}
            </ListItemButton>
          </li>
        ))}
      </Box>
    </nav>
  );

  return (
    <>
      <Typography variant="h6" sx={{ px: 2.5, mb: 2 }}>
        Contactos ({totalResults})
      </Typography>

      {notFound ? renderNotFound() : renderResults()}
    </>
  );
}
