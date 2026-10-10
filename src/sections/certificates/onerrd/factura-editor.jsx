import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Collapse from '@mui/material/Collapse';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { direccionPublicaActual } from 'src/utils/direccion-publica.mjs';
import {
  crearIdDeCampo,
  sanearCampoOnerrd,
  urlDeFacturaOnerrd,
  textosParaPintarOnerrd,
} from 'src/utils/certificado-onerrd.mjs';
import {
  sanearFormaFactura,
  datosDeFacturaOnerrd,
  PAGINA_FACTURA_ONERRD,
  valoresDeFacturaOnerrd,
  facturaSinEmitirOnerrd,
  sanearDisenoFacturaOnerrd,
  crearIdFormaFacturaOnerrd,
  FORMA_NUEVA_FACTURA_ONERRD,
  MAXIMO_FORMAS_FACTURA_ONERRD,
  MAXIMO_IMAGENES_FACTURA_ONERRD,
} from 'src/utils/factura-onerrd.mjs';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { VisorOnerrd } from './onerrd-visor';
import { LienzoOnerrd } from './onerrd-lienzo';
import { usePapeleraOnerrd } from './papelera-onerrd';
import { PropiedadesFactura } from './factura-propiedades';
import { pintarExtrasFactura } from './factura-extras-lienzo';
import { generarQrOnerrd, medirTextoOnerrd } from './imagenes-onerrd';
import {
  copiarOnerrd,
  copiaDeFormaOnerrd,
  copiaDeCampoOnerrd,
  recordarPegadoOnerrd,
  leerPortapapelesOnerrd,
} from './portapapeles-onerrd';

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
const CALCULADOS = new Set([
  'facturaNumero',
  'facturaFecha',
  'facturaVence',
  'facturaVenceEtiqueta',
]);

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
  // (archivos, { x, y }): imágenes soltadas encima de la factura.
  onSoltarArchivos,
  subiendoImagen,
  botonPanel,
}) {
  const [seleccion, setSeleccion] = useState(null);

  // El QR de la vista previa: el mismo tipo de enlace que llevará la factura
  // (el de verdad se conoce al emitir, con la clave del certificado). Se
  // mueve y se agranda como el del certificado.
  const [qrVista, setQrVista] = useState(null);
  const colorQr = diseno.qr?.color;
  useEffect(() => {
    let vivo = true;
    generarQrOnerrd(urlDeFacturaOnerrd(direccionPublicaActual(), '', ''), colorQr)
      .then((dataUrl) => vivo && setQrVista(dataUrl))
      .catch((error) => console.error('[onerrd] no se pudo generar el QR de la factura', error));
    return () => {
      vivo = false;
    };
  }, [colorQr]);
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

  // Eliminar textos: pregunta antes y los deja en "Eliminados" (papelera),
  // con el mismo componente que el certificado.
  const papelera = usePapeleraOnerrd({
    diseno,
    onCambiarDiseno,
    onEliminados: () => setSeleccion(null),
    onRestaurado: (id) => setSeleccion({ tipo: 'campo', id }),
  });
  const eliminarCampo = (id) => papelera.pedirEliminar([id]);

  // Ctrl + C / Ctrl + V / Ctrl + D / Supr en el lienzo. Se copian textos y
  // formas; una imagen subida es un documento propio y no se duplica.
  // Pega una lista de copiados de una vez y devuelve lo pegado ({ tipo, id }),
  // que el lienzo deja elegido en grupo. Los ids se reparten sobre la lista
  // que va creciendo: dos copias seguidas no pueden llevar el mismo.
  const pegar = (copiados) => {
    if (!copiados?.length) return [];
    const campos = [...diseno.campos];
    const formas = [...diseno.formas];
    const pegados = [];
    let sinSitio = false;
    copiados.forEach((copiado) => {
      if (copiado.tipo === 'campo') {
        const campo = copiaDeCampoOnerrd(copiado.elemento, copiado.texto, campos);
        campos.push(campo);
        pegados.push({ ...copiado, elemento: campo });
      } else if (formas.length >= MAXIMO_FORMAS_FACTURA_ONERRD) {
        sinSitio = true;
      } else {
        const forma = sanearFormaFactura(
          copiaDeFormaOnerrd(copiado.elemento, crearIdFormaFacturaOnerrd(formas))
        );
        formas.push(forma);
        pegados.push({ ...copiado, elemento: forma });
      }
    });
    if (sinSitio) {
      toast.warning(`La factura lleva como mucho ${MAXIMO_FORMAS_FACTURA_ONERRD} formas.`);
    }
    if (!pegados.length) return [];
    const nuevosCampos = campos.slice(diseno.campos.length);
    const nuevasFormas = formas.slice(diseno.formas.length);
    onCambiarDiseno((actual) => ({
      ...actual,
      campos: [...actual.campos, ...nuevosCampos],
      formas: [...actual.formas, ...nuevasFormas],
    }));
    recordarPegadoOnerrd(pegados);
    const elegidos = pegados.map(({ tipo, elemento }) => ({ tipo, id: elemento.id }));
    setSeleccion(elegidos[elegidos.length - 1]);
    return elegidos;
  };

  // Lo elegido, listo para el portapapeles (o null si no se copia).
  const paraCopiar = (sel) => {
    if (sel?.tipo === 'campo') {
      const pintado = textos.find((t) => t.campo.id === sel.id);
      return pintado ? { tipo: 'campo', elemento: pintado.campo, texto: pintado.texto } : null;
    }
    if (sel?.tipo === 'formas') {
      const forma = diseno.formas.find((item) => item.id === sel.id);
      return forma ? { tipo: 'formas', elemento: forma } : null;
    }
    return null;
  };

  // Eliminar: un texto añadido, una forma o una imagen se quitan; lo de
  // fábrica (sus textos, el logo, la tabla, el sello, la raya) se oculta y
  // vuelve desde «Ocultos».
  const eliminar = (sel) => {
    if (!sel) return;
    if (sel.tipo === 'campo') {
      const campo = diseno.campos.find((item) => item.id === sel.id);
      if (campo?.deFabrica) cambiarElemento('campo', sel.id, { visible: false });
      else papelera.pedirEliminar([sel.id]);
    } else if (sel.tipo === 'formas' || sel.tipo === 'imagenes') {
      onCambiarDiseno((a) => ({ ...a, [sel.tipo]: a[sel.tipo].filter((i) => i.id !== sel.id) }));
    } else {
      cambiarElemento(sel.tipo, sel.id, { visible: false });
    }
    setSeleccion(null);
  };

  // `lista`: lo elegido (uno, o varios con Ctrl + clic). Devuelve lo pegado.
  const alAtajo = (accion, sel, lista = sel ? [sel] : []) => {
    if (accion === 'eliminar') {
      // Los textos añadidos van juntos a la papelera (una sola pregunta).
      const aPapelera = lista
        .filter((item) => item.tipo === 'campo')
        .map((item) => diseno.campos.find((campo) => campo.id === item.id))
        .filter((campo) => campo && !campo.deFabrica)
        .map((campo) => campo.id);
      papelera.pedirEliminar(aPapelera);
      lista
        .filter((item) => !(item.tipo === 'campo' && aPapelera.includes(item.id)))
        .forEach(eliminar);
      return undefined;
    }
    if (accion === 'pegar') return pegar(leerPortapapelesOnerrd());
    const copiados = lista.map(paraCopiar).filter(Boolean);
    if (!copiados.length) {
      if (sel) toast.info('Se copian los textos y las formas.');
      return undefined;
    }
    if (accion === 'copiar') {
      copiarOnerrd(copiados);
      return undefined;
    }
    return pegar(copiados); // duplicar: sin tocar lo copiado
  };

  // Lo de fábrica oculto (también lo eliminado con Supr), para volver a mostrarlo.
  const ocultos = [
    ...diseno.campos
      .filter((campo) => campo.deFabrica && !campo.visible)
      .map((campo) => ({ tipo: 'campo', id: campo.id, nombre: campo.etiqueta })),
    ...[
      ['logo', 'Logo'],
      ['tabla', 'Tabla de líneas'],
      ['sello', 'Sello del estado'],
    ]
      .filter(([clave]) => diseno[clave] && !diseno[clave].visible)
      .map(([clave, nombre]) => ({ tipo: clave, id: clave, nombre })),
  ];
  const [menuOcultos, setMenuOcultos] = useState(null);

  // Una forma nueva: una barra navy en el centro, lista para moverla.
  const agregarForma = () => {
    const id = crearIdFormaFacturaOnerrd(diseno.formas);
    onCambiarDiseno((actual) => ({
      ...actual,
      formas: [...actual.formas, sanearFormaFactura({ ...FORMA_NUEVA_FACTURA_ONERRD, id })],
    }));
    setSeleccion({ tipo: 'formas', id });
  };

  const quitarForma = (id) => {
    onCambiarDiseno((actual) => ({
      ...actual,
      formas: actual.formas.filter((item) => item.id !== id),
    }));
    setSeleccion(null);
  };

  const renderExtras = useCallback(
    (herramientas) =>
      pintarExtrasFactura(
        { diseno, datos, imagenes, onCambiarElemento: cambiarElemento },
        herramientas
      ),
    [diseno, datos, imagenes, cambiarElemento]
  );

  return (
    <Card sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      {papelera.dialogo}
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        {botonPanel}
        <TituloDesplegable titulo="Diseño de factura" abierto={abierto} onAlternar={onAlternar} />
        {abierto && (
          <>
            <Button
              size="small"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={agregarTexto}
            >
              Agregar texto
            </Button>
            <Button
              size="small"
              disabled={diseno.formas.length >= MAXIMO_FORMAS_FACTURA_ONERRD}
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={agregarForma}
            >
              Agregar forma
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
            {papelera.boton}
            {ocultos.length > 0 && (
              <>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<Iconify icon="solar:eye-bold" />}
                  endIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={16} />}
                  onClick={(event) => setMenuOcultos(event.currentTarget)}
                >
                  Ocultos ({ocultos.length})
                </Button>
                <Menu
                  anchorEl={menuOcultos}
                  open={!!menuOcultos}
                  onClose={() => setMenuOcultos(null)}
                >
                  {ocultos.map((oculto) => (
                    <MenuItem
                      key={`${oculto.tipo}-${oculto.id}`}
                      onClick={() => {
                        cambiarElemento(oculto.tipo, oculto.id, { visible: true });
                        setSeleccion({ tipo: oculto.tipo, id: oculto.id });
                        setMenuOcultos(null);
                      }}
                    >
                      Mostrar «{oculto.nombre}»
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )}
            <Tooltip title="Vuelve a la factura de fábrica (logo, remitente, barras, tabla, sello y pie en su sitio, con los colores de la casa). Se queda solo si pulsas «Guardar diseño».">
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
              qr={qrVista}
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
              onSoltarArchivos={onSoltarArchivos}
              onAtajo={alAtajo}
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
                onQuitarForma={quitarForma}
              />
            </>
          )}
        </Stack>
      </Collapse>
    </Card>
  );
}
