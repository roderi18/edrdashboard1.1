import { adjustLocalProductStock } from 'src/utils/local-product-storage';

const LOCAL_ORDERS_KEY = 'dashboard-local-orders';
const LOCAL_INVOICES_KEY = 'dashboard-local-invoices';

const STORE_ADDRESS = {
  name: 'Grupo 1 Store DEV',
  fullAddress: 'Local store simulation',
  phoneNumber: '000-000-0000',
};

const readItems = (key) => {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

const writeItems = (key, items) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(key, JSON.stringify(items));
};

const getCustomerFromSession = (billing, sessionUser) => ({
  id: sessionUser?.id || sessionUser?.uid || billing?.id || 'local-customer',
  memberId: sessionUser?.memberId || sessionUser?.idMiembros || billing?.memberId || null,
  idMiembros: sessionUser?.idMiembros || sessionUser?.memberId || billing?.idMiembros || null,
  codigoMiembro: sessionUser?.codigoMiembro || billing?.codigoMiembro || '',
  name: sessionUser?.displayName || billing?.name || 'Cliente Local',
  email: sessionUser?.email || billing?.email || 'cliente.local@dev.test',
  phoneNumber: sessionUser?.phoneNumber || billing?.phoneNumber || '',
  avatarUrl: sessionUser?.photoURL || billing?.avatarUrl || '',
  role: sessionUser?.role || billing?.role || '',
  memberRole: sessionUser?.memberRole || billing?.memberRole || '',
  status: sessionUser?.status || billing?.status || '',
  alcance: sessionUser?.alcance || billing?.alcance || null,
  permisos: sessionUser?.permisos || billing?.permisos || null,
  destId: sessionUser?.idDestacamento || billing?.destId || billing?.idDestacamento || null,
  destName: sessionUser?.destName || billing?.destName || '',
  sectionalName: sessionUser?.sectionalName || billing?.sectionalName || '',
  regionalName: sessionUser?.regionalName || billing?.regionalName || '',
  ipAddress: '127.0.0.1',
});

const getAddressFromBilling = (billing) => ({
  fullAddress: billing?.fullAddress || billing?.address || 'Direccion local de prueba',
  phoneNumber: billing?.phoneNumber || '000-000-0000',
});

const mapOrderItems = (items = []) =>
  items.map((item) => ({
    id: item.id,
    sku: item.sku || item.id,
    quantity: Number(item.quantity) || 0,
    name: item.name,
    coverUrl: item.coverUrl,
    price: Number(item.price) || 0,
    available: Number(item.available) || 0,
  }));

const mapInvoiceItems = (items = []) =>
  items.map((item) => ({
    id: item.id,
    title: item.title || item.name || 'Producto',
    description:
      item.description ||
      [item.size, item.colors?.[0]].filter(Boolean).join(' / ') ||
      'Compra local DEV',
    price: Number(item.price) || 0,
    service: 'Technology',
    quantity: Number(item.quantity) || 0,
    total: (Number(item.price) || 0) * (Number(item.quantity) || 0),
  }));

export const getLocalOrders = () => readItems(LOCAL_ORDERS_KEY);

export const getLocalOrderById = (orderId) =>
  getLocalOrders().find((order) => order.id === orderId) || null;

export const getLocalInvoices = () => readItems(LOCAL_INVOICES_KEY);

export const getLocalInvoiceById = (invoiceId) =>
  getLocalInvoices().find((invoice) => invoice.id === invoiceId) || null;

export const updateLocalInvoice = (updatedInvoice) => {
  if (!updatedInvoice?.id) return null;

  const invoices = getLocalInvoices();
  const nextInvoices = invoices.map((invoice) =>
    invoice.id === updatedInvoice.id ? { ...invoice, ...updatedInvoice } : invoice
  );

  writeItems(LOCAL_INVOICES_KEY, nextInvoices);

  return nextInvoices.find((invoice) => invoice.id === updatedInvoice.id) || null;
};

export const updateLocalOrder = (updatedOrder) => {
  if (!updatedOrder?.id) return null;

  const orders = getLocalOrders();
  const nextOrders = orders.map((order) =>
    order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order
  );

  writeItems(LOCAL_ORDERS_KEY, nextOrders);

  return nextOrders.find((order) => order.id === updatedOrder.id) || null;
};

const applyOrderStockMovement = (order, direction = 'decrease') => {
  if (!order?.items?.length) return;

  order.items.forEach((item) => {
    const quantity = Number(item.quantity) || 0;
    if (!quantity) return;

    const delta = direction === 'increase' ? quantity : -quantity;
    adjustLocalProductStock(item.id, delta, item);
  });
};

export const changeLocalOrderStatus = (orderId, nextStatus) => {
  const currentOrder = getLocalOrderById(orderId);

  if (!currentOrder) return null;

  const previousStatus = currentOrder.status;
  const isCancelling = previousStatus !== 'cancelled' && nextStatus === 'cancelled';
  const isReactivating = previousStatus === 'cancelled' && nextStatus !== 'cancelled';

  if (isCancelling) {
    applyOrderStockMovement(currentOrder, 'increase');
  }

  if (isReactivating) {
    applyOrderStockMovement(currentOrder, 'decrease');
  }

  const updatedOrder = updateLocalOrder({
    ...currentOrder,
    status: nextStatus,
  });

  if (updatedOrder?.receiptId) {
    updateLocalInvoice({
      id: updatedOrder.receiptId,
      status: nextStatus === 'cancelled' ? 'cancelled' : 'paid',
    });
  }

  return updatedOrder;
};

export const createLocalPurchase = (checkoutState, paymentData = {}, sessionUser = null) => {
  const now = new Date();
  const timestamp = now.getTime();
  const orderId = `local-order-${timestamp}`;
  const invoiceId = `local-invoice-${timestamp}`;
  const createdAt = now.toISOString();
  const subtotal = Number(checkoutState.subtotal) || 0;
  const shipping = Number(checkoutState.shipping) || 0;
  const discount = Number(checkoutState.discount) || 0;
  const taxes = 0;
  const totalAmount = subtotal - discount + shipping + taxes;
  const orderItems = mapOrderItems(checkoutState.items);
  const invoiceItems = mapInvoiceItems(checkoutState.items);
  const customer = getCustomerFromSession(checkoutState.billing, sessionUser);
  const shippingAddress = getAddressFromBilling(checkoutState.billing);

  const order = {
    id: orderId,
    orderNumber: `DEV-${timestamp}`,
    createdAt,
    taxes,
    items: orderItems,
    history: {
      orderTime: createdAt,
      paymentTime: createdAt,
      deliveryTime: null,
      completionTime: null,
      timeline: [{ title: 'Order created in local store', time: createdAt }],
    },
    subtotal,
    shipping,
    discount,
    customer,
    delivery: { shipBy: 'Local DEV', speedy: 'Simulation', trackingNumber: orderId },
    totalAmount,
    totalQuantity: orderItems.reduce((total, item) => total + item.quantity, 0),
    shippingAddress,
    payment: {
      cardType: paymentData.payment || 'cash',
      cardNumber: paymentData.payment === 'cash' ? 'Cash on delivery' : 'Local payment DEV',
    },
    status: 'pending',
    receiptId: invoiceId,
  };

  const invoice = {
    id: invoiceId,
    taxes,
    status: 'paid',
    discount,
    shipping,
    subtotal,
    totalAmount,
    items: invoiceItems,
    invoiceNumber: `REC-${timestamp}`,
    invoiceFrom: STORE_ADDRESS,
    invoiceTo: {
      name: customer.name,
      fullAddress: shippingAddress.fullAddress,
      phoneNumber: sessionUser?.phoneNumber || shippingAddress.phoneNumber,
      company: customer.email,
      codigoMiembro: customer.codigoMiembro,
      memberId: customer.memberId,
      idMiembros: customer.idMiembros,
      role: customer.role,
      memberRole: customer.memberRole,
    },
    sent: 1,
    createDate: createdAt,
    dueDate: createdAt,
    orderId,
  };

  writeItems(LOCAL_ORDERS_KEY, [order, ...getLocalOrders()]);
  writeItems(LOCAL_INVOICES_KEY, [invoice, ...getLocalInvoices()]);
  applyOrderStockMovement(order, 'decrease');

  return { order, invoice };
};
