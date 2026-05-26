import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fPercent } from 'src/utils/format-number';

import { guardarProductoFirestore } from 'src/services/product-service';
import { PRODUCT_SIZE_OPTIONS, PRODUCT_COLOR_NAME_OPTIONS } from 'src/_mock';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field, schemaUtils } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const PRODUCT_COLOR_NAME_OPTIONS_ES = PRODUCT_COLOR_NAME_OPTIONS.map((option) => ({
  ...option,
  label:
    {
      Reds: 'Rojos',
      Blue: 'Azul',
      Pink: 'Rosado',
      Green: 'Verde',
      Yellow: 'Amarillo',
      Violet: 'Violeta',
      Black: 'Negro',
      White: 'Blanco',
    }[option.label] || option.label,
}));

const PRODUCT_CATEGORY_GROUP_OPTIONS_ES = [
  {
    group: 'ERRD',
    classify: [
      { label: 'Insignias y emblemas', value: 'insignias-emblemas' },
      { label: 'Cintas', value: 'cintas' },
      { label: 'Barras y numeros', value: 'barras-numeros' },
      { label: 'Parches', value: 'parches' },
      { label: 'Uniformes', value: 'uniformes' },
      { label: 'Accesorios', value: 'accesorios' },
      { label: 'Materiales / manuales', value: 'materiales-manuales' },
      { label: 'Campamentos / articulos especiales', value: 'campamentos-especiales' },
    ],
  },
];

const PRODUCT_RENGLON_OPTIONS = [
  { label: 'General', value: 'general' },
  { label: 'Restringido', value: 'restringido' },
];

const PRODUCT_TYPE_OPTIONS = [
  { label: 'Simple', value: 'simple' },
  { label: 'Con variantes', value: 'con_variantes' },
  { label: 'Restringido', value: 'restringido' },
];

const PRODUCT_TAG_OPTIONS = [
  'ERRD',
  'General',
  'Restringido',
  'Insignias y emblemas',
  'Cintas',
  'Barras y numeros',
  'Parches',
  'Uniformes',
  'Accesorios',
  'Materiales y manuales',
  'Campamentos y articulos especiales',
  'Emblema',
  'Distintivo',
  'Rango',
  'Liderazgo',
  'Adiestramiento',
  'Premios',
  'Servicios',
  'Nivel',
  'Consejo nacional',
  'Camiseta',
  'Chaleco',
  'Gorra',
  'Correa',
  'Corbata bolo',
  'Manual',
  'Carpeta',
  'Campamento',
  'Parche kilometraje',
  'Requiere aprobacion',
  'Precio pendiente',
];

const buildProductFormValues = (product) => {
  if (!product) return product;

  return {
    ...product,
    publish: product.publish === 'published',
  };
};

const getApprovalByRenglon = (renglon, explicitValue) => {
  if (renglon === 'restringido') return true;
  return Boolean(explicitValue);
};

const getProductTypeByRenglon = (renglon, explicitValue) => {
  if (renglon === 'restringido' && (!explicitValue || explicitValue === 'simple')) {
    return 'restringido';
  }

  return explicitValue || 'simple';
};

const PRODUCT_IMAGE_MAX_SIZE_BYTES = 1050000;

const optionalNumberInput = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isNaN(value)) return null;

    return value;
  },
  z.coerce.number().min(0).nullable()
);

const formatStorageSizeEs = (bytes) => {
  const value = Number(bytes || 0);
  if (!value) return '0 mb';

  const units = ['bytes', 'kb', 'mb', 'gb', 'tb'];
  const base = 1024;
  const index = Math.min(Math.floor(Math.log(value) / Math.log(base)), units.length - 1);
  const amount = value / base ** index;

  return `${amount.toLocaleString('es-DO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} ${units[index]}`;
};

export const ProductCreateSchema = z
  .object({
    name: z.string().min(1, { error: 'El nombre es requerido.' }),
    description: schemaUtils
      .editor({ error: 'La descripcion es requerida.' })
      .min(10, { error: 'La descripcion debe tener al menos 10 caracteres.' }),
    images: z.array(z.union([z.string(), z.file()])),
    code: z.string().min(1, { error: 'El codigo del producto es requerido.' }),
    sku: z.string().min(1, { error: 'El SKU del producto es requerido.' }),
    quantity: schemaUtils.nullableInput(
      z.coerce.number().min(0, { error: 'La cantidad no puede ser menor que 0.' }),
      { error: 'La cantidad es requerida.' }
    ),
    colors: z.string().array(),
    sizes: z.string().array(),
    tags: z.string().array().min(1, { error: 'Debe agregar al menos 1 etiqueta.' }),
    price: optionalNumberInput,
    precioRegistrado: schemaUtils.nullableInput(z.coerce.number().min(0), { error: null }),
    precioNoRegistrado: schemaUtils.nullableInput(z.coerce.number().min(0), { error: null }),
    precioPendiente: z.boolean().optional(),
    renglon: z.string(),
    requiereAprobacion: z.boolean().optional(),
    tipoProducto: z.string(),
    notasAdministrativas: z.string().optional(),
    orden: optionalNumberInput.optional(),
    // Not required
    category: z.string(),
    subDescription: z.string(),
    taxes: optionalNumberInput,
    priceSale: optionalNumberInput,
    saleLabel: z.object({ enabled: z.boolean(), content: z.string() }),
    newLabel: z.object({ enabled: z.boolean(), content: z.string() }),
    publish: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const registeredPrice = Number(data.precioRegistrado || 0);
    const unregisteredPrice = Number(data.precioNoRegistrado || 0);

    if (unregisteredPrice > 0 && unregisteredPrice < registeredPrice) {
      ctx.addIssue({
        code: 'custom',
        path: ['precioNoRegistrado'],
        message: 'El precio a destacamentos no registrados no puede ser menor al registrado.',
      });
    }
  });

// ----------------------------------------------------------------------

export function ProductCreateEditForm({ currentProduct }) {
  const router = useRouter();
  const { user } = useAuthContext();

  const openDetails = useBoolean(true);
  const openProperties = useBoolean(true);
  const openPricing = useBoolean(true);

  const [includeTaxes, setIncludeTaxes] = useState(false);
  const [publish, setPublish] = useState(true);
  const [submissionMessage, setSubmissionMessage] = useState('');

  const defaultValues = {
    name: '',
    description: '',
    subDescription: '',
    images: [],
    /********/
    code: '',
    sku: '',
    price: null,
    precioRegistrado: null,
    precioNoRegistrado: null,
    precioPendiente: false,
    taxes: null,
    priceSale: null,
    quantity: null,
    tags: [],
    renglon: 'general',
    requiereAprobacion: false,
    tipoProducto: 'simple',
    notasAdministrativas: '',
    orden: 0,
    category: PRODUCT_CATEGORY_GROUP_OPTIONS_ES[0].classify[1].value,
    colors: [],
    sizes: [],
    newLabel: { enabled: false, content: '' },
    saleLabel: { enabled: false, content: '' },
    publish: true,
  };

  const methods = useForm({
    resolver: zodResolver(ProductCreateSchema),
    defaultValues,
    values: buildProductFormValues(currentProduct),
  });

  const {
    reset,
    watch,
    setValue,
    getValues,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const values = watch();
  const isUniformCategory = values.category === 'uniformes';
  const oversizedImages = useMemo(
    () =>
      (values.images || []).filter(
        (image) => image instanceof File && Number(image.size || 0) > PRODUCT_IMAGE_MAX_SIZE_BYTES
      ),
    [values.images]
  );
  const oversizedImagesTotalSize = oversizedImages.reduce(
    (total, image) => total + Number(image.size || 0),
    0
  );
  const oversizedImagesAllowedSize = oversizedImages.length * PRODUCT_IMAGE_MAX_SIZE_BYTES;
  const shouldCompactImages = oversizedImages.length > 0;
  const isUnregisteredPriceUnavailable =
    values.precioNoRegistrado !== null &&
    values.precioNoRegistrado !== '' &&
    Number(values.precioNoRegistrado) === 0;

  const onSubmit = handleSubmit(
    async (data) => {
      if (!data.images.length) {
        toast.error('Falta subir la imagen del producto.');
        return;
      }

      const updatedData = {
        ...data,
        id: currentProduct?.id || data.id,
        variantes: currentProduct?.variantes || [],
        price: data.price || data.precioRegistrado || data.precioNoRegistrado || 0,
        sizes: data.category === 'uniformes' ? data.sizes : [],
        requiereAprobacion: getApprovalByRenglon(data.renglon, data.requiereAprobacion),
        tipoProducto: getProductTypeByRenglon(data.renglon, data.tipoProducto),
        taxes: includeTaxes ? defaultValues.taxes : data.taxes,
      };

      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setSubmissionMessage(
          shouldCompactImages ? 'Compactando imagenes...' : 'Publicando producto...'
        );
        const result = await guardarProductoFirestore(updatedData, { publish, user });
        reset();
        const compressionMessage = result?.imageStats?.totalOriginalSizeBytes
          ? `${formatStorageSizeEs(result.imageStats.totalOriginalSizeBytes)} a ${formatStorageSizeEs(
            result.imageStats.totalOptimizedSizeBytes
          )} (${fPercent(result.imageStats.reductionPercent)})`
          : null;

        toast.success(
          compressionMessage
            ? `${currentProduct ? 'Actualizacion exitosa!' : 'Producto creado!'} Imagenes optimizadas: ${compressionMessage}`
            : currentProduct
              ? 'Actualizacion exitosa!'
              : 'Producto creado!'
        );
        router.push(paths.dashboard.product.root);
        console.info('DATA', updatedData);
      } catch (error) {
        console.error(error);
        toast.error(error?.message || 'No se pudo guardar el producto');
      } finally {
        setSubmissionMessage('');
      }
    },
    (errors) => {
      const errorSummary = Object.entries(errors || {}).map(([fieldName, error]) => ({
        fieldName,
        message: error?.message,
        type: error?.type,
      }));

      console.warn('Errores del formulario de producto:', JSON.stringify(errorSummary), errors);
      toast.error(errorSummary[0]?.message || 'Revisa los campos marcados antes de guardar.');
    }
  );

  const handleRemoveFile = useCallback(
    (inputFile) => {
      const filtered = values.images && values.images?.filter((file) => file !== inputFile);
      setValue('images', filtered);
    },
    [setValue, values.images]
  );

  const handleRemoveAllFiles = useCallback(() => {
    setValue('images', [], { shouldValidate: true });
  }, [setValue]);

  const handleChangeIncludeTaxes = useCallback((event) => {
    setIncludeTaxes(event.target.checked);
  }, []);

  const handleChangeRenglon = useCallback(
    (event) => {
      const nextRenglon = event.target.value;

      setValue('renglon', nextRenglon);

      if (nextRenglon === 'restringido') {
        setValue('requiereAprobacion', true);
        setValue('tipoProducto', 'restringido');
      }
    },
    [setValue]
  );

  const handleAdjustPrice = useCallback(
    (fieldName, amount) => {
      const currentValue = Number(getValues(fieldName) || 0);
      const registeredPrice = Number(getValues('precioRegistrado') || 0);
      const unregisteredPrice = Number(getValues('precioNoRegistrado') || 0);
      const baseValue =
        fieldName === 'precioNoRegistrado' && currentValue === 0 && amount > 0
          ? registeredPrice
          : currentValue;
      const candidateValue = Math.max(baseValue + amount, 0);
      const nextValue =
        fieldName === 'precioNoRegistrado' && candidateValue > 0
          ? Math.max(candidateValue, registeredPrice)
          : candidateValue;

      setValue(fieldName, nextValue, { shouldDirty: true, shouldValidate: true });

      if (fieldName === 'precioRegistrado' && unregisteredPrice > 0 && unregisteredPrice < nextValue) {
        setValue('precioNoRegistrado', nextValue, { shouldDirty: true, shouldValidate: true });
      }
    },
    [getValues, setValue]
  );

  const renderPriceStepButtons = (fieldName) => (
    <InputAdornment position="end" sx={{ gap: 0.5, ml: 0.75 }}>
      {[-50, -10].map((amount) => (
        <Button
          key={amount}
          type="button"
          size="small"
          variant="outlined"
          onClick={() => handleAdjustPrice(fieldName, amount)}
          sx={{ minWidth: 42, px: 0.75 }}
        >
          {amount}
        </Button>
      ))}

      <Box component="span" sx={{ color: 'text.disabled', mx: 0.25 }}>
        |
      </Box>

      {[10, 50].map((amount) => (
          <Button
            key={amount}
            type="button"
            size="small"
            variant="outlined"
            onClick={() => handleAdjustPrice(fieldName, amount)}
            sx={{ minWidth: 42, px: 0.75 }}
          >
            +{amount}
          </Button>
        ))}
    </InputAdornment>
  );

  const renderUnavailablePriceIndicator = () =>
    isUnregisteredPriceUnavailable ? (
      <Box
        component="span"
        sx={{
          left: 74,
          top: '50%',
          zIndex: 1,
          pointerEvents: 'none',
          position: 'absolute',
          typography: 'body2',
          color: 'text.disabled',
          transform: 'translateY(-50%)',
        }}
      >
        (N/A)
      </Box>
    ) : null;

  const renderCollapseButton = (value, onToggle) => (
    <IconButton onClick={onToggle}>
      <Iconify icon={value ? 'eva:arrow-ios-downward-fill' : 'eva:arrow-ios-forward-fill'} />
    </IconButton>
  );

  const renderDetails = () => (
    <Card>
      <CardHeader
        title="Detalles"
        subheader="Titulo, descripcion corta, imagen..."
        action={renderCollapseButton(openDetails.value, openDetails.onToggle)}
        sx={{ mb: 3 }}
      />

      <Collapse in={openDetails.value}>
        <Divider />

        <Stack spacing={3} sx={{ p: 3 }}>
          <Field.Text name="name" label="Nombre del producto" />

          <Field.Text name="subDescription" label="Descripcion corta" multiline rows={4} />

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Contenido</Typography>
            <Field.Editor name="description" sx={{ maxHeight: 480 }} />
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Imagenes</Typography>
            <Field.Upload
              multiple
              name="images"
              onRemove={handleRemoveFile}
              onRemoveAll={handleRemoveAllFiles}
              onUpload={() => console.info('ON UPLOAD')}
            />
            {shouldCompactImages && (
              <Alert severity="info" variant="outlined">
                Estas imagenes pesan {formatStorageSizeEs(oversizedImagesTotalSize)}. Lo permitido
                es {formatStorageSizeEs(oversizedImagesAllowedSize)} para{' '}
                {oversizedImages.length} imagenes; se compactaran antes de publicarse y puede
                tardar unos segundos mas.
              </Alert>
            )}
          </Stack>
        </Stack>
      </Collapse>
    </Card>
  );

  const renderProperties = () => (
    <Card>
      <CardHeader
        title="Propiedades"
        subheader="Funciones y atributos adicionales..."
        action={renderCollapseButton(openProperties.value, openProperties.onToggle)}
        sx={{ mb: 3 }}
      />

      <Collapse in={openProperties.value}>
        <Divider />

        <Stack spacing={3} sx={{ p: 3 }}>
          <Box
            sx={{
              rowGap: 3,
              columnGap: 2,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' },
            }}
          >
            <Field.Text name="code" label="Codigo del producto" />

            <Field.Text name="sku" label="SKU del producto" />

            <Field.Text
              name="quantity"
              label="Cantidad"
              placeholder="0"
              type="number"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Field.Select
              name="category"
              label="Categoria"
              slotProps={{
                select: { native: true },
                inputLabel: { shrink: true },
              }}
            >
              {PRODUCT_CATEGORY_GROUP_OPTIONS_ES.map((category) => (
                <optgroup key={category.group} label={category.group}>
                  {category.classify.map((classify) => (
                    <option key={classify.value} value={classify.value}>
                      {classify.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Field.Select>

            <Field.Select
              name="renglon"
              label="Renglon"
              onChange={handleChangeRenglon}
              slotProps={{
                select: { native: true },
                inputLabel: { shrink: true },
              }}
            >
              {PRODUCT_RENGLON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Field.Select>

            <Field.Select
              name="tipoProducto"
              label="Tipo de producto"
              slotProps={{
                select: { native: true },
                inputLabel: { shrink: true },
              }}
            >
              {PRODUCT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Field.Select>

            <Field.Text
              name="orden"
              label="Orden de aparicion"
              placeholder="0"
              type="number"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Field.MultiSelect
              checkbox
              name="colors"
              label="Colores"
              options={PRODUCT_COLOR_NAME_OPTIONS_ES}
            />

            <Field.MultiSelect
              checkbox
              name="sizes"
              label="Tallas"
              options={PRODUCT_SIZE_OPTIONS}
              disabled={!isUniformCategory}
              helperText={
                !isUniformCategory ? 'Disponible solo para la categoria Uniformes.' : undefined
              }
            />
          </Box>

          <Field.Autocomplete
            name="tags"
            label="Etiquetas"
            placeholder="+ Etiquetas"
            multiple
            freeSolo
            disableCloseOnSelect
            options={PRODUCT_TAG_OPTIONS}
            getOptionLabel={(option) => option}
            slotProps={{
              chip: { color: 'info' },
            }}
          />

          <Stack spacing={2}>
            <Typography variant="subtitle2">Reglas de tienda ERRD</Typography>

            <Field.Switch
              name="requiereAprobacion"
              label="Requiere aprobacion administrativa"
              sx={{ m: 0 }}
            />

            <Field.Switch
              name="precioPendiente"
              label="Tiene precio pendiente por confirmar"
              sx={{ m: 0 }}
            />

            <Field.Text
              name="notasAdministrativas"
              label="Notas administrativas"
              multiline
              rows={3}
            />

          </Stack>

          <Divider sx={{ borderStyle: 'dashed' }} />

          <Box sx={{ gap: 3, display: 'flex', alignItems: 'center' }}>
            <Field.Switch name="saleLabel.enabled" label={null} sx={{ m: 0 }} />
            <Field.Text
              name="saleLabel.content"
              label="Etiqueta de oferta"
              fullWidth
              disabled={!values.saleLabel.enabled}
            />
          </Box>

          <Box sx={{ gap: 3, display: 'flex', alignItems: 'center' }}>
            <Field.Switch name="newLabel.enabled" label={null} sx={{ m: 0 }} />
            <Field.Text
              name="newLabel.content"
              label="Etiqueta de nuevo"
              fullWidth
              disabled={!values.newLabel.enabled}
            />
          </Box>
        </Stack>
      </Collapse>
    </Card>
  );

  const renderPricing = () => (
    <Card>
      <CardHeader
        title="Precios"
        subheader="Campos relacionados al precio"
        action={renderCollapseButton(openPricing.value, openPricing.onToggle)}
        sx={{ mb: 3 }}
      />

      <Collapse in={openPricing.value}>
        <Divider />

        <Stack spacing={3} sx={{ p: 3 }}>
          <Box
            sx={{
              rowGap: 3,
              columnGap: 2,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' },
            }}
          >
            <Field.Text
              name="precioRegistrado"
              label="Precio a Destacamentos registrados"
              placeholder="0.00"
              type="number"
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 0.75 }}>
                      <Box component="span" sx={{ color: 'text.disabled' }}>
                        RD$
                      </Box>
                    </InputAdornment>
                  ),
                  endAdornment: renderPriceStepButtons('precioRegistrado'),
                },
              }}
            />

            <Box sx={{ position: 'relative' }}>
              <Field.Text
                name="precioNoRegistrado"
                label="Precio a Destacamentos NO registrados"
                placeholder="0.00"
                type="number"
                slotProps={{
                  inputLabel: { shrink: true },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.75 }}>
                        <Box component="span" sx={{ color: 'text.disabled' }}>
                          RD$
                        </Box>
                      </InputAdornment>
                    ),
                    endAdornment: renderPriceStepButtons('precioNoRegistrado'),
                  },
                }}
              />
              {renderUnavailablePriceIndicator()}
            </Box>
          </Box>

          <Field.Text
            name="priceSale"
            label="Precio de oferta"
            placeholder="0.00"
            type="number"
            slotProps={{
              inputLabel: { shrink: true },
              input: {
                startAdornment: (
                  <InputAdornment position="start" sx={{ mr: 0.75 }}>
                    <Box component="span" sx={{ color: 'text.disabled' }}>
                      RD$
                    </Box>
                  </InputAdornment>
                ),
              },
            }}
          />

          <FormControlLabel
            control={
              <Switch
                id="toggle-taxes"
                checked={includeTaxes}
                onChange={handleChangeIncludeTaxes}
              />
            }
            label="El precio incluye impuestos"
          />

          {!includeTaxes && (
            <Field.Text
              name="taxes"
              label="Impuesto (%)"
              placeholder="0.00"
              type="number"
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 0.75 }}>
                      <Box component="span" sx={{ color: 'text.disabled' }}>
                        %
                      </Box>
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}
        </Stack>
      </Collapse>
    </Card>
  );

  const renderActions = () => (
    <Box
      sx={{
        gap: 3,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <FormControlLabel
        label="Publicar"
        control={
          <Switch
            checked={publish}
            onChange={(event) => setPublish(event.target.checked)}
            slotProps={{ input: { id: 'publish-switch' } }}
          />
        }
        sx={{ pl: 3, flexGrow: 1 }}
      />

      <Stack spacing={0.75} alignItems="flex-end">
        <Button type="submit" variant="contained" size="large" loading={isSubmitting}>
          {!currentProduct ? 'Crear producto' : 'Guardar cambios'}
        </Button>

        {submissionMessage && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {submissionMessage}
          </Typography>
        )}
      </Stack>
    </Box>
  );

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Stack spacing={{ xs: 3, md: 5 }} sx={{ mx: 'auto', maxWidth: { xs: 720, xl: 880 } }}>
        {renderDetails()}
        {renderProperties()}
        {renderPricing()}
        {renderActions()}
      </Stack>
    </Form>
  );
}
