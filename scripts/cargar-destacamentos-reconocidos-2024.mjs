// ----------------------------------------------------------------------
// CARGA DE LOS DESTACAMENTOS RECONOCIDOS DESDE 2024 (278-289).
//
// Del Excel "Destacamentos reconocidos desde 2024_mod.xlsx", revisado fila por
// fila con la Oficina Nacional el 28/09/2026 (sección según la dirección,
// erratas y coordinadores). Crea, igual que la carga del Listado Nacional:
//   - la iglesia (con el pastor y su primer teléfono) y el destacamento
//     ("Desconocido": sin nombre, como los demás del listado), registrado en la
//     Oficina Nacional;
//   - su evaluación (No., fechas y, en la nota, los otros teléfonos del pastor);
//   - el coordinador: los que estaban en el Provisional pasan a su destacamento,
//     Misael Amancio deja el Dest. 73 (y su coordinación, que queda en el
//     historial) y Andrés Torres y José Sánchez se crean como miembros nuevos.
// Todo queda en Historial (`auditoria_sistema`, origen "carga_excel").
//
// Sin argumentos solo enseña lo que haría. Para escribir:
//   node --env-file=.env.local scripts/cargar-destacamentos-reconocidos-2024.mjs --ejecutar
// Es idempotente por número: si un destacamento ya existe, no lo vuelve a crear.
// ----------------------------------------------------------------------

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import {
  debeRegistrarSalida,
  construirRegistroHistorial,
  COLECCION_HISTORIAL_DIRECTIVA,
} from '../src/utils/directiva-historial.mjs';

const API = 'https://systexploradores.somee.com/api';
const EJECUTAR = process.argv.includes('--ejecutar');
const HOY = new Date().toISOString().slice(0, 10);
const ID_CARGO_COORDINADOR = 39;
const POSICION_COORDINADOR = 'destacamento-coordinador-destacamento';
const ORDEN_COORDINADOR = 2;

// [numero, seccion, iglesia, [provincia, municipio, sector, calle], pastor,
//  telefonos del pastor, coordinador, [No. evaluación, fecha evaluación, entrega]]
// coordinador: { id } existente, { nuevo: [nombres, apellidos, genero] } o null.
const FILAS = [
  [278, 'Este Oriental I', 'Fuente de Vida', ['Santo Domingo', 'Santo Domingo Este', 'Los Mina', 'Calle Primera #1, Las Enfermeras'], 'Digna Ceballo', ['809-286-5347', '809-506-7257', '849-210-7257'], { nuevo: ['Andrés', 'Torres', 'M'] }, ['', '', '2024-12-04']],
  [279, 'Baní-Ocoa', 'Iglesia Comunitaria Agape', ['Peravia', 'Baní', '', ''], 'Maycor Andújar', [], { id: 519 }, ['', '', '2024-12-09']],
  [280, 'Este Oriental II', 'Manantial de Vida', ['Santo Domingo', 'Santo Domingo Este', 'San Isidro', 'Manzana 12 #6, Urb. Praderas del Este'], 'Antonio Perdomo', ['829-376-6374'], { id: 429 }, ['2025-01', '2025-01-25', '2025-03-29']],
  [281, 'Baní-Ocoa', 'Fuente de Vida', ['Peravia', 'Baní', 'Mata Gorda', ''], 'Julio Díaz Guerrero', [], null, ['2025-02', '2025-02-24', '2025-03-16']],
  [282, 'Baní-Ocoa', 'Manantial de Vida Nizao', ['Peravia', 'Nizao', '', 'Calle Sánchez #19'], 'Joel Valdez', [], null, ['2025-03', '2025-03-17', '2025-03-22']],
  [283, 'La Vega - Moca', 'Centro de Vida', ['La Vega', 'La Vega', 'Sabaneta', 'Residencial Las Praderas'], 'Gemuel Delgado', ['829-803-9978', '809-229-7352'], null, ['2025-04', '2025-04-28', '2025-05-11']],
  [284, 'La Romana', 'La Paz', ['La Romana', 'La Romana', '', 'Carretera vieja km 3 1/2 La Romana-San Pedro'], 'Néstor Julio Benítez', ['809-585-3246'], { id: 466 }, ['2025-06', '2025-09-01', '2025-09-06']],
  [285, 'Este Oriental I', 'Arca de Noé III', ['Santo Domingo', 'Santo Domingo Este', 'Mirador del Ozama', 'Prol. Fernández de Navarrete, Mz. A #1'], 'Manuel Dalmasí', ['849-287-6576'], { id: 403, dejaDestacamento: 340 }, ['2025-08', '2025-09-15', '2025-11-29']],
  [286, 'Este Oriental I', 'Cristo Rompe las Cadenas', ['Santo Domingo', 'Santo Domingo Este', 'Los Mina', 'Calle Santa Clara #49, casi esq. Martha Cruz, Katanga'], 'Silveria Sepúlveda', ['809-547-0327', '809-661-4223', '809-224-3834'], { nuevo: ['José', 'Sánchez', 'M'] }, ['2025-09', '2025-10-09', '2025-12-05']],
  [287, 'Azua', 'Quisqueya', ['Azua', 'Azua de Compostela', 'Quisqueya', ''], 'Sixto Gerónimo', ['829-683-8924'], { id: 533, apellidos: 'Figuereo' }, ['2025-11', '2025-12-01', '2025-12-21']],
  [288, 'Villa Hermosa', 'Monte Sinaí', ['La Romana', 'Villa Hermosa', 'Villa Progreso', 'C/ Principal'], 'Eliezer del Rosario', [], null, ['2025-08', '2025-11-27', '2026-02-25']],
  [289, 'Oeste Occidental I', 'Lirio de los Valles II', ['Santo Domingo', 'Los Alcarrizos', 'Los Cerros del Norte', 'Calle 8 #6, Km 18, Autopista Duarte'], 'Cristóbal Brito', ['829-972-0642'], { id: 414 }, ['2026-01', '2026-05-20', '2026-06-24']],
];

const cuenta = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({
  credential: cert({
    projectId: cuenta.project_id,
    clientEmail: cuenta.client_email,
    privateKey: cuenta.private_key.split('\\n').join('\n'),
  }),
});
const db = getFirestore();

const log = (...a) => console.log(...a);
const soloDigitos = (t) => String(t || '').replace(/\D/g, '');
const filas = (json) => json?.data?.items || json?.data || json?.Data || json || [];

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  for (let intento = 1; intento <= 3; intento += 1) {
    try {
      const res = await fetch(`${API}/${ruta}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal: AbortSignal.timeout(90000),
      });
      const texto = await res.text();
      if (!res.ok) throw new Error(`${ruta} ${res.status}: ${texto.slice(0, 300)}`);
      return texto ? JSON.parse(texto) : null;
    } catch (error) {
      if (intento === 3) throw error;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return null;
}

const leerDestacamentos = async () => filas(await api('Destacamentos/GetAllDestacamentos'));
const leerIglesias = async () => filas(await api('Iglesias/GetAllIglesias'));
const leerMiembros = async () =>
  filas(await api('Miembros/GetAllMiembrosPagination', { metodo: 'POST', cuerpo: { page: 1, pageSize: 10000 } }));

const historial = (accion, descripcion, entidad, despues, antes = null) =>
  db.collection('auditoria_sistema').add({
    modulo: 'destacamentos',
    accion,
    descripcion,
    resultado: 'exitoso',
    severidad: 'importante',
    entidad,
    antes,
    despues,
    realizadoPor: { nombre: 'Carga Excel "Destacamentos reconocidos desde 2024"', rol: 'sistema' },
    origen: 'carga_excel',
    metadatos: { archivo: 'Destacamentos reconocidos desde 2024_mod.xlsx' },
    fecha: new Date().toISOString(),
    fechaServidor: new Date(),
  });

const [secciones, divisiones] = await Promise.all([
  api('Secciones/GetAllSecciones').then(filas),
  api('Divisiones/GetAllDivisiones').then(filas),
]);
const idDivisionLiderazgo = divisiones.find((d) => /liderazgo/i.test(d.nombre))?.idDivision;
let destacamentos = await leerDestacamentos();
let iglesias = await leerIglesias();
let miembros = await leerMiembros();
let siguienteEdr = Math.max(
  ...miembros.map((m) => Number(String(m.codigoMiembro).match(/EDR-(\d+)/)?.[1] || 0)).filter((n) => n < 20000)
) + 1;

log(EJECUTAR ? '== EJECUTANDO ==' : '== SOLO VISTA PREVIA (añade --ejecutar para escribir) ==');
log(`División de liderazgo: ${idDivisionLiderazgo}; siguiente código: EDR-${siguienteEdr}`);

for (const [numero, nombreSeccion, nombreIglesia, dir, pastor, telefonos, coordinador, evaluacion] of FILAS) {
  const seccion = secciones.find((s) => s.nombre.trim() === nombreSeccion);
  if (!seccion) throw new Error(`No existe la sección "${nombreSeccion}"`);
  const direccion = dir.join(', ').slice(0, 100);
  log(`\n#${numero} · ${nombreIglesia} · ${nombreSeccion} (id ${seccion.idSeccion})`);
  log(`   dirección: ${direccion}`);
  log(`   pastor: ${pastor} · tel ${telefonos[0] || '—'}${telefonos.length > 1 ? ` · nota: ${telefonos.slice(1).join(', ')}` : ''}`);

  // 1-2. Iglesia y destacamento (si el número ya existe, se reutiliza).
  let dest = destacamentos.find((d) => String(d.numero) === String(numero));
  if (dest) {
    log(`   ya existe (idDestacamento ${dest.idDestacamento}): no se crea`);
  } else if (EJECUTAR) {
    const correoIglesia = `nomail_iglesia_${seccion.idSeccion}_${numero}@mail.com`;
    await api('Iglesias/SetIglesia', {
      metodo: 'POST',
      cuerpo: {
        idIglesia: 0,
        nombre: nombreIglesia,
        pastor,
        telefono: soloDigitos(telefonos[0]),
        direccion,
        correo: correoIglesia,
        idSeccion: seccion.idSeccion,
      },
    });
    iglesias = await leerIglesias();
    const iglesia = iglesias.find((i) => i.correo === correoIglesia);
    if (!iglesia) throw new Error(`No aparece la iglesia recién creada del #${numero}`);
    await api('Destacamentos/SetDestacamento', {
      metodo: 'POST',
      cuerpo: {
        idDestacamento: 0,
        nombre: 'Desconocido',
        idIglesia: iglesia.idIglesia,
        correo: `nomail_${HOY.replace(/-/g, '')}_dest${seccion.idSeccion}_${numero}@mail.com`,
        telefono: null,
        direccion: 'N/A',
        concilio: 'N/A',
        registradoOfnc: true,
        rritrackActivo: false,
        diaReunion: '',
        horaReunion: '',
        logo: '',
        numero: String(numero),
        fechaInicio: new Date().toISOString().slice(0, 19),
      },
    });
    destacamentos = await leerDestacamentos();
    dest = destacamentos.find((d) => String(d.numero) === String(numero));
    if (!dest) throw new Error(`No aparece el destacamento recién creado #${numero}`);
    await historial(
      'destacamento_creado',
      `Se creó el destacamento ${numero} (${nombreIglesia}, ${nombreSeccion}) desde el Excel de reconocidos 2024.`,
      { tipo: 'destacamento', id: String(dest.idDestacamento), nombre: `Desconocido ${numero}`, ruta: `/dashboard/level/dest/${dest.idDestacamento}/edit` },
      { numero, iglesia: nombreIglesia, idIglesia: iglesia.idIglesia, seccion: nombreSeccion, direccion, pastor }
    );
    log(`   creado: idIglesia ${iglesia.idIglesia}, idDestacamento ${dest.idDestacamento}`);
  } else {
    log('   se crearía la iglesia y el destacamento "Desconocido"');
  }

  // 3. Evaluación (+ nota con los otros teléfonos del pastor).
  const [numeroEvaluacion, fechaEvaluacion, fechaEntregaReconocimiento] = evaluacion;
  const nota = telefonos.length > 1 ? `Otros teléfonos del pastor: ${telefonos.slice(1).join(', ')}` : '';
  log(`   evaluación: No. ${numeroEvaluacion || '—'} · ${fechaEvaluacion || '—'} · entrega ${fechaEntregaReconocimiento || '—'}`);
  if (EJECUTAR && dest) {
    const evaluacionDoc = { numeroEvaluacion, fechaEvaluacion, fechaEntregaReconocimiento, nota };
    await db.collection('evaluaciones_destacamentos').doc(String(dest.idDestacamento)).set({
      idDestacamento: String(dest.idDestacamento),
      ...evaluacionDoc,
      actualizadoEn: FieldValue.serverTimestamp(),
      actualizadoPor: 'carga_excel',
    });
    await historial(
      'cambio_aplicado',
      `Evaluación del destacamento ${numero} cargada desde el Excel de reconocidos 2024.`,
      { tipo: 'destacamento', id: String(dest.idDestacamento), nombre: `Desconocido ${numero}`, ruta: `/dashboard/level/dest/${dest.idDestacamento}/edit/evaluation` },
      evaluacionDoc
    );
  }

  // 4. Coordinador.
  if (!coordinador) {
    log('   coordinador: ninguno');
    continue;
  }
  let miembro;
  if (coordinador.nuevo) {
    const [nombres, apellidos, genero] = coordinador.nuevo;
    miembro = miembros.find((m) => `${m.nombres} ${m.apellidos}`.trim() === `${nombres} ${apellidos}` && String(m.idDestacamento) === String(dest?.idDestacamento));
    if (miembro) {
      log(`   coordinador ${nombres} ${apellidos} ya creado (${miembro.codigoMiembro})`);
    } else if (EJECUTAR) {
      const codigoMiembro = `EDR-${String(siguienteEdr).padStart(5, '0')}`;
      siguienteEdr += 1;
      await api('Miembros/SetMiembros', {
        metodo: 'POST',
        cuerpo: {
          idMiembros: 0, codigoMiembro, nombres, apellidos, genero, fechaNacimiento: null,
          fechaCreacion: new Date().toISOString(), idDestacamento: dest.idDestacamento,
          telefono: null, direccion: null, correo: null, idDivision: idDivisionLiderazgo,
          estatusMiembro: 'activo', cargosmiembros: [], miembromeritos: [], participanteseventos: [],
          tutores: [], usuarios: [], idUniformes: [], uniformesMiembros: [],
        },
      });
      miembros = await leerMiembros();
      miembro = miembros.find((m) => m.codigoMiembro === codigoMiembro);
      if (!miembro) throw new Error(`No aparece el miembro nuevo ${codigoMiembro}`);
      await historial(
        'miembro_creado',
        `Se creó el miembro ${nombres} ${apellidos} (${codigoMiembro}), coordinador del destacamento ${numero}.`,
        { tipo: 'miembro', id: String(miembro.idMiembros), nombre: `${nombres} ${apellidos}`, ruta: `/dashboard/level/member/${miembro.idMiembros}/edit` },
        { codigoMiembro, idDestacamento: dest.idDestacamento }
      );
      log(`   coordinador nuevo: ${nombres} ${apellidos} ${codigoMiembro} (id ${miembro.idMiembros})`);
    } else {
      log(`   coordinador: se crearía ${nombres} ${apellidos} como EDR-${siguienteEdr} (género ${genero})`);
      siguienteEdr += 1;
      continue;
    }
  } else {
    miembro = miembros.find((m) => Number(m.idMiembros) === coordinador.id);
    if (!miembro) throw new Error(`No existe el miembro ${coordinador.id}`);
    const cambios = [`destacamento ${miembro.idDestacamento} → ${dest?.idDestacamento ?? '(nuevo)'}`];
    if (coordinador.apellidos) cambios.push(`apellidos "${miembro.apellidos}" → "${coordinador.apellidos}"`);
    log(`   coordinador: ${miembro.nombres} ${miembro.apellidos} (${miembro.codigoMiembro}): ${cambios.join('; ')}`);
    if (EJECUTAR && String(miembro.idDestacamento) !== String(dest.idDestacamento)) {
      const antes = { idDestacamento: miembro.idDestacamento, apellidos: miembro.apellidos };
      const actualizado = { ...miembro, idDestacamento: dest.idDestacamento, ...(coordinador.apellidos ? { apellidos: coordinador.apellidos } : {}) };
      await api('Miembros/UpdateMiembros', { metodo: 'POST', cuerpo: actualizado });
      await historial(
        'miembro_actualizado',
        `${miembro.nombres} ${actualizado.apellidos} pasa al destacamento ${numero} como coordinador (Excel de reconocidos 2024).`,
        { tipo: 'miembro', id: String(miembro.idMiembros), nombre: `${miembro.nombres} ${actualizado.apellidos}`, ruta: `/dashboard/level/member/${miembro.idMiembros}/edit` },
        { idDestacamento: dest.idDestacamento, apellidos: actualizado.apellidos },
        antes
      );
      miembro = actualizado;
    }
  }

  if (!EJECUTAR) continue;

  // Misael deja la coordinación del destacamento de donde sale (queda en el historial).
  if (coordinador.dejaDestacamento) {
    const previas = await db
      .collection('asignacionesDirectiva')
      .where('idMiembro', '==', String(miembro.idMiembros))
      .where('idEntidad', '==', String(coordinador.dejaDestacamento))
      .get();
    for (const previa of previas.docs) {
      const anterior = { id: previa.id, ...previa.data() };
      if (anterior.activo === false) continue;
      if (debeRegistrarSalida({ anterior, siguienteIdMiembro: '', siguienteActivo: false, fechaSalida: HOY })) {
        const registro = construirRegistroHistorial({ anterior, idAsignacion: previa.id, fechaSalida: HOY, motivo: 'otro' });
        await db.collection(COLECCION_HISTORIAL_DIRECTIVA).doc(registro.id).set({ ...registro, fechaCreacion: FieldValue.serverTimestamp() });
      }
      await previa.ref.set({ activo: false, fechaFin: HOY, fechaActualizacion: FieldValue.serverTimestamp() }, { merge: true });
      log(`   deja ${anterior.idPosicionDirectiva} del destacamento ${coordinador.dejaDestacamento}`);
    }
  }

  // Asignación de coordinador, con la misma forma que la del formulario.
  const idEntidad = String(dest.idDestacamento);
  const idAsignacion = `destacamento_${idEntidad}_${POSICION_COORDINADOR}_general_${ORDEN_COORDINADOR}`;
  const nombreMiembro = `${miembro.nombres} ${miembro.apellidos}`.trim();
  await db.collection('asignacionesDirectiva').doc(idAsignacion).set({
    idAsignacion,
    idDirectiva: `destacamento_${idEntidad}`,
    nivel: 'destacamento',
    idEntidad,
    idCargo: ID_CARGO_COORDINADOR,
    idMiembro: String(miembro.idMiembros),
    idPosicionDirectiva: POSICION_COORDINADOR,
    division: null,
    orden: ORDEN_COORDINADOR,
    origen: 'carga_excel',
    fechaInicio: HOY,
    fechaFin: null,
    activo: true,
    nombreMiembro,
    codigoMiembro: miembro.codigoMiembro || '',
    fotoMiembro: '',
    fechaActualizacion: FieldValue.serverTimestamp(),
    fechaCreacion: FieldValue.serverTimestamp(),
  });
  log(`   asignado como Coordinador de Destacamento`);
}

log(EJECUTAR ? '\nListo.' : '\nVista previa terminada: nada escrito.');
process.exit(0);
