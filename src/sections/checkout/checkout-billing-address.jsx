import { useState, useEffect } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';

import { getDestsApi } from 'src/services/dest-service';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { useCheckoutContext } from './context';
import { CheckoutSummary } from './checkout-summary';
import { AddressItem, AddressCreateForm } from '../address';

// ----------------------------------------------------------------------

const NO_PHONE = 'Sin numero de telefono';
const NO_ADDRESS = 'Direccion no especificada';

const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const getUserKeys = (user) =>
  new Set(
    [
      user?.uid,
      user?.id,
      user?.idMiembros,
      user?.memberId,
      user?.codigoMiembro,
      user?.codigo,
      user?.email,
      user?.correo,
    ]
      .filter(hasValue)
      .map(normalizeKey)
  );

const findCurrentMember = (members, user) => {
  const keys = getUserKeys(user);

  return (
    members.find((member) =>
      [member?.id, member?.memberId, member?.codigoMiembro, member?.email].some((value) =>
        keys.has(normalizeKey(value))
      )
    ) || null
  );
};

export function CheckoutBillingAddress() {
  const { user } = useAuthContext();
  const { onChangeStep, onCreateBillingAddress, state: checkoutState } = useCheckoutContext();

  const addressForm = useBoolean();
  const [addressBook, setAddressBook] = useState([]);

  useEffect(() => {
    const loadAddresses = async () => {
      const [members, dests, churches] = await Promise.all([
        getMembers(),
        getDestsApi(),
        getChurches(),
      ]);
      const member = findCurrentMember(members, user);
      const destId =
        member?.idDestacamento ||
        member?.destId ||
        user?.idDestacamento ||
        user?.destId ||
        user?.alcance?.destacamentos?.[0] ||
        null;
      const dest = dests.find((item) => String(item.id) === String(destId));
      const church = churches.find((item) => String(item.id) === String(dest?.churchId));
      const profileName =
        user?.displayName ||
        user?.nombre ||
        member?.name ||
        [member?.firstName, member?.lastName].filter(Boolean).join(' ') ||
        'Perfil';
      const memberAddress = member?.memberAddress || member?.direccion || user?.direccion || '';
      const memberPhone = member?.phoneNumber || user?.phoneNumber || user?.telefono || '';

      setAddressBook([
        {
          id: 'dest-address',
          name: church?.name || dest?.name || 'Iglesia del destacamento',
          addressType: 'Destacamento',
          fullAddress: church?.address || NO_ADDRESS,
          phoneNumber: church?.telefono || NO_PHONE,
          primary: true,
          locked: true,
        },
        {
          id: 'member-primary-address',
          name: profileName,
          addressType: 'Primaria',
          fullAddress: memberAddress || NO_ADDRESS,
          phoneNumber: memberPhone || NO_PHONE,
          primary: false,
          locked: true,
        },
      ]);
    };

    loadAddresses();
  }, [user]);

  return (
    <>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          {addressBook.map((address) => (
            <AddressItem
              key={address.id}
              address={address}
              action={
                <Box sx={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap' }}>
                  {!address.locked && (
                    <Button size="small" color="error" sx={{ mr: 1 }}>
                      Eliminar
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      onChangeStep('next');
                      onCreateBillingAddress(address);
                    }}
                  >
                    Enviar a esta direccion
                  </Button>
                </Box>
              }
              sx={[
                (theme) => ({
                  p: 3,
                  mb: 3,
                  borderRadius: 2,
                  boxShadow: theme.vars.customShadows.card,
                }),
              ]}
            />
          ))}

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              size="small"
              color="inherit"
              onClick={() => onChangeStep('back')}
              startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
            >
              Atras
            </Button>

            <Button
              size="small"
              color="primary"
              onClick={addressForm.onTrue}
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Agregar direccion
            </Button>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <CheckoutSummary checkoutState={checkoutState} />
        </Grid>
      </Grid>

      <AddressCreateForm
        open={addressForm.value}
        onClose={addressForm.onFalse}
        onCreate={(address) => {
          onChangeStep('next');
          onCreateBillingAddress(address);
        }}
        slotProps={{
          submitButton: { label: 'Enviar a esta direccion' },
        }}
      />
    </>
  );
}
