'use client';

import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { cambiadorDe } from './cambios';
import { ACENTOS } from './editores-de-listas';
import {
  CampoIcono,
  CampoMedio,
  CampoTexto,
  claveNueva,
  CampoNumero,
  CampoOpciones,
  ListaEditable,
} from './campos';

// ----------------------------------------------------------------------
// LOS BLOQUES DE POCOS CAMPOS: bienvenida, mi progreso, lema y destacamento
// destacado.
//
// LAS CIFRAS, EL NIVEL Y "MI PROGRESO" SE ESCRIBEN A MANO Y SON LOS MISMOS PARA
// TODOS. Parecen de cada persona ("12 actividades", "Nivel 4"), asi que el editor
// lo dice a la vista: hasta que salgan de los datos reales de cada miembro, lo
// que se escriba aqui lo ve igual toda la organizacion.
// ----------------------------------------------------------------------

function AvisoDeDatosIguales() {
  return (
    <Alert severity="warning">
      Estos números son los mismos para todos: todavía no salen de los datos reales de cada miembro.
    </Alert>
  );
}

export function EditorBienvenida({ idBloque, contenido, onCambiar }) {
  const cambiar = cambiadorDe(contenido, onCambiar);

  return (
    <Stack spacing={2}>
      <CampoTexto
        etiqueta="Lema"
        valor={contenido.lema}
        onCambiar={(valor) => cambiar('lema', valor)}
        max={160}
        obligatorio
      />

      <Divider sx={{ borderStyle: 'dashed' }} />

      <CampoMedio
        idBloque={idBloque}
        valor={contenido.fondo}
        onCambiar={(valor) => cambiar('fondo', valor)}
      />

      <Divider sx={{ borderStyle: 'dashed' }} />

      <AvisoDeDatosIguales />

      <ListaEditable
        titulo="Cifras"
        elementos={contenido.cifras}
        onCambiar={(cifras) => cambiar('cifras', cifras)}
        max={4}
        etiquetaDe={(cifra) => cifra.etiqueta}
        nuevo={() => ({
          clave: claveNueva('cifra'),
          valor: 0,
          etiqueta: '',
          icono: 'solar:medal-ribbon-bold',
        })}
        renderElemento={(cifra, cambiarCifra) => (
          <>
            <CampoTexto
              etiqueta="Etiqueta"
              valor={cifra.etiqueta}
              onCambiar={(etiqueta) => cambiarCifra({ etiqueta })}
              max={40}
              obligatorio
            />
            <CampoNumero
              etiqueta="Número"
              valor={cifra.valor}
              onCambiar={(valor) => cambiarCifra({ valor })}
              min={0}
              max={1000000}
            />
            <CampoIcono valor={cifra.icono} onCambiar={(icono) => cambiarCifra({ icono })} />
          </>
        )}
      />

      <Typography variant="subtitle2">Nivel</Typography>
      <CampoNumero
        etiqueta="Número del nivel"
        valor={contenido.nivel?.numero}
        onCambiar={(numero) => cambiar('nivel', { ...contenido.nivel, numero })}
        min={0}
        max={100}
      />
      <CampoTexto
        etiqueta="Nombre del nivel"
        valor={contenido.nivel?.nombre}
        onCambiar={(nombre) => cambiar('nivel', { ...contenido.nivel, nombre })}
        max={40}
        obligatorio
      />
      <CampoNumero
        etiqueta="Porcentaje"
        valor={contenido.nivel?.porcentaje}
        onCambiar={(porcentaje) => cambiar('nivel', { ...contenido.nivel, porcentaje })}
        min={0}
        max={100}
        entero={false}
      />
    </Stack>
  );
}

export function EditorMiProgreso({ contenido, onCambiar }) {
  const cambiar = cambiadorDe(contenido, onCambiar);
  const pasado = (contenido.hechas ?? 0) > (contenido.total ?? 0);

  return (
    <Stack spacing={2}>
      <AvisoDeDatosIguales />

      <CampoTexto
        etiqueta="Nivel"
        valor={contenido.nivel}
        onCambiar={(valor) => cambiar('nivel', valor)}
        max={60}
        obligatorio
      />
      <CampoNumero
        etiqueta="Porcentaje"
        valor={contenido.porcentaje}
        onCambiar={(valor) => cambiar('porcentaje', valor)}
        min={0}
        max={100}
        entero={false}
      />
      <Stack direction="row" spacing={1.5}>
        <CampoNumero
          etiqueta="Hechas"
          valor={contenido.hechas}
          onCambiar={(valor) => cambiar('hechas', valor)}
          min={0}
          max={10000}
          ayuda={pasado ? 'No pueden ser más que el total.' : undefined}
        />
        <CampoNumero
          etiqueta="Total"
          valor={contenido.total}
          onCambiar={(valor) => cambiar('total', valor)}
          min={1}
          max={10000}
        />
      </Stack>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <ListaEditable
        titulo="Áreas"
        elementos={contenido.areas}
        onCambiar={(areas) => cambiar('areas', areas)}
        max={6}
        etiquetaDe={(area) => area.nombre}
        nuevo={() => ({ nombre: '', estado: 'En progreso', avance: 0, acento: 'azul' })}
        renderElemento={(area, cambiarArea) => (
          <>
            <CampoTexto
              etiqueta="Nombre"
              valor={area.nombre}
              onCambiar={(nombre) => cambiarArea({ nombre })}
              max={60}
              obligatorio
            />
            <CampoTexto
              etiqueta="Estado"
              valor={area.estado}
              onCambiar={(estado) => cambiarArea({ estado })}
              max={40}
              obligatorio
            />
            <CampoNumero
              etiqueta="Avance (%)"
              valor={area.avance}
              onCambiar={(avance) => cambiarArea({ avance })}
              min={0}
              max={100}
              entero={false}
            />
            <CampoOpciones
              etiqueta="Color"
              valor={area.acento}
              opciones={ACENTOS}
              onCambiar={(acento) => cambiarArea({ acento })}
            />
          </>
        )}
      />
    </Stack>
  );
}

export function EditorLema({ contenido, onCambiar }) {
  const cambiar = cambiadorDe(contenido, onCambiar);

  return (
    <Stack spacing={2}>
      <CampoTexto
        etiqueta="Frase"
        valor={contenido.titulo}
        onCambiar={(valor) => cambiar('titulo', valor)}
        max={120}
        obligatorio
        multilinea
        ayuda="Cada salto de línea se ve igual en la tarjeta."
      />
      <CampoTexto
        etiqueta="Pie"
        valor={contenido.pie}
        onCambiar={(valor) => cambiar('pie', valor)}
        max={80}
        ayuda="Opcional. Sin pie, la tarjeta solo lleva la frase."
      />
    </Stack>
  );
}

export function EditorDestacamentoDestacado({ contenido, onCambiar }) {
  const cambiar = cambiadorDe(contenido, onCambiar);

  return (
    <Stack spacing={2}>
      <CampoTexto
        etiqueta="Destacamento"
        valor={contenido.nombre}
        onCambiar={(valor) => cambiar('nombre', valor)}
        max={120}
        obligatorio
        ayuda="Número y nombre, como se conoce. Ej.: Destacamento 52 — Halcones del Este."
      />
      <CampoTexto
        etiqueta="Región"
        valor={contenido.region}
        onCambiar={(valor) => cambiar('region', valor)}
        max={80}
      />
      <CampoNumero
        etiqueta="Miembros"
        valor={contenido.miembros}
        onCambiar={(valor) => cambiar('miembros', valor)}
        min={0}
        max={10000}
      />
      <CampoNumero
        etiqueta="Valoración"
        valor={contenido.valoracion}
        onCambiar={(valor) => cambiar('valoracion', valor)}
        min={0}
        max={5}
        entero={false}
        ayuda="De 0 a 5."
      />
    </Stack>
  );
}
