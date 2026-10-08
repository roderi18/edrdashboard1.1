import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { FUENTES_ONERRD } from 'src/utils/certificado-onerrd.mjs';
import { COLORES_FACTURA_ONERRD } from 'src/utils/factura-onerrd.mjs';

import { Iconify } from 'src/components/iconify';

import {
  Escalon,
  Posicion,
  NumeroCampo,
  ControlDeGiro,
  SelectorDeColor,
  PropiedadesOnerrd,
} from './onerrd-propiedades';

// ----------------------------------------------------------------------
// LAS PROPIEDADES DE LO ELEGIDO EN "DISEÑO DE LA FACTURA". Un texto usa el
// mismo panel que en el certificado (letra, grueso, tamaño, color, contorno,
// degradado, espaciado, alineación, giro…). La tabla, el sello y la raya
// tienen el suyo, con los mismos controles.
// ----------------------------------------------------------------------

const TITULOS_DE_TABLA = [
  ['descripcion', 'Columna 1'],
  ['precio', 'Columna 2'],
  ['cantidad', 'Columna 3'],
  ['importe', 'Columna 4'],
  ['total', 'Rótulo del total'],
];

function Mostrar({ elemento, cambiar, titulo }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="subtitle2" sx={{ flex: 1 }}>
        {titulo}
      </Typography>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={elemento.visible}
            onChange={(event) => cambiar({ visible: event.target.checked })}
          />
        }
        label="Mostrar"
      />
    </Stack>
  );
}

function Color({ titulo, valor, onCambiar }) {
  return (
    <Tooltip title={titulo}>
      <Stack spacing={0.5} alignItems="flex-start">
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {titulo}
        </Typography>
        <SelectorDeColor valor={valor} onCambiar={onCambiar} />
      </Stack>
    </Tooltip>
  );
}

// Un color que puede no estar ('' = sin relleno, sin borde, sin encabezado):
// el interruptor lo pone (con `porDefecto`) o lo quita.
function ColorOpcional({ titulo, valor, porDefecto, onCambiar }) {
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={!!valor}
            onChange={(event) => onCambiar(event.target.checked ? porDefecto : '')}
          />
        }
        label={<Typography variant="caption">{titulo}</Typography>}
      />
      {!!valor && <SelectorDeColor valor={valor} onCambiar={onCambiar} />}
    </Stack>
  );
}

const ESQUINAS = [
  ['todas', 'Todas'],
  ['arriba', 'Solo arriba'],
  ['abajo', 'Solo abajo'],
];

function SelectorDeFuente({ valor, onCambiar }) {
  return (
    <TextField
      select
      size="small"
      label="Letra"
      value={valor}
      onChange={(event) => onCambiar(event.target.value)}
      sx={{ minWidth: 160 }}
    >
      {FUENTES_ONERRD.map((fuente) => (
        <MenuItem key={fuente.value} value={fuente.value} sx={{ fontFamily: fuente.css }}>
          {fuente.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function PropiedadesFactura({
  seleccion,
  diseno,
  onCambiarElemento,
  onEliminarCampo,
  imagenes = {},
  onQuitarImagen,
  onQuitarForma,
}) {
  if (!seleccion) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
        Pulsa un texto, una imagen, una forma (barras, rayas, recuadros), la tabla o el sello en la
        factura para moverlo o cambiarlo. «Agregar forma» añade una barra o un recuadro; «Subir
        imagen», un logo o lo que quieras (PNG, JPG, WebP). Arrastra para mover, las asas para
        cambiar el tamaño (el asa redonda gira) y las flechas del teclado para afinar (Mayús = más
        rápido). Doble clic en un texto (o Intro) para escribirlo dentro de su caja. Ctrl + C y Ctrl
        + V copian y pegan textos y formas (Ctrl + D duplica) y Supr elimina; lo de fábrica
        eliminado se recupera en «Ocultos». Los datos de cada factura (a quién, estado, líneas,
        descuento, impuestos) se escriben en «Datos del registro».
      </Typography>
    );
  }

  if (seleccion.tipo === 'campo') {
    return (
      <PropiedadesOnerrd
        seleccion={seleccion}
        diseno={diseno}
        firmasActivas={[]}
        onCambiarElemento={onCambiarElemento}
        onEliminarCampo={onEliminarCampo}
      />
    );
  }

  if (seleccion.tipo === 'tabla') {
    const { tabla } = diseno;
    const cambiar = (cambios) => onCambiarElemento('tabla', 'tabla', cambios);
    return (
      <Stack spacing={2}>
        <Mostrar elemento={tabla} cambiar={cambiar} titulo="Tabla de líneas" />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Las líneas, el importe y los totales salen de «Datos del registro». Arrastra para moverla;
          el asa cambia su ancho. Su «Y %» es el borde de arriba (crece hacia abajo con las líneas).
        </Typography>
        <Posicion elemento={tabla} onCambiar={cambiar} />
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <SelectorDeFuente valor={tabla.fuente} onCambiar={(fuente) => cambiar({ fuente })} />
          <Escalon
            label="Tamaño"
            value={tabla.tamano}
            min={5}
            max={20}
            paso={0.5}
            menos="Letra más pequeña"
            mas="Letra más grande"
            onChange={(tamano) => cambiar({ tamano })}
          />
          <Escalon
            label="Filas"
            value={tabla.filas}
            min={1}
            max={20}
            paso={1}
            menos="Menos filas"
            mas="Más filas"
            onChange={(filas) => cambiar({ filas })}
          />
          <Escalon
            label="Alto de fila"
            value={tabla.altoFila}
            min={10}
            max={60}
            paso={0.5}
            menos="Filas más bajas"
            mas="Filas más altas"
            onChange={(altoFila) => cambiar({ altoFila })}
          />
          <Escalon
            label="Borde"
            value={tabla.grosorBorde}
            min={0}
            max={6}
            paso={0.1}
            menos="Borde más fino"
            mas="Borde más grueso"
            onChange={(grosorBorde) => cambiar({ grosorBorde })}
          />
          <Escalon
            label="Esquinas"
            value={tabla.radio}
            min={0}
            max={30}
            paso={0.5}
            menos="Esquinas más rectas"
            mas="Esquinas más redondas"
            onChange={(radio) => cambiar({ radio })}
          />
          {!!tabla.colorEncabezado && (
            <Escalon
              label="Hueco al total"
              value={tabla.separacionTotal}
              min={0}
              max={60}
              paso={1}
              menos="Total más pegado"
              mas="Total más separado"
              onChange={(separacionTotal) => cambiar({ separacionTotal })}
            />
          )}
        </Stack>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <ColorOpcional
            titulo="Encabezado relleno"
            valor={tabla.colorEncabezado}
            porDefecto={COLORES_FACTURA_ONERRD.navy}
            onCambiar={(colorEncabezado) => cambiar({ colorEncabezado })}
          />
          {!!tabla.colorEncabezado && (
            <Color
              titulo="Letras del encabezado"
              valor={tabla.colorTextoEncabezado || COLORES_FACTURA_ONERRD.blanco}
              onCambiar={(colorTextoEncabezado) => cambiar({ colorTextoEncabezado })}
            />
          )}
          <Color
            titulo="Texto"
            valor={tabla.colorTexto}
            onCambiar={(colorTexto) => cambiar({ colorTexto })}
          />
          <Color
            titulo="Borde"
            valor={tabla.colorBorde}
            onCambiar={(colorBorde) => cambiar({ colorBorde })}
          />
          <Color
            titulo="Franjas"
            valor={tabla.colorFranja}
            onCambiar={(colorFranja) => cambiar({ colorFranja })}
          />
          <Color
            titulo="Columna del importe"
            valor={tabla.colorImporte}
            onCambiar={(colorImporte) => cambiar({ colorImporte })}
          />
          <Color
            titulo="Total"
            valor={tabla.colorTotal}
            onCambiar={(colorTotal) => cambiar({ colorTotal })}
          />
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {TITULOS_DE_TABLA.map(([clave, etiqueta]) => (
            <TextField
              key={clave}
              size="small"
              label={etiqueta}
              value={tabla.titulos[clave]}
              onChange={(event) =>
                cambiar({ titulos: { ...tabla.titulos, [clave]: event.target.value } })
              }
              slotProps={{ htmlInput: { maxLength: 40 } }}
            />
          ))}
        </Box>
      </Stack>
    );
  }

  if (seleccion.tipo === 'sello') {
    const { sello } = diseno;
    const cambiar = (cambios) => onCambiarElemento('sello', 'sello', cambios);
    return (
      <Stack spacing={2}>
        <Mostrar elemento={sello} cambiar={cambiar} titulo="Sello del estado" />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Dice el estado de la factura (PAGADO, PENDIENTE, VENCIDA, BORRADOR; PRUEBA en la de
          prueba), elegido en «Datos del registro». La letra se ajusta al recuadro.
        </Typography>
        <Posicion elemento={sello} onCambiar={cambiar} />
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <SelectorDeFuente valor={sello.fuente} onCambiar={(fuente) => cambiar({ fuente })} />
          <Escalon
            label="Borde"
            value={sello.grosorBorde}
            min={0}
            max={10}
            paso={0.5}
            menos="Borde más fino"
            mas="Borde más grueso"
            onChange={(grosorBorde) => cambiar({ grosorBorde })}
          />
          <Escalon
            label="Esquinas"
            value={sello.radio}
            min={0}
            max={60}
            paso={0.5}
            menos="Esquinas más rectas"
            mas="Esquinas más redondas"
            onChange={(radio) => cambiar({ radio })}
          />
          <Color
            titulo="Letras"
            valor={sello.colorTexto}
            onCambiar={(colorTexto) => cambiar({ colorTexto })}
          />
          <Color
            titulo="Recuadro"
            valor={sello.colorBorde}
            onCambiar={(colorBorde) => cambiar({ colorBorde })}
          />
        </Stack>
        <ControlDeGiro valor={sello.rotacion} onCambiar={(rotacion) => cambiar({ rotacion })} />
      </Stack>
    );
  }

  if (seleccion.tipo === 'qr') {
    const { qr } = diseno;
    const cambiar = (cambios) => onCambiarElemento('qr', 'qr', cambios);
    return (
      <Stack spacing={2}>
        <Mostrar elemento={qr} cambiar={cambiar} titulo="Código QR" />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Al escanearlo abre esta factura (se guarda al emitir), en el mismo contenedor que el
          certificado, con su clave. En la prueba lleva a un aviso de que no tiene validez. Arrastra
          para moverlo y usa el asa para cambiar su tamaño.
        </Typography>
        <Posicion elemento={qr} onCambiar={cambiar} />
        <Color
          titulo="Color del código (oscuro sobre blanco para que se lea bien)"
          valor={qr.color}
          onCambiar={(color) => cambiar({ color })}
        />
      </Stack>
    );
  }

  if (seleccion.tipo === 'logo') {
    const { logo } = diseno;
    const cambiar = (cambios) => onCambiarElemento('logo', 'logo', cambios);
    return (
      <Stack spacing={2}>
        <Mostrar elemento={logo} cambiar={cambiar} titulo="Logo" />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          El emblema de Exploradores del Rey. Arrastra para moverlo; el asa cuadrada cambia su
          tamaño y la redonda lo gira. Para otro logo, ocúltalo y usa «Subir imagen».
        </Typography>
        <Posicion elemento={logo} onCambiar={cambiar} />
        <ControlDeGiro valor={logo.rotacion} onCambiar={(rotacion) => cambiar({ rotacion })} />
      </Stack>
    );
  }

  if (seleccion.tipo === 'imagenes') {
    const imagen = diseno.imagenes.find((item) => item.id === seleccion.id);
    if (!imagen) return null;
    const cambiar = (cambios) => onCambiarElemento('imagenes', imagen.id, cambios);
    return (
      <Stack spacing={2}>
        <Mostrar
          elemento={imagen}
          cambiar={cambiar}
          titulo={imagenes[imagen.id]?.nombreArchivo || 'Imagen'}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Arrastra para moverla; el asa cuadrada cambia su tamaño y la redonda la gira. Va debajo de
          los textos, la tabla y el sello.
        </Typography>
        <Posicion elemento={imagen} onCambiar={cambiar} />
        <ControlDeGiro valor={imagen.rotacion} onCambiar={(rotacion) => cambiar({ rotacion })} />
        <Button
          color="error"
          startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
          onClick={() => onQuitarImagen(imagen.id)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Quitar de la factura
        </Button>
      </Stack>
    );
  }

  if (seleccion.tipo === 'formas') {
    const forma = diseno.formas.find((item) => item.id === seleccion.id);
    if (!forma) return null;
    const cambiar = (cambios) => onCambiarElemento('formas', forma.id, cambios);
    return (
      <Stack spacing={2}>
        <Mostrar elemento={forma} cambiar={cambiar} titulo={forma.etiqueta} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Arrastra para moverla; el asa de la derecha cambia el ancho, la de abajo el alto y la
          redonda la gira. Va debajo de los textos: una barra navy con un texto blanco encima es un
          rótulo, como el de «FACTURAR A».
        </Typography>
        <TextField
          size="small"
          label="Nombre"
          value={forma.etiqueta}
          onChange={(event) => cambiar({ etiqueta: event.target.value })}
          slotProps={{ htmlInput: { maxLength: 60 } }}
          sx={{ maxWidth: 320 }}
        />
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <NumeroCampo
            label="X %"
            value={forma.x}
            min={-5}
            max={105}
            onChange={(x) => cambiar({ x })}
            sx={{ width: 96 }}
          />
          <NumeroCampo
            label="Y %"
            value={forma.y}
            min={-5}
            max={105}
            onChange={(y) => cambiar({ y })}
            sx={{ width: 96 }}
          />
          <NumeroCampo
            label="Ancho %"
            value={forma.ancho}
            min={0.1}
            max={100}
            onChange={(ancho) => cambiar({ ancho })}
            sx={{ width: 96 }}
          />
          <NumeroCampo
            label="Alto (pt)"
            value={forma.alto}
            min={0.25}
            max={792}
            onChange={(alto) => cambiar({ alto })}
            sx={{ width: 96 }}
          />
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Escalon
            label="Borde"
            value={forma.grosorBorde}
            min={0}
            max={10}
            paso={0.1}
            menos="Borde más fino"
            mas="Borde más grueso"
            onChange={(grosorBorde) => cambiar({ grosorBorde })}
          />
          <Escalon
            label="Esquinas"
            value={forma.radio}
            min={0}
            max={100}
            paso={0.5}
            menos="Esquinas más rectas"
            mas="Esquinas más redondas"
            onChange={(radio) => cambiar({ radio })}
          />
          <TextField
            select
            size="small"
            label="Redondear"
            value={forma.esquinas}
            onChange={(event) => cambiar({ esquinas: event.target.value })}
            sx={{ minWidth: 140 }}
          >
            {ESQUINAS.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <Escalon
            label="Bisel (°)"
            value={forma.inclinacion}
            min={-60}
            max={60}
            paso={1}
            menos="Inclinar a la izquierda"
            mas="Inclinar a la derecha"
            onChange={(inclinacion) => cambiar({ inclinacion })}
          />
        </Stack>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <ColorOpcional
            titulo="Relleno"
            valor={forma.relleno}
            porDefecto={COLORES_FACTURA_ONERRD.navy}
            onCambiar={(relleno) => cambiar({ relleno })}
          />
          <ColorOpcional
            titulo="Color del borde"
            valor={forma.colorBorde}
            porDefecto={COLORES_FACTURA_ONERRD.navy}
            onCambiar={(colorBorde) =>
              cambiar({
                colorBorde,
                // Encender el borde sin grosor no se vería.
                ...(colorBorde && !forma.grosorBorde ? { grosorBorde: 1 } : {}),
              })
            }
          />
        </Stack>
        <ControlDeGiro valor={forma.rotacion} onCambiar={(rotacion) => cambiar({ rotacion })} />
        <Button
          color="error"
          startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
          onClick={() => onQuitarForma(forma.id)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Quitar de la factura
        </Button>
      </Stack>
    );
  }

  if (seleccion.tipo === 'linea') {
    const { linea } = diseno;
    const cambiar = (cambios) => onCambiarElemento('linea', 'linea', cambios);
    return (
      <Stack spacing={2}>
        <Mostrar elemento={linea} cambiar={cambiar} titulo="Raya bajo «Facturar a»" />
        <Posicion elemento={linea} onCambiar={cambiar} />
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Escalon
            label="Grosor"
            value={linea.grosor}
            min={0.25}
            max={10}
            paso={0.25}
            menos="Más fina"
            mas="Más gruesa"
            onChange={(grosor) => cambiar({ grosor })}
          />
          <Color titulo="Color" valor={linea.color} onCambiar={(color) => cambiar({ color })} />
        </Stack>
      </Stack>
    );
  }

  return null;
}
