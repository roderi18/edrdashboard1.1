// ----------------------------------------------------------------------
// DISEÑO, CAMPAÑAS, AUDIENCIA, LAPICES, ANALITICAS Y AVISOS (EXPLORA, fases 6 a 8).
//
// Lo que se podia romper, y se comprueba aqui:
//
//   - DISEÑO: que un diseño vacio cambiara un pixel de la portada (cada pieza
//     tiene que devolver "nada" sin ajuste), o que colara en el CSS algo que no
//     es un color (`url(...)`, `red; background: ...`).
//   - CAMPAÑAS: que una campaña se viera antes de empezar o despues de terminar,
//     que le llegara a quien no es de su region, o que tumbara la portada estando
//     rota en vez de caer a lo publicado.
//   - LAPICES: que alguna tarjeta se quedara sin lapiz, o que siguiera el de
//     antes, que publicaba una foto en el acto sin vista previa ni Historial.
//   - ANALITICAS: que la coleccion quedara bajo el comodin, o que se pudiera
//     escribir en ella algo que no fueran los contadores.
//   - AVISOS: que reordenar los comunicados avisara a toda la organizacion.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { AJUSTES_DE_DISENO, sanearDiseno, colorHex, TIPOS_DE_AJUSTE } =
  await import('src/utils/everest/diseno.mjs');
const {
  alcanzaA,
  campanasDe,
  sanearCampana,
  campanaVigente,
  prepararCampana,
  estadoDeCampana,
  sanearAudiencia,
} = await import('src/utils/everest/campanas.mjs');
const { resolverPortada, ORIGEN_DEL_BLOQUE } = await import('src/utils/everest/portada.mjs');
const { comunicadosNuevos } = await import('src/utils/everest/avisos.mjs');
const { bloquesPublicablesDe } = await import('src/utils/everest/bloques.mjs');
const { FABRICA_DE_PORTADA } = await import('src/sections/principal/fabrica-de-portada.js');
const tarjeta = await import('src/sections/principal/diseno-de-tarjeta.js');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const LEMA = { titulo: 'Servir con alegría', pie: 'Siempre listos' };

// ----------------------------------------------------------------------
// 1. EL DISEÑO
// ----------------------------------------------------------------------

test('cada bloque publicable tiene ajustes de diseño, sin campos repetidos', () => {
  bloquesPublicablesDe('principal').forEach(({ id }) => {
    const campos = (AJUSTES_DE_DISENO[id] ?? []).map((ajuste) => ajuste.campo);

    assert.ok(campos.length > 0, id);
    assert.equal(new Set(campos).size, campos.length, id);
  });
});

test('cada ajuste es de un tipo conocido, con sus limites si es un numero', () => {
  Object.entries(AJUSTES_DE_DISENO).forEach(([id, ajustes]) =>
    ajustes.forEach((ajuste) => {
      assert.ok(Object.values(TIPOS_DE_AJUSTE).includes(ajuste.tipo), `${id}.${ajuste.campo}`);

      if (ajuste.tipo === TIPOS_DE_AJUSTE.tamano) {
        assert.ok(ajuste.min < ajuste.max, `${id}.${ajuste.campo}`);
        assert.ok(ajuste.porDefecto >= ajuste.min && ajuste.porDefecto <= ajuste.max);
      }
    })
  );
});

test('sin diseño, un diseño vacio; con uno roto, null', () => {
  assert.deepEqual(sanearDiseno('lema', undefined), {});
  assert.deepEqual(sanearDiseno('lema', null), {});
  assert.equal(sanearDiseno('lema', 'rojo'), null);
  assert.equal(sanearDiseno('lema', { colorFondo: 'red' }), null);
  assert.equal(sanearDiseno('lema', { tamanoTitulo: 400 }), null);
  assert.equal(sanearDiseno('lema', { alineacion: 'justify' }), null);
  assert.equal(sanearDiseno('lema', { icono: 'mdi:no-registrado' }), null);
  assert.equal(sanearDiseno('lema', { mostrarIcono: 'no' }), null);
});

test('los colores solo pasan en hexadecimal: nada de CSS colado', () => {
  assert.equal(colorHex('#00a76f'), '#00A76F');
  assert.equal(colorHex('#00A76F80'), '#00A76F80');
  ['red', 'url(https://x.test/a.png)', '#FFF', '#00A76F; background: red', 'rgb(0,0,0)'].forEach(
    (valor) => assert.equal(colorHex(valor), null, valor)
  );
});

test('un ajuste que el bloque no tiene se ignora; los que tiene se limpian', () => {
  assert.deepEqual(
    sanearDiseno('lema', {
      colorFondo: '#0b1b36',
      tamanoTitulo: 22,
      alineacion: 'center',
      mostrarIcono: false,
      inventado: 'x',
    }),
    { colorFondo: '#0B1B36', tamanoTitulo: 22, alineacion: 'center', mostrarIcono: false }
  );
});

test('SIN AJUSTES, LAS PIEZAS DE LA TARJETA NO AÑADEN NADA: la portada se ve igual', () => {
  [undefined, {}].forEach((diseno) => {
    assert.deepEqual(tarjeta.fondoDelDiseno(diseno), {});
    assert.deepEqual(tarjeta.radioDelDiseno(diseno), {});
    assert.deepEqual(tarjeta.colorDelDiseno(diseno, 'colorTitulo'), {});
    assert.deepEqual(
      tarjeta.letraDelDiseno(diseno, { tamano: 'tamanoTitulo', peso: 'pesoTitulo' }),
      {}
    );
    assert.equal(tarjeta.textoDelDiseno(diseno, 'titulo', 'Historias'), 'Historias');
    assert.equal(
      tarjeta.valorDelDiseno(diseno, 'icono', 'solar:shield-check-bold'),
      'solar:shield-check-bold'
    );
    assert.equal(tarjeta.seMuestra(diseno, 'mostrarBoton'), true);
  });

  const navy = { fondo: 'navy', claro: 'claro', canal: '1 2 3' };

  assert.equal(tarjeta.navyDelDiseno(navy, {}), navy);
});

test('con ajustes, las piezas de la tarjeta los aplican', () => {
  const diseno = {
    colorFondo: '#0B1B36',
    colorFondo2: '#00A76F',
    radio: 8,
    tamanoTitulo: 20,
    pesoTitulo: '700',
    titulo: '',
    mostrarBoton: false,
  };

  assert.deepEqual(tarjeta.fondoDelDiseno(diseno), {
    backgroundColor: '#0B1B36',
    backgroundImage: 'linear-gradient(140deg, #0B1B36 0%, #00A76F 100%)',
  });
  assert.deepEqual(tarjeta.fondoDelDiseno({ colorFondo: '#0B1B36' }), {
    backgroundColor: '#0B1B36',
    backgroundImage: 'none',
  });
  assert.deepEqual(tarjeta.radioDelDiseno(diseno), { borderRadius: '8px' });
  assert.deepEqual(tarjeta.letraDelDiseno(diseno, { tamano: 'tamanoTitulo', peso: 'pesoTitulo' }), {
    fontSize: '20px',
    fontWeight: 700,
  });
  // Un texto vacio publicado es "quitar ese texto".
  assert.equal(tarjeta.textoDelDiseno(diseno, 'titulo', 'Historias'), '');
  assert.equal(tarjeta.seMuestra(diseno, 'mostrarBoton'), false);
  assert.equal(tarjeta.canalDeHex('#0B1B36'), '11 27 54');
  assert.equal(tarjeta.navyDelDiseno({ fondo: 'x' }, diseno).canal, '11 27 54');
  assert.equal(tarjeta.conNombre('¡Hola, {nombre}!', 'Ana'), '¡Hola, Ana!');
});

test('un diseño publicado roto tumba el bloque a lo de fabrica, como un contenido roto', () => {
  const publicado = {
    bloques: {
      lema: { contenido: LEMA, diseno: { colorFondo: 'url(x)' } },
      comunicados: {
        contenido: FABRICA_DE_PORTADA.comunicados,
        diseno: { colorTitulo: '#FFFFFF' },
      },
    },
  };
  const portada = resolverPortada({
    publicado,
    fabrica: FABRICA_DE_PORTADA,
    pantalla: 'principal',
  });

  assert.equal(portada.lema.origen, ORIGEN_DEL_BLOQUE.codigo);
  assert.deepEqual(portada.lema.diseno, {});
  assert.equal(portada.comunicados.origen, ORIGEN_DEL_BLOQUE.designer);
  assert.deepEqual(portada.comunicados.diseno, { colorTitulo: '#FFFFFF' });
});

test('cada tarjeta lee su diseño y la portada se lo pasa', () => {
  const vista = leer('src/sections/principal/view/principal-home-view.jsx');

  bloquesPublicablesDe('principal').forEach(({ id }) => {
    const acceso = /^[a-z]+$/.test(id) ? `portada.${id}` : `portada\\['${id}'\\]`;

    assert.match(vista, new RegExp(`diseno=\\{${acceso}\\.diseno\\}`), id);
  });
});

// ----------------------------------------------------------------------
// 2. CAMPAÑAS Y AUDIENCIA
// ----------------------------------------------------------------------

const campana = (cambios = {}) => ({
  id: 'campana-uno',
  idBloque: 'lema',
  nombre: 'Investidura',
  desde: '2026-10-01',
  hasta: '2026-10-15',
  contenido: LEMA,
  diseno: {},
  audiencia: { tipo: 'todos' },
  creadoEn: '2026-09-16T12:00:00.000Z',
  ...cambios,
});

test('una campaña solo esta en curso entre sus dos fechas, las dos incluidas', () => {
  const limpia = sanearCampana(campana());

  assert.equal(estadoDeCampana(limpia, '2026-09-30'), 'programada');
  assert.equal(estadoDeCampana(limpia, '2026-10-01'), 'vigente');
  assert.equal(estadoDeCampana(limpia, '2026-10-15'), 'vigente');
  assert.equal(estadoDeCampana(limpia, '2026-10-16'), 'terminada');
});

test('una campaña rota no existe: fechas al reves, bloque externo, contenido o diseño mal', () => {
  assert.equal(sanearCampana(campana({ hasta: '2026-09-01' })), null);
  assert.equal(sanearCampana(campana({ idBloque: 'encabezado-tienda' })), null);
  assert.equal(sanearCampana(campana({ contenido: { titulo: '' } })), null);
  assert.equal(sanearCampana(campana({ diseno: { colorFondo: 'rojo' } })), null);
  assert.equal(sanearCampana(campana({ id: 'Con Espacios' })), null);
  assert.equal(sanearCampana(campana({ audiencia: { tipo: 'regiones', ids: [] } })), null);
  assert.deepEqual(campanasDe({ campanas: { a: campana({ hasta: '2020-01-01' }), b: 'x' } }), []);
});

test('la audiencia: todos, o solo quien es de esas regiones o destacamentos', () => {
  const regiones = sanearAudiencia({
    tipo: 'regiones',
    ids: ['3', '5'],
    nombres: ['Norte', 'Sur'],
  });

  assert.equal(alcanzaA({ tipo: 'todos' }, {}), true);
  assert.equal(alcanzaA(regiones, { idRegion: '5' }), true);
  assert.equal(alcanzaA(regiones, { idRegion: '4' }), false);
  // Sin saber donde esta, una campaña acotada no le llega.
  assert.equal(alcanzaA(regiones, {}), false);
  assert.equal(
    alcanzaA(sanearAudiencia({ tipo: 'destacamentos', ids: ['233'] }), { idDestacamento: '233' }),
    true
  );
  assert.equal(sanearAudiencia({ tipo: 'regiones', ids: ['<script>'] }), null);
  assert.equal(sanearAudiencia({ tipo: 'secciones', ids: ['1'] }), null);
});

test('la portada: campaña vigente para esa persona → lo publicado → lo de fabrica', () => {
  const publicado = {
    bloques: { lema: { contenido: { titulo: 'Publicado', pie: '' } } },
    campanas: {
      norte: campana({
        id: 'norte',
        contenido: { titulo: 'Solo el Norte', pie: '' },
        audiencia: { tipo: 'regiones', ids: ['3'] },
      }),
    },
  };
  const resolver = (hoy, quien) =>
    resolverPortada({ publicado, fabrica: FABRICA_DE_PORTADA, pantalla: 'principal', hoy, quien })
      .lema;

  assert.equal(resolver('2026-10-05', { idRegion: '3' }).origen, ORIGEN_DEL_BLOQUE.campana);
  assert.equal(resolver('2026-10-05', { idRegion: '3' }).contenido.titulo, 'Solo el Norte');
  assert.equal(resolver('2026-10-05', { idRegion: '3' }).idCampana, 'norte');
  assert.equal(resolver('2026-10-05', { idRegion: '7' }).contenido.titulo, 'Publicado');
  assert.equal(resolver('2026-10-20', { idRegion: '3' }).contenido.titulo, 'Publicado');
  // Sin dia (el primer pintado, o el Designer), las campañas no se miran.
  assert.equal(resolver(undefined, { idRegion: '3' }).contenido.titulo, 'Publicado');
});

test('con dos campañas a la vez gana la que empezo mas tarde', () => {
  const larga = sanearCampana(campana({ id: 'mes', desde: '2026-10-01', hasta: '2026-10-31' }));
  const corta = sanearCampana(campana({ id: 'semana', desde: '2026-10-10', hasta: '2026-10-16' }));

  assert.equal(
    campanaVigente({ campanas: [larga, corta], idBloque: 'lema', hoy: '2026-10-12' }).id,
    'semana'
  );
  assert.equal(
    campanaVigente({ campanas: [larga, corta], idBloque: 'lema', hoy: '2026-10-20' }).id,
    'mes'
  );
});

test('programar una campaña explica lo que falta', () => {
  const base = {
    idBloque: 'lema',
    nombre: 'Investidura',
    desde: '2026-10-01',
    hasta: '2026-10-15',
    contenido: LEMA,
    usuario: { uid: 'u', displayName: 'Admin' },
    ahora: new Date('2026-09-16T12:00:00.000Z'),
  };

  assert.throws(() => prepararCampana({ ...base, nombre: '' }), /nombre/);
  assert.throws(() => prepararCampana({ ...base, desde: '' }), /empieza/);
  assert.throws(() => prepararCampana({ ...base, hasta: '2026-09-01' }), /antes de empezar/);
  assert.throws(
    () => prepararCampana({ ...base, audiencia: { tipo: 'regiones', ids: [] } }),
    /región o un destacamento/
  );

  const lista = prepararCampana(base);

  assert.match(lista.id, /^campana-/);
  assert.deepEqual(lista.audiencia, { tipo: 'todos' });
  assert.deepEqual(lista.creadoPor, { uid: 'u', nombre: 'Admin' });
});

test('el lector de la portada pasa la region y el destacamento de la sesion', () => {
  const vista = leer('src/sections/principal/view/principal-home-view.jsx');

  assert.match(vista, /const quien = useMemo\(\(\) => alcanceDeLaSesion\(user\), \[user\]\);/);
  assert.match(vista, /useContenidoDePortada\(\{ quien \}\)/);
});

// ----------------------------------------------------------------------
// 3. LOS LAPICES
// ----------------------------------------------------------------------

test('cada tarjeta de la portada lleva el lapiz al Designer para el Administrador Global', () => {
  const componentes = [
    'principal-bienvenida.jsx',
    'principal-actividad.jsx',
    'principal-lateral.jsx',
  ]
    .map((archivo) => leer(`src/sections/principal/${archivo}`))
    .join('\n');
  const vista = leer('src/sections/principal/view/principal-home-view.jsx');

  bloquesPublicablesDe('principal').forEach(({ id }) => {
    assert.match(componentes, new RegExp(`data-everest-bloque="${id}"`), id);
  });
  // Nueve bloques en la vista, cada uno con su permiso de editar.
  assert.equal(vista.match(/puedeEditar=\{esAdministradorGlobal\}/g)?.length, 9);
  assert.match(componentes, /<LapizDelDesigner/);
});

test('el lapiz de antes, que publicaba una foto en el acto, ya no existe', () => {
  const imagen = leer('src/sections/principal/imagen-de-tarjeta.jsx');

  assert.doesNotMatch(imagen, /LapizDeImagen|subirFotoEntidad|subirVideoEntidad|elegirFoto/);
  // Y la foto de hoy se sigue leyendo de donde siempre.
  assert.match(imagen, /obtenerFotoPrincipal\(/);
});

test('el lapiz lleva al bloque en el Designer y vuelve a la portada', () => {
  const lapiz = leer('src/sections/principal/lapiz-del-designer.jsx');

  assert.match(
    lapiz,
    /\$\{paths\.dashboard\.everest\}\?bloque=\$\{encodeURIComponent\(idBloque\)\}&volver=\$\{encodeURIComponent\(paths\.dashboard\.principal\)\}/
  );
});

// ----------------------------------------------------------------------
// 4. ANALITICAS
// ----------------------------------------------------------------------

test('las analiticas: solo contadores, sin comodin, y las lee el Administrador Global', () => {
  const reglas = leer('firestore.rules');
  const inicio = reglas.indexOf('match /everest_analiticas/{pantalla} {');
  const bloque = reglas.slice(inicio, reglas.indexOf('\n    }', inicio));

  assert.ok(inicio > 0);
  assert.match(bloque, /allow read: if esAdministradorGlobal\(\);/);
  assert.match(
    bloque,
    /request\.resource\.data\.keys\(\)\.hasOnly\(\['bloques', 'campanas', 'actualizadoEn'\]\)/
  );
  assert.match(bloque, /allow delete: if false;/);
  assert.match(reglas, /&& coleccion != 'everest_analiticas'/);
  assert.match(leer('eslint.config.mjs'), /'src\/services\/everest-analiticas-service\.js',/);
});

test('se cuenta con increment, una vez por sesion, y el Administrador Global no cuenta', () => {
  const servicio = leer('src/services/everest-analiticas-service.js');
  const vista = leer('src/sections/principal/view/principal-home-view.jsx');

  assert.match(servicio, /increment\(1\)/);
  assert.match(servicio, /sessionStorage/);
  // No guarda quien miro: ni su uid, ni su nombre, ni la sesion.
  assert.doesNotMatch(servicio, /uid|displayName|usuario|useAuthContext/);
  assert.match(
    vista,
    /useAnaliticasDePortada\(\{ raizRef, portada, activo: !esAdministradorGlobal \}\)/
  );
});

// ----------------------------------------------------------------------
// 5. AVISOS DE COMUNICADOS
// ----------------------------------------------------------------------

test('solo se avisa de los comunicados que no estaban', () => {
  const antes = [
    { clave: 'a', titulo: 'A' },
    { clave: 'b', titulo: 'B' },
  ];

  assert.deepEqual(comunicadosNuevos(antes, [antes[1], antes[0]]), []);
  assert.deepEqual(comunicadosNuevos(antes, [{ ...antes[0], titulo: 'A corregido' }]), []);
  assert.deepEqual(comunicadosNuevos(antes, [...antes, { clave: 'c', titulo: 'C' }]), [
    { clave: 'c', titulo: 'C' },
  ]);
  assert.deepEqual(comunicadosNuevos(undefined, [{ clave: 'c', titulo: 'C' }]).length, 1);
});

test('el aviso nunca tumba la publicacion y va a toda la organizacion', () => {
  const servicio = leer('src/services/everest-service.js');
  const avisar = servicio.slice(servicio.indexOf('const avisarComunicados'));

  assert.match(avisar.slice(0, 600), /try \{[\s\S]*\} catch \(error\) \{/);
  assert.match(
    leer('src/services/notification-service.js'),
    /tipoNotificacion: 'comunicado_publicado',[\s\S]{0,200}rolDestinatario: 'todos',/
  );
  assert.match(leer('src/utils/firebase-notificaciones.js'), /comunicado_publicado: \{/);
});

// ----------------------------------------------------------------------
// 6. LA BIBLIOTECA
// ----------------------------------------------------------------------

test('la biblioteca lee la carpeta everest/ de Storage, solo para el Administrador Global', () => {
  const servicio = leer('src/services/everest-medios-service.js');
  const biblioteca = servicio.slice(
    servicio.indexOf('export async function listarBibliotecaDeMedios')
  );

  assert.match(biblioteca, /if \(!isAdminGlobal\(usuario\)\)/);
  assert.match(biblioteca, /listAll\(/);
  assert.match(biblioteca, /`\$\{CARPETA_MEDIOS_EXPLORA\}\/\$\{bloque\.id\}`/);
  assert.doesNotMatch(biblioteca, /principal-tarjetas/);
});
