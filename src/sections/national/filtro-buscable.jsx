import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

// ----------------------------------------------------------------------
// DESPLEGABLE CON BUSCADOR, EL MISMO DE "DESCARGAR MIEMBROS".
//
// Los filtros de la Directiva Nacional eran `Select` sin buscador: con todas las
// regiones y secciones (o todas las posiciones) habia que recorrer la lista a
// ojo. Este es el `Autocomplete` de `member-download-dialog.jsx`: se escribe
// para acotar y se marcan las casillas. La lista tiene alto maximo.
//
// `multiple`: casillas, valor = lista de `value`. Sin `multiple`: una sola
// opcion, valor = un `value`, y no se puede dejar vacio.
// ----------------------------------------------------------------------

export const ALTO_MAXIMO_DESPLEGABLE = 360;

const listboxConAltoMaximo = { listbox: { sx: { maxHeight: ALTO_MAXIMO_DESPLEGABLE } } };

export function FiltroBuscable({ label, options = [], value, onChange, multiple = false, sx }) {
  const porValor = (valor) => options.find((opcion) => opcion.value === valor);

  const valorDelAutocomplete = multiple
    ? (value || []).map((valor) => porValor(valor) || { value: valor, label: String(valor) })
    : porValor(value) || null;

  return (
    <Autocomplete
      multiple={multiple}
      disableCloseOnSelect={multiple}
      disableClearable={!multiple}
      limitTags={1}
      options={options}
      value={valorDelAutocomplete}
      getOptionKey={(opcion) => opcion.value}
      isOptionEqualToValue={(opcion, elegido) => opcion.value === elegido.value}
      getOptionLabel={(opcion) => opcion?.label ?? ''}
      onChange={(event, elegidas) =>
        onChange(multiple ? (elegidas || []).map((opcion) => opcion.value) : elegidas?.value)
      }
      renderOption={(props, opcion, { selected }) => {
        const { key, ...optionProps } = props;

        return (
          <li key={key} {...optionProps}>
            {multiple && <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />}
            {opcion.label}
          </li>
        );
      }}
      noOptionsText="Sin coincidencias"
      slotProps={listboxConAltoMaximo}
      renderInput={(params) => <TextField {...params} label={label} />}
      sx={sx}
    />
  );
}
