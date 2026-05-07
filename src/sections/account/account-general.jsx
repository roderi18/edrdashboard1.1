'use client';

import * as z from 'zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { updateProfile } from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';

import { fileToDataUrl, getAdminProfileRef, buildAdminDisplayName } from 'src/utils/admin-profile';

import { AUTH, FIRESTORE } from 'src/lib/firebase';
import { SignOutButton } from 'src/layouts/components/sign-out-button';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import { AccountSectionSkeleton } from 'src/components/account/account-section-skeleton';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export const UpdateAdminSchema = z.object({
  nombres: z.string().min(1, { error: 'Los nombres son requeridos.' }),
  apellidos: z.string().min(1, { error: 'Los apellidos son requeridos.' }),
  correo: z.string().email({ error: 'El correo no es válido.' }),
  codigoUsuario: z.string().min(1, { error: 'El código de usuario es requerido.' }),
  rol: z.string().min(1, { error: 'El rol es requerido.' }),
  estatus: z.string().min(1, { error: 'El estatus es requerido.' }),
  photoURL: z.any().optional(),
});

// ----------------------------------------------------------------------

export function AccountGeneral() {
  const { user, checkUserSession } = useAuthContext();

  const currentUser = useMemo(
    () => ({
      nombres: user?.nombres ?? user?.displayName?.split(' ')?.[0] ?? '',
      apellidos: user?.apellidos ?? user?.displayName?.split(' ')?.slice(1).join(' ') ?? '',
      correo: user?.correo ?? user?.email ?? '',
      codigoUsuario: user?.codigoUsuario ?? '',
      rol: user?.role ?? 'administrador',
      estatus: user?.estatus ?? 'activo',
      photoURL: user?.photoURL ?? '',
    }),
    [user]
  );

  const methods = useForm({
    mode: 'all',
    resolver: zodResolver(UpdateAdminSchema),
    defaultValues: currentUser,
    values: currentUser,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  if (!user) {
    return <AccountSectionSkeleton variant="profile" />;
  }

  const onSubmit = handleSubmit(async (data) => {
    try {
      const authUser = AUTH.currentUser;

      if (!authUser) {
        throw new Error('No hay una sesión activa.');
      }

      const adminEntry = await getAdminProfileRef(authUser.uid);
      const photoURL =
        data.photoURL instanceof File ? await fileToDataUrl(data.photoURL) : data.photoURL || '';
      const displayName = buildAdminDisplayName(
        { nombres: data.nombres, apellidos: data.apellidos },
        authUser
      );

      const payload = {
        uid: authUser.uid,
        nombres: data.nombres.trim(),
        apellidos: data.apellidos.trim(),
        correo: data.correo.trim(),
        codigoUsuario: data.codigoUsuario.trim(),
        rol: data.rol.trim(),
        estatus: data.estatus.trim(),
        photoURL,
        displayName,
        updatedAt: new Date(),
      };

      if (adminEntry?.ref) {
        await updateDoc(adminEntry.ref, payload);
      } else {
        await setDoc(doc(FIRESTORE, 'admins', authUser.uid), { ...payload, createdAt: new Date() }, { merge: true });
      }

      await updateProfile(authUser, {
        displayName,
        photoURL,
      });

      await checkUserSession?.();
      toast.success('Perfil actualizado con éxito.');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo actualizar el perfil.');
    }
  });

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              pt: 10,
              pb: 5,
              px: 3,
              textAlign: 'center',
            }}
          >
            <Field.UploadAvatar
              name="photoURL"
              maxSize={1050000}
              helperText={
                <Typography
                  variant="caption"
                  sx={{
                    mt: 3,
                    mx: 'auto',
                    display: 'block',
                    textAlign: 'center',
                    color: 'text.disabled',
                  }}
                >
                  Permitido *.jpeg, *.jpg, *.png, *.gif
                  <br /> tamaño máximo de 1 Mb
                </Typography>
              }
            />

            <Typography variant="subtitle1" sx={{ mt: 3 }}>
              {buildAdminDisplayName(currentUser, user)}
            </Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {currentUser.codigoUsuario}
            </Typography>

            <SignOutButton sx={{ mt: 3 }} />
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Box
              sx={{
                rowGap: 3,
                columnGap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
              }}
            >
              <Field.Text name="nombres" label="Nombres" />
              <Field.Text name="apellidos" label="Apellidos" />
              <Field.Text
                name="correo"
                label="Correo electrónico"
                slotProps={{ htmlInput: { readOnly: true } }}
              />
              <Field.Text name="codigoUsuario" label="Código de usuario" />
              <Field.Text
                name="rol"
                label="Rol"
                slotProps={{ htmlInput: { readOnly: true } }}
              />
              <Field.Select name="estatus" label="Estatus">
                <MenuItem value="activo">Activo</MenuItem>
                <MenuItem value="inactivo">Inactivo</MenuItem>
              </Field.Select>
            </Box>

            <Stack spacing={3} sx={{ mt: 3, alignItems: 'flex-end' }}>
              <Button type="submit" variant="contained" loading={isSubmitting}>
                Guardar cambios
              </Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Form>
  );
}
