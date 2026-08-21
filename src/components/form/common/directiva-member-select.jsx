'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';

import { getMemberFullName } from 'src/utils/get-member-fullname';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';

import { getMembers } from 'src/services/member-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import { obtenerAsignacionesDirectivaMiembros } from 'src/services/directivas-organizacionales-service';

// ----------------------------------------------------------------------
// Desplegable de personas para las directivas de seccion y region.
//
// Debajo de cada nombre se ve el cargo que ya ocupa, si lo ocupa. Sin eso, quien
// elige no tiene forma de saber que esta a punto de sacar a alguien de su puesto
// —el nombre a secas no lo dice—, y el error solo se descubre despues.
//
// Al elegir a alguien que ya tiene cargo se avisa de las dos consecuencias: que
// se le desvincula de donde estaba, y que el cambio no es inmediato porque lo
// aprueba la Oficina Nacional.
// ----------------------------------------------------------------------

const NIVELES_CON_CARGO = ['seccional', 'regional'];

const POSICION_POR_ID = new Map(
  DIRECTIVA_POSITIONS.map((position) => [position.idCargo, position])
);

const NOMBRE_NIVEL = {
  seccional: 'sección',
  regional: 'región',
};

export default function DirectivaMemberSelect({
  value,
  onChange,
  label = 'Responsable',
  disabled = false,
}) {
  const [members, setMembers] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [entidades, setEntidades] = useState({ seccional: [], regional: [] });
  const [porConfirmar, setPorConfirmar] = useState(null);

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      const [listaMiembros, listaAsignaciones, listaSecciones, listaRegiones, fotos] =
        await Promise.all([
          getMembers().catch(() => []),
          obtenerAsignacionesDirectivaMiembros().catch(() => []),
          getSectionals({ includePhotos: false }).catch(() => []),
          getRegionals({ includePhotos: false }).catch(() => []),
          // Las fotos viven en Firebase, no en la lista que devuelve la API: sin
          // pedirlas aparte, toda persona salia con el avatar generico.
          obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' }).catch(() => ({})),
        ]);

      if (cancelado) return;

      setMembers(
        (Array.isArray(listaMiembros) ? listaMiembros : []).map((member) => ({
          ...member,
          avatarUrl: fotos[String(member?.id)]?.urlFoto || member?.avatarUrl || '',
        }))
      );
      setAsignaciones(Array.isArray(listaAsignaciones) ? listaAsignaciones : []);
      setEntidades({
        seccional: Array.isArray(listaSecciones) ? listaSecciones : [],
        regional: Array.isArray(listaRegiones) ? listaRegiones : [],
      });
    };

    cargar();

    return () => {
      cancelado = true;
    };
  }, []);

  // Cargo ACTUAL de cada persona en seccion o region. Solo esos dos niveles: un
  // cargo de destacamento no estorba para dirigir una seccion.
  // Nombre de cada seccion y region por id. La asignacion suele traerlo, pero no
  // siempre: sin esta busqueda, el cargo aparecia sin decir DONDE, que es
  // justamente lo que distingue "Coordinador de Promoción" de una seccion del de
  // otra.
  const nombreEntidad = useMemo(() => {
    const mapa = new Map();

    (entidades.seccional || []).forEach((s) =>
      mapa.set(`seccional_${String(s.idSeccion ?? s.id)}`, s.sectionalName || s.nombre || '')
    );
    (entidades.regional || []).forEach((r) =>
      mapa.set(`regional_${String(r.regionId ?? r.id)}`, r.regionalName || r.name || r.nombre || '')
    );

    return mapa;
  }, [entidades]);

  const cargoPorMiembro = useMemo(() => {
    const mapa = new Map();

    asignaciones.forEach((asignacion) => {
      if (!NIVELES_CON_CARGO.includes(asignacion?.nivel)) return;
      if (!asignacion?.idMiembro) return;

      const posicion = POSICION_POR_ID.get(asignacion.idPosicionDirectiva);

      mapa.set(String(asignacion.idMiembro), {
        cargo: posicion?.nombreCargo || 'Cargo de directiva',
        donde:
          asignacion.nombreEntidad ||
          nombreEntidad.get(`${asignacion.nivel}_${String(asignacion.idEntidad)}`) ||
          '',
        nivel: asignacion.nivel,
      });
    });

    return mapa;
  }, [asignaciones, nombreEntidad]);

  const opciones = useMemo(() => {
    const lista = members.map((member) => {
      const cargoActual = cargoPorMiembro.get(String(member.id)) || null;

      return {
        id: String(member.id),
        member,
        nombre: getMemberFullName(member),
        // Mismo subtitulo que el desplegable de la directiva del destacamento:
        // el codigo de miembro cuando esta libre, y el cargo cuando ya lo tiene.
        subtitulo: member.memberId || member.codigoMiembro || '',
        cargoActual,
      };
    });

    // Los que ya tienen cargo, al final: se pueden elegir, pero no son la opcion
    // natural y no deben estorbar a los que estan libres.
    return lista.sort((a, b) => {
      if (Boolean(a.cargoActual) !== Boolean(b.cargoActual)) return a.cargoActual ? 1 : -1;

      return a.nombre.localeCompare(b.nombre, 'es');
    });
  }, [members, cargoPorMiembro]);

  const seleccionado = opciones.find((o) => o.id === String(value)) || null;

  const elegir = (opcion) => {
    // Sin cargo previo no hay nada que avisar: se asigna y ya.
    if (!opcion?.cargoActual) {
      onChange(opcion?.member?.id ?? null);
      return;
    }

    setPorConfirmar(opcion);
  };

  return (
    <>
      <Autocomplete
        fullWidth
        disabled={disabled}
        options={opciones}
        value={seleccionado}
        onChange={(evento, opcion) => elegir(opcion)}
        getOptionLabel={(opcion) => opcion?.nombre || ''}
        getOptionKey={(opcion) => opcion?.id}
        isOptionEqualToValue={(opcion, valor) => opcion?.id === valor?.id}
        noOptionsText="No hay miembros disponibles"
        // Salida para cuando la persona no esta en la lista. Va pegada al final
        // del desplegable, no dentro de las opciones, para que no se pueda elegir
        // por error ni la alcance el buscador.
        PaperComponent={(paperProps) => (
          <Box {...paperProps}>
            {paperProps.children}

            <Box
              component="li"
              onMouseDown={(evento) => evento.preventDefault()}
              onClick={() => {
                window.location.href = '/dashboard/level/member/new';
              }}
              sx={{
                px: 2,
                py: 1,
                fontSize: '0.875rem',
                color: 'primary.main',
                cursor: 'pointer',
                listStyle: 'none',
                borderTop: (theme) => `1px solid ${theme.vars.palette.divider}`,
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              + Agregar nuevo miembro
            </Box>
          </Box>
        )}
        renderInput={(params) => (
          <TextField {...params} label={label} placeholder="Buscar miembro" />
        )}
        renderOption={(optionProps, opcion) => {
          const { key, ...liProps } = optionProps;

          return (
            <Box
              key={key}
              component="li"
              {...liProps}
              sx={{ alignItems: 'flex-start', ...liProps.sx }}
            >
              <Avatar
                alt={opcion.nombre}
                src={opcion.member?.avatarUrl || opcion.member?.photoURL || ''}
                sx={{ width: 36, height: 36, mr: 1.5, mt: 0.25, flexShrink: 0 }}
              />

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  sx={opcion.cargoActual ? { color: 'text.disabled' } : undefined}
                >
                  {opcion.nombre}
                </Typography>

                <Typography variant="caption" component="div" sx={{ color: 'text.disabled' }}>
                  {opcion.cargoActual
                    ? `${opcion.cargoActual.cargo}${opcion.cargoActual.donde ? ` · ${opcion.cargoActual.donde}` : ''}`
                    : opcion.subtitulo}
                </Typography>
              </Box>
            </Box>
          );
        }}
      />


      <Dialog open={Boolean(porConfirmar)} onClose={() => setPorConfirmar(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Esta persona ya tiene un cargo</DialogTitle>

        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {porConfirmar?.nombreCompleto}
            </Typography>

            <Chip
              size="small"
              color="warning"
              variant="soft"
              label={`${porConfirmar?.cargoActual?.cargo}${porConfirmar?.cargoActual?.donde ? ` · ${porConfirmar.cargoActual.donde}` : ''}`}
              sx={{ mb: 2 }}
            />

            <Typography variant="body2" sx={{ mb: 1 }}>
              Al asignarle este puesto se le <strong>desvinculará</strong> de su cargo actual
              {porConfirmar?.cargoActual?.nivel
                ? ` de ${NOMBRE_NIVEL[porConfirmar.cargoActual.nivel] || porConfirmar.cargoActual.nivel}`
                : ''}
              .
            </Typography>

            <Typography variant="body2">
              El cambio no se aplica de inmediato: lo tiene que aprobar la{' '}
              <strong>Oficina Nacional</strong>.
            </Typography>
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setPorConfirmar(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => {
              onChange(porConfirmar?.id ?? null);
              setPorConfirmar(null);
            }}
          >
            Continuar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
