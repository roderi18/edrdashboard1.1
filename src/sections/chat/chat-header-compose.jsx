import { useState, useCallback } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// EL CAMPO "PARA:" MANDA LO QUE LE DIGAN, NO LO QUE RECUERDE.
//
// Guardaba su propia lista de destinatarios y arrancaba con `defaultValue={[]}`:
// no controlado. Asi que cuando la pantalla ponia a alguien de destinatario
// —al pulsarlo en el buscador de contactos—, este campo ni se enteraba y seguia
// enseñando "+ Destinatarios". Parecia que pulsar a la persona no hacia nada.
//
// Ahora la lista viene de fuera y este campo solo la enseña.
export function ChatHeaderCompose({
  contacts,
  recipients = [],
  onAddRecipients,
  groupName,
  onChangeGroupName,
}) {
  const [searchRecipients, setSearchRecipients] = useState('');

  const handleAddRecipients = useCallback(
    (selected) => {
      setSearchRecipients('');
      onAddRecipients(selected);
    },
    [onAddRecipients]
  );

  return (
    <>
      <Typography variant="subtitle2" sx={{ color: 'text.primary', mr: 2 }}>
        Para:
      </Typography>

      <Autocomplete
        sx={{ minWidth: { md: 320 }, flexGrow: { xs: 1, md: 'unset' } }}
        multiple
        limitTags={3}
        popupIcon={null}
        value={recipients}
        disableCloseOnSelect
        noOptionsText={searchRecipients ? 'No se encontraron destinatarios' : 'Escribe para buscar'}
        onChange={(event, newValue) => handleAddRecipients(newValue)}
        onInputChange={(event, newValue) => setSearchRecipients(newValue)}
        options={contacts}
        getOptionLabel={(recipient) => recipient.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderInput={(params) => <TextField {...params} placeholder="+ Destinatarios" />}
        renderOption={(props, option, state) => {
          const { key, ...otherProps } = props;

          return (
            <li key={key} {...otherProps}>
              <Box
                sx={{
                  mr: 1,
                  width: 32,
                  height: 32,
                  overflow: 'hidden',
                  borderRadius: '50%',
                  position: 'relative',
                }}
              >
                <Avatar alt={option.name} src={option.avatarUrl} sx={{ width: 1, height: 1 }} />
                <Box
                  sx={[
                    (theme) => ({
                      top: 0,
                      left: 0,
                      width: 1,
                      height: 1,
                      opacity: 0,
                      display: 'flex',
                      position: 'absolute',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: varAlpha(theme.vars.palette.grey['900Channel'], 0.8),
                      transition: theme.transitions.create(['opacity'], {
                        easing: theme.transitions.easing.easeInOut,
                        duration: theme.transitions.duration.shorter,
                      }),
                      ...(state.selected && { opacity: 1, color: 'primary.main' }),
                    }),
                  ]}
                >
                  <Iconify icon="eva:checkmark-fill" />
                </Box>
              </Box>
              {option.name}
            </li>
          );
        }}
        renderValue={(selected, getItemProps) =>
          selected.map((option, index) => (
            <Chip
              {...getItemProps({ index })}
              key={option.id}
              label={option.name}
              avatar={<Avatar alt={option.name} src={option.avatarUrl} />}
              size="small"
              variant="soft"
            />
          ))
        }
      />

      {recipients.length > 1 && (
        <TextField
          size="small"
          value={groupName}
          onChange={(event) => onChangeGroupName?.(event.target.value)}
          placeholder="Nombre del grupo (opcional)"
          sx={{ ml: 2, minWidth: { md: 220 } }}
        />
      )}
    </>
  );
}
