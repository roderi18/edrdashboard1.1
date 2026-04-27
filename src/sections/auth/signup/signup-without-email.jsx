'use client';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { useMemo, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { doc, setDoc, collection } from 'firebase/firestore';
import { getApp, deleteApp, initializeApp } from 'firebase/app';
import { getAuth, updateProfile, createUserWithEmailAndPassword } from 'firebase/auth';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { generateMemberId } from 'src/utils/generate-member-id';

import { CONFIG } from 'src/global-config';
import { FIRESTORE } from 'src/lib/firebase';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const GENERATED_EMAIL_DOMAIN = 'errd.local';
const SECONDARY_FIREBASE_APP_NAME = 'signup-without-email';

const SignUpWithoutEmailSchema = z.object({
  firstName: z.string().min(1, 'Debe ingresar el nombre.'),
  lastName: z.string().min(1, 'Debe ingresar el apellido.'),
  birthdate: z.any().refine((value) => !!value, 'Debe seleccionar la fecha de nacimiento.'),
  dest: z.any().refine((value) => !!value?.id, 'Debe seleccionar un destacamento.'),
});

const normalizeForCredential = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '');

const generatePassword = ({ firstName, birthdate }) => {
  const name = normalizeForCredential(firstName).replace(/\./g, '') || 'usuario';
  const birth = dayjs(birthdate).isValid() ? dayjs(birthdate).format('YYYYMMDD') : '123456';

  return `${name}${birth}`;
};

const buildGeneratedEmail = ({ firstName, lastName, birthdate }) => {
  const name = normalizeForCredential(`${firstName}.${lastName}`) || 'menor';
  const birth = dayjs(birthdate).isValid() ? dayjs(birthdate).format('YYYYMMDD') : 'sinfecha';

  return `${name}${birth}@${GENERATED_EMAIL_DOMAIN}`;
};

const getRowsFromApi = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
};

const normalizeDest = (dest) => {
  const id = dest.idDestacamento ?? dest.id ?? dest.value;
  const name = dest.nombre ?? dest.name ?? dest.label ?? '';
  const destNumber = dest.numero ?? dest.destNumber ?? '';

  return {
    id: String(id ?? ''),
    name: name || `Destacamento ${id}`,
    destNumber,
  };
};

const createSecondaryAuth = () => {
  try {
    return getAuth(getApp(SECONDARY_FIREBASE_APP_NAME));
  } catch {
    return getAuth(initializeApp(CONFIG.firebase, SECONDARY_FIREBASE_APP_NAME));
  }
};

const withTimeout = (promise, milliseconds, errorMessage) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), milliseconds);
    }),
  ]);

const buildCredentialTxt = ({ displayName, userCode, email, password }) =>
  [
    'Registro sin correo',
    '',
    `Nombre: ${displayName}`,
    `Codigo: ${userCode}`,
    `Email: ${email}`,
    `Contrasena: ${password}`,
  ].join('\n');

const downloadCredentials = (credential) => {
  const blob = new Blob([buildCredentialTxt(credential)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName = `${credential.userCode || 'usuario'}-credenciales.txt`;

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

// ----------------------------------------------------------------------

export function SignUpWithoutEmail() {
  const [open, setOpen] = useState(false);
  const [dests, setDests] = useState([]);
  const [isLoadingDests, setIsLoadingDests] = useState(false);
  const [createdCredential, setCreatedCredential] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const defaultValues = useMemo(
    () => ({
      firstName: '',
      lastName: '',
      birthdate: null,
      dest: null,
    }),
    []
  );

  const methods = useForm({
    defaultValues,
    resolver: zodResolver(SignUpWithoutEmailSchema),
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (!open) return;

    const loadDests = async () => {
      try {
        setIsLoadingDests(true);
        setErrorMessage(null);

        const res = await fetch('/api/dest/');

        if (!res.ok) {
          throw new Error('No se pudieron cargar los destacamentos.');
        }

        const data = await res.json();
        const rows = getRowsFromApi(data).map(normalizeDest).filter((dest) => dest.id);

        setDests(rows);
      } catch (error) {
        console.error(error);
        setDests([]);
        setErrorMessage('No se pudieron cargar los destacamentos disponibles.');
      } finally {
        setIsLoadingDests(false);
      }
    };

    loadDests();
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    setCreatedCredential(null);
    setErrorMessage(null);
    reset(defaultValues);
  };

  const onSubmit = handleSubmit(async (data) => {
    let secondaryAuth = null;

    try {
      setErrorMessage(null);
      setCreatedCredential(null);

      const userCode = await generateMemberId();
      const password = generatePassword({
        firstName: data.firstName,
        birthdate: data.birthdate,
      });
      const email = buildGeneratedEmail({
        firstName: data.firstName,
        lastName: data.lastName,
        birthdate: data.birthdate,
      });
      const displayName = `${data.firstName} ${data.lastName}`.trim();
      secondaryAuth = createSecondaryAuth();

      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);

      setCreatedCredential({ email, password, displayName, userCode });

      try {
        await withTimeout(
          updateProfile(credential.user, { displayName }),
          8000,
          'El usuario fue creado, pero no se pudo actualizar el nombre.'
        );

        await withTimeout(
          setDoc(doc(collection(FIRESTORE, 'users'), credential.user.uid), {
            uid: credential.user.uid,
            email,
            codigoMiembro: userCode,
            displayName,
            firstName: data.firstName,
            lastName: data.lastName,
            birthdate: dayjs(data.birthdate).format('YYYY-MM-DD'),
            idDestacamento: Number(data.dest.id),
            destName: data.dest.name,
            authMode: 'generated-email',
            emailVerifiedBypass: true,
            createdAt: new Date().toISOString(),
          }),
          8000,
          'El usuario fue creado, pero no se pudo guardar su perfil extra.'
        );
      } catch (profileError) {
        console.warn(profileError);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.message || 'No se pudo crear el usuario sin correo.');
    } finally {
      if (secondaryAuth?.app) {
        deleteApp(secondaryAuth.app).catch(() => { });
      }
    }
  });

  return (
    <>
      <Button
        fullWidth
        color="inherit"
        variant="outlined"
        startIcon={<Iconify icon="solar:user-plus-bold" />}
        onClick={() => setOpen(true)}
      >
        Registro sin correo
      </Button>

      <Dialog fullWidth maxWidth="sm" open={open} onClose={handleClose}>
        <DialogTitle>Registro sin correo</DialogTitle>

        <Form methods={methods} onSubmit={onSubmit}>
          <DialogContent>
            <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Para menores sin correo, se generará un usuario interno con email y contraseña.
                Guarda estos datos antes de cerrar esta ventana.
              </Typography>

              {!!errorMessage && <Alert severity="error">{errorMessage}</Alert>}

              {!!createdCredential && (
                <Alert
                  severity="success"
                  action={
                    <IconButton
                      color="success"
                      size="small"
                      title="Descargar credenciales"
                      onClick={() => downloadCredentials(createdCredential)}
                    >
                      <Iconify icon="solar:download-bold" />
                    </IconButton>
                  }
                >
                  <Typography variant="subtitle2">Usuario creado</Typography>
                  <Typography variant="body2">Nombre: {createdCredential.displayName}</Typography>
                  <Typography variant="body2">Código: {createdCredential.userCode}</Typography>
                  <Typography variant="body2">Email: {createdCredential.email}</Typography>
                  <Typography variant="body2">Contraseña: {createdCredential.password}</Typography>
                </Alert>
              )}

              <Divider />

              <Box
                sx={{
                  gap: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                }}
              >
                <Field.Text name="firstName" label="Nombre" />
                <Field.Text name="lastName" label="Apellido" />
              </Box>

              <Field.DatePicker
                name="birthdate"
                label="Fecha de nacimiento"
                slotProps={{ textField: { fullWidth: true } }}
              />

              <Field.Autocomplete
                name="dest"
                label="Destacamento"
                options={dests}
                loading={isLoadingDests}
                loadingText="Cargando destacamentos..."
                noOptionsText={
                  isLoadingDests ? 'Cargando destacamentos...' : 'No hay destacamentos disponibles'
                }
                getOptionLabel={(option) =>
                  typeof option === 'string'
                    ? option
                    : `${option?.name || ''} ${option?.destNumber || ''}`.trim()
                }
                isOptionEqualToValue={(option, value) => option.id === value?.id}
              />
            </Box>
          </DialogContent>

          <DialogActions>
            <Button color="inherit" onClick={handleClose}>
              Cerrar
            </Button>
            <Button type="submit" variant="contained" loading={isSubmitting}>
              Crear usuario
            </Button>
          </DialogActions>
        </Form>
      </Dialog>
    </>
  );
}
