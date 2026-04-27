import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useCallback } from 'react';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
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

import { saveLocalProduct } from 'src/utils/local-product-storage';

import {
  _tags,
  PRODUCT_SIZE_OPTIONS,
  PRODUCT_COLOR_NAME_OPTIONS,
} from 'src/_mock';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field, schemaUtils } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const PRODUCT_GENDER_OPTIONS_ES = [
  { label: 'Hombre', value: 'Men' },
  { label: 'Mujer', value: 'Women' },
  { label: 'Ninos', value: 'Kids' },
];

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
    group: 'Ropa',
    classify: [
      { label: 'Camisas', value: 'Shirts' },
      { label: 'T-shirts', value: 'T-shirts' },
      { label: 'Jeans', value: 'Jeans' },
      { label: 'Cuero', value: 'Leather' },
      { label: 'Accesorios', value: 'Accessories' },
    ],
  },
  {
    group: 'Sastreria',
    classify: [
      { label: 'Trajes', value: 'Suits' },
      { label: 'Blazers', value: 'Blazers' },
      { label: 'Pantalones', value: 'Trousers' },
      { label: 'Chalecos', value: 'Waistcoats' },
      { label: 'Ropa', value: 'Apparel' },
    ],
  },
  {
    group: 'Accesorios',
    classify: [
      { label: 'Zapatos', value: 'Shoes' },
      { label: 'Mochilas y bolsos', value: 'Backpacks and bags' },
      { label: 'Brazaletes', value: 'Bracelets' },
      { label: 'Mascarillas', value: 'Face masks' },
    ],
  },
];

export const ProductCreateSchema = z.object({
  name: z.string().min(1, { error: 'El nombre es requerido.' }),
  description: schemaUtils
    .editor({ error: 'La descripcion es requerida.' })
    .min(100, { error: 'La descripcion debe tener al menos 100 caracteres.' }),
  images: schemaUtils.files({ error: 'Las imagenes son requeridas.' }).min(2, {
    error: 'Debe subir al menos 2 imagenes.',
  }),
  code: z.string().min(1, { error: 'El codigo del producto es requerido.' }),
  sku: z.string().min(1, { error: 'El SKU del producto es requerido.' }),
  quantity: schemaUtils.nullableInput(
    z.coerce.number().min(1, { error: 'La cantidad es requerida.' }),
    { error: 'La cantidad es requerida.' }
  ),
  colors: z.string().array().min(1, { error: 'Elija al menos una opcion.' }),
  sizes: z.string().array().min(1, { error: 'Elija al menos una opcion.' }),
  tags: z.string().array().min(2, { error: 'Debe agregar al menos 2 etiquetas.' }),
  gender: z.array(z.string()).min(1, { error: 'Elija al menos una opcion.' }),
  price: schemaUtils.nullableInput(z.coerce.number().min(1, { error: 'El precio es requerido.' }), {
    error: 'El precio es requerido.',
  }),
  // Not required
  category: z.string(),
  subDescription: z.string(),
  taxes: z.coerce.number().nullable(),
  priceSale: z.coerce.number().nullable(),
  saleLabel: z.object({ enabled: z.boolean(), content: z.string() }),
  newLabel: z.object({ enabled: z.boolean(), content: z.string() }),
  publish: z.boolean().optional(),
});

// ----------------------------------------------------------------------

export function ProductCreateEditForm({ currentProduct }) {
  const router = useRouter();

  const openDetails = useBoolean(true);
  const openProperties = useBoolean(true);
  const openPricing = useBoolean(true);

  const [includeTaxes, setIncludeTaxes] = useState(false);
  const [publish, setPublish] = useState(currentProduct?.publish !== 'draft');

  const defaultValues = {
    name: '',
    description: '',
    subDescription: '',
    images: [],
    /********/
    code: '',
    sku: '',
    price: null,
    taxes: null,
    priceSale: null,
    quantity: null,
    tags: [],
    gender: [],
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
    values: currentProduct,
  });

  const {
    reset,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const values = watch();

  const onSubmit = handleSubmit(async (data) => {
    const updatedData = {
      ...data,
      taxes: includeTaxes ? defaultValues.taxes : data.taxes,
    };

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await saveLocalProduct(updatedData, { publish });
      reset();
      toast.success(currentProduct ? 'Actualizacion exitosa!' : 'Producto creado!');
      router.push(paths.dashboard.product.root);
      console.info('DATA', updatedData);
    } catch (error) {
      console.error(error);
    }
  });

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
              maxSize={1050000}
              onRemove={handleRemoveFile}
              onRemoveAll={handleRemoveAllFiles}
              onUpload={() => console.info('ON UPLOAD')}
            />
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

            <Field.MultiSelect
              checkbox
              name="colors"
              label="Colores"
              options={PRODUCT_COLOR_NAME_OPTIONS_ES}
            />

            <Field.MultiSelect checkbox name="sizes" label="Tallas" options={PRODUCT_SIZE_OPTIONS} />
          </Box>

          <Field.Autocomplete
            name="tags"
            label="Etiquetas"
            placeholder="+ Etiquetas"
            multiple
            freeSolo
            disableCloseOnSelect
            options={_tags.map((option) => option)}
            getOptionLabel={(option) => option}
            slotProps={{
              chip: { color: 'info' },
            }}
          />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Genero</Typography>
            <Field.MultiCheckbox
              row
              name="gender"
              options={PRODUCT_GENDER_OPTIONS_ES}
              sx={{ gap: 2 }}
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
          <Field.Text
            name="price"
            label="Precio regular"
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

      <Button type="submit" variant="contained" size="large" loading={isSubmitting}>
        {!currentProduct ? 'Crear producto' : 'Guardar cambios'}
      </Button>
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
