import { db } from './firebase.mjs';
import { leerDestacamento } from './padron.mjs';
import { leerConfiguracion } from './configuracion.mjs';
import { tieneLicencia, planesDisponibles } from '../utils/configuracion-membresia.mjs';

// ----------------------------------------------------------------------
// LAS CINCO COMPUERTAS antes de cobrar (requerimientos §3): existe en el
// censo, tiene región y sección, no está excluido del ciclo, no tiene ya la membresía 2027 y
// le corresponde al menos un plan.
//
// · Existe = está en el padrón (API .NET), que es el censo.
// · Registro 2026 = "Registrado en la Oficina Nacional" del padrón; la Oficina
//   Nacional lo puede corregir en `elegibilidadMembresia2027/{id}`
//   (`registrado2026`) o cerrar el ciclo a un destacamento (`habilitado2027: false`).
// · Licencia = el número está en la lista del dashboard (pestaña ONERRD →
//   "Membresía 2027 · landing") o `licenciasRriTrac/{id}` habilita 2027.
// · Tarifas y planes, los de esa misma configuración.
// ----------------------------------------------------------------------

const COLECCION = 'elegibilidadMembresia2027';
const MEMBRESIAS = 'membresiasOnerrd2027';

export async function leerElegibilidad(id) {
  const destacamento = await leerDestacamento(id);
  if (!destacamento)
    return {
      disponible: false,
      motivo: 'Destacamento no encontrado en el censo.',
    };
  const [{ config }, reglasSnap, licenciaSnap, membresiaSnap] = await Promise.all([
    leerConfiguracion(),
    db().collection(COLECCION).doc(String(id)).get(),
    db().collection('licenciasRriTrac').doc(String(id)).get(),
    db().collection(MEMBRESIAS).doc(String(id)).get(),
  ]);
  const reglas = reglasSnap.data() || {};
  const licencia = licenciaSnap.data() || {};
  const membresia = membresiaSnap.data() || null;
  const licenciaVigente =
    tieneLicencia(config, destacamento.numero) ||
    (Array.isArray(licencia.licencias) &&
      licencia.licencias.some((item) => item.habilita2027 === true));
  const registrado2026 =
    typeof reglas.registrado2026 === 'boolean'
      ? reglas.registrado2026
      : destacamento.registradoOfnc;
  const planes = planesDisponibles({ registrado2026, licenciaVigente }, config);
  const validaciones = {
    existe: true,
    jurisdiccion: Boolean(destacamento.seccion && destacamento.region),
    // UN DESTACAMENTO INACTIVO TAMBIÉN PAGA (Oficina Nacional, oct. 2026): el
    // estatus se enseña, pero solo bloquea que la Oficina Nacional lo excluya
    // del ciclo (`elegibilidadMembresia2027/{id}.habilitado2027 = false`).
    habilitado: reglas.habilitado2027 !== false,
    sinMembresia: !membresia || membresia.estado === 'rechazada',
  };
  const disponible = Object.values(validaciones).every(Boolean) && planes.length > 0;
  // Al navegador solo va lo que se pinta: nada de teléfonos ni correos.
  const {
    id: idDest,
    numero,
    nombre,
    region,
    seccion,
    iglesia,
    pastor,
    coordinador,
  } = destacamento;
  return {
    disponible,
    destacamento: {
      id: idDest,
      numero,
      nombre,
      region,
      seccion,
      iglesia,
      pastor,
      coordinador,
    },
    validaciones,
    // Solo para enseñarlo: activo o inactivo (no bloquea).
    activo: destacamento.estado === 'activo',
    planes,
    registrado2026: registrado2026 ?? null,
    licencia: { habilita2027: licenciaVigente },
    estadoExistente: membresia?.estado || null,
    motivo: !validaciones.jurisdiccion
      ? 'Falta confirmar la región y la sección de este destacamento con la Oficina Nacional.'
      : !validaciones.habilitado
        ? 'La Oficina Nacional excluyó este destacamento del ciclo 2027.'
        : !validaciones.sinMembresia
          ? membresia?.estado === 'confirmada'
            ? 'Este destacamento ya tiene su membresía 2027.'
            : 'Este destacamento ya tiene una membresía 2027 en trámite.'
          : !planes.length
            ? 'Falta confirmar si el destacamento se registró en 2026. Contacta a la Oficina Nacional.'
            : '',
  };
}
