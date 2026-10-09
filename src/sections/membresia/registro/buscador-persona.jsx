'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';

// ----------------------------------------------------------------------
// BUSCADOR DE PERSONAS: busca entre los miembros del app (API /api/personas,
// mínimo 3 letras) y, si la persona no aparece, deja escribirla a mano. Lo usa
// "Registrado por". El valor es { nombre, idMiembro, nombres, apellidos }; lo
// escrito a mano va solo con `nombre`.
// ----------------------------------------------------------------------

// Lo ya buscado no se vuelve a pedir.
const resultados = new Map();
const jurisdiccionVisible = (valor) =>
  String(valor || '').trim().toLocaleLowerCase('es') === 'provisional' ? '' : valor;

export function BuscadorPersona({ value, onChange, label, helperText, error }) {
  const [texto, setTexto] = useState(value?.nombre || '');
  const [opciones, setOpciones] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const elegida = value?.idMiembro ? value : null;

  // Al recuperar lo guardado (recarga), el campo lo enseña.
  useEffect(() => {
    if (value?.nombre && value.nombre !== texto) setTexto(value.nombre);
    // Solo cuando llega un valor distinto desde fuera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.nombre]);

  // Al montar se despierta la búsqueda en el servidor (la API tarda).
  useEffect(() => {
    fetch('/api/personas/?q=').catch(() => {});
  }, []);

  useEffect(() => {
    const q = texto.trim();
    if (q.replace(/\s/g, '').length < 3 || (elegida && q === elegida.nombre)) {
      setOpciones([]);
      setBuscando(false);
      return undefined;
    }
    const clave = q.toLowerCase();
    if (resultados.has(clave)) {
      setOpciones(resultados.get(clave));
      setFallo(false);
      setBuscando(false);
      return undefined;
    }
    setFallo(false);
    setBuscando(true);
    const control = new AbortController();
    let vigente = true;
    const espera = setTimeout(() => {
      fetch(`/api/personas/?q=${encodeURIComponent(q)}`, { signal: control.signal })
        .then((r) => {
          if (!r.ok) throw new Error('No se pudo buscar.');
          return r.json();
        })
        .then((lista) => {
          if (!vigente) return;
          const filas = Array.isArray(lista) ? lista : [];
          resultados.set(clave, filas);
          setOpciones(filas);
        })
        .catch(() => {
          if (vigente) setFallo(true);
        })
        .finally(() => {
          if (vigente) setBuscando(false);
        });
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(espera);
      control.abort();
    };
  }, [texto, elegida]);

  return (
    <Autocomplete
      freeSolo
      options={opciones}
      loading={buscando}
      filterOptions={(x) => x}
      value={elegida}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.nombre)}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      inputValue={texto}
      onInputChange={(_, valor, motivo) => {
        setTexto(valor);
        // Escrito a mano: sin id, hasta que se elija a alguien de la lista.
        if (motivo === 'input')
          onChange({ nombre: valor, idMiembro: '', nombres: '', apellidos: '' });
      }}
      onChange={(_, valor) => {
        if (valor && typeof valor === 'object') {
          setTexto(valor.nombre);
          onChange({
            nombre: valor.nombre,
            idMiembro: valor.id,
            nombres: valor.nombres || '',
            apellidos: valor.apellidos || '',
          });
        }
      }}
      noOptionsText={
        fallo
          ? 'No se pudo buscar. Inténtalo de nuevo.'
          : texto.trim().length < 3
            ? 'Escribe al menos 3 letras'
            : 'No aparece: déjalo escrito así'
      }
      loadingText="Buscando…"
      renderOption={({ key, ...props }, opcion) => (
        <li key={key} {...props}>
          <Box>
            <Typography variant="body2">{opcion.nombre}</Typography>
            {(jurisdiccionVisible(opcion.region) || jurisdiccionVisible(opcion.seccion)) && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {[opcion.region, opcion.seccion].map(jurisdiccionVisible).filter(Boolean).join(' · ')}
              </Typography>
            )}
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText || undefined}
        />
      )}
    />
  );
}
