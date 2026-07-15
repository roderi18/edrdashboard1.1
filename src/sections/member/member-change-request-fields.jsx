'use client';

import dayjs from 'dayjs';

import MenuItem from '@mui/material/MenuItem';

import barriosData from 'src/data/barrios.json';
import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';
import { NIVELES_DIRECTIVA } from 'src/services/directivas-organizacionales-service';
import {
  MEMBER_GENDERS,
  MEMBER_SHIRT_SIZES,
  MEMBER_OCUPATIONS_SORTED,
} from 'src/catalogs/member-catalogs';

import { Field } from 'src/components/hook-form';
import NameInput from 'src/components/common/name-input';
import LocationSelect from 'src/components/location/location-select';
import CargoSelectApi from 'src/components/api/cargo-institucional-select-api';

// ----------------------------------------------------------------------
// Registro unico de los campos que puede contener una solicitud de cambio de
// miembro. Cada descriptor sabe: como mostrarse (format) y con que input real
// del formulario de miembro se edita (render). Asi el diff que envia el lider y
// el dialogo con el que revisa el coordinador comparten exactamente los mismos
// componentes y comportamiento (limite de caracteres, sanitizacion, etc.).
// ----------------------------------------------------------------------

// Reproduce el mapeo de LocationSelect (municipio: id = indice + 1; sector: id
// del barrio) para resolver los IDs de ubicacion a su nombre legible.
const nombreProvincia = (id) =>
  provinciasData.find((p) => String(p.id) === String(id))?.nombre || '';
const nombreMunicipio = (id) =>
  id === null || id === undefined || id === ''
    ? ''
    : municipiosData[Number(id) - 1]?.nombre || '';
const nombreSector = (id) => barriosData.find((b) => String(b.id) === String(id))?.nombre || '';

const labelDesdeCatalogo = (catalogo, value) => {
  if (value === null || value === undefined || value === '') return '';
  // Algunos autocompletes (p. ej. ocupacion) guardan el objeto {value,label}.
  if (typeof value === 'object') return value.label ?? labelDesdeCatalogo(catalogo, value.value);
  const opcion = catalogo.find((item) => String(item.value) === String(value));
  return opcion?.label ?? String(value);
};

const formatFecha = (value) => {
  if (!value) return '';
  const fecha = dayjs(value);
  return fecha.isValid() ? fecha.format('DD/MM/YYYY') : '';
};

const nombreDestacamento = (id, dests = []) => {
  if (id === null || id === undefined || id === '') return '';
  const dest = dests.find((d) => String(d?.id ?? d?.idDestacamento ?? d?.value) === String(id));
  if (!dest) return String(id);
  return `${dest?.name ?? dest?.nombre ?? ''} ${dest?.destNumber ?? dest?.numero ?? ''}`.trim();
};

const formatInstructorCI = (value) => {
  if (value === null || value === undefined || value === '') return '';
  return String(value) === '1' ? 'Sí' : 'No';
};

// ----------------------------------------------------------------------

export const MEMBER_CHANGE_REQUEST_FIELDS = [
  {
    name: 'firstName',
    label: 'Nombres',
    format: (value) => String(value ?? ''),
    render: ({ disabled }) => <NameInput name="firstName" label="Nombres" maxLength={60} disabled={disabled} />,
  },
  {
    name: 'lastName',
    label: 'Apellidos',
    format: (value) => String(value ?? ''),
    render: ({ disabled }) => <NameInput name="lastName" label="Apellidos" maxLength={60} disabled={disabled} />,
  },
  {
    name: 'birthdate',
    label: 'Fecha de nacimiento',
    format: (value) => formatFecha(value),
    render: ({ disabled }) => (
      <Field.DatePicker
        name="birthdate"
        label="Fecha de nacimiento"
        format="DD/MM/YYYY"
        views={['year', 'month', 'day']}
        disabled={disabled}
      />
    ),
  },
  {
    name: 'phoneNumber',
    label: 'Núm. Teléfono',
    format: (value) => String(value ?? ''),
    render: ({ disabled }) => (
      <Field.Phone
        name="phoneNumber"
        label="Núm. Teléfono"
        defaultCountry="DO"
        inputProps={{ maxLength: 14 }}
        disabled={disabled}
      />
    ),
  },
  {
    name: 'email',
    label: 'Correo electrónico',
    format: (value) => String(value ?? ''),
    render: ({ disabled }) => (
      <Field.Text name="email" label="Correo electrónico" disabled={disabled} />
    ),
  },
  // Dirección: se renderiza como un unico bloque con LocationSelect (los 4 campos
  // son en cascada). Se marca `grupo` para agrupar las filas del dialogo.
  {
    name: 'provinceId',
    label: 'Provincia',
    grupo: 'direccion',
    format: (value) => nombreProvincia(value),
  },
  {
    name: 'municipioId',
    label: 'Municipio',
    grupo: 'direccion',
    format: (value) => nombreMunicipio(value),
  },
  {
    name: 'sectorId',
    label: 'Sector',
    grupo: 'direccion',
    format: (value) => nombreSector(value),
  },
  {
    name: 'street',
    label: 'Calle / Número',
    grupo: 'direccion',
    format: (value) => String(value ?? ''),
  },
  {
    name: 'ocupation',
    label: 'Ocupación',
    format: (value) => labelDesdeCatalogo(MEMBER_OCUPATIONS_SORTED, value),
    render: ({ disabled }) => (
      <Field.Autocomplete
        name="ocupation"
        label="Ocupación"
        disabled={disabled}
        options={MEMBER_OCUPATIONS_SORTED}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option?.label || '')}
        isOptionEqualToValue={(option, value) => option.value === value?.value}
        ListboxProps={{ sx: { maxHeight: 260 } }}
      />
    ),
  },
  {
    name: 'gender',
    label: 'Sexo',
    format: (value) => labelDesdeCatalogo(MEMBER_GENDERS, value),
    render: ({ disabled }) => (
      <Field.Autocomplete
        name="gender"
        label="Sexo"
        disabled={disabled}
        options={MEMBER_GENDERS}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option?.label || '')}
        isOptionEqualToValue={(option, value) => option.value === value?.value}
      />
    ),
  },
  {
    name: 'shirtSize',
    label: 'Size T-Shirt',
    format: (value) => labelDesdeCatalogo(MEMBER_SHIRT_SIZES, value),
    render: ({ disabled }) => (
      <Field.Select name="shirtSize" label="Size T-Shirt" disabled={disabled}>
        {MEMBER_SHIRT_SIZES.map((size) => (
          <MenuItem key={size.value} value={size.value}>
            {size.label}
          </MenuItem>
        ))}
      </Field.Select>
    ),
  },
  {
    name: 'destId',
    label: 'Tu Destacamento',
    format: (value, ctx = {}) => nombreDestacamento(value, ctx.dests),
    render: ({ disabled, dests = [] }) => (
      <Field.Autocomplete
        name="destId"
        label="Tu Destacamento"
        disabled={disabled}
        options={dests}
        getOptionLabel={(option) =>
          typeof option === 'string'
            ? option
            : `${option?.name || ''} ${option?.destNumber || ''}`.trim()
        }
        isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
      />
    ),
  },
  {
    name: 'memberPosition',
    label: 'Nivel posición en tu Destacamento',
    format: (value) => String(value ?? ''),
    render: ({ disabled }) => (
      <CargoSelectApi
        name="memberPosition"
        label="Nivel posición en tu Destacamento"
        niveles={[NIVELES_DIRECTIVA.destacamento]}
        groupByDivision
        includeNone
        disabled={disabled}
      />
    ),
  },
  {
    name: 'nationalLeadershipRole',
    label: 'Cargo Nacional',
    format: (value) => String(value ?? ''),
    render: ({ disabled }) => (
      <CargoSelectApi
        name="nationalLeadershipRole"
        label="Cargo Nacional"
        niveles={[
          NIVELES_DIRECTIVA.nacional,
          NIVELES_DIRECTIVA.regional,
          NIVELES_DIRECTIVA.seccional,
        ]}
        groupByLevel
        disabled={disabled}
      />
    ),
  },
  {
    name: 'InstructorCertificadoCI',
    label: '¿Instructor Certificado?',
    format: (value) => formatInstructorCI(value),
    render: ({ disabled }) => (
      <Field.Select name="InstructorCertificadoCI" label="¿Instructor Certificado?" disabled={disabled}>
        <MenuItem value={1}>Sí</MenuItem>
        <MenuItem value={0}>No</MenuItem>
      </Field.Select>
    ),
  },
];

const FIELD_BY_NAME = Object.fromEntries(MEMBER_CHANGE_REQUEST_FIELDS.map((field) => [field.name, field]));

export const getMemberChangeField = (name) => FIELD_BY_NAME[name] || null;

// Texto legible de un valor crudo (ID/codigo/fecha) para un campo dado.
export const formatMemberFieldValue = (name, value, ctx = {}) => {
  const field = FIELD_BY_NAME[name];
  if (!field?.format) return String(value ?? '');
  return field.format(value, ctx);
};

// Los campos de direccion se editan juntos con LocationSelect.
export const isAddressField = (name) => FIELD_BY_NAME[name]?.grupo === 'direccion';

export { LocationSelect };
