import * as z from 'zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';
import {
  linkCurrentUserWithGoogle,
  unlinkCurrentUserProvider,
} from 'src/auth/components/context/firebase';

// ----------------------------------------------------------------------

const SOCIAL_LOGIN_ACCOUNTS = [
  {
    id: 'google',
    name: 'Google',
    icon: 'socials:google',
    enabled: true,
    providerId: 'google.com',
    description: 'Permite iniciar sesión con Google después de asociarlo a tu código de usuario.',
  },
  {
    id: 'apple',
    name: 'Apple',
    icon: 'mingcute:apple-fill',
    enabled: false,
    providerId: 'apple.com',
    description: 'Permite iniciar sesión con Apple manteniendo el mismo usuario del sistema.',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'socials:facebook',
    enabled: false,
    providerId: 'facebook.com',
    description: 'Permite iniciar sesión con Facebook manteniendo el mismo usuario del sistema.',
  },
];

export const ChangePassWordSchema = z
  .object({
    oldPassword: z
      .string()
      .min(1, { error: 'La contraseña actual es requerida.' })
      .min(6, { error: 'La contraseña debe tener al menos 6 caracteres.' }),
    newPassword: z.string().min(1, { error: 'La nueva contraseña es requerida.' }),
    confirmNewPassword: z.string().min(1, { error: 'Confirma la nueva contraseña.' }),
  })
  .refine((val) => val.oldPassword !== val.newPassword, {
    error: 'La nueva contraseña debe ser diferente a la actual.',
    path: ['newPassword'],
  })
  .refine((val) => val.newPassword === val.confirmNewPassword, {
    error: 'Las contraseñas no coinciden.',
    path: ['confirmNewPassword'],
  });

// ----------------------------------------------------------------------

export function AccountChangePassword() {
  const showPassword = useBoolean();
  const { user, checkUserSession } = useAuthContext();
  const [providerAction, setProviderAction] = useState(null);

  const socialLoginAccounts = useMemo(() => {
    const providerData = Array.isArray(user?.providerData) ? user.providerData : [];
    const authProviders = Array.isArray(user?.authProviders) ? user.authProviders : [];

    return SOCIAL_LOGIN_ACCOUNTS.map((account) => ({
      ...account,
      linked: Boolean(
        user?.[`${account.id}Linked`] ||
          authProviders.includes(account.id) ||
          providerData.some((provider) => provider?.providerId === account.providerId)
      ),
    }));
  }, [user]);

  const defaultValues = {
    oldPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  };

  const methods = useForm({
    mode: 'all',
    resolver: zodResolver(ChangePassWordSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      reset();
      toast.success('Actualización exitosa!');
    } catch (error) {
      console.error(error);
    }
  });

  const saveProviderStatus = async ({ account, linked, authUser }) => {
    if (!isFirebaseConfigured || !FIRESTORE) {
      return;
    }

    const uid = authUser?.uid || user?.uid || user?.id || '';
    const providerProfile = authUser?.providerData?.find(
      (provider) => provider?.providerId === account.providerId
    );
    const providerEmail = providerProfile?.email || authUser?.email || user?.email || '';
    const authProviders = new Set(Array.isArray(user?.authProviders) ? user.authProviders : []);

    authProviders.add('member-code');

    if (linked) {
      authProviders.add(account.id);
    } else {
      authProviders.delete(account.id);
    }

    const timestamp = serverTimestamp();
    const payload = {
      uid,
      linkedAuthUid: uid,
      correo: linked && providerEmail ? providerEmail : user?.email || '',
      authProviders: Array.from(authProviders),
      [`${account.id}Linked`]: linked,
      [`${account.id}Email`]: linked ? providerEmail : '',
      [`${account.id}ProviderId`]: account.providerId,
      [`${account.id}${linked ? 'LinkedAt' : 'UnlinkedAt'}`]: timestamp,
      actualizadoEn: timestamp,
    };
    const writes = [];
    const memberProfileId =
      user?.idMiembros || user?.codigoMiembro || user?.memberId || user?.codigoUsuario || '';

    if (memberProfileId) {
      writes.push(setDoc(doc(FIRESTORE, 'usuarios_roles', String(memberProfileId)), payload, { merge: true }));
    }

    if (uid) {
      writes.push(setDoc(doc(FIRESTORE, 'users', String(uid)), payload, { merge: true }));
    }

    await Promise.all(writes);
  };

  const handleLinkAccount = async (account) => {
    if (!account.enabled) {
      toast.info(`${account.name} estará disponible próximamente.`);
      return;
    }

    try {
      setProviderAction(`link-${account.id}`);

      const authUser = await linkCurrentUserWithGoogle();

      await saveProviderStatus({ account, linked: true, authUser });
      await checkUserSession?.();
      toast.success(`Cuenta de ${account.name} vinculada correctamente.`);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || `No se pudo vincular ${account.name}.`);
    } finally {
      setProviderAction(null);
    }
  };

  const handleUnlinkAccount = async (account) => {
    if (!account.enabled) {
      toast.info(`${account.name} estará disponible próximamente.`);
      return;
    }

    try {
      setProviderAction(`unlink-${account.id}`);

      const authUser = await unlinkCurrentUserProvider(account.providerId);

      await saveProviderStatus({ account, linked: false, authUser });
      await checkUserSession?.();
      toast.success(`Cuenta de ${account.name} desvinculada correctamente.`);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || `No se pudo desvincular ${account.name}.`);
    } finally {
      setProviderAction(null);
    }
  };

  return (
    <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
      <Form methods={methods} onSubmit={onSubmit}>
        <Card
          sx={{
            p: 3,
            gap: 3,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Typography variant="h6">Contraseña</Typography>

          <Field.Text
            name="oldPassword"
            type={showPassword.value ? 'text' : 'password'}
            label="Contraseña actual"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={showPassword.onToggle} edge="end">
                      <Iconify
                        icon={showPassword.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Field.Text
            name="newPassword"
            label="Nueva contraseña"
            type={showPassword.value ? 'text' : 'password'}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={showPassword.onToggle} edge="end">
                      <Iconify
                        icon={showPassword.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
            helperText={
              <Box component="span" sx={{ gap: 0.5, display: 'flex', alignItems: 'center' }}>
                <Iconify icon="solar:info-circle-bold" width={16} /> Debe tener mínimo 6 caracteres
              </Box>
            }
          />

          <Field.Text
            name="confirmNewPassword"
            type={showPassword.value ? 'text' : 'password'}
            label="Confirmar nueva contraseña"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={showPassword.onToggle} edge="end">
                      <Iconify
                        icon={showPassword.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button type="submit" variant="contained" loading={isSubmitting} sx={{ ml: 'auto' }}>
            Guardar cambios
          </Button>
        </Card>
      </Form>

      <Card
        sx={{
          p: 3,
          gap: 3,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h6">Cuentas vinculadas</Typography>

        {socialLoginAccounts.map((account, index) => (
          <Box key={account.id}>
            <Box
              sx={{
                gap: 2,
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                flexDirection: { xs: 'column', sm: 'row' },
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
                }}
              >
                <Iconify icon={account.icon} width={26} />
              </Box>

              <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="subtitle1">Cuenta de {account.name}</Typography>
                  <Chip
                    size="small"
                    color={account.linked ? 'success' : 'default'}
                    label={account.linked ? 'Vinculada' : 'No vinculada'}
                  />
                </Box>

                <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                  {account.description}
                </Typography>
              </Box>

              <Box
                sx={{
                  gap: 1.5,
                  display: 'flex',
                  flexShrink: 0,
                  flexWrap: 'wrap',
                  justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                }}
              >
                <Button
                  type="button"
                  variant="contained"
                  disabled={account.linked}
                  loading={providerAction === `link-${account.id}`}
                  onClick={() => handleLinkAccount(account)}
                  startIcon={<Iconify icon={account.icon} />}
                >
                  Vincular
                </Button>

                <Button
                  type="button"
                  color="error"
                  variant="outlined"
                  disabled={!account.linked}
                  loading={providerAction === `unlink-${account.id}`}
                  onClick={() => handleUnlinkAccount(account)}
                  startIcon={<Iconify icon="solar:link-broken-bold" />}
                >
                  Desvincular
                </Button>
              </Box>
            </Box>

            {index < SOCIAL_LOGIN_ACCOUNTS.length - 1 && (
              <Divider sx={{ mt: 3, borderStyle: 'dashed' }} />
            )}
          </Box>
        ))}
      </Card>
    </Box>
  );
}
