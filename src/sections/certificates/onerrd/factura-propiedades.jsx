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

import { Iconify } from 'src/components/iconify';

import {
  Escalon,
  Posicion,
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
}) {
  if (!seleccion) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
        Pulsa un texto, una imagen, la tabla, la raya o el sello en la factura para moverlo o
        cambiarlo. «Subir imagen» añade un logo o lo que quieras (PNG, JPG, WebP). Arrastra para
        mover, las asas para cambiar el tamaño (el asa redonda gira) y las flechas del teclado para
        afinar (Mayús = más rápido). Doble clic en un texto (o Intro) para escribirlo dentro de su
        caja. Los datos de cada factura (a quién, estado, líneas, descuento, impuestos) se escriben
        en «Datos del registro».
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
        </Stack>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
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
