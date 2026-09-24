import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';

import { normalizeText } from 'src/utils/normalize-text';

import { Iconify } from 'src/components/iconify';

import { FiltroBuscable } from './filtro-buscable';

// ----------------------------------------------------------------------
// LA BARRA DE LA PESTAÑA JERARQUÍA.
//
// En la lista mandan cuatro filtros; aquí, solo dos cosas: un buscador por NOMBRE
// que elige a una persona y la lleva a su organigrama, y un filtro de nivel de UNA
// sola opción (no casillas). Los demás controles de la lista —posición, estructura,
// vista panel/grid— no tienen sentido sobre un organigrama y no se pintan.
// ----------------------------------------------------------------------

export function NationalJerarquiaToolbar({
  opcionesBusqueda,
  onSeleccionarMiembro,
  nivelOpciones,
  nivelValor,
  onCambiarNivel,
}) {
  return (
    <Box
      sx={{
        p: 2.5,
        gap: 2,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'center' },
      }}
    >
      <Autocomplete
        fullWidth
        // Cada elección dispara la búsqueda; no se queda un valor pegado, para que
        // volver a elegir a la misma persona vuelva a resaltarla.
        value={null}
        blurOnSelect
        clearOnBlur
        handleHomeEndKeys
        options={opcionesBusqueda}
        getOptionLabel={(opcion) => opcion?.label || ''}
        isOptionEqualToValue={(opcion, valor) => opcion?.clave === valor?.clave}
        filterOptions={(lista, { inputValue }) => {
          const buscado = normalizeText(inputValue);

          if (!buscado) return lista;

          return lista.filter((opcion) => normalizeText(opcion.label).includes(buscado));
        }}
        onChange={(event, opcion) => {
          if (opcion) onSeleccionarMiembro(opcion);
        }}
        noOptionsText="Sin coincidencias"
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Buscar nombre en la jerarquía…"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, opcion) => (
          <Box component="li" {...props} key={opcion.clave} sx={{ gap: 1.5 }}>
            <Avatar src={opcion.avatarUrl || undefined} sx={{ width: 32, height: 32 }}>
              {opcion.label?.charAt(0)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Box component="span" sx={{ display: 'block', typography: 'body2', noWrap: true }}>
                {opcion.label}
              </Box>
              <Box
                component="span"
                sx={{ display: 'block', typography: 'caption', color: 'text.secondary' }}
              >
                {opcion.cargo ? `${opcion.cargo} · ${opcion.ambito}` : opcion.ambito}
              </Box>
            </Box>
          </Box>
        )}
      />

      {/* Una sola opción y con buscador, como los filtros de la lista. Sin opción
          "Consejo Nacional": era el mismo organigrama que "Consejo Ejecutivo". */}
      <FiltroBuscable
        label="Nivel organizacional"
        options={nivelOpciones}
        value={nivelValor}
        onChange={onCambiarNivel}
        sx={{ minWidth: 280, width: { xs: 1, md: 'auto' } }}
      />
    </Box>
  );
}
