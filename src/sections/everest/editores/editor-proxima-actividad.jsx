'use client';

import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import { cambiadorDe } from './cambios';
import { CampoFecha, CampoMedio, CampoTexto, CampoNumero, CampoDestino } from './campos';

// ----------------------------------------------------------------------
// PROXIMA ACTIVIDAD.
//
// Lo mas importante es la FECHA: con la de inicio elegida en el calendario, el
// texto de las fechas y los "dias que faltan" se calculan solos cada dia. Sin
// ella —como el valor de siempre— hay que escribirlos a mano, y el numero de
// dias no se actualiza: por eso se avisa.
// ----------------------------------------------------------------------

export function EditorProximaActividad({ idBloque, contenido, onCambiar }) {
  const cambiar = cambiadorDe(contenido, onCambiar);
  const conFechas = Boolean(contenido.fechaInicio);
  const conBoton = Boolean(contenido.boton);

  return (
    <Stack spacing={2}>
      <CampoTexto
        etiqueta="Título"
        valor={contenido.titulo}
        onCambiar={(valor) => cambiar('titulo', valor)}
        max={120}
        obligatorio
      />
      <CampoTexto
        etiqueta="Lugar"
        valor={contenido.lugar}
        onCambiar={(valor) => cambiar('lugar', valor)}
        max={160}
      />
      <CampoTexto
        etiqueta="Estado"
        valor={contenido.estado}
        onCambiar={(valor) => cambiar('estado', valor)}
        max={40}
        ayuda="Por ejemplo: Inscripciones abiertas, Registrado, Cupo lleno."
      />

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Typography variant="subtitle2">Fechas</Typography>
      <CampoFecha
        etiqueta="Empieza"
        valor={contenido.fechaInicio}
        onCambiar={(valor) => {
          const copia = { ...contenido };

          if (valor) {
            copia.fechaInicio = valor;
          } else {
            delete copia.fechaInicio;
            delete copia.fechaFin;
          }

          // Un fin anterior al inicio nuevo ya no vale: se quita.
          if (copia.fechaFin && valor && copia.fechaFin < valor) delete copia.fechaFin;

          onCambiar(copia);
        }}
      />
      {conFechas && (
        <CampoFecha
          etiqueta="Termina (opcional)"
          valor={contenido.fechaFin}
          minimo={contenido.fechaInicio}
          onCambiar={(valor) => cambiar('fechaFin', valor)}
        />
      )}

      {conFechas ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Las fechas y los días que faltan se calculan solos cada día.
        </Typography>
      ) : (
        <>
          <Typography variant="caption" sx={{ color: 'warning.main' }}>
            Sin fecha de inicio, los días que faltan no se actualizan solos: elige una arriba.
          </Typography>
          <CampoTexto
            etiqueta="Texto de las fechas"
            valor={contenido.fechas}
            onCambiar={(valor) => cambiar('fechas', valor)}
            max={80}
          />
          <CampoNumero
            etiqueta="Días que faltan"
            valor={contenido.diasQueFaltan}
            onCambiar={(valor) => cambiar('diasQueFaltan', valor)}
            min={0}
            max={3650}
          />
        </>
      )}

      <Divider sx={{ borderStyle: 'dashed' }} />

      <FormControlLabel
        control={
          <Switch
            checked={conBoton}
            onChange={(evento) =>
              cambiar(
                'boton',
                evento.target.checked
                  ? { texto: 'Inscribirme', destino: paths.dashboard.calendar }
                  : undefined
              )
            }
          />
        }
        label="Botón propio"
      />
      {conBoton ? (
        <>
          <CampoTexto
            etiqueta="Texto del botón"
            valor={contenido.boton.texto}
            onCambiar={(valor) => cambiar('boton', { ...contenido.boton, texto: valor })}
            max={30}
            obligatorio
          />
          <CampoDestino
            valor={contenido.boton.destino}
            onCambiar={(valor) => cambiar('boton', { ...contenido.boton, destino: valor })}
          />
        </>
      ) : (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Se usa el botón de siempre, que lleva al calendario.
        </Typography>
      )}

      <Divider sx={{ borderStyle: 'dashed' }} />

      <CampoMedio
        idBloque={idBloque}
        aceptaVideo
        valor={contenido.fondo}
        onCambiar={(valor) => cambiar('fondo', valor)}
      />
    </Stack>
  );
}
