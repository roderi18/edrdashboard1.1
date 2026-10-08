import { db } from './firebase.mjs';
import { leerDestacamento } from './padron.mjs';
import { planesDisponibles } from './planes.mjs';

const COLECCION = 'elegibilidadMembresia2027';
const MEMBRESIAS = 'membresiasOnerrd2027';

export async function leerElegibilidad(id) {
  const destacamento = await leerDestacamento(id);
  if (!destacamento) return { disponible: false, motivo: 'Destacamento no encontrado.' };
  const [reglasSnap, licenciaSnap, membresiaSnap] = await Promise.all([
    db().collection(COLECCION).doc(String(id)).get(),
    db().collection('licenciasRriTrac').doc(String(id)).get(),
    db().collection(MEMBRESIAS).doc(String(id)).get(),
  ]);
  const reglas = reglasSnap.data() || {};
  const licencia = licenciaSnap.data() || {};
  const membresia = membresiaSnap.data() || null;
  const licenciaVigente = Array.isArray(licencia.licencias) && licencia.licencias.some((item) => item.habilita2027 === true);
  const planes = planesDisponibles({ registrado2026: reglas.registrado2026, licenciaVigente });
  const validaciones = {
    existe: reglas.existeCenso2026 === true,
    jurisdiccion: Boolean(destacamento.seccion && destacamento.region),
    activo: destacamento.estado === 'activo' && reglas.habilitado2027 === true,
    sinMembresia: !membresia || membresia.estado === 'rechazada',
  };
  const disponible = Object.values(validaciones).every(Boolean) && planes.length > 0;
  return {
    disponible,
    destacamento,
    validaciones,
    planes,
    licencia: { habilita2027: licenciaVigente },
    estadoExistente: membresia?.estado || null,
    motivo: !validaciones.existe ? 'Este destacamento aún no consta como verificado en el censo 2026.'
      : !planes.length ? 'Falta validar el registro 2026 o la licencia RRI TRaC de este destacamento.'
      : !validaciones.activo ? 'El destacamento aún no está habilitado para 2027.'
        : !validaciones.sinMembresia ? 'Este destacamento ya tiene una membresía 2027 en trámite o confirmada.'
          : !validaciones.jurisdiccion ? 'Falta confirmar la región y sección.' : '',
  };
}
