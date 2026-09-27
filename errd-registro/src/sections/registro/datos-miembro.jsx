'use client';

import { useMemo, useState, useEffect } from 'react';
import { useWatch, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';

import cargosDirectiva from 'src/data/cargos-directiva.json';

import { Field } from 'src/components/hook-form';

import { PROVINCIAS, sectoresDe, municipiosDe } from './catalogo';

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

export const OPCIONES_POSICION = [
  { value: 'none', label: 'Ninguna', grupo: '' },
  ...sinRepetir(cargosDirectiva.filter((c) => c.nivel === 'destacamento')).map((c) => ({
    ...c,
    label: c.nombreDivision ? `${c.label} (${c.nombreDivision})` : c.label,
    grupo: c.nombreDivision || 'General',
  })),
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
  const provincia = useWatch({ control, name: 'miembro.direccion.provincia' });
  const municipio = useWatch({ control, name: 'miembro.direccion.municipio' });
  const municipios = useMemo(() => municipiosDe(provincia), [provincia]);
  const [sectores, setSectores] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let vigente = true;
    sectoresDe(municipio, provincia).then((lista) => vigente && setSectores(lista));
    return () => {
      vigente = false;
    };
  }, [municipio, provincia]);

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
        setValue('miembro', {
          foto: f.foto || null,
          nombres: f.nombres || '',
          apellidos: f.apellidos || '',
          fechaNacimiento: null,
          direccion: { provincia: '', municipio: '', sector: '', calle: '' },
          sexo: f.sexo || '',
          talla: f.talla || '',
          cargoNacional: f.cargoNacional || '',
          posicionDestacamento: f.posicionDestacamento || 'none',
        });
      })
      .catch(() => {})
      .finally(() => setCargando(false));
    return () => control_.abort();
  }, [idElegido, setValue]);

  if (modo === 'existente' && !elegido) return null;

  return (
    <Stack spacing={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, border: (t) => `dashed 1px ${t.vars.palette.divider}` }}>
      <Box>
        <Typography variant="subtitle1">Tus datos de miembro</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Revisa y corrige lo que haga falta. Por tu privacidad, la fecha de nacimiento y la
          dirección no se muestran: escríbelas solo si quieres actualizarlas.
        </Typography>
      </Box>

      {cargando ? (
        <Stack spacing={2}>
          <Skeleton variant="circular" width={120} height={120} sx={{ mx: 'auto' }} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </Stack>
      ) : (
        <>
          <Box sx={{ textAlign: 'center' }}>
            <Field.UploadAvatar name="miembro.foto" optimizationToast={false} />
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
              Tu foto de perfil. Pulsa para cambiarla (PNG, JPG o WEBP).
            </Typography>
          </Box>

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
            <Field.DatePicker
              name="miembro.fechaNacimiento"
              label="Fecha de nacimiento"
              format="DD/MM/YYYY"
              disableFuture
            />
            <Field.Select name="miembro.sexo" label="Sexo">
              {SEXOS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Field.Select>
          </Rejilla>

          <Typography variant="subtitle2">Dirección</Typography>
          <Rejilla>
            <Field.Autocomplete
              name="miembro.direccion.provincia"
              label="Provincia"
              options={PROVINCIAS.map((p) => p.nombre)}
              onChange={(_, v) => {
                setValue('miembro.direccion.provincia', v || '');
                setValue('miembro.direccion.municipio', '');
                setValue('miembro.direccion.sector', '');
              }}
            />
            <Field.Autocomplete
              name="miembro.direccion.municipio"
              label="Municipio"
              disabled={!provincia}
              options={municipios.map((m) => m.nombre)}
              onChange={(_, v) => {
                setValue('miembro.direccion.municipio', v || '');
                setValue('miembro.direccion.sector', '');
              }}
            />
            <Field.Autocomplete
              name="miembro.direccion.sector"
              label="Sector"
              freeSolo
              disabled={!municipio}
              options={sectores}
              onInputChange={(_, v) => setValue('miembro.direccion.sector', v || '')}
            />
            <Field.Text name="miembro.direccion.calle" label="Calle / Número" placeholder="Ej: C/ Principal #123" />
          </Rejilla>

          <Typography variant="subtitle2">Destacamento y cargos</Typography>
          {/* Destacamento a la izquierda y su posición al lado, como en la ficha de la app. */}
          <Box
            sx={{
              gap: 3,
              display: 'grid',
              alignItems: 'start',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            }}
          >
            {destacamento}
            <SelectorCargo
              name="miembro.posicionDestacamento"
              label="Nivel posición en tu Destacamento *"
              opciones={OPCIONES_POSICION}
            />
          </Box>
          <Rejilla>
            <SelectorCargo
              name="miembro.cargoNacional"
              label="Cargo Nacional"
              opciones={OPCIONES_CARGO_NACIONAL}
            />
            <Field.Select name="miembro.talla" label="Size T-Shirt">
              {TALLAS.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Field.Select>
          </Rejilla>
        </>
      )}
    </Stack>
  );
}
