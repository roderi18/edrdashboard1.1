'use client';

import { useState, useEffect, useCallback } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';

import { ocupanteHistorico, integrantesDeEntidad } from 'src/utils/directiva-cuatrienios.mjs';

import { tomarFotoDeLaDirectivaActual } from 'src/services/directiva-importacion-service';
import { obtenerIntegrantesDelCuatrienio } from 'src/services/directiva-cuatrienios-service';

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

  const abrirOrganigrama = (nivel, { id = '', nombre = '' } = {}) => {
    const filas = integrantesDeEntidad(integrantes, { nivel, idEntidad: id, nombre });

    setOrganigrama({
      nivel,
      idEntidad: id,
      nombreEntidad: nombre,
      cuatrienio,
      obtenerOcupante: (nodeId) => ocupanteHistorico(filas, nivel, nodeId),
    });
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
    </>
  );

  return {
    dialogos,
    tomandoFoto,
    abrirOrganigrama,
    editar: (integrante) => setEdicion(integrante),
    agregar: (base = {}) => setEdicion({ nuevo: true, cuatrienio, ...base }),
    importar: () => setImportando(true),
    pedirFoto: () => setPidiendoFoto(true),
  };
}
