'use client';

import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { hoyISO, diaYMes, fechaCorta, fechaCortaAISO } from 'src/utils/everest/presentacion.mjs';

import {
  CampoFecha,
  CampoIcono,
  CampoTexto,
  claveNueva,
  CampoDestino,
  ListaEditable,
  CampoOpciones,
} from './campos';

// ----------------------------------------------------------------------
// LOS BLOQUES QUE SON UNA LISTA: comunicados, eventos, accesos rapidos e
// historias. Todos se ordenan, se amplian y se recortan igual (`ListaEditable`);
// aqui solo cambia que tiene cada fila.
// ----------------------------------------------------------------------

// Los colores de estado de un evento, con nombre y a la vista. Cada uno dice una
// cosa distinta, que es la unica razon para tener cuatro.
const COLORES_DE_EVENTO = [
  { valor: 'success', etiqueta: 'Confirmado', color: 'success' },
  { valor: 'info', etiqueta: 'Por confirmar', color: 'info' },
  { valor: 'warning', etiqueta: 'Pendiente', color: 'warning' },
  { valor: 'error', etiqueta: 'Suspendido', color: 'error' },
  { valor: 'default', etiqueta: 'Neutro', color: 'default' },
];

// Los acentos de los accesos rapidos: los mismos cuatro de la portada. Tambien
// los usan las areas de "Mi progreso".
export const ACENTOS = [
  { valor: 'azul', etiqueta: 'Azul', color: 'primary' },
  { valor: 'verde', etiqueta: 'Verde', color: 'success' },
  { valor: 'ambar', etiqueta: 'Ámbar', color: 'warning' },
  { valor: 'morado', etiqueta: 'Morado', color: 'secondary' },
];

// ----------------------------------------------------------------------

export function EditorComunicados({ contenido, onCambiar }) {
  return (
    <ListaEditable
      titulo="Comunicados"
      elementos={contenido}
      onCambiar={onCambiar}
      max={10}
      etiquetaDe={(comunicado) => comunicado.titulo}
      nuevo={() => ({
        clave: claveNueva('comunicado'),
        origen: 'Dirección Nacional',
        titulo: '',
        fecha: fechaCorta(hoyISO()),
      })}
      renderElemento={(comunicado, cambiar) => (
        <>
          <CampoTexto
            etiqueta="Título"
            valor={comunicado.titulo}
            onCambiar={(titulo) => cambiar({ titulo })}
            max={160}
            obligatorio
          />
          <CampoTexto
            etiqueta="Lo envía"
            valor={comunicado.origen}
            onCambiar={(origen) => cambiar({ origen })}
            max={80}
            obligatorio
          />
          <CampoFecha
            etiqueta="Fecha"
            valor={fechaCortaAISO(comunicado.fecha)}
            onCambiar={(fecha) => fecha && cambiar({ fecha: fechaCorta(fecha) })}
          />
        </>
      )}
    />
  );
}

export function EditorProximosEventos({ contenido, onCambiar }) {
  return (
    <ListaEditable
      titulo="Eventos"
      elementos={contenido}
      onCambiar={onCambiar}
      max={10}
      etiquetaDe={(evento) => evento.titulo}
      nuevo={() => {
        const hoy = hoyISO();

        return {
          clave: claveNueva('evento'),
          ...diaYMes(hoy),
          titulo: '',
          lugar: '',
          estado: 'Por confirmar',
          color: 'info',
          fecha: hoy,
        };
      }}
      renderElemento={(evento, cambiar) => (
        <>
          <CampoTexto
            etiqueta="Título"
            valor={evento.titulo}
            onCambiar={(titulo) => cambiar({ titulo })}
            max={120}
            obligatorio
          />
          <CampoTexto
            etiqueta="Lugar"
            valor={evento.lugar}
            onCambiar={(lugar) => cambiar({ lugar })}
            max={160}
          />
          <CampoFecha
            etiqueta="Fecha"
            valor={evento.fecha}
            onCambiar={(fecha) => fecha && cambiar({ fecha, ...diaYMes(fecha) })}
          />
          {!evento.fecha && (
            <Typography variant="caption" sx={{ color: 'warning.main' }}>
              Sin fecha, este evento se queda en la lista aunque ya haya pasado.
            </Typography>
          )}
          <CampoTexto
            etiqueta="Estado"
            valor={evento.estado}
            onCambiar={(estado) => cambiar({ estado })}
            max={40}
          />
          <CampoOpciones
            etiqueta="Color del estado"
            valor={evento.color}
            opciones={COLORES_DE_EVENTO}
            onCambiar={(color) => cambiar({ color })}
          />
        </>
      )}
    />
  );
}

export function EditorAccesosRapidos({ contenido, onCambiar }) {
  return (
    <>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Solo los ve quien tiene activados los accesos rápidos en sus ajustes.
      </Typography>
      <ListaEditable
        titulo="Accesos"
        elementos={contenido}
        onCambiar={onCambiar}
        max={8}
        etiquetaDe={(acceso) => acceso.titulo}
        nuevo={() => ({
          clave: claveNueva('acceso'),
          titulo: '',
          icono: 'solar:calendar-date-bold',
          acento: 'azul',
          href: paths.dashboard.calendar,
        })}
        renderElemento={(acceso, cambiar) => (
          <>
            <CampoTexto
              etiqueta="Título"
              valor={acceso.titulo}
              onCambiar={(titulo) => cambiar({ titulo })}
              max={40}
              obligatorio
            />
            <CampoIcono valor={acceso.icono} onCambiar={(icono) => cambiar({ icono })} />
            <CampoOpciones
              etiqueta="Color"
              valor={acceso.acento}
              opciones={ACENTOS}
              onCambiar={(acento) => cambiar({ acento })}
            />
            <CampoDestino valor={acceso.href} onCambiar={(href) => cambiar({ href })} />
          </>
        )}
      />
    </>
  );
}

export function EditorHistorias({ contenido, onCambiar }) {
  return (
    <>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Por ahora las historias son solo el círculo con su título: todavía no abren contenido.
      </Typography>
      <ListaEditable
        titulo="Historias"
        elementos={contenido}
        onCambiar={onCambiar}
        max={20}
        etiquetaDe={(historia) => historia.titulo}
        nuevo={() => ({ clave: claveNueva('historia'), titulo: '' })}
        renderElemento={(historia, cambiar) => (
          <CampoTexto
            etiqueta="Título"
            valor={historia.titulo}
            onCambiar={(titulo) => cambiar({ titulo })}
            max={40}
            obligatorio
          />
        )}
      />
    </>
  );
}
