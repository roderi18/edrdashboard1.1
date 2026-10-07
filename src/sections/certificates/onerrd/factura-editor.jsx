import { useMemo, useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import {
  crearIdDeCampo,
  sanearCampoOnerrd,
  textosParaPintarOnerrd,
} from 'src/utils/certificado-onerrd.mjs';
import {
  datosDeFacturaOnerrd,
  PAGINA_FACTURA_ONERRD,
  valoresDeFacturaOnerrd,
  facturaSinEmitirOnerrd,
  sanearDisenoFacturaOnerrd,
  MAXIMO_IMAGENES_FACTURA_ONERRD,
} from 'src/utils/factura-onerrd.mjs';

import { Iconify } from 'src/components/iconify';

import { VisorOnerrd } from './onerrd-visor';
import { LienzoOnerrd } from './onerrd-lienzo';
import { medirTextoOnerrd } from './imagenes-onerrd';
import { PropiedadesFactura } from './factura-propiedades';
import { pintarExtrasFactura } from './factura-extras-lienzo';

// ----------------------------------------------------------------------
// "DISEÑO DE LA FACTURA": el desplegable bajo el del certificado, con el
// (y sus imágenes subidas: logos, sellos…, que se mueven, estiran y giran)
// mismo lienzo, visor (zoom, cuadrícula, Ctrl + arrastrar) y panel de
// propiedades. Lo que se ve es la factura del certificado que se va a emitir,
// con los datos de "Datos del registro"; el número lo da la emisión.
//
// El diseño vive en `OnerrdView` (se guarda con la emisión); aquí solo la
// selección, el modo "Ver resultado" y la cuadrícula.
// ----------------------------------------------------------------------

// Lo que el sistema escribe: no se cambia escribiendo en su caja.
const CALCULADOS = new Set(['facturaNumero', 'facturaFecha', 'facturaVence']);

export function TituloDesplegable({ titulo, abierto, onAlternar }) {
  return (
    <ButtonBase
      onClick={onAlternar}
      sx={{ flex: 1, minWidth: 160, justifyContent: 'flex-start', gap: 1, borderRadius: 1 }}
    >
      <Iconify
        icon="eva:arrow-ios-downward-fill"
        sx={{ transition: 'transform 0.2s', transform: abierto ? 'none' : 'rotate(-90deg)' }}
      />
      <Typography variant="h6">{titulo}</Typography>
    </ButtonBase>
  );
}

export function EditorFacturaOnerrd({
  abierto,
  onAlternar,
  diseno,
  onCambiarDiseno,
  hayCambios,
  guardando,
  onGuardar,
  onDescartar,
  valores,
  anio,
  onCambiarValor,
  fuentesListas,
  imagenes,
  numeroRegistro,
  onSubirImagen,
  subiendoImagen,
}) {
  const [seleccion, setSeleccion] = useState(null);
  const [modoVista, setModoVista] = useState(false);
  const [cuadricula, setCuadricula] = useState(false);

  const datos = useMemo(
    () => datosDeFacturaOnerrd(facturaSinEmitirOnerrd(valores, { anio, numeroRegistro })),
    [valores, anio, numeroRegistro]
  );
  const valoresFactura = useMemo(
    () => valoresDeFacturaOnerrd(datos, { ...valores, anio }),
    [datos, valores, anio]
  );
  const textos = useMemo(
    () =>
      textosParaPintarOnerrd(diseno, valoresFactura, PAGINA_FACTURA_ONERRD.ancho, medirTextoOnerrd),
    // `fuentesListas`: volver a medir cuando llega la fuente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diseno, valoresFactura, fuentesListas]
  );

  // Un campo o una imagen (por su id en su lista); la tabla, el sello y la
  // raya, por su clave.
  const cambiarElemento = useCallback(
    (tipo, id, cambios) =>
      onCambiarDiseno((actual) => {
        const lista = tipo === 'campo' ? 'campos' : tipo;
        return Array.isArray(actual[lista])
          ? {
              ...actual,
              [lista]: actual[lista].map((item) =>
                item.id === id ? { ...item, ...cambios } : item
              ),
            }
          : { ...actual, [tipo]: { ...actual[tipo], ...cambios } };
      }),
    [onCambiarDiseno]
  );

  const quitarImagen = (id) => {
    onCambiarDiseno((actual) => ({
      ...actual,
      imagenes: actual.imagenes.filter((imagen) => imagen.id !== id),
    }));
    setSeleccion(null);
  };

  const cambiarValor = useCallback(
    (clave, texto) => {
      if (!CALCULADOS.has(clave)) onCambiarValor(clave, texto);
    },
    [onCambiarValor]
  );

  const agregarTexto = () => {
    const id = crearIdDeCampo(diseno.campos);
    onCambiarDiseno((actual) => ({
      ...actual,
      campos: [
        ...actual.campos,
        sanearCampoOnerrd({
          id,
          tipo: 'fijo',
          etiqueta: 'Texto',
          contenido: 'Texto nuevo',
          fuente: 'Helvetica',
          peso: 400,
          tamano: 12,
          color: '#000000',
          mayusculas: false,
          x: 50,
          y: 50,
          ancho: 40,
        }),
      ],
    }));
    setSeleccion({ tipo: 'campo', id });
  };

  const eliminarCampo = (id) => {
    onCambiarDiseno((actual) => ({ ...actual, campos: actual.campos.filter((c) => c.id !== id) }));
    setSeleccion(null);
  };

  const renderExtras = useCallback(
    (herramientas) => pintarExtrasFactura({ diseno, datos, imagenes }, herramientas),
    [diseno, datos, imagenes]
  );

  return (
    <Card sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        <TituloDesplegable
          titulo="Diseño de la factura"
          abierto={abierto}
          onAlternar={onAlternar}
        />
        {abierto && (
          <>
            <Button
              size="small"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={agregarTexto}
            >
              Agregar texto
            </Button>
            <LoadingButton
              size="small"
              loading={subiendoImagen}
              loadingPosition="start"
              disabled={diseno.imagenes.length >= MAXIMO_IMAGENES_FACTURA_ONERRD}
              startIcon={<Iconify icon="solar:gallery-add-bold" />}
              onClick={async () => {
                const id = await onSubirImagen();
                if (id) setSeleccion({ tipo: 'imagenes', id });
              }}
            >
              Subir imagen
            </LoadingButton>
            <Button
              size="small"
              color={modoVista ? 'primary' : 'inherit'}
              startIcon={<Iconify icon={modoVista ? 'solar:eye-closed-bold' : 'solar:eye-bold'} />}
              onClick={() => {
                setModoVista((v) => !v);
                setSeleccion(null);
              }}
            >
              {modoVista ? 'Volver a editar' : 'Ver resultado'}
            </Button>
            {!diseno.logo?.visible && (
              <Button
                size="small"
                color="inherit"
                startIcon={<Iconify icon="solar:eye-bold" />}
                onClick={() => {
                  cambiarElemento('logo', 'logo', { visible: true });
                  setSeleccion({ tipo: 'logo', id: 'logo' });
                }}
              >
                Mostrar logo
              </Button>
            )}
            <Tooltip title="Vuelve a la factura de fábrica (logo, remitente, tabla y sello en su sitio). Se queda solo si pulsas «Guardar diseño».">
              <Button
                size="small"
                color="inherit"
                startIcon={<Iconify icon="solar:restart-bold" />}
                onClick={() => {
                  onCambiarDiseno(() => sanearDisenoFacturaOnerrd());
                  setSeleccion(null);
                }}
              >
                Diseño de fábrica
              </Button>
            </Tooltip>
            {hayCambios && (
              <Tooltip title="Volver a lo último guardado">
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<Iconify icon="solar:restart-bold" />}
                  onClick={() => {
                    onDescartar();
                    setSeleccion(null);
                  }}
                >
                  Descartar
                </Button>
              </Tooltip>
            )}
            <LoadingButton
              size="small"
              variant="contained"
              loading={guardando}
              disabled={!hayCambios}
              onClick={onGuardar}
              startIcon={
                <Iconify icon={hayCambios ? 'solar:file-text-bold' : 'solar:check-circle-bold'} />
              }
            >
              {hayCambios ? 'Guardar diseño' : 'Guardado'}
            </LoadingButton>
          </>
        )}
      </Stack>

      <Collapse in={abierto} unmountOnExit>
        <Stack sx={{ mt: 2 }}>
          <VisorOnerrd
            cuadricula={cuadricula}
            onCuadricula={setCuadricula}
            mostrarCuadricula={!modoVista}
          >
            <LienzoOnerrd
              paginaEnBlanco
              pagina={PAGINA_FACTURA_ONERRD}
              diseno={diseno}
              firmasPorId={{}}
              textos={textos}
              valores={valoresFactura}
              onCambiarValor={cambiarValor}
              seleccion={seleccion}
              modoVista={modoVista}
              cuadricula={cuadricula}
              onSeleccionar={setSeleccion}
              onCambiarElemento={cambiarElemento}
              renderExtras={renderExtras}
            />
          </VisorOnerrd>

          {!modoVista && (
            <>
              <Divider sx={{ my: 2.5 }} />
              <PropiedadesFactura
                seleccion={seleccion}
                diseno={diseno}
                onCambiarElemento={cambiarElemento}
                onEliminarCampo={eliminarCampo}
                imagenes={imagenes}
                onQuitarImagen={quitarImagen}
              />
            </>
          )}
        </Stack>
      </Collapse>
    </Card>
  );
}
