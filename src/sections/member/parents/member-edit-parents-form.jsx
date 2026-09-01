'use client';

import { z as zod } from 'zod';
import { useRef, useState, useEffect } from 'react';
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
import LoadingButton from '@mui/lab/LoadingButton';

import { obtenerSaludMiembro } from 'src/services/member-health-service';
import { crearNotificacionUsuario } from 'src/services/notification-service';
import { PARENTESCOS_DE_TUTOR, etiquetaDeParentesco } from 'src/catalogs/parentescos';
import { obtenerCuentasDeCoordinadores } from 'src/services/member-info-access-service';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';
import {
  obtenerTutoresDelMiembro,
  guardarTutoresDelMiembro,
  obtenerNotaTutoresDelMiembro,
  guardarNotaTutoresDelMiembro,
} from 'src/services/tutores-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';
import NameInput from 'src/components/common/name-input';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------
// Padre, madre o tutor.
//
// Hasta TRES. Una persona tiene padre y madre, y a veces un tutor ademas; mas de
// tres no hace falta y una lista sin tope acaba llena de gente que nadie llama.
//
// De cada uno se guarda a quien llamar y nada mas: nombre y telefono. Sin foto,
// a proposito.
//
// Los tutores se guardan mediante los endpoints de la API:
//
//   Tutores:     idTutor, nombres, telefono, idParentesco, idMiembro
//   Parentesco:  idParentesco, nombre
//
// La nota no tiene sitio en `TutoresDTO`; se almacena por separado mediante
// `/api/miembros/tutores/nota` y se autoguarda mientras el usuario escribe.
// ----------------------------------------------------------------------

const TOPE_NOTA = 500;
const TOPE_NOMBRE = 100;
const MAXIMO_TUTORES = 3;

const TUTOR_VACIO = { idTutor: 0, nombres: '', telefono: '', parentesco: '' };

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
  idTutor: zod.number().optional(),
  nombres: zod.string().max(TOPE_NOMBRE).optional().or(zod.literal('')),
  telefono: zod.string().max(14).optional().or(zod.literal('')),
  parentesco: zod.string().optional().or(zod.literal('')),
});

const PadresSchema = zod.object({
  tutores: zod.array(TutorSchema).max(MAXIMO_TUTORES),
  nota: zod.string().max(TOPE_NOTA, `La nota no puede pasar de ${TOPE_NOTA} caracteres.`),
});

/** Como se cuenta en el Historial: nombres y parentesco, que es lo que importa. */
const describirTutores = (tutores = []) =>
  tutores
    .map((tutor) =>
      `${tutor.nombres || 'sin nombre'} (${etiquetaDeParentesco(tutor.parentesco)})`.trim()
    )
    .join(', ') || 'ninguno';

export function MemberEditParentsForm({
  idMiembro = '',
  idDestacamento = null,
  nombreDelMiembro = '',
  usuario = null,
  readOnly = false,
  puedeEliminar = false,
  // Solo se prellena desde la Dispensa Medica a quien puede VERLA. Traer de ahi
  // un nombre y un telefono para quien no tiene ese permiso seria colarselos por
  // la puerta de atras.
  puedePrellenarDesdeSalud = false,
}) {
  const [prellenado, setPrellenado] = useState(false);
  const [cargando, setCargando] = useState(true);
  // Lo que habia al abrir, para poder contar en el Historial que cambio.
  const tutoresIniciales = useRef([]);
  const notaActual = useRef('');
  const notaGuardada = useRef('');
  const notaListaParaAutoguardar = useRef(false);
  const notaEnviadaAlSalir = useRef('');
  // Que fila se esta a punto de borrar. `null` es "ninguna": el cero es una fila
  // valida y con un booleano se habria perdido cual.
  const [porBorrar, setPorBorrar] = useState(null);
  const [guardandoBorrado, setGuardandoBorrado] = useState(false);
  const [estadoNota, setEstadoNota] = useState('idle');

  const methods = useForm({
    resolver: zodResolver(PadresSchema),
    defaultValues: { tutores: [TUTOR_VACIO], nota: '' },
  });

  // Lo que ya esta guardado manda. Se carga primero; el prellenado desde la
  // Dispensa solo entra si esto no trajo nada.
  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      if (!idMiembro) {
        setCargando(false);
        return;
      }

      try {
        const [guardados, resultadoNota] = await Promise.all([
          obtenerTutoresDelMiembro(idMiembro),
          obtenerNotaTutoresDelMiembro(idMiembro)
            .then((notaPersistida) => ({ ok: true, notaPersistida }))
            .catch((error) => ({ ok: false, notaPersistida: '', error })),
        ]);

        if (cancelado) return;

        tutoresIniciales.current = guardados;
        notaActual.current = resultadoNota.notaPersistida;
        notaGuardada.current = resultadoNota.notaPersistida;
        notaEnviadaAlSalir.current = resultadoNota.notaPersistida;
        notaListaParaAutoguardar.current = resultadoNota.ok;

        methods.reset({
          tutores: guardados.length ? guardados : [TUTOR_VACIO],
          nota: resultadoNota.notaPersistida,
        });

        if (!resultadoNota.ok) {
          setEstadoNota('error');
          toast.error(resultadoNota.error?.message || 'No se pudo cargar la nota de tutores.');
        }

        if (guardados.length) {
          setPrellenado(true);
        }
      } catch (error) {
        if (!cancelado) toast.error(error?.message || 'No se pudieron cargar los tutores.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    cargar();

    return () => {
      cancelado = true;
    };
  }, [idMiembro, methods]);

  /** Se avisa al Coordinador de Destacamento y a su Asistente, los dos. */
  const avisarALaCoordinacion = async ({ despues }) => {
    const cuentas = await obtenerCuentasDeCoordinadores(idDestacamento);

    if (!cuentas.length) return;

    await crearNotificacionUsuario({
      tipoNotificacion: 'tutores_actualizados',
      modulo: 'miembros',
      titulo: 'Tutores actualizados',
      mensaje: `${nombreDeQuienEdita} actualizó los tutores de ${nombreDelMiembro || 'un miembro'}.`,
      prioridad: 'informativa',
      entidadTipo: 'miembro',
      entidadId: String(idMiembro),
      ruta: `/dashboard/level/member/${idMiembro}/edit/parents`,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver tutores',
      metadatos: { idMiembro: String(idMiembro), cuantos: despues.length },
      usuario,
      idsDestinatarios: cuentas,
    });
  };

  // TODO CAMBIO PASA POR LA PUERTA.
  //
  // No se guarda contra la API a pelo: `proponerCambio` lo registra en Historial
  // ANTES de aplicarlo. Los tutores son a quien se llama cuando a un menor le
  // pasa algo; que quede quien los cambio, y cuando, no es un adorno.
  const guardarCambios = async (datos) => {
    const antes = tutoresIniciales.current;
    const despues = datos.tutores.filter((tutor) => tutor.nombres || tutor.telefono);

    try {
      await proponerCambio({
        ambito: AMBITOS_CAMBIO.miembro,
        entidad: { id: String(idMiembro), nombre: nombreDelMiembro },
        cambios: [
          {
            campo: 'tutores',
            antes: describirTutores(antes),
            despues: describirTutores(despues),
          },
        ],
        usuario,
        aplicarDirecto: true,
        descripcion: `Se actualizaron los tutores de ${nombreDelMiembro || 'un miembro'}.`,
        aplicar: async () => {
          const guardados = await guardarTutoresDelMiembro({
            idMiembro,
            tutores: datos.tutores,
          });

          tutoresIniciales.current = guardados;
          methods.reset({
            tutores: guardados.length ? guardados : [TUTOR_VACIO],
            nota: datos.nota,
          });
        },
      });

      toast.success('Tutores guardados.');

      // EL AVISO VA DESPUES, Y NO PUEDE TUMBAR EL GUARDADO.
      //
      // Los tutores ya estan guardados. Si el aviso falla —no hay coordinador
      // asignado, la red se cae—, se anota y se sigue: quedarse sin avisar es un
      // problema, perder el guardado por eso seria mucho peor.
      avisarALaCoordinacion({ despues }).catch((error) => {
        console.warn('[tutores] no se pudo avisar a la coordinación', error);
      });

      return true;
    } catch (error) {
      toast.error(error?.message || 'No se pudieron guardar los tutores.');

      return false;
    }
  };

  const onSubmit = methods.handleSubmit(guardarCambios);

  // EL CONTACTO MEDICO YA ES UN TUTOR: NO SE ESCRIBE DOS VECES.
  //
  // Quien llena la Dispensa Medica pone ahi el nombre, el parentesco y el
  // telefono de quien responde por esa persona. Es exactamente lo que pide esta
  // pestaña, asi que se trae solo.
  //
  // Menos si es el conyuge: un conyuge no es padre, madre ni tutor de nadie, y
  // meterlo aqui seria decir algo que no es.
  useEffect(() => {
    if (cargando || prellenado || readOnly || !puedePrellenarDesdeSalud || !idMiembro) {
      return undefined;
    }

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
  }, [cargando, idMiembro, methods, prellenado, puedePrellenarDesdeSalud, readOnly]);

  const { fields, append } = useFieldArray({
    control: methods.control,
    name: 'tutores',
  });

  const nota = methods.watch('nota') ?? '';
  const nombreDeQuienEdita = usuario?.displayName || usuario?.nombre || 'Alguien';

  useEffect(() => {
    notaActual.current = nota;
  }, [nota]);

  // Se guarda después de una pausa breve. Así navegar o recargar no es el
  // mecanismo principal de persistencia: para entonces la nota normalmente ya
  // está en el servidor. No se muestran toasts por cada pausa; el estado queda
  // junto al contador del campo.
  useEffect(() => {
    if (
      cargando ||
      readOnly ||
      !idMiembro ||
      !notaListaParaAutoguardar.current ||
      nota === notaGuardada.current
    ) {
      return undefined;
    }

    setEstadoNota('pending');

    const timeout = window.setTimeout(async () => {
      const valorAEnviar = nota;
      setEstadoNota('saving');

      try {
        const guardada = await guardarNotaTutoresDelMiembro({
          idMiembro,
          nota: valorAEnviar,
        });

        notaGuardada.current = guardada;
        notaEnviadaAlSalir.current = guardada;

        if (notaActual.current === valorAEnviar) {
          methods.resetField('nota', { defaultValue: guardada });
          setEstadoNota('saved');
        }
      } catch (error) {
        setEstadoNota('error');
        console.warn('[tutores] no se pudo autoguardar la nota', error);
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [cargando, idMiembro, methods, nota, readOnly]);

  // Respaldo para una salida inmediata antes de que venzan los 700 ms. `keepalive`
  // permite al navegador terminar esta petición corta mientras abandona la página.
  useEffect(() => {
    const guardarAntesDeSalir = () => {
      const pendiente = notaActual.current;

      if (
        readOnly ||
        !idMiembro ||
        !notaListaParaAutoguardar.current ||
        pendiente === notaGuardada.current ||
        pendiente === notaEnviadaAlSalir.current
      ) {
        return;
      }

      notaEnviadaAlSalir.current = pendiente;
      guardarNotaTutoresDelMiembro({ idMiembro, nota: pendiente, keepalive: true }).catch(
        (error) => console.warn('[tutores] no se pudo guardar la nota al salir', error)
      );
    };

    window.addEventListener('pagehide', guardarAntesDeSalir);

    return () => {
      window.removeEventListener('pagehide', guardarAntesDeSalir);
      guardarAntesDeSalir();
    };
  }, [idMiembro, readOnly]);

  /** Como se llama la fila que se va a quitar, para poder decirlo en la pregunta. */
  const nombreDeLaFila = (indice) =>
    String(methods.getValues(`tutores.${indice}.nombres`) ?? '').trim();
  const puedeAgregar = !readOnly && fields.length < MAXIMO_TUTORES;

  // Confirmar "Quitar" es una accion completa: calcula la lista sin esa fila y
  // la guarda por la misma puerta que el boton Guardar (historial, API y aviso).
  // Si falla, el dialogo y la fila permanecen para que se pueda reintentar.
  const confirmarBorrado = async () => {
    if (porBorrar === null || guardandoBorrado) return;

    const datos = methods.getValues();
    const datosSinTutor = {
      ...datos,
      tutores: (datos.tutores ?? []).filter((_, indice) => indice !== porBorrar),
    };

    setGuardandoBorrado(true);

    try {
      const guardado = await guardarCambios(datosSinTutor);

      if (guardado) setPorBorrar(null);
    } finally {
      setGuardandoBorrado(false);
    }
  };

  return (
    <Form methods={methods} onSubmit={onSubmit}>
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
                    <IconButton color="error" onClick={() => setPorBorrar(indice)}>
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

                <LoadingButton
                  type="submit"
                  variant="contained"
                  loading={methods.formState.isSubmitting}
                  disabled={cargando}
                >
                  Guardar
                </LoadingButton>
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
              helperText={`${nota.length}/${TOPE_NOTA} · ${
                estadoNota === 'saving' || estadoNota === 'pending'
                  ? 'Guardando…'
                  : estadoNota === 'saved'
                    ? 'Guardado automáticamente'
                    : estadoNota === 'error'
                      ? 'No se pudo guardar; se reintentará al salir'
                      : 'Autoguardado activado'
              }`}
            />
          </Box>
        </Card>
      </Stack>

      {/* SE PREGUNTA ANTES DE QUITAR.
          La papelera esta al lado de los campos y se pulsa sin querer. Y lo que
          se quita es un telefono de emergencia: no deja rastro de que existio, y
          el dia que haga falta llamar no habra a quien. Una pregunta cuesta un
          segundo; recuperarlo, una llamada a la familia. */}
      <ConfirmDialog
        open={porBorrar !== null}
        onClose={() => {
          if (!guardandoBorrado) setPorBorrar(null);
        }}
        title="Quitar este tutor"
        content={
          porBorrar === null
            ? ''
            : `Se quitará a ${nombreDeLaFila(porBorrar) || 'este tutor'} de la ficha y el cambio se guardará de inmediato.`
        }
        action={
          <LoadingButton
            color="error"
            variant="contained"
            loading={guardandoBorrado}
            onClick={confirmarBorrado}
          >
            Quitar
          </LoadingButton>
        }
      />
    </Form>
  );
}
