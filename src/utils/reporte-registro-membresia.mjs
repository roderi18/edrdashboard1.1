const texto = (valor) => String(valor ?? '').trim();

export const LEYENDA_REPORTE_REGISTRO = [
  { codigo: '001', descripcion: 'Código normal' },
  {
    codigo: '002N',
    descripcion:
      'Código + N indica que el dest. Hereda el registro por haber obtenido reconocimiento de la ON este año.',
  },
  {
    codigo: '002RA',
    descripcion:
      'Código + RA indica que el dest. estaba en estado inactivo y ha pasado a estado de Reactivación.',
  },
];

const numeroDeRegistro = (membresia, estadoPadron = '') => {
  const origen =
    texto(membresia.codigo) || texto(membresia.certificadoEmitido?.numeroRegistro) || '';
  const coincidencia = origen.match(/(\d+)(?:[A-Z]+)?\s*$/i);
  if (!coincidencia) return '—';
  const numero = String(Number(coincidencia[1])).padStart(3, '0').slice(-3);
  const estadoAlRegistrarse =
    texto(membresia.estadoDestacamentoAlRegistrarse) ||
    texto(membresia.destacamento?.estado) ||
    texto(estadoPadron);
  return `${numero}${estadoAlRegistrarse.toLowerCase() === 'inactivo' ? 'RA' : ''}`;
};

export function filasReporteRegistro(membresias, padron = []) {
  const estadoPorDestacamento = new Map(
    (padron || []).map((destacamento) => [texto(destacamento.id), texto(destacamento.estado)])
  );
  return (membresias || [])
    .filter((membresia) => membresia.estado === 'confirmada')
    .map((membresia) => {
      const destacamento = membresia.destacamento || {};
      const fecha = membresia.confirmadoEn || membresia.creadoEn || '';
      return {
        id: texto(membresia.id),
        registro: numeroDeRegistro(membresia, estadoPorDestacamento.get(texto(membresia.id))),
        destacamento: texto(destacamento.numero) || '—',
        nombre: texto(destacamento.nombre),
        fecha,
        region: texto(destacamento.region).replace(/^Regi[oó]n\s+/i, '') || '—',
        // «Registrado por»: la persona que registró el destacamento al pagar.
        registradoPor: texto(membresia.registradoPor?.nombre) || '—',
      };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.registro.localeCompare(b.registro, 'es'));
}

export function fechaReporteRegistro(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return new Intl.DateTimeFormat('es-DO', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'America/Santo_Domingo',
  }).format(fecha);
}

// El primer nombre y el primer apellido de una persona: de sus campos si
// los tiene (elegida de la lista) y, si se escribió a mano, de su nombre:
// 2 palabras → ambas; 3 → primera y última; 4 o más → primera y tercera.
export function nombreCortoPersona(persona) {
  if (!persona) return '';
  const primero = (t) => texto(t).split(/\s+/)[0] || '';
  if (persona.nombres && persona.apellidos) {
    return `${primero(persona.nombres)} ${primero(persona.apellidos)}`.trim();
  }
  const palabras = texto(persona.nombre).split(/\s+/).filter(Boolean);
  if (palabras.length <= 2) return palabras.join(' ');
  return `${palabras[0]} ${palabras[2]}`;
}
