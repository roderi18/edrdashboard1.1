const LOCAL_PRODUCTS_KEY = 'dashboard-local-products';
const LOCAL_PRODUCT_STOCK_KEY = 'dashboard-local-product-stock';

const readStorage = (key) => {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

const writeStorage = (key, value) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(key, JSON.stringify(value));
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const serializeImages = async (images = []) =>
  Promise.all(
    images.map((image) => {
      if (typeof image === 'string') return image;
      if (image instanceof File) return fileToDataUrl(image);

      return '';
    })
  );

const getInventoryType = (quantity) => {
  const available = Number(quantity) || 0;

  if (available <= 0) return 'out of stock';
  if (available <= 10) return 'low stock';

  return 'in stock';
};

export const getLocalProducts = () => readStorage(LOCAL_PRODUCTS_KEY);

export const getLocalProductById = (productId) => {
  if (!productId) return null;

  return getLocalProducts().find((product) => product.id === productId) || null;
};

export const getLocalProductStockAdjustments = () => readStorage(LOCAL_PRODUCT_STOCK_KEY);

export const getLocalProductStockAdjustmentById = (productId) =>
  getLocalProductStockAdjustments().find((item) => item.id === productId) || null;

export const mergeProductWithLocalInventory = (product) => {
  if (!product?.id) return product;

  const localProduct = getLocalProductById(product.id);
  const stockAdjustment = getLocalProductStockAdjustmentById(product.id);

  if (localProduct) {
    return localProduct;
  }

  if (!stockAdjustment) {
    return product;
  }

  const available = Number(stockAdjustment.available);
  const quantity = Number(product.quantity) || Number(stockAdjustment.quantity) || available;

  return {
    ...product,
    available,
    quantity,
    inventoryType: getInventoryType(available),
  };
};

export const mergeProductsWithLocalInventory = (products = []) =>
  products.map((product) => mergeProductWithLocalInventory(product));

export const setLocalProductAvailable = (productId, available, baseProduct = null) => {
  if (!productId) return null;

  const safeAvailable = Math.max(0, Number(available) || 0);
  const adjustments = getLocalProductStockAdjustments();
  const nextAdjustment = {
    id: productId,
    available: safeAvailable,
    quantity: Number(baseProduct?.quantity) || safeAvailable,
    inventoryType: getInventoryType(safeAvailable),
    updatedAt: new Date().toISOString(),
  };

  const nextAdjustments = [
    nextAdjustment,
    ...adjustments.filter((item) => item.id !== productId),
  ];

  writeStorage(LOCAL_PRODUCT_STOCK_KEY, nextAdjustments);

  const localProduct = getLocalProductById(productId);

  if (localProduct) {
    const nextLocalProducts = getLocalProducts().map((product) =>
      product.id === productId
        ? {
            ...product,
            available: safeAvailable,
            quantity: Number(product.quantity) || safeAvailable,
            inventoryType: getInventoryType(safeAvailable),
          }
        : product
    );

    writeStorage(LOCAL_PRODUCTS_KEY, nextLocalProducts);
  }

  return nextAdjustment;
};

export const adjustLocalProductStock = (productId, delta, baseProduct = null) => {
  if (!productId) return null;

  const mergedBaseProduct = mergeProductWithLocalInventory(baseProduct) || getLocalProductById(productId);
  const currentAvailable = Number(mergedBaseProduct?.available) || 0;

  return setLocalProductAvailable(productId, currentAvailable + Number(delta || 0), mergedBaseProduct);
};

export const saveLocalProduct = async (data, { publish = true } = {}) => {
  const images = await serializeImages(data.images);
  const quantity = Number(data.quantity) || 0;
  const product = {
    ...data,
    id: data.id || `local-product-${Date.now()}`,
    images,
    coverUrl: images[0] || '',
    createdAt: data.createdAt || new Date().toISOString(),
    available: quantity,
    quantity,
    inventoryType: getInventoryType(quantity),
    publish: publish ? 'published' : 'draft',
    price: Number(data.price) || 0,
    priceSale: Number(data.priceSale) || 0,
  };
  const products = getLocalProducts();
  const nextProducts = [product, ...products.filter((item) => item.id !== product.id)];

  writeStorage(LOCAL_PRODUCTS_KEY, nextProducts);

  return product;
};

export const removeLocalProduct = (productId) => {
  const nextProducts = getLocalProducts().filter((product) => product.id !== productId);
  const nextAdjustments = getLocalProductStockAdjustments().filter((product) => product.id !== productId);

  writeStorage(LOCAL_PRODUCTS_KEY, nextProducts);
  writeStorage(LOCAL_PRODUCT_STOCK_KEY, nextAdjustments);
};
