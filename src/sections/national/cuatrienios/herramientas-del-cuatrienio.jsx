'use client';

import { useState, useEffect, useCallback } from 'react';

import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { ocupanteHistorico, integrantesDeEntidad } from 'src/utils/directiva-cuatrienios.mjs';

import { obtenerIntegrantesDelCuatrienio } from 'src/services/directiva-cuatrienios-service';
import {
  restaurarFotosDelCuatrienio,
  tomarFotoDeLaDirectivaActual,
  cargarFotosActualesDelCuatrienio,
} from 'src/services/directiva-importacion-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { NationalLeadershipView } from 'src/sections/national/leadership/national-leadership-view';
import { RegionalLeadershipView } from 'src/sections/regional/leadership/regional-leadership-view';
import { SectionalLeadershipView } from 'src/sections/sectional/leadership/sectional-leadership-view';

import { IntegranteDialog } from './integrante-dialog';
import { ImportarListadoDialog } from './importar-listado-dialog';

// ----------------------------------------------------------------------
// LO QUE LA LISTA NACIONAL NECESITA PARA ENSEÑAR UN CUATRIENIO.
//
// Antes la memoria vivía en su propia pestaña ("Por cuatrienio"), con acordeones
// por región y sección: otra forma de leer lo mismo que la Directiva actual, sin
// sus filtros ni su tabla. Ahora el cuatrienio se elige en el título de la lista
// y se pinta en la MISMA tabla; aquí quedan solo la lectura del cuatrienio y los
// diálogos que la tabla abre (organigrama de entonces, editar, cargar el
// listado y guardar la directiva de hoy).
// ----------------------------------------------------------------------

const VISTA_ORGANIGRAMA = {
  nacional: NationalLeadershipView,
  regional: RegionalLeadershipView,
  seccional: SectionalLeadershipView,
};

/** Integrantes guardados de un cuatrienio; sin cuatrienio no lee nada. */
export function useIntegrantesDelCuatrienio(cuatrienio) {
  const [integrantes, setIntegrantes] = useState([]);
  const [cargando, setCargando] = useState(Boolean(cuatrienio));

  const recargar = useCallback(async () => {
    if (!cuatrienio) {
      setIntegrantes([]);
      setCargando(false);
      return;
    }

    setCargando(true);

    try {
      setIntegrantes(await obtenerIntegrantesDelCuatrienio(cuatrienio));
    } catch (error) {
      console.error('[directiva-cuatrienios] no se pudo leer el cuatrienio', error);
      toast.error('No se pudo leer la directiva de ese cuatrienio.');
      setIntegrantes([]);
    } finally {
      setCargando(false);
    }
  }, [cuatrienio]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { integrantes, cargando, recargar };
}

/**
 * Acciones sobre un cuatrienio y sus diálogos. `dialogos` se pinta una vez en la
 * pantalla; lo demás lo llaman las filas y el encabezado.
 */
export function useHerramientasDelCuatrienio({ cuatrienio, integrantes, usuario, alCambiar }) {
  const [organigrama, setOrganigrama] = useState(null);
  const [edicion, setEdicion] = useState(null);
  const [importando, setImportando] = useState(false);
  const [pidiendoFoto, setPidiendoFoto] = useState(false);
  const [tomandoFoto, setTomandoFoto] = useState('');
  const [actualizandoFotos, setActualizandoFotos] = useState('');
  const [menuFotos, setMenuFotos] = useState(null);
  const [confirmarCargaFotos, setConfirmarCargaFotos] = useState(false);
  const [seleccionLibreAbierta, setSeleccionLibreAbierta] = useState(false);
  const [integranteSeleccionado, setIntegranteSeleccionado] = useState(null);
  const [confirmarFotoSeleccionada, setConfirmarFotoSeleccionada] = useState(false);
  const [reversionesFotos, setReversionesFotos] = useState([]);
  const [reversionesCargadas, setReversionesCargadas] = useState('');
  const claveReversiones = `directiva-fotos-reversion:${cuatrienio}`;

  useEffect(() => {
    try {
      const guardadas = JSON.parse(sessionStorage.getItem(claveReversiones) || '[]');
      setReversionesFotos(Array.isArray(guardadas) ? guardadas : []);
    } catch {
      setReversionesFotos([]);
    }
    setReversionesCargadas(claveReversiones);
  }, [claveReversiones]);

  useEffect(() => {
    if (reversionesCargadas !== claveReversiones) return;

    try {
      sessionStorage.setItem(claveReversiones, JSON.stringify(reversionesFotos));
    } catch (error) {
      console.warn('[directiva-cuatrienios] no se pudo guardar la opción de volver atrás', error);
    }
  }, [claveReversiones, reversionesCargadas, reversionesFotos]);

  const cargarFotosActuales = async (idsIntegrante = null) => {
    setConfirmarCargaFotos(false);
    setConfirmarFotoSeleccionada(false);
    setActualizandoFotos('Preparando…');

    try {
      const resultado = await cargarFotosActualesDelCuatrienio({
        cuatrienio,
        usuario,
        idsIntegrante,
        alAvanzar: setActualizandoFotos,
      });
      const detalleFallidas = resultado.fallidas
        ? `; ${resultado.fallidas} no se pudieron copiar`
        : '';
      if (resultado.actualizadas) {
        setReversionesFotos((actuales) => [
          ...actuales,
          { cuatrienio, fotosAnteriores: resultado.anteriores },
        ]);
      }
      if (idsIntegrante && resultado.actualizadas) setSeleccionLibreAbierta(false);
      const estado = idsIntegrante
        ? `Foto actualizada: ${resultado.actualizadas}`
        : `Fotos actualizadas: ${resultado.actualizadas}; sin foto actual: ${resultado.sinFoto}`;
      if (!resultado.actualizadas) {
        toast.info(
          idsIntegrante
            ? 'Esta persona no tiene una foto de perfil actual para cargar.'
            : 'No se encontraron fotos de perfil actuales para cargar.'
        );
      } else {
        toast.success(`${estado}${detalleFallidas}.`);
      }
      alCambiar?.();
    } catch (error) {
      console.error('[directiva-cuatrienios] no se pudieron actualizar las fotos', error);
      toast.error(error?.message || 'No se pudieron cargar las fotos actuales.');
    } finally {
      setActualizandoFotos('');
    }
  };

  const volverAtrasFotos = async () => {
    const ultima = reversionesFotos[reversionesFotos.length - 1];
    if (!ultima) return;

    setActualizandoFotos('Restaurando…');
    try {
      const restauradas = await restaurarFotosDelCuatrienio({
        ...ultima,
        usuario,
      });
      setReversionesFotos((actuales) => actuales.slice(0, -1));
      toast.success(`Se restauraron ${restauradas} fotos anteriores.`);
      alCambiar?.();
    } catch (error) {
      console.error('[directiva-cuatrienios] no se pudieron restaurar las fotos', error);
      toast.error(error?.message || 'No se pudieron restaurar las fotos anteriores.');
    } finally {
      setActualizandoFotos('');
    }
  };

  // El `historico` que espera cada organigrama de solo lectura: sus ocupantes
  // salen de la memoria del cuatrienio, no del padron de hoy. Lo usan por igual el
  // dialogo que abre un cargo y la pestaña Jerarquia embebida en la lista.
  const construirHistorico = useCallback(
    (nivel, { id = '', nombre = '' } = {}) => {
      const filas = integrantesDeEntidad(integrantes, { nivel, idEntidad: id, nombre });

      return {
        nivel,
        idEntidad: id,
        nombreEntidad: nombre,
        cuatrienio,
        obtenerOcupante: (nodeId) => ocupanteHistorico(filas, nivel, nodeId),
      };
    },
    [integrantes, cuatrienio]
  );

  const abrirOrganigrama = (nivel, entidad = {}) => {
    setOrganigrama(construirHistorico(nivel, entidad));
  };

  const tomarFoto = async () => {
    setPidiendoFoto(false);
    setTomandoFoto('Empezando…');

    try {
      const { integrantes: total } = await tomarFotoDeLaDirectivaActual({
        cuatrienio,
        usuario,
        alAvanzar: setTomandoFoto,
      });

      toast.success(`Se guardaron ${total} integrantes en la Directiva ${cuatrienio}.`);
      alCambiar?.();
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la directiva de hoy.');
    } finally {
      setTomandoFoto('');
    }
  };

  const VistaOrganigrama = organigrama ? VISTA_ORGANIGRAMA[organigrama.nivel] : null;

  const dialogos = (
    <>
      <Dialog
        fullWidth
        maxWidth="xl"
        open={Boolean(organigrama)}
        onClose={() => setOrganigrama(null)}
      >
        <DialogTitle sx={{ pr: 7 }}>
          Organigrama · {organigrama?.cuatrienio}
          <IconButton
            aria-label="Cerrar"
            onClick={() => setOrganigrama(null)}
            sx={{ position: 'absolute', top: 12, right: 12 }}
          >
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {VistaOrganigrama && <VistaOrganigrama historico={organigrama} />}
        </DialogContent>
      </Dialog>

      {edicion && (
        <IntegranteDialog
          inicial={edicion}
          cuatrienio={cuatrienio}
          integrantes={integrantes}
          usuario={usuario}
          onClose={() => setEdicion(null)}
          onGuardado={() => {
            setEdicion(null);
            alCambiar?.();
          }}
        />
      )}

      {importando && (
        <ImportarListadoDialog
          usuario={usuario}
          onClose={() => setImportando(false)}
          onTerminado={() => {
            setImportando(false);
            alCambiar?.();
          }}
        />
      )}

      <ConfirmDialog
        open={pidiendoFoto}
        onClose={() => setPidiendoFoto(false)}
        title={`Guardar la directiva de hoy en ${cuatrienio}`}
        content="Se copian los cargos nacionales, regionales y seccionales que hay asignados ahora, con su foto de perfil de hoy. Si alguien ya estaba guardado en la misma casilla, se reemplaza."
        action={
          <Button variant="contained" onClick={tomarFoto}>
            Guardar
          </Button>
        }
      />

      <ConfirmDialog
        open={confirmarCargaFotos}
        onClose={() => setConfirmarCargaFotos(false)}
        title="Cargar fotos actuales"
        content={`Se reemplazarán las fotos de la Directiva ${cuatrienio} por las fotos de perfil actuales de cada persona que tenga una. Después podrás restaurar las anteriores desde “Volver atrás”. ¿Deseas continuar?`}
        action={
          <Button
            variant="contained"
            disabled={Boolean(actualizandoFotos)}
            onClick={() => cargarFotosActuales()}
          >
            Cargar fotos
          </Button>
        }
      />

      <ConfirmDialog
        open={confirmarFotoSeleccionada}
        onClose={() => setConfirmarFotoSeleccionada(false)}
        title="Actualizar foto de esta persona"
        content={`Se reemplazará la foto histórica de ${integranteSeleccionado?.nombres || ''} ${integranteSeleccionado?.apellidos || ''} por su foto de perfil actual. Podrás restaurar la anterior con “Volver atrás”. ¿Deseas continuar?`}
        action={
          <Button
            variant="contained"
            disabled={Boolean(actualizandoFotos)}
            onClick={() => cargarFotosActuales([integranteSeleccionado?.id])}
          >
            Actualizar foto
          </Button>
        }
      />

      <Dialog
        fullWidth
        maxWidth="sm"
        open={seleccionLibreAbierta}
        onClose={() => setSeleccionLibreAbierta(false)}
      >
        <DialogTitle>Seleccionar persona</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Autocomplete
            options={integrantes}
            value={integranteSeleccionado}
            onChange={(_, value) => setIntegranteSeleccionado(value)}
            getOptionLabel={(integrante) =>
              `${integrante.nombres || ''} ${integrante.apellidos || ''} · ${integrante.cargoNombre || ''}`.trim()
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Persona de la directiva" />}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSeleccionLibreAbierta(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!integranteSeleccionado || Boolean(actualizandoFotos)}
            onClick={() => setConfirmarFotoSeleccionada(true)}
          >
            Continuar
          </Button>
        </DialogActions>
      </Dialog>

      <Menu anchorEl={menuFotos} open={Boolean(menuFotos)} onClose={() => setMenuFotos(null)}>
        <MenuItem
          disabled={Boolean(actualizandoFotos)}
          onClick={() => {
            setMenuFotos(null);
            setConfirmarCargaFotos(true);
          }}
        >
          Cargar fotos actuales
        </MenuItem>
        <MenuItem
          disabled={!reversionesFotos.length || Boolean(actualizandoFotos)}
          onClick={() => {
            setMenuFotos(null);
            volverAtrasFotos();
          }}
        >
          Volver atrás
        </MenuItem>
        <MenuItem
          disabled={Boolean(actualizandoFotos)}
          onClick={() => {
            setMenuFotos(null);
            setIntegranteSeleccionado(null);
            setSeleccionLibreAbierta(true);
          }}
        >
          Selección libre
        </MenuItem>
      </Menu>
    </>
  );

  return {
    dialogos,
    tomandoFoto,
    actualizandoFotos,
    reversionesFotos,
    abrirOrganigrama,
    construirHistorico,
    editar: (integrante) => setEdicion(integrante),
    agregar: (base = {}) => setEdicion({ nuevo: true, cuatrienio, ...base }),
    importar: () => setImportando(true),
    abrirMenuFotos: (event) => setMenuFotos(event.currentTarget),
    pedirFoto: () => setPidiendoFoto(true),
  };
}
