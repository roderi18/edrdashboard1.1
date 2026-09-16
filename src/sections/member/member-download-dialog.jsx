import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Radio from '@mui/material/Radio';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import {
  ALL_DOWNLOAD_OPTION,
  applyDownloadFilters,
  getSectionalIdsByRegion,
  normalizeDownloadOptions,
  getSectionalOptionsByRegion,
  getDownloadAutocompleteValue,
} from './member-toolbar-download-utils';

export function MemberDownloadDialog({
  open,
  onClose,
  filters,
  setFilters,
  options,
  members,
  onDownload,
}) {
  const handleAutocompleteChange = (key, selectedOptions, details) => {
    const isSelectingAll = details?.option?.value === ALL_DOWNLOAD_OPTION.value;
    const nextValues = isSelectingAll
      ? []
      : (selectedOptions || [])
          .filter((option) => option.value !== ALL_DOWNLOAD_OPTION.value)
          .map((option) => String(option.value));

    setFilters((previous) => {
      const nextFilters = { ...previous, [key]: nextValues };

      if (key === 'regionalId' && nextValues.length) {
        const allowedSectionalIds = getSectionalIdsByRegion(members, nextValues);
        nextFilters.sectionalId = previous.sectionalId.filter((sectionalId) =>
          allowedSectionalIds?.has(String(sectionalId))
        );
      }

      return nextFilters;
    });
  };

  const renderAutocomplete = (key, label, items) => {
    const autocompleteOptions = [ALL_DOWNLOAD_OPTION, ...normalizeDownloadOptions(items)];

    return (
      <Autocomplete
        multiple
        disableCloseOnSelect
        options={autocompleteOptions}
        value={getDownloadAutocompleteValue(filters[key], items)}
        getOptionKey={(option) => `${key}-${option.value}`}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        getOptionLabel={(option) => option.label}
        onChange={(event, selectedOptions, reason, details) =>
          handleAutocompleteChange(key, selectedOptions, details)
        }
        renderOption={(props, option, { selected }) => {
          const { key: optionKey, ...optionProps } = props;

          return (
            <li key={`${optionKey}-${option.value}`} {...optionProps}>
              <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
              {option.label}
            </li>
          );
        }}
        renderInput={(params) => <TextField {...params} label={label} />}
      />
    );
  };

  const sectionalOptions = getSectionalOptionsByRegion(
    options.sectionalId,
    members,
    filters.regionalId
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Descargar miembros</DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {renderAutocomplete('regionalId', 'Región', options.regionalId)}
          {renderAutocomplete('sectionalId', 'Sección', sectionalOptions)}
          {renderAutocomplete('destName', 'Destacamento', options.destName)}
          {renderAutocomplete('memberDivision', 'División', options.memberDivision)}
          {renderAutocomplete('memberPosition', 'Posición', options.memberPosition)}

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Edad
            </Typography>
            <RadioGroup
              row
              value={filters.ageScope}
              onChange={(event) =>
                setFilters((previous) => ({ ...previous, ageScope: event.target.value }))
              }
            >
              <FormControlLabel value="all" control={<Radio />} label="Todos" />
              <FormControlLabel value="minor" control={<Radio />} label="Menores de edad" />
              <FormControlLabel value="adult" control={<Radio />} label="Mayores de edad" />
              <FormControlLabel value="custom" control={<Radio />} label="Otros (avanzados)" />
            </RadioGroup>

            {filters.ageScope === 'custom' && (
              <TextField
                fullWidth
                value={filters.ageCustom}
                onChange={(event) =>
                  setFilters((previous) => ({ ...previous, ageCustom: event.target.value }))
                }
                helperText={
                  <>
                    Escribe edades separadas por coma. Puedes usar &gt; o &lt;, por ejemplo: 15, 16,
                    &gt;30, &lt;12.
                    <br />
                    &gt; (mayor que la edad), &lt; (menor que la edad)
                  </>
                }
                placeholder="15, 16, 17, 20, o >30, <12"
                size="small"
                sx={{ mt: 1.5 }}
              />
            )}
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Formato
            </Typography>
            <RadioGroup
              row
              value={filters.format}
              onChange={(event) =>
                setFilters((previous) => ({ ...previous, format: event.target.value }))
              }
            >
              <FormControlLabel value="pdf" control={<Radio />} label="PDF" />
              <FormControlLabel value="csv" control={<Radio />} label="CSV" />
            </RadioGroup>
          </Box>

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {applyDownloadFilters(members, filters).length} miembros coinciden con estos filtros.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={onDownload}>
          Descargar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
