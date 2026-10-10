// ----------------------------------------------------------------------
// "CERTIFICADOS CREADOS": la lista de lo emitido, con los lotes de "Crear
// certificados" y los certificados ONERRD juntos, y sus filtros (lote,
// certificado, fecha y creado por).
//
// Cada uno guarda las cosas a su modo (inglés heredado en los lotes, español
// en el ONERRD); aquí se ponen en una sola forma de fila para pintarlas y
// filtrarlas igual. Sin navegador ni Firebase: lo prueba
// `tests/admin/certificados-creados.test.mjs`.
// ----------------------------------------------------------------------

export const TITULO_CERTIFICADO_ONERRD = 'Certificado de Registro ONERRD';

// El nombre que no lleva código debajo: lo hizo el sistema, no una persona.
export const esCreadorSistema = (nombre) =>
  String(nombre || '')
    .trim()
    .toLowerCase() === 'sistema';

const creadorDe = (creador) => {
  if (typeof creador === 'string') return { uid: '', nombre: creador || 'Usuario', codigo: '' };
  const nombre = creador?.nombre || creador?.name || 'Usuario';
  return {
    uid: creador?.uid || '',
    nombre,
    codigo: esCreadorSistema(nombre) ? '' : String(creador?.codigo || creador?.code || ''),
  };
};

export const filaDeLote = (lote = {}) => ({
  tipo: 'curso',
  id: String(lote.id || ''),
  titulo: lote.course?.certificateTitle || lote.course?.name || '',
  detalle: lote.course?.name || '',
  plantilla: lote.templateName || '',
  cantidad: lote.totalCertificates || lote.certificates?.length || 0,
  creadoEn: lote.createdAt || '',
  creador: creadorDe(lote.createdBy),
  origen: lote,
});

export const filaDeEmitidoOnerrd = (emitido = {}) => {
  const valores = emitido.valores || {};
  const destacamento = [
    valores.numeroDestacamento && `Dest. ${valores.numeroDestacamento}`,
    valores.nombreDestacamento,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    tipo: 'onerrd',
    id: String(emitido.numeroRegistro || emitido.id || ''),
    titulo: TITULO_CERTIFICADO_ONERRD,
    detalle: destacamento,
    plantilla: '',
    cantidad: 1,
    creadoEn: emitido.emitidoEnIso || '',
    creador: creadorDe(emitido.emitidoPor),
    origen: emitido,
  };
};

// Las dos listas en una, de la más nueva a la más vieja.
export const unirCertificadosCreados = (lotes = [], emitidosOnerrd = []) =>
  [...lotes.map(filaDeLote), ...emitidosOnerrd.map(filaDeEmitidoOnerrd)].sort((a, b) =>
    String(b.creadoEn).localeCompare(String(a.creadoEn))
  );

const ordenar = (valores) =>
  [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

// Lo que ofrecen los desplegables: solo lo que hay en la lista.
export const opcionesDeFiltroCreados = (filas = []) => ({
  certificados: ordenar(filas.map((fila) => fila.titulo)),
  creadores: ordenar(filas.map((fila) => fila.creador.nombre)),
});

export const FILTROS_CREADOS_VACIOS = Object.freeze({
  lote: '',
  certificado: '',
  desde: '',
  hasta: '',
  creadoPor: '',
});

const sinAcentos = (texto) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// `desde` y `hasta`: AAAA-MM-DD, el día entero en hora de Santo Domingo.
const diaLocal = (iso) => {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
};

export const filtrarCertificadosCreados = (filas = [], filtros = FILTROS_CREADOS_VACIOS) => {
  const lote = sinAcentos(filtros.lote).trim();
  return filas.filter((fila) => {
    if (lote && !sinAcentos(`${fila.id} ${fila.detalle}`).includes(lote)) return false;
    if (filtros.certificado && fila.titulo !== filtros.certificado) return false;
    if (filtros.creadoPor && fila.creador.nombre !== filtros.creadoPor) return false;
    if (filtros.desde || filtros.hasta) {
      const dia = diaLocal(fila.creadoEn);
      if (!dia) return false;
      if (filtros.desde && dia < filtros.desde) return false;
      if (filtros.hasta && dia > filtros.hasta) return false;
    }
    return true;
  });
};

export const hayFiltrosCreados = (filtros = {}) =>
  Object.keys(FILTROS_CREADOS_VACIOS).some((clave) => !!filtros[clave]);
