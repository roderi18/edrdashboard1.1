'use client';

import { useState, useEffect } from 'react';
import { useWatch, useController, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';

import { Field } from 'src/components/hook-form';
import { Iconify } from 'src/components/iconify';

import { BotonNoAparece } from './boton-no-aparece';

// ----------------------------------------------------------------------
// Buscar a una persona entre los miembros de la app (mayores de edad o sin
// fecha de nacimiento) o, si no aparece, escribir su nombre y apellido.
// Se busca a partir de 3 letras y solo llega el nombre: nunca el código,
// el teléfono ni la fecha de nacimiento.
// ----------------------------------------------------------------------

// Lo ya buscado no se vuelve a pedir (volver atrás, borrar una letra…).
const resultados = new Map();

export function BuscarPersona({ ruta, etiqueta, textoNuevo = 'No está en la lista' }) {
  const { control, setValue, trigger, formState } = useFormContext();
  const modo = useWatch({ control, name: `${ruta}.modo` });
  // Controlado: el valor es un objeto ({ id, nombre }) y con setValue suelto
  // React Hook Form lo desarmaba en sus campos y la elección no se quedaba.
  const {
    field: { value: miembro, onChange: elegirMiembro },
  } = useController({ control, name: `${ruta}.miembro` });
  const [texto, setTexto] = useState('');
  const [opciones, setOpciones] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const error = ruta.split('.').reduce((o, k) => o?.[k], formState.errors)?.miembro?.message;

  // Al abrir, se despierta la lista en el servidor para que la primera
  // búsqueda no tenga que esperar a la API.
  useEffect(() => {
    fetch('/api/miembros/?q=').catch(() => {});
  }, []);

  useEffect(() => {
    const q = texto.trim();
    if (q.replace(/\s/g, '').length < 3 || (miembro && q === miembro.nombre)) {
      // Sin esto, borrar letras o elegir mientras se buscaba dejaba "Buscando…" pegado.
      setOpciones([]);
      setBuscando(false);
      return undefined;
    }
    const clave = q.toLowerCase();
    if (resultados.has(clave)) {
      setOpciones(resultados.get(clave));
      setBuscando(false);
      return undefined;
    }
    setBuscando(true);
    const control_ = new AbortController();
    // La API tarda a veces; a los 15 s se corta para no quedar esperando para siempre.
    const limite = setTimeout(() => control_.abort(), 15000);
    const espera = setTimeout(() => {
      fetch(`/api/miembros/?q=${encodeURIComponent(q)}`, { signal: control_.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((lista) => {
          const ok = Array.isArray(lista) ? lista : [];
          resultados.set(clave, ok);
          setOpciones(ok);
        })
        .catch(() => setOpciones([]))
        .finally(() => setBuscando(false));
    }, 150);
    return () => {
      clearTimeout(espera);
      clearTimeout(limite);
      control_.abort();
      setBuscando(false);
    };
  }, [texto, miembro]);

  const cambiarModo = (nuevo) => {
    setValue(`${ruta}.modo`, nuevo, { shouldValidate: false });
    elegirMiembro(null);
    if (nuevo === 'existente') {
      setValue(`${ruta}.nombres`, '');
      setValue(`${ruta}.apellidos`, '');
    }
  };

  if (modo === 'nuevo') {
    return (
      <Stack spacing={2}>
        <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <Field.Text name={`${ruta}.nombres`} label="Nombre *" placeholder="Ej: Juan Carlos" />
          <Field.Text name={`${ruta}.apellidos`} label="Apellido *" placeholder="Ej: Pérez Gómez" />
        </Box>
        <Box>
          <Button
            size="small"
            color="inherit"
            startIcon={<Iconify icon="eva:search-fill" />}
            onClick={() => cambiarModo('existente')}
          >
            Buscar en la lista otra vez
          </Button>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      {/* Arriba del buscador: abajo y en texto plano pasaba desapercibido. */}
      <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          ¿Tu nombre no aparece?
        </Typography>
        <BotonNoAparece icono="solar:user-plus-linear" onClick={() => cambiarModo('nuevo')}>
          {textoNuevo}
        </BotonNoAparece>
      </Stack>
      <Autocomplete
        options={opciones}
        value={miembro}
        loading={buscando}
        filterOptions={(x) => x}
        getOptionLabel={(o) => o?.nombre || ''}
        renderOption={({ key, ...props }, o) => (
          <li key={key} {...props}>
            <Box>
              <Typography variant="body2">{o.nombre}</Typography>
              {o.destacamento && (
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  Dest. {o.destacamento}
                </Typography>
              )}
            </Box>
          </li>
        )}
        isOptionEqualToValue={(a, b) => String(a.id) === String(b.id)}
        onInputChange={(_, v) => setTexto(v)}
        onChange={(_, v) => {
          elegirMiembro(v);
          // Valor controlado: sin esto "Búscala o pulsa…" seguía en rojo tras elegir.
          trigger(`${ruta}.miembro`);
        }}
        noOptionsText={
          texto.trim().length < 3 ? 'Escribe al menos 3 letras del nombre' : 'No aparece. Pulsa "No está en la lista".'
        }
        loadingText="Buscando…"
        renderInput={(params) => (
          <TextField
            {...params}
            label={etiqueta}
            placeholder="Escribe el nombre y apellido"
            error={!!error}
            helperText={error}
          />
        )}
      />
    </Stack>
  );
}
