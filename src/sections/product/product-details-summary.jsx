import { useForm, Controller } from 'react-hook-form';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Rating from '@mui/material/Rating';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Link, { linkClasses } from '@mui/material/Link';
import { formHelperTextClasses } from '@mui/material/FormHelperText';

import { paths } from 'src/routes/paths';
import { useRouter, usePathname } from 'src/routes/hooks';

import { fDopCurrency, fShortenNumber } from 'src/utils/format-number';
import { uploadFilesToStorage, buildStorageFileName } from 'src/utils/firebase-file-storage';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';
import { ColorPicker } from 'src/components/color-utils';
import { NumberInput } from 'src/components/number-input';

// ----------------------------------------------------------------------

const EMPTY_OPTIONS = [];
const ALLOWED_EVIDENCE_TYPES = new Set(['application/pdf']);

const isAllowedEvidenceFile = (file) =>
  String(file?.type || '').startsWith('image/') || ALLOWED_EVIDENCE_TYPES.has(file?.type);

// ----------------------------------------------------------------------

export function ProductDetailsSummary({
  items,
  product,
  onAddToCart,
  disableActions,
  onCreateEvaluationOrder,
  ...other
}) {
  const router = useRouter();
  const pathname = usePathname();
  const checkoutPath = pathname.includes(paths.dashboard.root)
    ? paths.dashboard.checkout
    : paths.product.checkout;

  const {
    id,
    name,
    sizes,
    price,
    colors,
    coverUrl,
    renglon,
    newLabel,
    available,
    priceSale,
    saleLabel,
    tipoProducto,
    category,
    precioRegistrado,
    precioNoRegistrado,
    totalRatings,
    totalReviews,
    inventoryType,
    requiereAprobacion,
    subDescription,
  } = product;

  const productSizes = sizes ?? EMPTY_OPTIONS;
  const productColors = colors ?? EMPTY_OPTIONS;
  const existProduct = !!items?.length && items.map((item) => item.id).includes(id);
  const isUniformProduct = category === 'uniformes';
  const isRestrictedProduct =
    renglon === 'restringido' || tipoProducto === 'restringido' || requiereAprobacion;
  const [evidenceFiles, setEvidenceFiles] = useState([]);

  const availableQuantity = Number(available) || 0;
  const isMaxQuantity =
    !!items?.length &&
    items.filter((item) => item.id === id).map((item) => item.quantity)[0] >= availableQuantity;

  const defaultValues = useMemo(
    () => ({
      id,
      name,
      coverUrl,
      available: availableQuantity,
      price,
      precioRegistrado,
      precioNoRegistrado,
      renglon,
      requiereAprobacion,
      tipoProducto,
      colors: productColors[0] || '',
      size: isUniformProduct ? productSizes[0] || '' : '',
      quantity: availableQuantity < 1 ? 0 : 1,
    }),
    [
      availableQuantity,
      coverUrl,
      id,
      name,
      price,
      isUniformProduct,
      precioNoRegistrado,
      precioRegistrado,
      productColors,
      productSizes,
      renglon,
      requiereAprobacion,
      tipoProducto,
    ]
  );

  const methods = useForm({
    defaultValues,
  });

  const { reset, watch, control, setValue, handleSubmit } = methods;
  const {
    formState: { isSubmitting },
  } = methods;

  const values = watch();
  const hasQuantity = Number(values.quantity) > 0;
  const hasRequiredEvidence = !isRestrictedProduct || evidenceFiles.length > 0;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    console.info('DATA', JSON.stringify(data, null, 2));

    try {
      const archivosAdjuntos = await uploadFilesToStorage({
        files: evidenceFiles,
        storagePathBuilder: (file, index) =>
          `ordenes/evidencias/${id}/${buildStorageFileName(file, index)}`,
        metadataBuilder: () => ({
          productoId: String(id || ''),
          productoNombre: name || '',
          renglon: renglon || '',
        }),
      });

      const itemToOrder = {
        ...data,
        colors: [values.colors],
        archivosAdjuntos,
        subtotal: values.price * values.quantity,
      };

      if (isRestrictedProduct) {
        await onCreateEvaluationOrder?.({ item: itemToOrder });
        router.push(`${checkoutPath}?step=3`);
        return;
      }

      if (!existProduct) {
        onAddToCart?.({
          ...itemToOrder,
        });
      }
      router.push(checkoutPath);
    } catch (error) {
      console.error(error);
    }
  });

  const handleAddCart = useCallback(async () => {
    try {
      const archivosAdjuntos = await uploadFilesToStorage({
        files: evidenceFiles,
        storagePathBuilder: (file, index) =>
          `ordenes/evidencias/${id}/${buildStorageFileName(file, index)}`,
        metadataBuilder: () => ({
          productoId: String(id || ''),
          productoNombre: name || '',
          renglon: renglon || '',
        }),
      });

      onAddToCart?.({
        ...values,
        colors: [values.colors],
        archivosAdjuntos,
        subtotal: values.price * values.quantity,
      });
    } catch (error) {
      console.error(error);
    }
  }, [evidenceFiles, id, name, onAddToCart, renglon, values]);

  const handleEvidenceChange = useCallback((event) => {
    setEvidenceFiles(Array.from(event.target.files || []).filter(isAllowedEvidenceFile).slice(0, 10));
  }, []);

  const renderPrice = () => (
    <Box sx={{ typography: 'h5' }}>
      {priceSale && (
        <Box
          component="span"
          sx={{ color: 'text.disabled', textDecoration: 'line-through', mr: 0.5 }}
        >
          {fDopCurrency(priceSale)}
        </Box>
      )}

      {fDopCurrency(price)}
    </Box>
  );

  const renderShare = () => (
    <Box
      sx={{
        gap: 3,
        display: 'flex',
        justifyContent: 'center',
        [`& .${linkClasses.root}`]: {
          gap: 1,
          alignItems: 'center',
          display: 'inline-flex',
          color: 'text.secondary',
          typography: 'subtitle2',
        },
      }}
    >
      <Link>
        <Iconify icon="mingcute:add-line" width={16} />
        Comparar
      </Link>

      <Link>
        <Iconify icon="solar:heart-bold" width={16} />
        Favorito
      </Link>

      <Link>
        <Iconify icon="solar:share-bold" width={16} />
        Compartir
      </Link>
    </Box>
  );

  const renderColorOptions = () => (
    <Box sx={{ display: 'flex' }}>
      <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
        Color
      </Typography>

      <Controller
        name="colors"
        control={control}
        render={({ field }) => (
          <ColorPicker
            options={productColors}
            value={field.value}
            onChange={(color) => field.onChange(color)}
            limit={4}
          />
        )}
      />
    </Box>
  );

  const renderSizeOptions = () => (
    <Box sx={{ display: 'flex' }}>
      <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
        Size
      </Typography>

      <Field.Select
        name="size"
        size="small"
        helperText={
          <Link underline="always" color="text.primary">
            Guía de tallas
          </Link>
        }
        sx={{
          maxWidth: 88,
          [`& .${formHelperTextClasses.root}`]: { mx: 0, mt: 1, textAlign: 'right' },
        }}
      >
        {productSizes.map((size) => (
          <MenuItem key={size} value={size}>
            {size}
          </MenuItem>
        ))}
      </Field.Select>
    </Box>
  );

  const renderQuantity = () => (
    <Box sx={{ display: 'flex' }}>
      <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
        Quantity
      </Typography>

      <Stack spacing={1}>
        <NumberInput
          hideDivider
          value={values.quantity}
          onChange={(event, quantity) => setValue('quantity', quantity)}
          min={availableQuantity > 0 ? 1 : 0}
          max={availableQuantity}
          sx={{ maxWidth: 112 }}
        />

        <Typography
          variant="caption"
          component="div"
          sx={{ textAlign: 'right', color: 'text.secondary' }}
        >
          Disponible: {availableQuantity}
        </Typography>
      </Stack>
    </Box>
  );

  const renderRestrictedEvidence = () =>
    isRestrictedProduct && (
      <Box sx={{ display: 'flex' }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle2">Cargar evidencias</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Para adquirir este producto, es necesario haber completado el adiestramiento requerido.
            Por ello, tu Certificado será evaluado antes de permitir la compra.
            <br />
            Puedes cargar hasta 10 evidencias. Al cargar Certificado se habilitará el botón de
            Enviar a evaluación.
          </Typography>
        </Box>

        <Stack spacing={0.75} alignItems="flex-end">
          <Button
            component="label"
            size="small"
            variant="outlined"
            startIcon={<Iconify icon="solar:upload-bold" />}
            sx={{ width: 88, minHeight: 40 }}
          >
            Cargar
            <Box
              component="input"
              hidden
              multiple
              type="file"
              onChange={handleEvidenceChange}
              accept="image/*,application/pdf,.pdf"
            />
          </Button>

          {!!evidenceFiles.length && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {evidenceFiles.length} archivo{evidenceFiles.length > 1 ? 's' : ''} seleccionado
              {evidenceFiles.length > 1 ? 's' : ''}
            </Typography>
          )}
        </Stack>
      </Box>
    );

  const renderActions = () => (
    <Box sx={{ gap: 2, display: 'flex' }}>
      <Button
        disabled={isMaxQuantity || disableActions || !hasQuantity}
        size="large"
        color="inherit"
        variant="outlined"
        startIcon={<Iconify icon="solar:cart-plus-bold" width={24} />}
        onClick={handleAddCart}
        sx={{ width: { xs: 1, sm: 200 }, whiteSpace: 'nowrap' }}
      >
        Agregar al carrito
      </Button>

      <Tooltip
        title={
          isRestrictedProduct && !hasRequiredEvidence
            ? 'Antes, debes cargar evidencias.'
            : ''
        }
      >
        <Box component="span" sx={{ width: { xs: 1, sm: 200 } }}>
          <Button
            fullWidth
            size="large"
            type="submit"
            variant="contained"
            loading={isSubmitting}
            disabled={disableActions || !hasQuantity || !hasRequiredEvidence}
          >
            {isRestrictedProduct ? 'Enviar a evaluación' : 'Comprar ahora'}
          </Button>
        </Box>
      </Tooltip>
    </Box>
  );

  const renderSubDescription = () => (
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {subDescription}
    </Typography>
  );

  const renderRating = () => (
    <Box
      sx={{
        display: 'flex',
        typography: 'body2',
        alignItems: 'center',
        color: 'text.disabled',
      }}
    >
      <Rating size="small" value={totalRatings} precision={0.1} readOnly sx={{ mr: 1 }} />
      {`(${fShortenNumber(totalReviews)} reseñas)`}
    </Box>
  );

  const renderLabels = () =>
    (newLabel?.enabled || saleLabel?.enabled) && (
      <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
        {newLabel?.enabled && <Label color="info">{newLabel.content}</Label>}
        {saleLabel?.enabled && <Label color="error">{saleLabel.content}</Label>}
      </Box>
    );

  const renderInventoryType = () => (
    <Box
      component="span"
      sx={{
        typography: 'overline',
        color:
          (inventoryType === 'out of stock' && 'error.main') ||
          (inventoryType === 'low stock' && 'warning.main') ||
          'success.main',
      }}
    >
      {inventoryType}
    </Box>
  );

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Stack spacing={3} sx={{ pt: 3 }} {...other}>
        <Stack spacing={2} alignItems="flex-start">
          {renderLabels()}
          {renderInventoryType()}

          <Typography variant="h5">{name}</Typography>

          {renderRating()}
          {renderPrice()}
          {renderSubDescription()}
        </Stack>

        <Divider sx={{ borderStyle: 'dashed' }} />

        {renderColorOptions()}
        {isUniformProduct && renderSizeOptions()}
        {renderQuantity()}
        {renderRestrictedEvidence()}

        <Divider sx={{ borderStyle: 'dashed' }} />

        {renderActions()}
        {renderShare()}
      </Stack>
    </Form>
  );
}
