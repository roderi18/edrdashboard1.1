'use client';

import dayjs from 'dayjs';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useTheme, alpha as hexAlpha } from '@mui/material/styles';

import { MEMBER_DIVISION_OPTIONS } from 'src/_mock';
import { obtenerHistorialAsistenciaDestacamento } from 'src/services/attendance-service';

import { Chart, useChart } from 'src/components/chart';

import { DivisionOptionContent } from './division-option-content';

// ----------------------------------------------------------------------
// INFORME AVANZADO: COMO VA LA ASISTENCIA CON EL TIEMPO.
//
// La pantalla de asistencia responde por UN dia. Esta ventana responde por la
// racha: cuanta gente vino y cuanta se esperaba, semana a semana, mes a mes,
// hasta el historico completo. Son las mismas barras del panel —el componente
// `Chart` del proyecto— y se puede acotar por division, que es como se organiza
// el destacamento por dentro.
//
// Se lee de los REGISTROS de asistencia, uno por miembro y dia, que es lo unico
// que guarda la division de cada quien.
// ----------------------------------------------------------------------

// Cada agrupacion con su etiqueta y cuantos tramos se ensenan. El historico no
// recorta: ensena todos los años que haya.
const PERIODOS = [
  { value: 'semana', label: 'Semanas', tramos: 12 },
  { value: 'mes', label: 'Meses', tramos: 12 },
  { value: 'trimestre', label: 'Trimestres', tramos: 8 },
  { value: 'semestre', label: 'Semestres', tramos: 6 },
  { value: 'anio', label: 'Años', tramos: 5 },
  { value: 'historico', label: 'Histórico completo', tramos: 0 },
];

// Clave con la que se agrupa cada fecha, y el texto que se lee debajo de la
// barra. La clave ordena; la etiqueta se lee.
const agruparFecha = (fecha, periodo) => {
  const dia = dayjs(fecha);

  if (!dia.isValid()) return null;

  switch (periodo) {
    case 'semana': {
      const inicio = dia.startOf('week');

      return { clave: inicio.format('YYYY-MM-DD'), etiqueta: inicio.format('DD/MM') };
    }
    case 'mes':
      return { clave: dia.format('YYYY-MM'), etiqueta: dia.format('MMM YY') };
    case 'trimestre': {
      const trimestre = Math.floor(dia.month() / 3) + 1;

      return {
        clave: `${dia.year()}-T${trimestre}`,
        etiqueta: `T${trimestre} ${dia.format('YY')}`,
      };
    }
    case 'semestre': {
      const semestre = dia.month() < 6 ? 1 : 2;

      return { clave: `${dia.year()}-S${semestre}`, etiqueta: `S${semestre} ${dia.format('YY')}` };
    }
    default:
      // Años e historico se agrupan igual; lo que cambia es cuantos se ensenan.
      return { clave: String(dia.year()), etiqueta: String(dia.year()) };
  }
};

export function AttendanceAdvancedReportDialog({ open, onClose, dest, destId }) {
  const theme = useTheme();

  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [periodo, setPeriodo] = useState('semana');
  const [division, setDivision] = useState('all');

  // Se pide al abrir, y solo entonces: es la historia entera del destacamento y
  // no hace falta tenerla cargada mientras se pasa lista.
  useEffect(() => {
    if (!open || !destId) return undefined;

    let activo = true;

    setCargando(true);

    obtenerHistorialAsistenciaDestacamento({ idDestacamento: destId })
      .then((datos) => {
        if (activo) setRegistros(datos);
      })
      .catch(() => {
        if (activo) setRegistros([]);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [open, destId]);

  const { categorias, asistieron, esperados, totalAsistencias, totalEsperados } = useMemo(() => {
    const porTramo = new Map();

    registros.forEach((registro) => {
      // La division va en el registro; los mas viejos pueden no traerla, y esos
      // solo cuentan cuando no se filtra.
      if (division !== 'all' && registro.division !== division) return;

      const tramo = agruparFecha(registro.fecha, periodo);

      if (!tramo) return;

      const actual = porTramo.get(tramo.clave) || {
        etiqueta: tramo.etiqueta,
        asistieron: 0,
        esperados: 0,
      };

      actual.esperados += 1;
      if (registro.estado === 'present') actual.asistieron += 1;

      porTramo.set(tramo.clave, actual);
    });

    const ordenados = [...porTramo.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const tramos = PERIODOS.find((item) => item.value === periodo)?.tramos ?? 0;
    const visibles = tramos ? ordenados.slice(-tramos) : ordenados;

    return {
      categorias: visibles.map(([, valor]) => valor.etiqueta),
      asistieron: visibles.map(([, valor]) => valor.asistieron),
      esperados: visibles.map(([, valor]) => valor.esperados),
      totalAsistencias: visibles.reduce((suma, [, valor]) => suma + valor.asistieron, 0),
      totalEsperados: visibles.reduce((suma, [, valor]) => suma + valor.esperados, 0),
    };
  }, [registros, periodo, division]);

  const chartOptions = useChart({
    colors: [
      hexAlpha(theme.palette.success.dark, 0.85),
      hexAlpha(theme.palette.grey[500], 0.45),
    ],
    stroke: { width: 2, colors: ['transparent'] },
    xaxis: { categories: categorias },
    legend: { show: true },
    tooltip: {
      y: { formatter: (valor) => `${valor} ${valor === 1 ? 'miembro' : 'miembros'}` },
    },
  });

  const porcentaje = totalEsperados ? Math.round((totalAsistencias / totalEsperados) * 100) : 0;

  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={onClose}>
      <DialogTitle sx={{ pb: 2 }}>
        Informe avanzado
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {dest || 'Destacamento'}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {/* `pt` para el nombre del campo: la etiqueta flota por encima del
            borde y, pegada al techo del contenido —que se desplaza—, salia
            cortada por arriba. */}
        <Stack
          spacing={2}
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ pt: 1, mb: 3, alignItems: { sm: 'center' } }}
        >
          <TextField
            select
            fullWidth
            label="Periodo"
            value={periodo}
            onChange={(event) => setPeriodo(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            {PERIODOS.map((opcion) => (
              <MenuItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </MenuItem>
            ))}
          </TextField>

          {/* El MISMO desplegable de la lista, con el escudo de cada division:
              es el mismo dato y se reconoce antes por la imagen. */}
          <TextField
            select
            fullWidth
            label="División"
            value={division}
            onChange={(event) => setDivision(event.target.value)}
            sx={{ minWidth: 180 }}
            slotProps={{
              select: {
                renderValue: (elegida) => {
                  const opcion =
                    MEMBER_DIVISION_OPTIONS.find((item) => item.value === elegida) ||
                    MEMBER_DIVISION_OPTIONS[0];

                  return <DivisionOptionContent option={opcion} />;
                },
              },
            }}
          >
            {MEMBER_DIVISION_OPTIONS.map((opcion) => (
              <MenuItem key={opcion.value} value={opcion.value}>
                <DivisionOptionContent option={opcion} />
              </MenuItem>
            ))}
          </TextField>

          {/* El resumen de lo que se esta viendo: sin el hay que sumar las
              barras a ojo para saber como va el conjunto. */}
          <Stack sx={{ minWidth: 132, flexShrink: 0 }}>
            <Typography variant="h4">{porcentaje}%</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {totalAsistencias} de {totalEsperados}
            </Typography>
          </Stack>
        </Stack>

        {categorias.length ? (
          <Chart
            type="bar"
            series={[
              { name: 'Asistieron', data: asistieron },
              { name: 'Miembros', data: esperados },
            ]}
            options={chartOptions}
            slotProps={{ loading: { p: 2.5 } }}
            sx={{ pl: 1, py: 2.5, pr: 2.5, height: 360 }}
          />
        ) : (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant="subtitle1">
              {cargando ? 'Cargando el historial...' : 'Todavía no hay asistencia guardada'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {cargando
                ? 'Se están leyendo los registros del destacamento.'
                : 'El informe se arma con lo que se va guardando cada día de reunión.'}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
