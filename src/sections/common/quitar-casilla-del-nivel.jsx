'use client';

import { useState } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { nodosOcultosDelNivel } from 'src/utils/casillas-personalizadas.mjs';

import {
  ocultarNodoDeDirectiva,
  devolverNodoDeDirectiva,
  quitarCasillaPersonalizada,
} from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// "QUITAR DEL ORGANIGRAMA", en el panel del lápiz de la Jerarquía.
//
// Quita la casilla o el contenedor marcado de TODOS los organigramas del nivel
// (todas las regiones, todas las secciones…), igual que "Agregar casilla" la
// añade a todos. Lo que colgaba de él sube a su sitio. Una añadida se quita
// como siempre; una de fábrica deja una ficha `oculta` que "Devolver" deshace
// (ver `casillas-personalizadas.mjs`). Ocupada no se quita.
// ----------------------------------------------------------------------

const PREFIJO_ANADIDA = 'casilla-';

const NOMBRE_DEL_NIVEL = {
  nacional: 'la Directiva Nacional',
  regional: 'todas las regiones',
  seccional: 'todas las secciones',
  destacamento: 'todos los destacamentos',
};

const buscarNodo = (arboles, id) => {
  let encontrado = null;
  const recorrer = (nodo, profundidad) => {
    if (!nodo || encontrado) return;
    if (nodo.id === id) {
      encontrado = { nodo, profundidad };
      return;
    }
    (nodo.children || []).forEach((hijo) => recorrer(hijo, profundidad + 1));
  };

  (Array.isArray(arboles) ? arboles : [arboles]).forEach((arbol) => recorrer(arbol, 0));

  return encontrado;
};

export function QuitarCasillaDelNivel({ nivel, nodo, arboles, todas = [], onCambio }) {
  const { user } = useAuthContext();
  const [confirmar, setConfirmar] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const ocultos = nodosOcultosDelNivel(todas, nivel);

  const enArbol = nodo ? buscarNodo(arboles, nodo.id) : null;
  const esContenedor = Boolean(enArbol?.nodo?.isDivision);
  const nombre = esContenedor ? nodo?.name : nodo?.role || nodo?.name;
  const esRaiz = enArbol?.profundidad === 0;
  // La persona de ESTA entidad; las de las demás las comprueba el servicio.
  const ocupada = !esContenedor && Boolean(nodo?.name) && nodo?.name !== 'Vacante';
  const motivo = !enArbol
    ? ''
    : esRaiz
      ? 'La caja principal no se quita.'
      : ocupada
        ? 'Está ocupada: retira a la persona antes de quitarla.'
        : '';

  const quitar = async () => {
    setTrabajando(true);
    try {
      if (nodo.id.startsWith(PREFIJO_ANADIDA)) {
        await quitarCasillaPersonalizada({
          id: nodo.id.slice(PREFIJO_ANADIDA.length),
          usuario: user,
        });
      } else {
        await ocultarNodoDeDirectiva({ nivel, idNodo: nodo.id, nombre, usuario: user });
      }
      toast.success(`"${nombre}" se quitó de ${NOMBRE_DEL_NIVEL[nivel] || 'este nivel'}.`);
      setConfirmar(false);
      onCambio?.();
    } catch (error) {
      toast.error(error?.message || 'No se pudo quitar.');
    } finally {
      setTrabajando(false);
    }
  };

  const devolver = async (ficha) => {
    try {
      await devolverNodoDeDirectiva({ id: ficha.id, usuario: user });
      toast.success(`"${ficha.nombre}" vuelve al organigrama.`);
      onCambio?.();
    } catch (error) {
      toast.error(error?.message || 'No se pudo devolver.');
    }
  };

  return (
    <Stack spacing={0.75}>
      {enArbol && (
        <>
          <Button
            size="small"
            color="error"
            variant="outlined"
            disabled={Boolean(motivo)}
            onClick={() => setConfirmar(true)}
            startIcon={<Iconify width={16} icon="solar:trash-bin-trash-bold" />}
          >
            Quitar del organigrama
          </Button>
          {motivo && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {motivo}
            </Typography>
          )}
        </>
      )}

      {ocultos.length > 0 && (
        <Stack spacing={0.25}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Quitadas en {NOMBRE_DEL_NIVEL[nivel] || 'este nivel'} · {ocultos.length}
          </Typography>
          {ocultos.map((ficha) => (
            <Stack key={ficha.id} direction="row" alignItems="center" spacing={1}>
              <Typography variant="caption" noWrap sx={{ flexGrow: 1, color: 'text.secondary' }}>
                {ficha.nombre}
              </Typography>
              <Button size="small" variant="text" onClick={() => devolver(ficha)}>
                Devolver
              </Button>
            </Stack>
          ))}
        </Stack>
      )}

      <ConfirmDialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title={`Quitar "${nombre}"`}
        content={`Deja de verse en ${NOMBRE_DEL_NIVEL[nivel] || 'todos los organigramas de este nivel'}. Lo que cuelga de ${esContenedor ? 'este contenedor' : 'esta casilla'} sube a su sitio. Se puede devolver desde este mismo panel.`}
        action={
          <Button variant="contained" color="error" loading={trabajando} onClick={quitar}>
            Quitar
          </Button>
        }
      />
    </Stack>
  );
}
