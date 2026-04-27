const LOCAL_PRODUCTS_KEY = 'dashboard-local-products';

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

export const getLocalProducts = () => {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_PRODUCTS_KEY) || '[]');
  } catch {
    return [];
  }
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

  window.localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(nextProducts));

  return product;
};

export const removeLocalProduct = (productId) => {
  const nextProducts = getLocalProducts().filter((product) => product.id !== productId);

  window.localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(nextProducts));
};
