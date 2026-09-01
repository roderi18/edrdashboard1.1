'use client';

import { z as zod } from 'zod';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';

import { PARENTESCOS_DE_TUTOR } from 'src/catalogs/parentescos';
import { obtenerSaludMiembro } from 'src/services/member-health-service';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';
import NameInput from 'src/components/common/name-input';

// ----------------------------------------------------------------------
// Padre, madre o tutor.
//
// Hasta TRES. Una persona tiene padre y madre, y a veces un tutor ademas; mas de
// tres no hace falta y una lista sin tope acaba llena de gente que nadie llama.
//
// De cada uno se guarda a quien llamar y nada mas: nombre y telefono. Sin foto,
// a proposito.
//
// PENDIENTE DE ENGANCHAR. La primera version guardaba en Firestore, con un padre
// y una madre fijos. Se retiro entera al aparecer los endpoints de la API
// —`/api/Tutores` y `/api/Parentesco`—, que llevan este mismo modelo de lista:
//
//   Tutores:     idTutor, nombres, telefono, idParentesco, idMiembro
//   Parentesco:  idParentesco, nombre
//
// Falta el guardado contra esa API. La nota no tiene sitio en `TutoresDTO`:
// queda por decidir si se le pide una columna al backend o se guarda aparte.
// ----------------------------------------------------------------------

const TOPE_NOTA = 500;
const TOPE_NOMBRE = 100;
const MAXIMO_TUTORES = 3;

const TUTOR_VACIO = { nombres: '', telefono: '', parentesco: '' };

/**
 * El telefono, como lo entiende el campo internacional.
 *
 * La Dispensa Medica lo guarda tal como se ve —`(829) 447-4866`—, y con eso el
 * campo de aqui no pinta nada: espera el formato internacional. Se convierte al
 * traerlo, o el numero llegaria vacio y el traspaso quedaria a medias.
 *
 * Diez digitos es un numero dominicano sin el pais; once que empiezan por 1, uno
 * con el. Lo que no encaje se devuelve tal cual: mejor un dato raro visible que
 * un numero inventado.
 */
const enFormatoInternacional = (valor) => {
  const bruto = String(valor ?? '').trim();

  if (!bruto) return '';
  if (bruto.startsWith('+')) return bruto;

  const digitos = bruto.replace(/\D/g, '');

  if (digitos.length === 10) return `+1${digitos}`;
  if (digitos.length === 11 && digitos.startsWith('1')) return `+${digitos}`;

  return bruto;
};

const TutorSchema = zod.object({
  nombres: zod.string().max(TOPE_NOMBRE).optional().or(zod.literal('')),
  telefono: zod.string().max(14).optional().or(zod.literal('')),
  parentesco: zod.string().optional().or(zod.literal('')),
});

const PadresSchema = zod.object({
  tutores: zod.array(TutorSchema).max(MAXIMO_TUTORES),
  nota: zod.string().max(TOPE_NOTA, `La nota no puede pasar de ${TOPE_NOTA} caracteres.`),
});

export function MemberEditParentsForm({
  idMiembro = '',
  readOnly = false,
  puedeEliminar = false,
  // Solo se prellena desde la Dispensa Medica a quien puede VERLA. Traer de ahi
  // un nombre y un telefono para quien no tiene ese permiso seria colarselos por
  // la puerta de atras.
  puedePrellenarDesdeSalud = false,
}) {
  const [prellenado, setPrellenado] = useState(false);

  const methods = useForm({
    resolver: zodResolver(PadresSchema),
    defaultValues: { tutores: [TUTOR_VACIO], nota: '' },
  });

  // EL CONTACTO MEDICO YA ES UN TUTOR: NO SE ESCRIBE DOS VECES.
  //
  // Quien llena la Dispensa Medica pone ahi el nombre, el parentesco y el
  // telefono de quien responde por esa persona. Es exactamente lo que pide esta
  // pestaña, asi que se trae solo.
  //
  // Menos si es el conyuge: un conyuge no es padre, madre ni tutor de nadie, y
  // meterlo aqui seria decir algo que no es.
  useEffect(() => {
    if (prellenado || readOnly || !puedePrellenarDesdeSalud || !idMiembro) return undefined;

    let cancelado = false;

    const traer = async () => {
      const salud = await obtenerSaludMiembro(idMiembro, { secciones: ['general'] }).catch(
        () => null
      );

      if (cancelado || !salud) return;

      const nombre = String(salud.medicalContactName ?? '').trim();
      const parentesco = String(salud.medicalRelationship ?? '').trim();

      if (!nombre || parentesco === 'spouse') return;

      // Solo si la primera fila sigue en blanco: lo que alguien haya escrito
      // aqui manda sobre lo que venga de la otra pantalla.
      const actuales = methods.getValues('tutores') ?? [];
      const primera = actuales[0] ?? {};

      if (primera.nombres || primera.telefono || primera.parentesco) return;

      methods.setValue(
        'tutores.0',
        {
          nombres: nombre.slice(0, TOPE_NOMBRE),
          telefono: enFormatoInternacional(salud.medicalPrimaryPhone),
          parentesco,
        },
        { shouldDirty: false }
      );
      setPrellenado(true);
    };

    traer();

    return () => {
      cancelado = true;
    };
  }, [idMiembro, methods, prellenado, puedePrellenarDesdeSalud, readOnly]);

  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: 'tutores',
  });

  const nota = methods.watch('nota') ?? '';
  const puedeAgregar = !readOnly && fields.length < MAXIMO_TUTORES;

  return (
    <Form methods={methods} onSubmit={(evento) => evento.preventDefault()}>
      <Stack spacing={3}>
        <Card>
          <CardHeader
            title="Padre, madre o tutor"
            subheader={`Hasta ${MAXIMO_TUTORES}. A quién llamar y su número.`}
          />

          <Stack spacing={2} sx={{ p: 3 }}>
            {fields.map((campo, indice) => (
              <Box
                key={campo.id}
                sx={{
                  gap: 2,
                  display: 'grid',
                  alignItems: 'center',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: `2fr 2fr 1.4fr${!puedeEliminar || readOnly || fields.length === 1 ? '' : ' 40px'}`,
                  },
                }}
              >
                <NameInput
                  name={`tutores.${indice}.nombres`}
                  label="Nombres"
                  maxLength={TOPE_NOMBRE}
                  disabled={readOnly}
                />

                <Field.Phone
                  name={`tutores.${indice}.telefono`}
                  label="Núm. Teléfono"
                  defaultCountry="DO"
                  inputProps={{ maxLength: 14 }}
                  disabled={readOnly}
                />

                {/* El MISMO catalogo que la Dispensa Medica. Si un sitio dijera
                    "Tutor" y el otro "Tutor legal", serian dos cosas distintas
                    para la base de datos y nadie sabria cual mirar. */}
                <Field.Select
                  name={`tutores.${indice}.parentesco`}
                  label="Relación con el miembro"
                  disabled={readOnly}
                >
                  {PARENTESCOS_DE_TUTOR.map((opcion) => (
                    <MenuItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </MenuItem>
                  ))}
                </Field.Select>

                {/* Borrar es del Coordinador y su Asistente, no de cualquier
                    cargo: un telefono que desaparece no deja rastro, y el dia que
                    haga falta llamar no habra a quien. El primero se queda
                    siempre, porque la lista vacia no tendria sentido. */}
                {puedeEliminar && !readOnly && fields.length > 1 && (
                  <Tooltip title="Quitar">
                    <IconButton color="error" onClick={() => remove(indice)}>
                      <Iconify icon="solar:trash-bin-trash-bold" width={20} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}

            {!readOnly && (
              <Box
                sx={{
                  gap: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {/* El hueco se reserva aunque no haya boton: si desapareciera,
                    Guardar saltaria de sitio al llegar al tercer tutor. */}
                {puedeAgregar ? (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => append(TUTOR_VACIO)}
                    startIcon={<Iconify icon="mingcute:add-line" />}
                  >
                    Agregar tutor
                  </Button>
                ) : (
                  <span />
                )}

                <Tooltip title="Todavía no guarda: falta conectar /api/Tutores.">
                  {/* El `span` es para que el tooltip funcione sobre un boton
                      apagado; sin el, el navegador no lanza el evento. */}
                  <span>
                    <Button type="submit" variant="contained" disabled>
                      Guardar
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            )}
          </Stack>
        </Card>

        <Card>
          <CardHeader
            title="Nota"
            subheader="Cualquier cosa que convenga saber al llamarles: horarios, quién responde antes, con quién vive."
          />

          <Box sx={{ p: 3 }}>
            <Field.Text
              name="nota"
              label="Nota"
              multiline
              rows={4}
              disabled={readOnly}
              inputProps={{ maxLength: TOPE_NOTA }}
              helperText={`${nota.length}/${TOPE_NOTA}`}
            />
          </Box>
        </Card>
      </Stack>
    </Form>
  );
}
