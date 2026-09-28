'use client';

import { useState, useEffect } from 'react';
import { useWatch, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

import cargosDirectiva from 'src/data/cargos-directiva.json';

import { Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------
// "TUS DATOS DE MIEMBRO": los mismos campos de la ficha del miembro del
// dashboard (/level/member), para que la persona los actualice. Se envían con
// el resto y quedan pendientes de revisión, como todo lo de esta página.
//
// Al elegir su nombre se precarga SOLO lo no sensible (nombre, sexo, talla,
// cargos y foto): la página es pública y sin sesión, y cualquiera puede elegir
// cualquier nombre. Fecha de nacimiento y dirección salen vacías siempre; el
// teléfono es el de arriba ("Tu teléfono").
// ----------------------------------------------------------------------

export const SEXOS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
];

export const TALLAS = ['6', '8', '10', '12', '14', '16', 'S', 'M', 'L', 'XL', 'XXL'];

const GRUPO_NIVEL = {
  nacional: 'Consejo Nacional y Ejecutivo',
  regional: 'Regiones',
  seccional: 'Secciones',
};

// Un cargo repetido en varias casillas (los veinte "Oficial Especial") sale una
// sola vez: la casilla concreta la decide quien lo aplique en el dashboard.
const sinRepetir = (lista) => {
  const vistos = new Set();
  return lista.filter((c) => {
    const clave = `${c.nivel}|${c.label}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
};

export const OPCIONES_CARGO_NACIONAL = sinRepetir(
  cargosDirectiva.filter((c) => c.nivel !== 'destacamento')
).map((c) => ({ ...c, grupo: GRUPO_NIVEL[c.nivel] || 'Otros' }));

// Solo los cargos que llenan este formulario. "Líder de Grupo" existe en cada
// división del padrón; aquí basta uno, y la casilla exacta la decide quien lo
// aplique en el dashboard. "Otro cargo" no es una casilla: solo avisa.
const POSICIONES_DEL_FORMULARIO = [
  'destacamento-coordinador-destacamento',
  'destacamento-coordinador-asistente-destacamento',
  'destacamento-pastor',
  'destacamento-exploradores-lider-grupo',
];

export const OPCIONES_POSICION = [
  ...POSICIONES_DEL_FORMULARIO.map((v) => {
    const c = cargosDirectiva.find((x) => x.value === v);
    return { value: v, label: c?.label || v, grupo: '' };
  }),
  { value: 'otro', label: 'Otro cargo', grupo: '' },
];

// La casilla guardada puede ser otra del mismo cargo (p. ej. Oficial Especial 7):
// se enseña la opción que lleva ese nombre.
const opcionDe = (opciones, valor) => {
  if (!valor) return null;
  const directa = opciones.find((o) => o.value === valor);
  if (directa) return directa;
  const original = cargosDirectiva.find((c) => c.value === valor);
  return original ? opciones.find((o) => o.label.startsWith(original.label)) || null : null;
};

export const etiquetaCargo = (valor) =>
  opcionDe([...OPCIONES_CARGO_NACIONAL, ...OPCIONES_POSICION], valor)?.label || '';

function SelectorCargo({ name, label, opciones }) {
  const { control, setValue, formState } = useFormContext();
  const valor = useWatch({ control, name });
  const error = name.split('.').reduce((o, k) => o?.[k], formState.errors)?.message;
  return (
    <Autocomplete
      options={opciones}
      value={opcionDe(opciones, valor)}
      groupBy={(o) => o.grupo}
      getOptionLabel={(o) => o?.label || ''}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      onChange={(_, o) =>
        setValue(name, o?.value || '', { shouldDirty: true, shouldValidate: true })
      }
      renderInput={(params) => (
        <TextField {...params} label={label} error={!!error} helperText={error} />
      )}
      slotProps={{ listbox: { sx: { maxHeight: 320 } } }}
    />
  );
}

const Rejilla = ({ children }) => (
  <Box sx={{ gap: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
    {children}
  </Box>
);

export function DatosMiembro({ destacamento }) {
  const { control, setValue } = useFormContext();
  const modo = useWatch({ control, name: 'remitente.modo' });
  const elegido = useWatch({ control, name: 'remitente.miembro' });
  const [cargando, setCargando] = useState(false);

  // Al elegir (o cambiar) el nombre se precarga su ficha; lo sensible queda vacío.
  const idElegido = elegido?.id;
  useEffect(() => {
    if (!idElegido) return undefined;
    const control_ = new AbortController();
    setCargando(true);
    fetch(`/api/miembros/${encodeURIComponent(idElegido)}/`, { signal: control_.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((f) => {
        if (!f) return;
        setValue('miembro.nombres', f.nombres || '');
        setValue('miembro.apellidos', f.apellidos || '');
        // Un cargo que no está en la lista corta se deja para que lo elija.
        const opcion = opcionDe(OPCIONES_POSICION, f.posicionDestacamento);
        setValue('miembro.posicionDestacamento', opcion?.value || '');
      })
      .catch(() => {})
      .finally(() => setCargando(false));
    return () => control_.abort();
  }, [idElegido, setValue]);

  if (modo === 'existente' && !elegido) return null;

  return (
    // Sin recuadro ni título: van seguidos de "Tu nombre", en el mismo bloque.
    <Stack spacing={3}>

      {cargando ? (
        <Stack spacing={2}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </Stack>
      ) : (
        <>
          {/* Orden: destacamento (se pone solo), nombre, teléfono y posición. */}
          {destacamento}

          {modo === 'existente' && (
            <Rejilla>
              <Field.Text name="miembro.nombres" label="Nombres" />
              <Field.Text name="miembro.apellidos" label="Apellidos" />
            </Rejilla>
          )}

          <Rejilla>
            <Field.Phone
              name="remitente.telefono"
              label="Tu teléfono *"
              defaultCountry="DO"
              maxDigitos={10}
              placeholder="Ej: 809 555 1234"
            />
            <SelectorCargo
              name="miembro.posicionDestacamento"
              label="Posición en tu Destacamento *"
              opciones={OPCIONES_POSICION}
            />
          </Rejilla>
        </>
      )}
    </Stack>
  );
}
