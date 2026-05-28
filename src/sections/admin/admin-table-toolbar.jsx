import { useCallback } from 'react';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from 'src/components/iconify';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';

// ----------------------------------------------------------------------

export function AdminTableToolbar({ filters, onResetPage, displayMode, setDisplayMode }) {
  const { state: currentFilters, setState: updateFilters } = filters;

  const handleFilterName = useCallback(
    (event) => {
      onResetPage();
      updateFilters({ name: event.target.value });
    },
    [onResetPage, updateFilters]
  );

  return (
    <Box
      sx={{
        gap: { xs: 1, md: 2 },
        p: 2.5,
        display: 'grid',
        alignItems: 'center',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr) auto auto',
          md: 'minmax(240px, 360px) 1fr auto auto',
        },
      }}
    >
      <TextField
        fullWidth
        value={currentFilters.name}
        onChange={handleFilterName}
        placeholder="Buscar nombre"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ minWidth: 0, maxWidth: { md: 360 } }}
      />

      <Box sx={{ display: { xs: 'none', md: 'block' } }} />

      <ViewModeToggle
        value={displayMode}
        onChange={setDisplayMode}
        storageKey="admin-display-mode"
      />

      <IconButton>
        <Iconify icon="eva:more-vertical-fill" />
      </IconButton>
    </Box>
  );
}
