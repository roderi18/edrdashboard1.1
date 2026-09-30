'use client';

import { flushSync } from 'react-dom';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import { regionDe, provinciaEnMapa } from './portada';
import { MAPA_ALTO, MAPA_ANCHO, PROVINCIAS } from './mapa-provincias';

const ANCHO = 848;
const PALETA = {
  fondo: '#0c172b',
  tarjeta: '#142844',
  tarjetaClara: '#193459',
  linea: '#315884',
  blanco: '#f8faff',
  suave: '#c5d4e7',
  azul: '#3887f0',
  rojo: '#ed474c',
  verde: '#20c967',
  amarillo: '#f5b512',
};
const COLOR_REGION = {
  'Región Central': PALETA.azul,
  'Región Sur': PALETA.rojo,
  'Región Este': PALETA.verde,
  'Región Norte': PALETA.amarillo,
};
const ORDEN = ['Región Central', 'Región Sur', 'Región Este', 'Región Norte'];
const FILAS_POR_COLUMNA_REGION = 20;
const MENSAJES_REGIONALES = [
  {
    min: 0,
    max: 9,
    textos: [
      ['Inicio bajo. Conviene', 'convocar a los líderes', 'y completar lo urgente.'],
      ['La región necesita', 'activarse. Prioricen los', 'destacamentos sin envío.'],
      ['Aún hay mucho por', 'levantar. Un contacto', 'directo inicia el avance.'],
      ['Es momento de empujar', 'el arranque y definir', 'los primeros registros.'],
    ],
  },
  {
    min: 10,
    max: 24,
    textos: [
      ['La región ya comenzó.', 'Prioricen contactar a', 'los que faltan por enviar.'],
      ['Hay movimiento en la zona.', 'Un seguimiento directo', 'puede duplicar el avance.'],
      ['Buen arranque inicial.', 'Falta activar a los', 'destacamentos pendientes.'],
      ['El avance toma forma.', 'Mantengan el ritmo y', 'cierren registros cercanos.'],
    ],
  },
  {
    min: 25,
    max: 49,
    textos: [
      ['La región avanza firme.', 'Enfoquen esfuerzos en', 'los pendientes clave.'],
      ['Buen progreso regional.', 'Revisen la lista y asignen', 'responsables por zona.'],
      ['Ya hay base completada.', 'Ahora toca acelerar', 'el tramo medio.'],
      ['El avance es visible.', 'Un empuje coordinado', 'puede acercarlos a la mitad.'],
    ],
  },
  {
    min: 50,
    max: 100,
    textos: [
      ['La región marca avance', 'fuerte. Mantengan el', 'seguimiento hasta cerrar.'],
      ['Excelente progreso.', 'Ahora enfoquen energía', 'en los últimos pendientes.'],
      ['La meta está más cerca.', 'Cuiden que ningún', 'destacamento quede atrás.'],
      ['Gran respuesta regional.', 'Sostengan el ritmo hasta', 'completar el registro.'],
    ],
  },
];

function Rect({ x, y, width, height, fill = PALETA.tarjeta, stroke = PALETA.linea, rx = 8, ...rest }) {
  return <rect x={x} y={y} width={width} height={height} rx={rx} fill={fill} stroke={stroke} {...rest} />;
}

function Txt({ x, y, children, size = 12, color = PALETA.blanco, weight = 400, anchor, ...rest }) {
  return <text x={x} y={y} fill={color} fontSize={size} fontWeight={weight} textAnchor={anchor} fontFamily="Arial, Helvetica, sans-serif" {...rest}>{children}</text>;
}

function Lineas({ x, y, lineas, size = 12, salto = 17, color = PALETA.blanco, weight = 400 }) {
  return lineas.map((linea, i) => <Txt key={`${i}-${linea}`} x={x} y={y + i * salto} size={size} color={color} weight={weight}>{linea}</Txt>);
}

const porcentaje = (n, total) => total ? Math.round(n / total * 100) : 0;
const nombreCorto = (d) => d.numero ? `Dest. ${d.numero}` : d.nombre || 'Sin número';
const ordenar = (a, b) => (Number(a.numero) || 999999) - (Number(b.numero) || 999999) || nombreCorto(a).localeCompare(nombreCorto(b), 'es');

function envolverTexto(texto, maxCaracteres, maxLineas = 2) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const lineas = [];

  for (const palabra of palabras) {
    const actual = lineas[lineas.length - 1] || '';
    const siguiente = actual ? `${actual} ${palabra}` : palabra;

    if (!actual) {
      lineas.push(palabra);
    } else if (siguiente.length <= maxCaracteres) {
      lineas[lineas.length - 1] = siguiente;
    } else if (lineas.length < maxLineas) {
      lineas.push(palabra);
    } else {
      lineas[lineas.length - 1] = `${actual} ${palabra}`;
    }
  }

  return lineas.slice(0, maxLineas);
}

function mensajeRegional(pct, indiceRegion) {
  const rango = MENSAJES_REGIONALES.find(({ min, max }) => pct >= min && pct <= max);
  const textos = rango?.textos || MENSAJES_REGIONALES[0].textos;

  return textos[indiceRegion % textos.length];
}

function cuenta(cierre, servidorAhora, capturaAhora, mostrar) {
  if (!mostrar || !cierre || !servidorAhora) return null;
  const ms = Math.max(0, Date.parse(cierre) - (servidorAhora.servidor + capturaAhora - servidorAhora.cliente));
  if (!Number.isFinite(ms)) return null;
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
}

function MapaCatalogo({ enviados, y, alto }) {
  const porProvincia = useMemo(() => {
    const resultado = new Map();
    for (const d of enviados) {
      const nombre = provinciaEnMapa(d.direccion?.provincia);
      if (nombre) resultado.set(nombre, (resultado.get(nombre) || 0) + 1);
    }
    return resultado;
  }, [enviados]);

  return (
    <svg x="215" y={y} width="425" height={alto} viewBox={`-12 -12 ${MAPA_ANCHO + 24} ${MAPA_ALTO + 24}`} overflow="visible">
      <g filter="url(#map-shadow)">
        {PROVINCIAS.map((p) => (
          <path key={p.nombre} d={p.d} fill={COLOR_REGION[regionDe(p.nombre)?.nombre] || '#5f7890'} fillOpacity={porProvincia.has(p.nombre) ? 0.9 : 0.63} stroke="#e6eef5" strokeOpacity="0.78" strokeWidth="1.7" />
        ))}
      </g>
      {PROVINCIAS.filter((p) => porProvincia.has(p.nombre)).map((p) => (
        <g key={`pin-${p.nombre}`} transform={`translate(${p.centro[0]} ${p.centro[1]})`}>
          <circle r="14" fill="#fff" stroke="#163058" strokeWidth="2" />
          <Txt x={0} y={5} anchor="middle" color="#142844" size={14} weight={700}>{porProvincia.get(p.nombre)}</Txt>
        </g>
      ))}
    </svg>
  );
}

function Lamina({ padron, enviados, cuentaConfig, capturaAhora, imagenes, svgRef }) {
  const listas = Object.fromEntries(ORDEN.map((nombre) => [nombre, enviados.filter((d) => d.region === nombre).sort(ordenar)]));
  const totales = Object.fromEntries(ORDEN.map((nombre) => [nombre, padron.filter((d) => d.region === nombre).length]));
  const maxFilas = Math.max(...ORDEN.map((nombre) => Math.min(FILAS_POR_COLUMNA_REGION, listas[nombre].length || FILAS_POR_COLUMNA_REGION)));
  const altoTarjetas = Math.max(460, 74 + maxFilas * 22 + 129 + 38);
  const tarjetasBottom = 876 + altoTarjetas;
  const pieY = tarjetasBottom + 54;
  const alto = pieY + 54;
  const restantes = cuenta(cuentaConfig?.cierre, cuentaConfig?.ahora, capturaAhora, cuentaConfig?.mostrar);
  const actualizados = enviados.length;
  const pendientes = Math.max(0, padron.length - actualizados);
  const fecha = new Intl.DateTimeFormat('es-DO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Santo_Domingo' }).format(new Date(capturaAhora));

  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={ANCHO} height={alto} viewBox={`0 0 ${ANCHO} ${alto}`} style={{ display: 'block', width: '100%', height: 'auto' }} role="img" aria-label="Estado de actualización de destacamentos">
      <defs>
        <clipPath id="foto-intro"><rect x="50" y="162" width="747" height="76" /></clipPath>
        <clipPath id="foto-reloj"><rect x="51" y="335" width="328" height="108" /></clipPath>
        <clipPath id="foto-mapa"><rect x="207" y="494" width="433" height="312" rx="5" /></clipPath>
        <filter id="map-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#020a17" floodOpacity="0.65" /></filter>
      </defs>
      <rect width={ANCHO} height={alto} fill={PALETA.fondo} />
      <Rect x={14} y={14} width={820} height={alto - 29} fill="none" stroke="#24466f" rx={12} />

      <rect x={102} y={31} width={644} height={117} fill="#102a55" />
      {imagenes.logo && <image x={132} y={54} width={78} height={75} href={imagenes.logo} />}
      <Txt x={230} y={79} size={31} weight={800}>EXPLORADORES DEL REY</Txt>
      <Txt x={230} y={116} size={21} color={PALETA.suave} weight={700} letterSpacing={1}>EVANGELIZAR · EQUIPAR · EMPODERAR</Txt>

      <g clipPath="url(#foto-intro)">
        {imagenes.foto && <image x={50} y={162} width={747} height={235} href={imagenes.foto} preserveAspectRatio="xMidYMid slice" />}
        <rect x={50} y={162} width={747} height={76} fill="#183052" fillOpacity="0.8" />
      </g>
      <Lineas x={64} y={192} lineas={['Registra o actualiza la información de tu destacamento y ayúdanos a tener un', 'registro nacional completo y al día.']} size={19} salto={29} weight={500} />

      <Rect x={30} y={254} width={788} height={42} fill={PALETA.tarjetaClara} stroke="#4076b5" rx={5} />
      <Txt x={424} y={282} size={24} weight={700} anchor="middle">ESTATUS DE ACTUALIZACIÓN DE DESTACAMENTOS</Txt>

      <Rect x={30} y={310} width={371} height={158} />
      <g clipPath="url(#foto-reloj)">
        {imagenes.foto && <image x={51} y={335} width={328} height={170} href={imagenes.foto} preserveAspectRatio="xMidYMid slice" />}
        <rect x={51} y={335} width={328} height={108} fill="#172d51" fillOpacity="0.79" />
      </g>
      <Txt x={73} y={362} size={12} weight={700}>{restantes ? cuentaConfig.texto || 'Resta para finalizar la actualización:' : 'Estado del plazo de actualización:'}</Txt>
      {restantes ? restantes.map((valor, i) => {
        const x = 73 + i * 73;
        return <g key={i}>
          <Rect x={x} y={374} width={62} height={49} fill="#ffffff" fillOpacity="0.13" stroke="#ffffff" strokeOpacity="0.35" rx={8} />
          <Txt x={x + 31} y={402} size={23} weight={700} anchor="middle">{String(valor).padStart(2, '0')}</Txt>
          <Txt x={x + 31} y={415} size={10} anchor="middle" color={PALETA.suave}>{['Días', 'Horas', 'Minutos', 'Segundos'][i]}</Txt>
        </g>;
      }) : <Txt x={73} y={402} size={18} color={PALETA.suave}>No hay cuenta regresiva activa</Txt>}

      <Rect x={413} y={310} width={405} height={158} />
      <Txt x={430} y={332} size={13} weight={700}>AVANCE GENERAL POR REGIÓN</Txt>
      <Txt x={798} y={334} size={20} weight={700} color={PALETA.amarillo} anchor="end">{actualizados} Total</Txt>
      {ORDEN.map((nombre, i) => {
        const y = 355 + i * 26;
        const total = totales[nombre];
        const n = listas[nombre].length;
        return <g key={nombre}>
          <Txt x={430} y={y} size={11}>{nombre.replace('Región ', '')}</Txt>
          <Txt x={800} y={y} size={11} anchor="end" color={PALETA.suave}>{n} / {total} ({porcentaje(n, total)}%)</Txt>
          <rect x={430} y={y + 5} width={369} height={6} rx={3} fill="#263f62" />
          <rect x={430} y={y + 5} width={Math.max(n ? 5 : 0, 369 * n / (total || 1))} height={6} rx={3} fill={COLOR_REGION[nombre]} />
        </g>;
      })}

      <Rect x={30} y={482} width={159} height={336} />
      <rect x={30} y={482} width={159} height={29} rx={6} fill={PALETA.tarjetaClara} />
      <Txt x={44} y={502} size={14} weight={700}>MÉTRICAS CLAVE</Txt>
      {[
        ['UNIVERSO TOTAL', padron.length, 'Destacamentos convocados', PALETA.blanco],
        ['AVANCE NACIONAL', `${porcentaje(actualizados, padron.length)}%`, `${actualizados} de ${padron.length} registrados`, PALETA.azul],
        ['PENDIENTES', pendientes, 'Destacamentos aún por', PALETA.rojo],
      ].map(([titulo, valor, detalle, color], i) => {
        // 72 de alto (antes 62): la segunda línea de PENDIENTES caía fuera de la tarjeta.
        const y = 520 + i * 78;
        return <g key={titulo}>
          <Rect x={40} y={y} width={139} height={72} fill="#1d355a" stroke="#385e8c" rx={6} />
          <Txt x={48} y={y + 14} size={10} color={PALETA.suave}>{titulo}</Txt>
          <Txt x={48} y={y + 38} size={23} weight={700} color={color}>{valor}</Txt>
          <Txt x={48} y={y + 54} size={9} color={PALETA.suave}>{detalle}</Txt>
          {i === 2 && <Txt x={48} y={y + 64} size={9} color={PALETA.suave}>completar el formulario.</Txt>}
        </g>;
      })}
      <Txt x={43} y={796} size={10} color={PALETA.suave}>• Censo Nacional 2026</Txt>

      <Rect x={202} y={482} width={444} height={336} />
      <g clipPath="url(#foto-mapa)">
        {imagenes.foto && <image x={207} y={494} width={433} height={312} href={imagenes.foto} preserveAspectRatio="xMidYMid slice" />}
        <rect x={207} y={494} width={433} height={312} fill="#092340" fillOpacity="0.44" />
      </g>
      <MapaCatalogo enviados={enviados} y={517} alto={249} />
      <Rect x={497} y={516} width={114} height={57} fill="#132c51" stroke="#45678b" rx={10} />
      <Txt x={508} y={546} size={20} weight={700}>{actualizados}</Txt>
      <Txt x={508} y={561} size={10}>Dests. actualizados</Txt>
      {['Región Norte', 'Región Central', 'Región Sur', 'Región Este'].map((nombre, i) => {
        const x = 418 + i * 54;
        const emblema = imagenes.regiones?.[nombre];
        return <g key={nombre}>
          <circle cx={x} cy={751} r={13} fill="#17365b" />
          {emblema && <>
            <defs><clipPath id={`recorte-region-${i}`}><circle cx={x} cy={751} r={12} /></clipPath></defs>
            <image x={x - 12} y={739} width={24} height={24} href={emblema} preserveAspectRatio="xMidYMid slice" clipPath={`url(#recorte-region-${i})`} />
          </>}
          <circle cx={x} cy={751} r={13} fill="none" stroke={COLOR_REGION[nombre]} strokeWidth={2} />
          {!emblema && <Txt x={x} y={755} size={10} anchor="middle" weight={700}>{nombre.slice(7, 9).toUpperCase()}</Txt>}
          <Txt x={x} y={773} size={9} anchor="middle" weight={700}>{nombre.replace('Región ', '')}</Txt>
          <Txt x={x} y={784} size={9} anchor="middle">{listas[nombre].length} dest.</Txt>
        </g>;
      })}

      <Rect x={660} y={482} width={158} height={336} />
      <rect x={660} y={482} width={158} height={29} rx={6} fill={PALETA.tarjetaClara} />
      <Txt x={672} y={502} size={13} weight={700}>¿CÓMO ACTUALIZAR?</Txt>
      {[
        ['Accede al enlace', 'Usa el link oficial enviado', 'por tu coordinación.'],
        ['Datos de líderes', 'Registra comandante y', 'equipo pastoral.'],
        ['Envía tu reporte', 'Confirma membresía activa', 'y fecha de aniversario.'],
      ].map(([titulo, a, b], i) => {
        const y = 520 + i * 67;
        return <g key={titulo}>
          <Rect x={669} y={y} width={139} height={60} fill="#1d355a" stroke="#385e8c" rx={5} />
          <circle cx={684} cy={y + 16} r={10} fill={PALETA.azul} />
          <Txt x={684} y={y + 20} size={11} anchor="middle" weight={700}>{i + 1}</Txt>
          <Txt x={698} y={y + 20} size={10} weight={700}>{titulo}</Txt>
          <Lineas x={676} y={y + 39} lineas={[a, b]} size={9} salto={11} color={PALETA.suave} />
        </g>;
      })}
      <Rect x={669} y={728} width={139} height={77} fill="#193354" stroke={PALETA.amarillo} rx={5} />
      <Txt x={676} y={747} size={12} weight={700} color={PALETA.amarillo}>¡IMPORTANTE!</Txt>
      <Lineas x={676} y={763} lineas={['¡No te quedes fuera', 'del próximo reporte', 'oficial nacional!']} size={9} salto={11} />

      <Rect x={30} y={832} width={788} height={32} fill={PALETA.tarjetaClara} stroke="none" rx={5} />
      <Txt x={44} y={854} size={17} weight={700}>DESTACAMENTOS ACTUALIZADOS POR REGIÓN (TOTAL: {actualizados})</Txt>
      {ORDEN.map((nombre, i) => {
        const x = 30 + i * 201;
        const color = COLOR_REGION[nombre];
        const lista = listas[nombre];
        const total = totales[nombre];
        const pct = porcentaje(lista.length, total);
        const columnas = lista.length > FILAS_POR_COLUMNA_REGION
          ? [lista.slice(0, FILAS_POR_COLUMNA_REGION), lista.slice(FILAS_POR_COLUMNA_REGION)]
          : [lista];
        const filasVisibles = Math.min(FILAS_POR_COLUMNA_REGION, lista.length);
        const statusY = Math.max(1069, 926 + filasVisibles * 22 + 14);
        const statusH = 129;
        return <g key={nombre}>
          <Rect x={x} y={876} width={184} height={altoTarjetas} fill="#10223c" stroke={color} rx={7} />
          <rect x={x} y={876} width={184} height={32} rx={5} fill={color} />
          <Txt x={x + 10} y={896} size={13} weight={700} color={nombre === 'Región Norte' ? '#192c44' : PALETA.blanco}>{nombre.toUpperCase()} ({lista.length})</Txt>
          {lista.length ? columnas.map((columna, columnaIndex) => {
            const offsetX = columnaIndex * 87;
            return columna.map((d, j) => {
              const texto = nombreCorto(d);
              const dosColumnas = columnas.length > 1;
              const size = dosColumnas ? 8.5 : 11;
              const lineas = envolverTexto(texto, dosColumnas ? 13 : 22);
              return (
                <g key={d.id || `${nombre}-${columnaIndex}-${j}`}>
                  <path d={`M${x + 10 + offsetX} ${919 + j * 22} l7 4 -7 4 z`} fill={color} />
                  <Txt
                    x={x + 20 + offsetX}
                    y={924 + j * 22}
                    size={size}
                    weight={600}
                  >
                    {lineas.map((linea, lineaIndex) => (
                      <tspan key={linea} x={x + 20 + offsetX} dy={lineaIndex ? size + 1 : 0}>
                        {linea}
                      </tspan>
                    ))}
                  </Txt>
                </g>
              );
            });
          }) : <>
            <Rect x={x + 9} y={919} width={166} height={122} fill="#252323" stroke={color} rx={5} />
            <Txt x={x + 16} y={940} size={13} weight={700} color={color}>PENDIENTE REGISTRO</Txt>
            <Txt x={x + 16} y={961} size={11}>0 de {total} registrados</Txt>
            <Lineas x={x + 16} y={980} lineas={['¡Atención líderes de esta', 'región! Aún no hay', 'destacamentos registrados', 'en esta zona.']} size={10} salto={12} />
          </>}
          {lista.length > 0 ? <>
            <Rect x={x + 9} y={statusY} width={166} height={statusH} fill="#172c40" stroke={color} rx={5} />
            <Txt x={x + 16} y={statusY + 20} size={13} weight={700} color={color}>ESTATUS REGIONAL</Txt>
            <Txt x={x + 16} y={statusY + 41} size={11} weight={700}>{lista.length} de {total} registrados</Txt>
            <Txt x={x + 16} y={statusY + 59} size={11}>{pct}% de avance en la zona.</Txt>
            <Lineas x={x + 16} y={statusY + 81} lineas={mensajeRegional(pct, i)} size={10} salto={12} />
          </> : !lista.length ? <>
            <Rect x={x + 9} y={1055} width={166} height={142} fill="#19355b" stroke={color} rx={5} />
            <Txt x={x + 16} y={1076} size={13} weight={700} color={color}>¡SÉ EL PRIMERO!</Txt>
            <Lineas x={x + 16} y={1097} lineas={['¡Haz que tu destacamento', 'brille en el mapa!', '', 'Ingresa al formulario', 'y completa los datos hoy.']} size={10} salto={13} />
          </> : null}
          <Txt x={x + 10} y={876 + altoTarjetas - 17} size={10}>Meta: {lista.length} / {total} ({pct}%)</Txt>
        </g>;
      })}
      {/* Pie dentro del marco general, justo debajo de las tarjetas regionales. */}
      <rect x="14" y={pieY - 26} width="820" height="57" fill="#07111f" />
      <Txt x={424} y={pieY - 6} size={10} color={PALETA.suave} anchor="middle">Estado generado el {fecha} (hora de Santo Domingo)</Txt>
      <Txt x={424} y={pieY + 14} size={10} color={PALETA.suave} anchor="middle">Exploradores del Rey • República Dominicana • Proceso Oficial de Actualización de Destacamentos</Txt>
    </svg>
  );
}

async function pedirDatos() {
  const ahora = Date.now();
  const urls = ['/api/destacamentos/', '/api/envios/?fresco=1', '/api/cuenta-regresiva/'];
  const respuestas = await Promise.all(urls.map((url) => fetch(`${url}${url.includes('?') ? '&' : '?'}estado=${ahora}`, { cache: 'no-store' })));
  if (respuestas.some((r) => !r.ok)) throw new Error('No se pudo consultar el estado actual. Inténtalo de nuevo.');
  const [padron, enviados, config] = await Promise.all(respuestas.map((r) => r.json()));
  if (!Array.isArray(padron) || !Array.isArray(enviados)) throw new Error('La respuesta del servidor no contiene las listas esperadas.');
  return { padron, enviados, cuentaConfig: { ...config, ahora: { servidor: config.ahora, cliente: Date.now() } } };
}

async function comoDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = reject;
    lector.readAsDataURL(blob);
  });
}

async function pedirEmblemas() {
  const res = await fetch('/api/emblemas-region/', { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudieron cargar los emblemas regionales.');
  return res.json();
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function convertirEnCanvas(svg) {
  const copia = svg.cloneNode(true);
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const texto = new XMLSerializer().serializeToString(copia);
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const imagen = new Image();
    await new Promise((resolve, reject) => {
      imagen.onload = resolve;
      imagen.onerror = () => reject(new Error('No se pudo preparar la imagen para descargar.'));
      imagen.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = ANCHO * 2;
    canvas.height = Number(svg.getAttribute('height')) * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('El navegador no pudo crear el archivo.');
    ctx.scale(2, 2);
    ctx.drawImage(imagen, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function CatalogoEstado() {
  const svgRef = useRef(null);
  const descargaAutomatica = useRef(false);
  const [datos, setDatos] = useState(null);
  const [imagenes, setImagenes] = useState({});
  const [capturaAhora, setCapturaAhora] = useState(0);
  const [descargando, setDescargando] = useState(null);
  const [error, setError] = useState('');
  const ocupado = descargando !== null;

  const refrescar = useCallback(async () => {
    const nuevos = await pedirDatos();
    flushSync(() => {
      setDatos(nuevos);
      setCapturaAhora(Date.now());
    });
  }, []);

  useEffect(() => {
    refrescar().catch((e) => setError(e.message));
    Promise.all([comoDataUrl('/logo/emblema-erd.png'), comoDataUrl('/fotos/campamento-monitor-1920.webp'), pedirEmblemas().catch(() => ({}))])
      .then(([logo, foto, regiones]) => setImagenes({ logo, foto, regiones }))
      .catch((e) => setError(e.message));
  }, [refrescar]);

  const guardar = useCallback(async (formato) => {
    setDescargando(formato);
    setError('');
    try {
      await refrescar();
      if (!imagenes.logo || !imagenes.foto) throw new Error('Las imágenes aún no están listas. Inténtalo de nuevo.');
      const canvas = await convertirEnCanvas(svgRef.current);
      const nombre = `estado-destacamentos-${new Date().toISOString().slice(0, 10)}`;
      if (formato === 'png') {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('No se pudo crear el PNG.');
        descargar(blob, `${nombre}.png`);
      } else {
        const { jsPDF } = await import('jspdf');
        const alto = Number(svgRef.current.getAttribute('height'));
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [210, 210 * alto / ANCHO], compress: true });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 210 * alto / ANCHO);
        await pdf.save(`${nombre}.pdf`, { returnPromise: true });
      }
    } catch (e) {
      setError(e.message || 'No se pudo descargar el catálogo.');
    } finally {
      setDescargando(null);
    }
  }, [imagenes, refrescar]);

  useEffect(() => {
    if (!datos || !imagenes.logo || !imagenes.foto || descargaAutomatica.current) return;
    const formato = new URLSearchParams(window.location.search).get('descargar');
    if (formato !== 'pdf' && formato !== 'png') return;
    descargaAutomatica.current = true;
    window.history.replaceState({}, '', '/estado-actualizacion/');
    guardar(formato);
  }, [datos, guardar, imagenes]);

  return <main style={{ minHeight: '100vh', background: '#07111f', color: '#f8faff', padding: '20px 12px 50px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
    <style>{'@keyframes giroDescarga { to { transform: rotate(360deg); } }'}</style>
    <div style={{ maxWidth: 848, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <a href="/" style={{ color: '#c5d4e7', textDecoration: 'none' }}>← Volver al registro</a>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={ocupado} onClick={() => { setError(''); refrescar().catch((e) => setError(e.message)); }} style={boton('#24466f')}>Actualizar datos</button>
        <button type="button" disabled={ocupado || !datos} aria-busy={descargando === 'png'} onClick={() => guardar('png')} style={boton(PALETA.azul)}>
          {descargando === 'png' && <span aria-hidden="true" style={indicadorDescarga} />}
          {descargando === 'png' ? 'Preparando PNG…' : 'Descargar PNG'}
        </button>
        <button type="button" disabled={ocupado || !datos} aria-busy={descargando === 'pdf'} onClick={() => guardar('pdf')} style={boton(PALETA.rojo)}>
          {descargando === 'pdf' && <span aria-hidden="true" style={indicadorDescarga} />}
          {descargando === 'pdf' ? 'Preparando PDF…' : 'Descargar PDF'}
        </button>
      </div>
    </div>
    {error && <p role="alert" style={{ maxWidth: 848, margin: '0 auto 16px', color: '#ff989b' }}>{error}</p>}
    {!datos ? <p style={{ textAlign: 'center' }}>Cargando estado actual…</p> :
      <div style={{ maxWidth: 848, margin: '0 auto', boxShadow: '0 18px 45px rgba(0,0,0,.38)' }}>
        <Lamina {...datos} capturaAhora={capturaAhora} imagenes={imagenes} svgRef={svgRef} />
      </div>}
  </main>;
}

function boton(fondo) {
  return { background: fondo, color: '#fff', border: 0, borderRadius: 7, padding: '11px 15px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 38 };
}

const indicadorDescarga = { width: 15, height: 15, border: '2px solid rgba(255,255,255,.45)', borderTopColor: '#fff', borderRadius: '50%', animation: 'giroDescarga .7s linear infinite' };
