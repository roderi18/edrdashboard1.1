'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';

import { paths } from 'src/routes/paths';

import { getLocalOrderById } from 'src/utils/local-commerce-storage';

import { ORDER_STATUS_OPTIONS } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';

import { OrderDetailsItems } from '../order-details-items';
import { OrderDetailsToolbar } from '../order-details-toolbar';
import { OrderDetailsHistory } from '../order-details-history';
import { OrderDetailsPayment } from '../order-details-payment';
import { OrderDetailsCustomer } from '../order-details-customer';
import { OrderDetailsDelivery } from '../order-details-delivery';
import { OrderDetailsShipping } from '../order-details-shipping';

// ----------------------------------------------------------------------

export function OrderDetailsView({ order, orderId }) {
  const [resolvedOrder, setResolvedOrder] = useState(order);
  const [status, setStatus] = useState(order?.status);

  useEffect(() => {
    if (order || !orderId?.startsWith('local-order-')) return;

    const localOrder = getLocalOrderById(orderId);
    setResolvedOrder(localOrder);
    setStatus(localOrder?.status);
  }, [order, orderId]);

  const handleChangeStatus = useCallback((newValue) => {
    setStatus(newValue);
  }, []);

  return (
    <DashboardContent>
      <OrderDetailsToolbar
        status={status}
        createdAt={resolvedOrder?.createdAt}
        orderNumber={resolvedOrder?.orderNumber}
        backHref={paths.dashboard.order.root}
        onChangeStatus={handleChangeStatus}
        statusOptions={ORDER_STATUS_OPTIONS}
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
