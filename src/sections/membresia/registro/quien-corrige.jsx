'use client';

import { useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------
// "¿QUIÉN HACE LA CORRECCIÓN?": al guardar los datos corregidos del
// destacamento se pide el nombre (buscado entre los miembros de la API; si no
// aparece, se escribe tal cual) y un teléfono, para que la Oficina Nacional
// sepa a quién llamar al revisar el cambio.
// ----------------------------------------------------------------------

// Lo ya buscado no se vuelve a pedir.
const resultados = new Map();

const digitos = (v) => String(v || '').replace(/\D/g, '');

export function QuienCorrige({ abierto, inicial, onCancelar, onGuardar }) {
  const [persona, setPersona] = useState(inicial?.nombre || '');
  const [elegida, setElegida] = useState(inicial?.idMiembro ? inicial : null);
  const [telefono, setTelefono] = useState(inicial?.telefono || '');
  const [opciones, setOpciones] = useState([]);
  const [buscando, setBuscando] = useState(false);

  // Al abrir se despierta la búsqueda en el servidor (la API tarda).
  useEffect(() => {
    if (abierto) fetch('/api/personas/?q=').catch(() => {});
  }, [abierto]);

  useEffect(() => {
    const q = persona.trim();
    if (q.replace(/\s/g, '').length < 3 || (elegida && q === elegida.nombre)) {
      setOpciones([]);
      setBuscando(false);
      return undefined;
    }
    const clave = q.toLowerCase();
    if (resultados.has(clave)) {
      setOpciones(resultados.get(clave));
      return undefined;
    }
    setBuscando(true);
    const control = new AbortController();
    const espera = setTimeout(() => {
      fetch(`/api/personas/?q=${encodeURIComponent(q)}`, { signal: control.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((lista) => {
          const filas = Array.isArray(lista) ? lista : [];
          resultados.set(clave, filas);
          setOpciones(filas);
        })
        .catch(() => {})
        .finally(() => setBuscando(false));
    }, 300);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [persona, elegida]);

  const nombreValido = persona.trim().length >= 3;
  const telefonoValido = digitos(telefono).replace(/^1(?=\d{10}$)/, '').length === 10;

  return (
    <Dialog open={abierto} onClose={onCancelar} maxWidth="sm" fullWidth>
      <DialogTitle>¿Quién hace la corrección?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
          La Oficina Nacional revisará los cambios y puede contactarte. Busca tu nombre; si no
          aparece, escríbelo completo.
        </Typography>
        <Stack spacing={2.5}>
          <Autocomplete
            freeSolo
            options={opciones}
            loading={buscando}
            filterOptions={(x) => x}
            getOptionLabel={(o) => (typeof o === 'string' ? o : o.nombre)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            inputValue={persona}
            onInputChange={(_, valor, motivo) => {
              setPersona(valor);
              if (motivo === 'input') setElegida(null);
            }}
            onChange={(_, valor) => {
              if (valor && typeof valor === 'object') {
                setElegida(valor);
                setPersona(valor.nombre);
              } else setElegida(null);
            }}
            noOptionsText={
              persona.trim().length < 3
                ? 'Escribe al menos 3 letras'
                : 'No aparece: déjalo escrito así'
            }
            loadingText="Buscando…"
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                label="Tu nombre y apellido *"
              />
            )}
          />
          <TextField
            label="Tu teléfono *"
            placeholder="(809) 000-0000"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            error={!!telefono && !telefonoValido}
            helperText={telefono && !telefonoValido ? 'Teléfono de 10 dígitos.' : ' '}
            slotProps={{ htmlInput: { inputMode: 'tel', maxLength: 20 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={!nombreValido || !telefonoValido}
          onClick={() =>
            onGuardar({
              nombre: persona.trim(),
              idMiembro: elegida?.id || '',
              telefono: telefono.trim(),
            })
          }
        >
          Guardar corrección
        </Button>
      </DialogActions>
    </Dialog>
  );
}
