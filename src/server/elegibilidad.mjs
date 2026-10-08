import { db } from './firebase.mjs';
import { leerDestacamento } from './padron.mjs';
import { planesDisponibles } from './planes.mjs';

// ----------------------------------------------------------------------
// LAS CINCO COMPUERTAS antes de cobrar (requerimientos §3): existe en el
// censo, tiene región y sección, está activo, no tiene ya la membresía 2027 y
// le corresponde al menos un plan.
//
// · Existe = está en el padrón (API .NET), que es el censo.
// · Registro 2026 = "Registrado en la Oficina Nacional" del padrón; la Oficina
//   Nacional lo puede corregir en `elegibilidadMembresia2027/{id}`
//   (`registrado2026`) o cerrar el ciclo a un destacamento (`habilitado2027: false`).
// · Licencia = `licenciasRriTrac/{id}` con alguna licencia `habilita2027`.
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
  const [reglasSnap, licenciaSnap, membresiaSnap] = await Promise.all([
    db().collection(COLECCION).doc(String(id)).get(),
    db().collection('licenciasRriTrac').doc(String(id)).get(),
    db().collection(MEMBRESIAS).doc(String(id)).get(),
  ]);
  const reglas = reglasSnap.data() || {};
  const licencia = licenciaSnap.data() || {};
  const membresia = membresiaSnap.data() || null;
  const licenciaVigente =
    Array.isArray(licencia.licencias) &&
    licencia.licencias.some((item) => item.habilita2027 === true);
  const registrado2026 =
    typeof reglas.registrado2026 === 'boolean'
      ? reglas.registrado2026
      : destacamento.registradoOfnc;
  const planes = planesDisponibles({ registrado2026, licenciaVigente });
  const validaciones = {
    existe: true,
    jurisdiccion: Boolean(destacamento.seccion && destacamento.region),
    activo: destacamento.estado === 'activo' && reglas.habilitado2027 !== false,
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
    planes,
    registrado2026: registrado2026 ?? null,
    licencia: { habilita2027: licenciaVigente },
    estadoExistente: membresia?.estado || null,
    motivo: !validaciones.jurisdiccion
      ? 'Falta confirmar la región y la sección de este destacamento con la Oficina Nacional.'
      : !validaciones.activo
        ? 'El destacamento no está habilitado para el ciclo 2027.'
        : !validaciones.sinMembresia
          ? membresia?.estado === 'confirmada'
            ? 'Este destacamento ya tiene su membresía 2027.'
            : 'Este destacamento ya tiene una membresía 2027 en trámite.'
          : !planes.length
            ? 'Falta confirmar si el destacamento se registró en 2026. Contacta a la Oficina Nacional.'
            : '',
  };
}
