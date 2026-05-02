import { useBoolean } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';

import {
  guardarDireccionUsuario,
  cargarDireccionesUsuarioFirestore,
  marcarDireccionPredeterminadaUsuario,
} from 'src/services/address-service';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { useCheckoutContext } from './context';
import { CheckoutSummary } from './checkout-summary';
import { AddressItem, AddressCreateForm } from '../address';

// ----------------------------------------------------------------------

export function CheckoutBillingAddress() {
  const { user } = useAuthContext();
  const { onChangeStep, onCreateBillingAddress, state: checkoutState } = useCheckoutContext();

  const addressForm = useBoolean();
  const [addressBook, setAddressBook] = useState([]);

  const loadAddresses = useCallback(async () => {
    const addresses = await cargarDireccionesUsuarioFirestore(user);
    setAddressBook(addresses);
  }, [user]);

  const handleSetPrimaryAddress = useCallback(
    async (addressId) => {
      setAddressBook((current) =>
        current.map((address) => ({
          ...address,
          primary: String(address.id) === String(addressId),
        }))
      );

      if (user) {
        await marcarDireccionPredeterminadaUsuario({ user, addressId });
      }
    },
    [user]
  );

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

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
                  {!address.primary && (
                    <Button
                      size="small"
                      color="inherit"
                      sx={{ mr: 1 }}
                      onClick={() => handleSetPrimaryAddress(address.id)}
                    >
                      Usar como predeterminada
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
        onCreate={async (address) => {
          const savedAddress = await guardarDireccionUsuario({
            user,
            address: {
              ...address,
              locked: false,
              editLocked: false,
            },
          });

          if (!savedAddress) return;

          setAddressBook((current) =>
            savedAddress.primary
              ? [
                  ...current.map((item) => ({ ...item, primary: false })),
                  savedAddress,
                ]
              : [...current, savedAddress]
          );
          onChangeStep('next');
          onCreateBillingAddress(savedAddress);
        }}
        slotProps={{
          submitButton: { label: 'Enviar a esta direccion' },
        }}
      />
    </>
  );
}
