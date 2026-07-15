'use client';

import { Controller, useFieldArray, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

import {
  BLOOD_TYPE_OPTIONS,
  MEDICATION_OPTIONS,
  FOOD_ALLERGY_OPTIONS,
  HEALTH_INSURANCE_OPTIONS,
  ALLERGY_REACTION_OPTIONS,
  MEDICAL_CONDITIONS_OPTIONS,
  HEALTH_INSURANCE_COMPANIES,
  MEDICATION_SCHEDULE_OPTIONS,
  MEDICAL_RELATIONSHIP_OPTIONS,
  ENVIRONMENTAL_ALLERGY_OPTIONS,
} from 'src/_mock/health';

import { Field } from 'src/components/hook-form';
import HeightInput from 'src/components/form/HeightInput';
import WeightInput from 'src/components/form/WeightInput';
import RestrictedText from 'src/components/restricted/RestrictedText';

// ----------------------------------------------------------------------
// Registro unico de los campos que puede contener una solicitud de cambio de la
// Dispensa Médica de un miembro. Cada descriptor sabe: como mostrarse (format) y
// con que input real del formulario de salud se edita (render). Asi el diff que
// envia el lider de grupo y el dialogo con el que revisa el coordinador
// comparten exactamente los mismos componentes (RestrictedText, HeightInput,
// checkboxes, etc.). Es el equivalente de member-change-request-fields para el
// tab de Dispensa Médica.
// ----------------------------------------------------------------------

const SI_NO_LABEL = { yes: 'Sí', no: 'No', unknown: 'Desconocido', '': 'No' };

const HEIGHT_UNIT_LABEL = { meters: 'm', feet: 'pies', cm: 'cm' };
const WEIGHT_UNIT_LABEL = { lbs: 'lb', kg: 'kg' };

const labelFrom = (catalogo, value) => {
  if (value === null || value === undefined || value === '') return '';
  const opcion = catalogo.find((item) => String(item.value ?? item.id) === String(value));
  return opcion?.label ?? String(value);
};

const siNoTexto = (value) => SI_NO_LABEL[value] ?? (value ? 'Sí' : 'No');

const labelsFromArray = (catalogo, values = []) =>
  (Array.isArray(values) ? values : [])
    .map((value) => labelFrom(catalogo, value))
    .filter(Boolean)
    .join(', ');

// ----------------------------------------------------------------------
// Wrappers que enlazan los inputs "controlados" del formulario de salud con el
// react-hook-form del dialogo (via useFormContext), para poder reutilizarlos
// tal cual dentro de la revision, igual que los Field.* se autoconectan.
// ----------------------------------------------------------------------

function RHFRestrictedText({ name, ...props }) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <RestrictedText value={field.value ?? ''} onChange={field.onChange} {...props} />
      )}
    />
  );
}

function RHFHeightInput() {
  const { watch, setValue } = useFormContext();
  return <HeightInput watch={watch} setValue={setValue} />;
}

function RHFWeightInput() {
  const { watch, setValue } = useFormContext();
  return <WeightInput watch={watch} setValue={setValue} />;
}

function RHFAllergyCheckboxes({ name, options }) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={[]}
      render={({ field }) => {
        const current = Array.isArray(field.value) ? field.value : [];

        return (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
              columnGap: 4,
              rowGap: 1,
            }}
          >
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                label={option.label}
                control={
                  <Checkbox
                    checked={current.includes(option.value)}
                    onChange={(event) => {
                      field.onChange(
                        event.target.checked
                          ? [...current, option.value]
                          : current.filter((value) => value !== option.value)
                      );
                    }}
                  />
                }
              />
            ))}
          </Box>
        );
      }}
    />
  );
}

function RHFConditionsCheckboxes() {
  return (
    <Box
      sx={{
        rowGap: 1.5,
        columnGap: 2,
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
      }}
    >
      {MEDICAL_CONDITIONS_OPTIONS.map((item) => (
        <Field.Checkbox
          key={item.id}
          name={`medicalConditions.${item.id}`}
          label={item.label}
        />
      ))}
    </Box>
  );
}

function RHFMedicationsEditor() {
  const { control, watch, setValue } = useFormContext();
  const { fields } = useFieldArray({ control, name: 'medications' });

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {fields.map((item, index) => (
        <Box
          key={item.id}
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          }}
        >
          <RestrictedText
            label="Nombre del medicamento"
            value={watch(`medications.${index}.name`) || ''}
            onChange={(value) => setValue(`medications.${index}.name`, value)}
            allow="all"
            maxLength={30}
          />

          <RestrictedText
            label="Dosis"
            value={watch(`medications.${index}.dose`) || ''}
            onChange={(value) => setValue(`medications.${index}.dose`, value)}
            allow="all"
            maxLength={30}
          />

          <Field.Select name={`medications.${index}.schedule`} label="Horario" multiple>
            {MEDICATION_SCHEDULE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Field.Select>
        </Box>
      ))}
    </Box>
  );
}

// Texto legible del arreglo de medicamentos (para el diff y el resultado).
const formatMedicamentos = (medications = []) =>
  (Array.isArray(medications) ? medications : [])
    .filter((med) => String(med?.name || '').trim())
    .map((med) => {
      const horarios = labelsFromArray(MEDICATION_SCHEDULE_OPTIONS, med?.schedule);
      const dosis = String(med?.dose || '').trim();
      const detalles = [dosis, horarios].filter(Boolean).join(' · ');
      return detalles ? `${med.name} (${detalles})` : String(med.name);
    })
    .join('; ');

const formatCondiciones = (conditions = {}) =>
  MEDICAL_CONDITIONS_OPTIONS.filter((option) => conditions?.[option.id])
    .map((option) => option.label)
    .join(', ');

// ----------------------------------------------------------------------

const RADIO_SI_NO = [
  { label: 'No', value: 'no' },
  { label: 'Sí', value: 'yes' },
];

const selectRender = (name, options) => () => (
  <Field.Select name={name} label={undefined}>
    {options.map((option) => (
      <MenuItem key={option.value} value={option.value}>
        {option.label}
      </MenuItem>
    ))}
  </Field.Select>
);

export const HEALTH_CHANGE_REQUEST_FIELDS = [
  // --- Información médica básica ---
  {
    name: 'healthInsurance',
    label: '¿Tiene seguro médico?',
    seccion: 'Información médica básica',
    format: (v) => labelFrom(HEALTH_INSURANCE_OPTIONS, v.healthInsurance),
    render: selectRender('healthInsurance', HEALTH_INSURANCE_OPTIONS),
  },
  {
    name: 'insuranceName',
    label: 'Nombre del seguro',
    seccion: 'Información médica básica',
    format: (v) => labelFrom(HEALTH_INSURANCE_COMPANIES, v.insuranceName),
    render: selectRender('insuranceName', HEALTH_INSURANCE_COMPANIES),
  },
  {
    name: 'policyNumber',
    label: 'Número de póliza',
    seccion: 'Información médica básica',
    format: (v) => String(v.policyNumber ?? ''),
    render: () => (
      <RHFRestrictedText
        name="policyNumber"
        label="Número de póliza"
        allow="numbers"
        maxLength={12}
      />
    ),
  },
  {
    name: 'bloodType',
    label: 'Tipo de sangre',
    seccion: 'Información médica básica',
    format: (v) => labelFrom(BLOOD_TYPE_OPTIONS, v.bloodType),
    render: selectRender('bloodType', BLOOD_TYPE_OPTIONS),
  },
  {
    name: 'heightApprox',
    label: 'Estatura aproximada',
    seccion: 'Información médica básica',
    keys: ['heightApprox', 'heightUnit'],
    format: (v) =>
      v.heightApprox ? `${v.heightApprox} ${HEIGHT_UNIT_LABEL[v.heightUnit] ?? ''}`.trim() : '',
    render: () => <RHFHeightInput />,
  },
  {
    name: 'weightApprox',
    label: 'Peso aproximado',
    seccion: 'Información médica básica',
    keys: ['weightApprox', 'weightUnit'],
    format: (v) =>
      v.weightApprox ? `${v.weightApprox} ${WEIGHT_UNIT_LABEL[v.weightUnit] ?? ''}`.trim() : '',
    render: () => <RHFWeightInput />,
  },
  {
    name: 'medicalContactName',
    label: 'Contacto médico / responsable',
    seccion: 'Información médica básica',
    format: (v) => String(v.medicalContactName ?? ''),
    render: () => (
      <RHFRestrictedText
        name="medicalContactName"
        label="Nombre del responsable médico"
        allow="all"
        maxLength={60}
      />
    ),
  },
  {
    name: 'medicalPrimaryPhone',
    label: 'Teléfono principal',
    seccion: 'Información médica básica',
    format: (v) => String(v.medicalPrimaryPhone ?? ''),
    render: () => <Field.Text name="medicalPrimaryPhone" label="Teléfono principal" />,
  },
  {
    name: 'medicalSecondaryPhone',
    label: 'Teléfono de emergencia',
    seccion: 'Información médica básica',
    format: (v) => String(v.medicalSecondaryPhone ?? ''),
    render: () => <Field.Text name="medicalSecondaryPhone" label="Teléfono de emergencia" />,
  },
  {
    name: 'medicalRelationship',
    label: 'Relación con el miembro',
    seccion: 'Información médica básica',
    format: (v) => labelFrom(MEDICAL_RELATIONSHIP_OPTIONS, v.medicalRelationship),
    render: selectRender('medicalRelationship', MEDICAL_RELATIONSHIP_OPTIONS),
  },
  {
    name: 'medicalNotes',
    label: 'Información médica adicional',
    seccion: 'Información médica básica',
    format: (v) => String(v.medicalNotes ?? ''),
    render: () => (
      <RHFRestrictedText
        name="medicalNotes"
        label="Información médica adicional"
        allow="all"
        maxLength={500}
        multiline
        rows={3}
      />
    ),
  },
  // --- Medicación ---
  {
    name: 'hasMedication',
    label: '¿Toma algún medicamento?',
    seccion: 'Medicación',
    format: (v) => siNoTexto(v.hasMedication),
    render: () => <Field.RadioGroup row name="hasMedication" options={MEDICATION_OPTIONS} sx={{ gap: 4 }} />,
  },
  {
    name: 'medications',
    label: 'Medicamentos',
    seccion: 'Medicación',
    keys: ['medications'],
    format: (v) => formatMedicamentos(v.medications),
    render: () => <RHFMedicationsEditor />,
  },
  // --- Alergias ---
  {
    name: 'hasAllergies',
    label: '¿Presenta alguna alergia?',
    seccion: 'Alergias',
    format: (v) => siNoTexto(v.hasAllergies),
    render: () => <Field.RadioGroup row name="hasAllergies" options={RADIO_SI_NO} sx={{ gap: 4 }} />,
  },
  {
    name: 'drugAllergy',
    label: 'Alergia a medicamentos',
    seccion: 'Alergias',
    format: (v) => siNoTexto(v.drugAllergy),
    render: () => <Field.RadioGroup row name="drugAllergy" options={RADIO_SI_NO} sx={{ gap: 4 }} />,
  },
  {
    name: 'drugAllergyDetails',
    label: 'Medicamento (alergia)',
    seccion: 'Alergias',
    format: (v) => String(v.drugAllergyDetails ?? ''),
    render: () => (
      <RHFRestrictedText
        name="drugAllergyDetails"
        label="Indique el medicamento"
        allow="all"
        maxLength={50}
      />
    ),
  },
  {
    name: 'hasFoodAllergies',
    label: '¿Alergias alimentarias?',
    seccion: 'Alergias',
    format: (v) => siNoTexto(v.hasFoodAllergies),
    render: () => (
      <Field.RadioGroup row name="hasFoodAllergies" options={RADIO_SI_NO} sx={{ gap: 4 }} />
    ),
  },
  {
    name: 'foodAllergies',
    label: 'Alergias alimentarias',
    seccion: 'Alergias',
    keys: ['foodAllergies'],
    format: (v) => labelsFromArray(FOOD_ALLERGY_OPTIONS, v.foodAllergies),
    render: () => <RHFAllergyCheckboxes name="foodAllergies" options={FOOD_ALLERGY_OPTIONS} />,
  },
  {
    name: 'foodAllergyOther',
    label: 'Otros alimentos (alergia)',
    seccion: 'Alergias',
    format: (v) => String(v.foodAllergyOther ?? ''),
    render: () => (
      <RHFRestrictedText
        name="foodAllergyOther"
        label="Especifique otros alimentos"
        allow="all"
        maxLength={100}
        multiline
        rows={2}
      />
    ),
  },
  {
    name: 'hasEnvironmentalAllergies',
    label: '¿Alergias ambientales?',
    seccion: 'Alergias',
    format: (v) => siNoTexto(v.hasEnvironmentalAllergies),
    render: () => (
      <Field.RadioGroup row name="hasEnvironmentalAllergies" options={RADIO_SI_NO} sx={{ gap: 4 }} />
    ),
  },
  {
    name: 'environmentalAllergies',
    label: 'Alergias ambientales',
    seccion: 'Alergias',
    keys: ['environmentalAllergies'],
    format: (v) => labelsFromArray(ENVIRONMENTAL_ALLERGY_OPTIONS, v.environmentalAllergies),
    render: () => (
      <RHFAllergyCheckboxes name="environmentalAllergies" options={ENVIRONMENTAL_ALLERGY_OPTIONS} />
    ),
  },
  {
    name: 'environmentalAllergyOther',
    label: 'Otros alérgenos ambientales',
    seccion: 'Alergias',
    format: (v) => String(v.environmentalAllergyOther ?? ''),
    render: () => (
      <RHFRestrictedText
        name="environmentalAllergyOther"
        label="Especifique otros alérgenos ambientales"
        allow="all"
        maxLength={100}
        multiline
        rows={2}
      />
    ),
  },
  {
    name: 'allergyReaction',
    label: 'Tipo de reacción',
    seccion: 'Alergias',
    format: (v) => labelFrom(ALLERGY_REACTION_OPTIONS, v.allergyReaction),
    render: selectRender('allergyReaction', ALLERGY_REACTION_OPTIONS),
  },
  // --- Condiciones médicas ---
  {
    name: 'hasMedicalConditions',
    label: '¿Presenta alguna condición médica?',
    seccion: 'Condiciones médicas',
    format: (v) => siNoTexto(v.hasMedicalConditions),
    render: () => (
      <Field.RadioGroup row name="hasMedicalConditions" options={RADIO_SI_NO} sx={{ gap: 4 }} />
    ),
  },
  {
    name: 'medicalConditions',
    label: 'Condiciones médicas',
    seccion: 'Condiciones médicas',
    keys: ['medicalConditions'],
    format: (v) => formatCondiciones(v.medicalConditions),
    render: () => <RHFConditionsCheckboxes />,
  },
  {
    name: 'medicalConditionsOther',
    label: 'Otras condiciones',
    seccion: 'Condiciones médicas',
    format: (v) => String(v.medicalConditionsOther ?? ''),
    render: () => (
      <RHFRestrictedText
        name="medicalConditionsOther"
        label="Otras condiciones"
        allow="all"
        maxLength={100}
        multiline
        rows={2}
      />
    ),
  },
  {
    name: 'surgeryDetails',
    label: 'Detalle de la operación',
    seccion: 'Condiciones médicas',
    format: (v) => String(v.surgeryDetails ?? ''),
    render: () => (
      <RHFRestrictedText
        name="surgeryDetails"
        label="Detalle de la operación"
        allow="all"
        maxLength={100}
        multiline
        rows={2}
      />
    ),
  },
];

const HEALTH_FIELD_BY_NAME = Object.fromEntries(
  HEALTH_CHANGE_REQUEST_FIELDS.map((field) => [field.name, field])
);

export const getHealthChangeField = (name) => HEALTH_FIELD_BY_NAME[name] || null;

// Claves del formulario que abarca un campo (por defecto su propio name).
export const getHealthFieldKeys = (name) =>
  HEALTH_FIELD_BY_NAME[name]?.keys || [name];

// Todas las claves de valores que participan en una solicitud de salud (incluye
// las auxiliares como heightUnit / weightUnit). Sirve para tomar snapshots
// limpios (sin avatar, documentos ni otros campos ajenos a la solicitud).
export const HEALTH_VALUE_KEYS = Array.from(
  new Set(HEALTH_CHANGE_REQUEST_FIELDS.flatMap((field) => field.keys || [field.name]))
);

export const pickHealthValues = (values = {}) =>
  Object.fromEntries(HEALTH_VALUE_KEYS.map((key) => [key, values?.[key] ?? '']));

// Texto legible de un campo a partir del objeto completo de valores del form.
export const formatHealthFieldValue = (name, values = {}) => {
  const field = HEALTH_FIELD_BY_NAME[name];
  if (!field?.format) return String(values?.[name] ?? '');
  return field.format(values);
};

// Calcula el diff (antes/despues) sobre todos los campos de salud comparando el
// texto legible (robusto para arreglos, objetos y selects). `antes` y `despues`
// son los objetos completos de valores del formulario.
export const construirCambiosSalud = (antes = {}, despues = {}) =>
  HEALTH_CHANGE_REQUEST_FIELDS.map(({ name, label }) => {
    const antesTexto = formatHealthFieldValue(name, antes);
    const despuesTexto = formatHealthFieldValue(name, despues);
    const keys = getHealthFieldKeys(name);

    return {
      campo: name,
      label,
      antes: Object.fromEntries(keys.map((key) => [key, antes?.[key] ?? ''])),
      despues: Object.fromEntries(keys.map((key) => [key, despues?.[key] ?? ''])),
      antesTexto,
      despuesTexto,
    };
  }).filter((cambio) => cambio.antesTexto !== cambio.despuesTexto);
