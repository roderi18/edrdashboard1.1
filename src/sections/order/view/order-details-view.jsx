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
import {
  obtenerOrdenFirestorePorId,
  cambiarEstadoOrdenFirestore,
  evaluarOrdenRestringidaFirestore,
  eliminarArchivoAdjuntoOrdenFirestore,
  cargarArchivosFaltantesOrdenFirestore,
  restaurarArchivoAdjuntoOrdenFirestore,
} from 'src/services/order-service';

import { useAuthContext } from 'src/auth/hooks';

import { OrderDetailsItems } from '../order-details-items';
import { OrderDetailsToolbar } from '../order-details-toolbar';
import { OrderDetailsHistory } from '../order-details-history';
import { OrderDetailsPayment } from '../order-details-payment';
import { OrderDetailsCustomer } from '../order-details-customer';
import { OrderDetailsDelivery } from '../order-details-delivery';
import { OrderDetailsShipping } from '../order-details-shipping';
import { OrderDetailsAttachments } from '../order-details-attachments';

// ----------------------------------------------------------------------

export function OrderDetailsView({ order, orderId }) {
  const { user } = useAuthContext();
  const [resolvedOrder, setResolvedOrder] = useState(order);
  const [status, setStatus] = useState(order?.status);
  const canManageStatus = !isMemberSessionUser(user);
  const showAttachments =
    (resolvedOrder?.items || []).some(
      (item) =>
        item?.requiereAprobacion ||
        item?.renglon === 'restringido' ||
        item?.tipoProducto === 'restringido'
    );

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

  const handleEvaluateOrder = useCallback(
    async (accion, razon = '') => {
      if (!canManageStatus || !resolvedOrder?.id) return null;

      const updatedOrder = await evaluarOrdenRestringidaFirestore({
        orderId: resolvedOrder.id,
        accion,
        razon,
        user,
      });

      if (updatedOrder) {
        setResolvedOrder(updatedOrder);
        setStatus(updatedOrder.status);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('notificaciones:actualizar'));
          window.dispatchEvent(new Event('chat:notificaciones:actualizar'));
        }
      }

      return updatedOrder;
    },
    [canManageStatus, resolvedOrder?.id, user]
  );

  const handleUploadMissingFiles = useCallback(
    async (archivos = []) => {
      if (!resolvedOrder?.id || !archivos.length) return null;

      const updatedOrder = await cargarArchivosFaltantesOrdenFirestore({
        orderId: resolvedOrder.id,
        archivos,
        user,
      });

      if (updatedOrder) {
        setResolvedOrder(updatedOrder);
        setStatus(updatedOrder.status);
      }

      return updatedOrder;
    },
    [resolvedOrder?.id, user]
  );

  const handleDeleteAttachment = useCallback(
    async (archivo) => {
      if (!canManageStatus || !resolvedOrder?.id || !archivo) return null;

      const updatedOrder = await eliminarArchivoAdjuntoOrdenFirestore({
        orderId: resolvedOrder.id,
        archivo,
        user,
      });

      if (updatedOrder) {
        setResolvedOrder(updatedOrder);
        setStatus(updatedOrder.status);
      }

      return updatedOrder;
    },
    [canManageStatus, resolvedOrder?.id, user]
  );

  const handleRestoreAttachment = useCallback(
    async (archivo) => {
      if (!canManageStatus || !resolvedOrder?.id || !archivo) return null;

      const updatedOrder = await restaurarArchivoAdjuntoOrdenFirestore({
        orderId: resolvedOrder.id,
        archivo,
        user,
      });

      if (updatedOrder) {
        setResolvedOrder(updatedOrder);
        setStatus(updatedOrder.status);
      }

      return updatedOrder;
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

            {showAttachments && (
              <>
                <Divider sx={{ borderStyle: 'dashed' }} />
                <OrderDetailsAttachments
                  order={resolvedOrder}
                  canManageStatus={canManageStatus}
                  onEvaluateOrder={handleEvaluateOrder}
                  onUploadMissingFiles={handleUploadMissingFiles}
                  onDeleteAttachment={handleDeleteAttachment}
                  onRestoreAttachment={handleRestoreAttachment}
                />
              </>
            )}

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
