'use client';

import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import CardHeader from '@mui/material/CardHeader';
import LoadingButton from '@mui/lab/LoadingButton';

import {
  PADRES_VACIO,
  obtenerPadresDelMiembro,
  guardarPadresDelMiembro,
} from 'src/services/padres-miembro-service';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import NameInput from 'src/components/common/name-input';

// ----------------------------------------------------------------------
// Padres o tutores.
//
// Dos personas y una nota. Los campos son los MISMOS que en la ficha del
// miembro —el de nombre con su contador y sus reglas, el de telefono con su
// bandera—: si en un sitio no se dejan escribir numeros en un nombre, aqui
// tampoco.
//
// No hay foto, a proposito: de los padres se guarda a quien llamar, no su cara.
// ----------------------------------------------------------------------

const TOPE_NOTA = 500;

const PersonaSchema = zod.object({
  nombres: zod.string().max(60).optional().or(zod.literal('')),
  apellidos: zod.string().max(60).optional().or(zod.literal('')),
  telefono: zod.string().max(14).optional().or(zod.literal('')),
});

const PadresSchema = zod.object({
  padre: PersonaSchema,
  madre: PersonaSchema,
  nota: zod.string().max(TOPE_NOTA, `La nota no puede pasar de ${TOPE_NOTA} caracteres.`),
});

function BloqueDePersona({ prefijo, titulo, readOnly }) {
  return (
    <Card>
      <CardHeader title={titulo} />

      <Box
        sx={{
          p: 3,
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        }}
      >
        <NameInput name={`${prefijo}.nombres`} label="Nombres" maxLength={60} disabled={readOnly} />

        <NameInput
          name={`${prefijo}.apellidos`}
          label="Apellidos"
          maxLength={60}
          disabled={readOnly}
        />

        <Field.Phone
          name={`${prefijo}.telefono`}
          label="Núm. Teléfono"
          defaultCountry="DO"
          inputProps={{ maxLength: 14 }}
          disabled={readOnly}
        />
      </Box>
    </Card>
  );
}

export function MemberEditParentsForm({ currentMember, readOnly = false }) {
  const idMiembro = currentMember?.id ?? currentMember?.idMiembros ?? '';
  const [cargando, setCargando] = useState(true);

  const methods = useForm({
    resolver: zodResolver(PadresSchema),
    defaultValues: PADRES_VACIO,
  });

  const {
    reset,
    watch,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = methods;

  const nota = watch('nota') ?? '';

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      try {
        const guardado = await obtenerPadresDelMiembro(idMiembro);

        if (!cancelado) reset(guardado);
      } catch (error) {
        if (!cancelado) toast.error(error?.message || 'No se pudo cargar la información.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    cargar();

    return () => {
      cancelado = true;
    };
  }, [idMiembro, reset]);

  // Guardar SI espera al servidor. Esto no es un "me gusta": son los telefonos a
  // los que se llama cuando a un menor le pasa algo, y decir "guardado" sin
  // estar seguro seria justo la clase de mentira que aqui no se puede permitir.
  const onSubmit = handleSubmit(async (datos) => {
    try {
      const guardado = await guardarPadresDelMiembro({ idMiembro, ...datos });

      reset(guardado ?? datos);
      toast.success('Información guardada.');
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la información.');
    }
  });

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Stack spacing={3}>
        <BloqueDePersona prefijo="padre" titulo="Padre o tutor" readOnly={readOnly || cargando} />

        <BloqueDePersona prefijo="madre" titulo="Madre o tutora" readOnly={readOnly || cargando} />

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
              disabled={readOnly || cargando}
              inputProps={{ maxLength: TOPE_NOTA }}
              helperText={`${nota.length}/${TOPE_NOTA}`}
            />
          </Box>
        </Card>

        {!readOnly && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <LoadingButton
              type="submit"
              variant="contained"
              loading={isSubmitting}
              disabled={cargando || !isDirty}
            >
              Guardar cambios
            </LoadingButton>
          </Box>
        )}
      </Stack>
    </Form>
  );
}
