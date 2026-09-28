'use client';

import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { puedeVerEvaluacionDeDestacamento } from 'src/utils/org-level-access';
import { EVALUACION_VACIA, ETIQUETAS_EVALUACION } from 'src/utils/evaluacion-destacamento.mjs';

import {
  leerEvaluacionDeDestacamento,
  guardarEvaluacionDeDestacamento,
} from 'src/services/evaluacion-destacamento-service';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// PESTAÑA "EVALUACIÓN" DE LA FICHA DEL DESTACAMENTO.
//
// Tres datos que solo ven y cambian el Administrador Global y la Oficina
// Nacional (ver `src/utils/evaluacion-destacamento.mjs`). La pestaña ya no sale
// a los demás; esta comprobación cubre a quien llegue por la dirección.
// ----------------------------------------------------------------------

// El calendario devuelve la fecha con hora y zona; se guarda solo el día.
const soloDia = (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD') : '');

export function DestEvaluacionView({ idDestacamento }) {
  const { user } = useAuthContext();
  const puede = puedeVerEvaluacionDeDestacamento(user);
  const [guardada, setGuardada] = useState(null);

  const methods = useForm({ defaultValues: { ...EVALUACION_VACIA } });
  const {
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = methods;

  useEffect(() => {
    if (!puede || !idDestacamento) return undefined;
    let vigente = true;
    leerEvaluacionDeDestacamento(idDestacamento)
      .then((evaluacion) => {
        if (!vigente) return;
        setGuardada(evaluacion);
        reset(evaluacion);
      })
      .catch(() => {
        if (!vigente) return;
        setGuardada({ ...EVALUACION_VACIA });
        toast.error('No se pudo leer la evaluación.');
      });
    return () => {
      vigente = false;
    };
  }, [puede, idDestacamento, reset]);

  const onSubmit = handleSubmit(async (valores) => {
    const nueva = {
      numeroEvaluacion: String(valores.numeroEvaluacion ?? '').trim(),
      fechaEvaluacion: soloDia(valores.fechaEvaluacion),
      fechaEntregaReconocimiento: soloDia(valores.fechaEntregaReconocimiento),
      nota: String(valores.nota ?? '').trim(),
    };
    try {
      const resultado = await guardarEvaluacionDeDestacamento({
        idDestacamento,
        valores: nueva,
        anterior: guardada,
        usuario: user,
      });
      setGuardada(nueva);
      reset(nueva);
      toast.success(
        resultado?.estado === 'sin_cambios' ? 'No había cambios.' : 'Evaluación guardada.'
      );
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la evaluación.');
    }
  });

  if (!puede) {
    return (
      <Alert severity="info">
        La evaluación del destacamento solo la ven la Oficina Nacional y el Administrador Global.
      </Alert>
    );
  }

  return (
    <Card sx={{ p: { xs: 2.5, md: 4 } }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Evaluación
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Solo la ven y la cambian la Oficina Nacional y el Administrador Global.
      </Typography>

      {guardada === null ? (
        <Stack spacing={3}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={56} />
          ))}
        </Stack>
      ) : (
        <Form methods={methods} onSubmit={onSubmit}>
          <Box
            sx={{
              gap: 3,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            }}
          >
            <Field.Text
              name="numeroEvaluacion"
              label={ETIQUETAS_EVALUACION.numeroEvaluacion}
              placeholder="Ej: 12"
            />
            <Field.DatePicker
              name="fechaEvaluacion"
              label={ETIQUETAS_EVALUACION.fechaEvaluacion}
              format="DD/MM/YYYY"
            />
            <Field.DatePicker
              name="fechaEntregaReconocimiento"
              label={ETIQUETAS_EVALUACION.fechaEntregaReconocimiento}
              format="DD/MM/YYYY"
            />
          </Box>
          <Field.Text
            name="nota"
            label={ETIQUETAS_EVALUACION.nota}
            placeholder="Ej: otros teléfonos del pastor: 809-506-7257, 849-210-7257"
            multiline
            minRows={3}
            sx={{ mt: 3 }}
          />
          <Stack direction="row" sx={{ mt: 3, justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" loading={isSubmitting} disabled={!isDirty}>
              Guardar
            </Button>
          </Stack>
        </Form>
      )}
    </Card>
  );
}
