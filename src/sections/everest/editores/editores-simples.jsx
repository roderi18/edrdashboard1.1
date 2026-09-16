'use client';

import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';

import { cambiadorDe } from './cambios';
import { CampoMedio, CampoTexto, CampoNumero } from './campos';

// ----------------------------------------------------------------------
// LOS BLOQUES DE POCOS CAMPOS: bienvenida, lema y destacamento destacado.
// ----------------------------------------------------------------------

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

      {/* LAS CIFRAS Y EL NIVEL NO SE EDITAN AQUI. Parecen de cada persona
          ("12 actividades", "Nivel 4") pero son las mismas para todos: escritas
          a mano en el Designer, toda la organizacion veria unos numeros suyos
          que nadie midio. Queda pendiente decidir si salen de datos reales. */}
      <Alert severity="info">
        Las cifras y el nivel se quedan como están: falta decidir si salen de los datos reales de
        cada miembro.
      </Alert>
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
