'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';

import { paths } from 'src/routes/paths';

import { isMemberSessionUser } from 'src/utils/member-access';

import { ORDER_STATUS_OPTIONS } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';
import { obtenerOrdenFirestorePorId, cambiarEstadoOrdenFirestore } from 'src/services/order-service';

import { useAuthContext } from 'src/auth/hooks';

import { OrderDetailsItems } from '../order-details-items';
import { OrderDetailsToolbar } from '../order-details-toolbar';
import { OrderDetailsHistory } from '../order-details-history';
import { OrderDetailsPayment } from '../order-details-payment';
import { OrderDetailsCustomer } from '../order-details-customer';
import { OrderDetailsDelivery } from '../order-details-delivery';
import { OrderDetailsShipping } from '../order-details-shipping';

// ----------------------------------------------------------------------

export function OrderDetailsView({ order, orderId }) {
  const { user } = useAuthContext();
  const [resolvedOrder, setResolvedOrder] = useState(order);
  const [status, setStatus] = useState(order?.status);
  const canManageStatus = !isMemberSessionUser(user);

  useEffect(() => {
    const loadOrder = async () => {
      if (order?.id === orderId) return;

      const firestoreOrder = await obtenerOrdenFirestorePorId(orderId);
      if (firestoreOrder) {
        setResolvedOrder(firestoreOrder);
        setStatus(firestoreOrder?.status);
      }
    };

    loadOrder();
  }, [order, orderId]);

  const handleChangeStatus = useCallback(
    async (newValue) => {
      if (!canManageStatus || !resolvedOrder?.id) return;

      const updatedOrder = await cambiarEstadoOrdenFirestore({
        orderId: resolvedOrder.id,
        nextStatus: newValue,
        user,
      });

      if (updatedOrder) {
        setResolvedOrder(updatedOrder);
        setStatus(updatedOrder.status);
        return;
      }

      setStatus(newValue);
    },
    [canManageStatus, resolvedOrder?.id, user]
  );

  return (
    <DashboardContent>
      <OrderDetailsToolbar
        status={status}
        createdAt={resolvedOrder?.createdAt}
        orderNumber={resolvedOrder?.orderNumber}
        backHref={paths.dashboard.order.root}
        onChangeStatus={handleChangeStatus}
        statusOptions={ORDER_STATUS_OPTIONS}
        canManageStatus={canManageStatus}
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Box
            sx={{ gap: 3, display: 'flex', flexDirection: { xs: 'column-reverse', md: 'column' } }}
          >
            <OrderDetailsItems
              items={resolvedOrder?.items}
              taxes={resolvedOrder?.taxes}
              shipping={resolvedOrder?.shipping}
              discount={resolvedOrder?.discount}
              subtotal={resolvedOrder?.subtotal}
              totalAmount={resolvedOrder?.totalAmount}
            />

            <OrderDetailsHistory history={resolvedOrder?.history} />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <OrderDetailsCustomer customer={resolvedOrder?.customer} />

            <Divider sx={{ borderStyle: 'dashed' }} />
            <OrderDetailsDelivery delivery={resolvedOrder?.delivery} />

            <Divider sx={{ borderStyle: 'dashed' }} />
            <OrderDetailsShipping shippingAddress={resolvedOrder?.shippingAddress} />

            <Divider sx={{ borderStyle: 'dashed' }} />
            <OrderDetailsPayment payment={resolvedOrder?.payment} />
          </Card>
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
