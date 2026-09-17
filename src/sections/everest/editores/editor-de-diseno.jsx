'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Accordion from '@mui/material/Accordion';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';

import {
  colorHex,
  ajustesDe,
  TIPOS_DE_AJUSTE,
  GRUPOS_DE_AJUSTE,
} from 'src/utils/everest/diseno.mjs';

import { Iconify } from 'src/components/iconify';
import { PaletaDeColores } from 'src/components/header-visual-editor/paleta-de-colores';

import { conCampo } from './cambios';
import { CampoIcono, CampoTexto, CampoDestino, CampoOpciones } from './campos';

// ----------------------------------------------------------------------
// EL EDITOR DE DISEÑO DE CUALQUIER BLOQUE.
//
// No hay un editor de diseño por bloque: se arma solo con la lista de ajustes de
// `src/utils/everest/diseno.mjs`. Un ajuste nuevo en esa lista aparece aqui sin
// tocar nada, y lo que se puede elegir es exactamente lo que acepta el saneado.
//
// Cada ajuste empieza SIN VALOR —la tarjeta usa el suyo de siempre— y lleva un
// boton para volver a ese valor. Asi se ve que se toco y que no, y deshacer un
// color no obliga a adivinar cual era el de antes.
//
// Los colores usan la misma paleta que el encabezado de la tienda: los de la casa
// primero, la rueda para el caso raro y la X de "sin color".
// ----------------------------------------------------------------------

const ORDEN_DE_GRUPOS = [
  GRUPOS_DE_AJUSTE.textos,
  GRUPOS_DE_AJUSTE.colores,
  GRUPOS_DE_AJUSTE.forma,
  GRUPOS_DE_AJUSTE.mostrar,
];

function Restablecer({ visible, onClick }) {
  if (!visible) return <Box sx={{ width: 28, flex: 'none' }} />;

  return (
    <Tooltip title="Volver al de siempre">
      <IconButton size="small" onClick={onClick} sx={{ flex: 'none' }}>
        <Iconify icon="solar:restart-bold" width={16} />
      </IconButton>
    </Tooltip>
  );
}

function Ajuste({ ajuste, valor, onCambiar }) {
  const tocado = valor !== undefined;
  const quitar = () => onCambiar(undefined);

  switch (ajuste.tipo) {
    case TIPOS_DE_AJUSTE.texto:
      return (
        <Stack direction="row" spacing={0.5} alignItems="flex-start">
          <CampoTexto
            etiqueta={ajuste.etiqueta}
            valor={tocado ? valor : ajuste.porDefecto}
            onCambiar={onCambiar}
            max={ajuste.max}
            ayuda={ajuste.ayuda ?? (tocado ? undefined : 'El de siempre.')}
          />
          <Restablecer visible={tocado} onClick={quitar} />
        </Stack>
      );

    case TIPOS_DE_AJUSTE.destino:
      return (
        <Stack direction="row" spacing={0.5} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <CampoDestino
              etiqueta={ajuste.etiqueta}
              valor={tocado ? valor : ajuste.porDefecto}
              onCambiar={onCambiar}
            />
          </Box>
          <Restablecer visible={tocado} onClick={quitar} />
        </Stack>
      );

    case TIPOS_DE_AJUSTE.icono:
      return (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <CampoIcono
              etiqueta={ajuste.etiqueta}
              valor={tocado ? valor : ajuste.porDefecto}
              onCambiar={onCambiar}
            />
          </Box>
          <Restablecer visible={tocado} onClick={quitar} />
        </Stack>
      );

    case TIPOS_DE_AJUSTE.color:
      return (
        <Stack spacing={0.75}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              {ajuste.etiqueta}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {tocado ? valor : 'El de siempre'}
            </Typography>
            <Restablecer visible={tocado} onClick={quitar} />
          </Stack>
          <PaletaDeColores
            valor={valor}
            onElegir={(color) => onCambiar(colorHex(color) ?? undefined)}
          />
          {ajuste.ayuda && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {ajuste.ayuda}
            </Typography>
          )}
        </Stack>
      );

    case TIPOS_DE_AJUSTE.tamano:
    case TIPOS_DE_AJUSTE.numero:
      return (
        <Stack spacing={0.25}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              {ajuste.etiqueta}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {tocado ? valor : `${ajuste.porDefecto} (el de siempre)`}
            </Typography>
            <Restablecer visible={tocado} onClick={quitar} />
          </Stack>
          <Slider
            size="small"
            min={ajuste.min}
            max={ajuste.max}
            step={1}
            value={tocado ? valor : ajuste.porDefecto}
            onChange={(evento, nuevo) => onCambiar(nuevo)}
            valueLabelDisplay="auto"
          />
        </Stack>
      );

    case TIPOS_DE_AJUSTE.opcion:
      return (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <CampoOpciones
            etiqueta={ajuste.etiqueta}
            valor={tocado ? valor : ajuste.porDefecto}
            opciones={ajuste.opciones}
            onCambiar={onCambiar}
          />
          <Restablecer visible={tocado} onClick={quitar} />
        </Stack>
      );

    case TIPOS_DE_AJUSTE.interruptor:
      return (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            {ajuste.etiqueta}
          </Typography>
          {/* Encendido es lo de siempre: se guarda solo cuando se apaga. */}
          <Switch
            size="small"
            checked={valor !== false}
            onChange={(evento) => onCambiar(evento.target.checked ? undefined : false)}
          />
        </Stack>
      );

    default:
      return null;
  }
}

export function EditorDeDiseno({ idBloque, diseno = {}, onCambiar }) {
  const ajustes = ajustesDe(idBloque);

  if (!ajustes.length) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Este bloque no tiene ajustes de diseño.
      </Typography>
    );
  }

  const cambiar = (campo, valor) => onCambiar(conCampo(diseno ?? {}, campo, valor));
  const tocados = Object.keys(diseno ?? {}).length;

  return (
    <Stack spacing={1}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {tocados
          ? `${tocados} ${tocados === 1 ? 'ajuste cambiado' : 'ajustes cambiados'}. Lo demás se ve como siempre.`
          : 'Todo se ve como siempre. Cambia lo que quieras: se ve al momento en la vista previa.'}
      </Typography>

      {ORDEN_DE_GRUPOS.map((grupo) => {
        const delGrupo = ajustes.filter((ajuste) => ajuste.grupo === grupo);

        if (!delGrupo.length) return null;

        const cambiadosDelGrupo = delGrupo.filter((ajuste) => diseno?.[ajuste.campo] !== undefined);

        return (
          <Accordion key={grupo} disableGutters defaultExpanded={grupo === GRUPOS_DE_AJUSTE.textos}>
            <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {grupo}
              </Typography>
              {!!cambiadosDelGrupo.length && (
                <Typography variant="caption" sx={{ color: 'primary.main', mr: 1 }}>
                  {cambiadosDelGrupo.length} cambiado{cambiadosDelGrupo.length === 1 ? '' : 's'}
                </Typography>
              )}
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {delGrupo.map((ajuste) => (
                  <Ajuste
                    key={ajuste.campo}
                    ajuste={ajuste}
                    valor={diseno?.[ajuste.campo]}
                    onCambiar={(valor) => cambiar(ajuste.campo, valor)}
                  />
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
}
