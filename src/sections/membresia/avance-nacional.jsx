'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';

import logoOficina from 'src/assets/marca/logo-oficina-nacional.webp';

import { Iconify } from 'src/components/iconify';

const REGIONES = [
  {
    nombre: 'Región Sur',
    corto: 'Sur',
    color: '#ff3e47',
    x: 300,
    y: 232,
    lado: 'izquierda',
    filas: 13,
  },
  {
    nombre: 'Región Central',
    corto: 'Central',
    color: '#087dff',
    x: 574,
    y: 232,
    lado: 'derecha',
    filas: 13,
  },
  {
    nombre: 'Región Este',
    corto: 'Este',
    color: '#43d10b',
    x: 300,
    y: 608,
    lado: 'izquierda',
    filas: 7,
  },
  {
    nombre: 'Región Norte',
    corto: 'Norte',
    color: '#ffe317',
    x: 574,
    y: 608,
    lado: 'derecha',
    filas: 7,
  },
];
const FONDO = '#171b27';
const PISTA = '#2b3245';

function porcentaje(parte, total) {
  return total > 0 ? (parte / total) * 100 : 0;
}

function mesEnCurso() {
  const partes = new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Santo_Domingo',
  }).formatToParts(new Date());
  const anio = partes.find((parte) => parte.type === 'year')?.value;
  const mesNumero = partes.find((parte) => parte.type === 'month')?.value;
  return {
    periodo: `${anio}-${mesNumero}`,
    mes: new Intl.DateTimeFormat('es-DO', {
      month: 'long',
      timeZone: 'America/Santo_Domingo',
    }).format(new Date()),
  };
}

function Anillo({ x, y, radio, grosor, valor, color }) {
  const perimetro = 2 * Math.PI * radio;
  return (
    <g aria-hidden="true">
      <circle cx={x} cy={y} r={radio} fill="none" stroke={PISTA} strokeWidth={grosor} />
      {valor > 0 ? (
        <circle
          cx={x}
          cy={y}
          r={radio}
          fill="none"
          stroke={color}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={perimetro}
          strokeDashoffset={perimetro * (1 - Math.min(valor, 100) / 100)}
          transform={`rotate(-90 ${x} ${y})`}
        />
      ) : (
        <circle cx={x} cy={y - radio} r={grosor / 2} fill={color} />
      )}
    </g>
  );
}

function LineaMes({ region, y, mes }) {
  const anchoMes = Math.max(62, mes.length * 9 + 14);
  return (
    <g>
      <line
        x1={region.lado === 'izquierda' ? 8 : 687}
        x2={region.lado === 'izquierda' ? 177 : 849}
        y1={y + 10}
        y2={y + 10}
        stroke={region.color}
        strokeWidth="1.5"
        opacity="0.75"
      />
      <rect
        x={region.lado === 'izquierda' ? 8 : 849 - anchoMes}
        y={y + 1}
        width={anchoMes}
        height="22"
        fill="#075e43"
      />
      <text
        x={region.lado === 'izquierda' ? 8 + anchoMes / 2 : 849 - anchoMes / 2}
        y={y + 17}
        textAnchor="middle"
        fill="#24b6a4"
        fontSize="15"
        letterSpacing="0"
      >
        {mes.charAt(0).toUpperCase() + mes.slice(1)}
      </text>
    </g>
  );
}

function ListaDestacamentos({ fila, region }) {
  const registros = fila?.destacamentos || [];
  const actual = mesEnCurso();
  if (!registros.length && !actual) return null;

  const x = region.lado === 'izquierda' ? 95 : 720;
  const baseY = region.y < 400 ? 151 : 603;
  const visibles = registros.slice(0, region.filas);
  const mostrarMesActual =
    actual && visibles.at(-1)?.periodo !== actual.periodo && visibles.length < region.filas;
  return (
    <g fontFamily="Barlow, sans-serif" fontWeight="700" fontSize="19" letterSpacing="3">
      {visibles.map((registro, indice) => {
        const y = baseY + indice * 19;
        const cierraMes =
          registro.mes &&
          (indice === visibles.length - 1 || registro.periodo !== visibles[indice + 1].periodo);
        return (
          <g key={`${registro.numero}-${indice}`}>
            {cierraMes && <LineaMes region={region} y={y} mes={registro.mes} />}
            <text x={x} y={y} fill={region.color}>
              #{String(registro.numero).padStart(3, '0')}
            </text>
            {registro.nuevo && (
              <text
                x={region.lado === 'izquierda' ? 43 : 797}
                y={y - 1}
                textAnchor={region.lado === 'izquierda' ? 'middle' : 'start'}
                fill="#687399"
                fontSize="12"
                letterSpacing="0"
              >
                *Nuevo
              </text>
            )}
          </g>
        );
      })}
      {mostrarMesActual && (
        <LineaMes region={region} y={baseY + visibles.length * 19} mes={actual.mes} />
      )}
      {registros.length > visibles.length && (
        <text
          x={x}
          y={baseY + visibles.length * 19}
          fill={region.color}
          fontSize="15"
          letterSpacing="0"
        >
          +{registros.length - visibles.length} más
        </text>
      )}
    </g>
  );
}

function Region({ region, fila }) {
  const cuota = porcentaje(fila?.pagadas || 0, fila?.total || 0);
  const etiquetaX = region.lado === 'izquierda' ? 116 : 753;
  const etiquetaY = region.y < 400 ? 66 : 529;
  const logoSize = region.nombre === 'Región Norte' ? 152 : 168;
  return (
    <g>
      <circle cx={etiquetaX} cy={etiquetaY} r="10" fill={region.color} />
      <text
        x={etiquetaX}
        y={etiquetaY + 32}
        fill={region.color}
        textAnchor="middle"
        fontFamily="Barlow, sans-serif"
        fontWeight="800"
        fontSize="21"
        fontStyle="italic"
        letterSpacing="3"
      >
        <tspan x={etiquetaX}>Región</tspan>
        <tspan x={etiquetaX} dy="23">
          {region.corto}
        </tspan>
      </text>
      <Anillo
        x={region.x}
        y={region.y}
        radio={111}
        grosor={20}
        valor={cuota}
        color={region.color}
      />
      {fila?.logoUrl ? (
        <g>
          <clipPath id={`emblema-${region.corto.toLowerCase()}`}>
            <circle cx={region.x} cy={region.y} r={logoSize / 2} />
          </clipPath>
          <image
            href={fila.logoUrl}
            x={region.x - logoSize / 2}
            y={region.y - logoSize / 2}
            width={logoSize}
            height={logoSize}
            preserveAspectRatio="xMidYMid meet"
            clipPath={`url(#emblema-${region.corto.toLowerCase()})`}
            aria-label={`Emblema de ${region.nombre}`}
          />
        </g>
      ) : (
        <text x={region.x} y={region.y + 7} textAnchor="middle" fill={region.color} fontSize="24">
          {region.corto}
        </text>
      )}
      {fila?.pagadas > 0 && (
        <text
          x={region.x}
          y={region.y + 100}
          textAnchor="middle"
          fill={region.color}
          fontFamily="Barlow, sans-serif"
          fontWeight="800"
          fontSize="22"
          fontStyle="italic"
        >
          {fila.pagadas}
        </text>
      )}
      <ListaDestacamentos fila={fila} region={region} />
    </g>
  );
}

function Nacional({ filas }) {
  return (
    <g>
      {REGIONES.map((region, indice) => {
        const fila = filas.find((item) => item.region === region.nombre);
        const cuota = porcentaje(fila?.pagadas || 0, fila?.total || 0);
        return (
          <g key={region.nombre}>
            <Anillo
              x={1201}
              y={420}
              radio={330 - indice * 52}
              grosor={32}
              valor={cuota}
              color={region.color}
            />
            <text
              x="1124"
              y={107 + indice * 54}
              fill={region.color}
              fontFamily="Barlow, sans-serif"
              fontWeight="800"
              fontSize="32"
              textAnchor="middle"
            >
              {Math.round(cuota)}%
            </text>
          </g>
        );
      })}
      <image
        href={logoOficina.src}
        x="1073"
        y="293"
        width="256"
        height="256"
        preserveAspectRatio="xMidYMid meet"
        aria-label="Oficina Nacional de Exploradores del Rey"
      />
      <text
        fill="#515a70"
        fontFamily="Barlow, sans-serif"
        fontSize="22"
        fontWeight="700"
        letterSpacing="0.4"
      >
        <textPath href="#leyenda-nacional" startOffset="50%" textAnchor="middle">
          *Inscritos por regiones, avance en % · 2027
        </textPath>
      </text>
    </g>
  );
}

function LineaMesMovil({ aLaIzquierda, y, mes, color }) {
  return (
    <g>
      <line
        x1={aLaIzquierda ? 8 : 280}
        x2={aLaIzquierda ? 120 : 392}
        y1={y + 8}
        y2={y + 8}
        stroke={color}
        strokeWidth="1"
      />
      <text
        x={aLaIzquierda ? 8 : 392}
        y={y + 23}
        textAnchor={aLaIzquierda ? 'start' : 'end'}
        fill="#24b6a4"
        fontSize="11"
        fontWeight="700"
      >
        {mes.charAt(0).toUpperCase() + mes.slice(1)}
      </text>
    </g>
  );
}

function RegionMovil({ region, fila, indice }) {
  const aLaIzquierda = indice % 2 === 0;
  const x = aLaIzquierda ? 270 : 130;
  const y = 145 + indice * 310;
  const etiquetaX = aLaIzquierda ? 53 : 347;
  const registros = (fila?.destacamentos || []).slice(0, 12);
  const actual = mesEnCurso();
  const mostrarMesActual =
    actual && registros.at(-1)?.periodo !== actual.periodo && registros.length < 12;
  return (
    <g>
      <circle cx={etiquetaX} cy={y - 100} r="8" fill={region.color} />
      <text
        x={etiquetaX}
        y={y - 76}
        textAnchor="middle"
        fill={region.color}
        fontFamily="Barlow, sans-serif"
        fontStyle="italic"
        fontWeight="800"
        fontSize="17"
        letterSpacing="2"
      >
        <tspan x={etiquetaX}>Región</tspan>
        <tspan x={etiquetaX} dy="20">
          {region.corto}
        </tspan>
      </text>
      <Anillo
        x={x}
        y={y}
        radio={94}
        grosor={17}
        valor={porcentaje(fila?.pagadas || 0, fila?.total || 0)}
        color={region.color}
      />
      {fila?.logoUrl && (
        <g>
          <clipPath id={`emblema-movil-${region.corto.toLowerCase()}`}>
            <circle cx={x} cy={y} r="68" />
          </clipPath>
          <image
            href={fila.logoUrl}
            x={x - 68}
            y={y - 68}
            width="136"
            height="136"
            preserveAspectRatio="xMidYMid meet"
            clipPath={`url(#emblema-movil-${region.corto.toLowerCase()})`}
          />
        </g>
      )}
      {fila?.pagadas > 0 && (
        <text
          x={x}
          y={y + 88}
          textAnchor="middle"
          fill={region.color}
          fontSize="18"
          fontWeight="800"
        >
          {fila.pagadas}
        </text>
      )}
      {registros.map((registro, posicion) => {
        const filaY = y - 56 + posicion * 17;
        const cierraMes =
          registro.mes &&
          (posicion === registros.length - 1 ||
            registro.periodo !== registros[posicion + 1].periodo);
        return (
          <g key={`${registro.numero}-${posicion}`}>
            <text
              x={aLaIzquierda ? 35 : 282}
              y={filaY}
              fill={region.color}
              fontFamily="Barlow, sans-serif"
              fontWeight="800"
              fontSize="16"
              letterSpacing="1.5"
            >
              #{String(registro.numero).padStart(3, '0')}
            </text>
            {registro.nuevo && (
              <text x={aLaIzquierda ? 7 : 350} y={filaY - 1} fill="#687399" fontSize="9">
                *Nuevo
              </text>
            )}
            {cierraMes && (
              <LineaMesMovil
                aLaIzquierda={aLaIzquierda}
                y={filaY}
                mes={registro.mes}
                color={region.color}
              />
            )}
          </g>
        );
      })}
      {mostrarMesActual && (
        <LineaMesMovil
          aLaIzquierda={aLaIzquierda}
          y={y - 56 + registros.length * 17}
          mes={actual.mes}
          color={region.color}
        />
      )}
      {(fila?.destacamentos?.length || 0) > 12 && (
        <text x={aLaIzquierda ? 35 : 282} y={y + 165} fill={region.color} fontSize="13">
          +{fila.destacamentos.length - 12} más
        </text>
      )}
    </g>
  );
}

function NacionalMovil({ filas }) {
  return (
    <g>
      {REGIONES.map((region, indice) => {
        const fila = filas.find((item) => item.region === region.nombre);
        const cuota = porcentaje(fila?.pagadas || 0, fila?.total || 0);
        return (
          <g key={region.nombre}>
            <Anillo
              x={200}
              y={1580}
              radio={176 - indice * 32}
              grosor={17}
              valor={cuota}
              color={region.color}
            />
            <text
              x="157"
              y={1413 + indice * 32}
              fill={region.color}
              fontFamily="Barlow, sans-serif"
              fontSize="21"
              fontWeight="800"
              textAnchor="middle"
            >
              {Math.round(cuota)}%
            </text>
          </g>
        );
      })}
      <image href={logoOficina.src} x="143" y="1523" width="114" height="114" />
      <text fill="#515a70" fontFamily="Barlow, sans-serif" fontSize="13" fontWeight="700">
        <textPath href="#leyenda-movil" startOffset="50%" textAnchor="middle">
          *Inscritos por regiones, avance en % · 2027
        </textPath>
      </text>
    </g>
  );
}

export function AvanceNacional() {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState(false);
  const escritorioRef = useRef(null);
  const movilRef = useRef(null);

  useEffect(() => {
    fetch('/api/estadisticas/')
      .then((respuesta) => (respuesta.ok ? respuesta.json() : Promise.reject(respuesta)))
      .then((datos) => setFilas(Array.isArray(datos) ? datos : []))
      .catch(() => setError(true));
  }, []);

  if (error)
    return (
      <Alert severity="warning">No se pudo calcular el avance nacional. Intenta más tarde.</Alert>
    );
  if (!filas) return <Skeleton variant="rectangular" height={680} />;

  async function descargarImagen() {
    setDescargando(true);
    setErrorDescarga(false);
    let svgUrl;
    let pngUrl;
    try {
      const movil = window.matchMedia('(max-width: 899.95px)').matches;
      const original = movil ? movilRef.current : escritorioRef.current;
      const copia = original.cloneNode(true);
      copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const imagenes = [...copia.querySelectorAll('image')];
      const logosRemotos = imagenes.some((imagen) =>
        imagen.getAttribute('href')?.startsWith('https://')
      );
      let logos = {};
      if (logosRemotos) {
        const respuesta = await fetch('/api/estadisticas/?imagenes=1');
        if (!respuesta.ok) throw new Error('No se pudieron cargar los emblemas regionales');
        logos = await respuesta.json();
      }
      await Promise.all(
        imagenes.map(async (imagen) => {
          const origen = imagen.getAttribute('href');
          if (origen.startsWith('https://')) {
            if (!logos[origen]) throw new Error('Falta un emblema regional');
            imagen.setAttribute('href', logos[origen]);
            return;
          }
          const respuesta = await fetch(origen);
          if (!respuesta.ok) throw new Error('No se pudo cargar el emblema nacional');
          const archivo = await respuesta.blob();
          const dataUrl = await new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(lector.result);
            lector.onerror = reject;
            lector.readAsDataURL(archivo);
          });
          imagen.setAttribute('href', dataUrl);
        })
      );

      const ancho = movil ? 400 : 1600;
      const alto = movil ? 1840 : 810;
      const svg = new Blob([new XMLSerializer().serializeToString(copia)], {
        type: 'image/svg+xml;charset=utf-8',
      });
      svgUrl = URL.createObjectURL(svg);
      const imagen = new Image();
      await new Promise((resolve, reject) => {
        imagen.onload = resolve;
        imagen.onerror = reject;
        imagen.src = svgUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = ancho * 2;
      canvas.height = alto * 2;
      const contexto = canvas.getContext('2d');
      if (!contexto) throw new Error('No se pudo crear la imagen');
      contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
      const png = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (archivo) => (archivo ? resolve(archivo) : reject(new Error('No se pudo crear el PNG'))),
          'image/png'
        );
      });
      pngUrl = URL.createObjectURL(png);
      const enlace = document.createElement('a');
      enlace.href = pngUrl;
      enlace.download = 'avance-nacional-onerrd-2027.png';
      enlace.click();
    } catch (errorAlDescargar) {
      console.error('[avance nacional] Descarga de imagen:', errorAlDescargar);
      setErrorDescarga(true);
    } finally {
      if (svgUrl) URL.revokeObjectURL(svgUrl);
      if (pngUrl) setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      setDescargando(false);
    }
  }

  return (
    <Box
      aria-label="Infografía del avance nacional"
      sx={{
        width: '100%',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: FONDO,
        position: 'relative',
      }}
    >
      <IconButton
        onClick={descargarImagen}
        disabled={descargando}
        aria-label="Descargar imagen del avance nacional"
        title="Descargar imagen"
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1,
          color: '#fff',
          bgcolor: 'rgba(43, 50, 69, 0.85)',
          '&:hover': { bgcolor: '#2b3245' },
        }}
      >
        {descargando ? (
          <CircularProgress size={20} color="inherit" />
        ) : (
          <Iconify icon="solar:download-bold" width={22} />
        )}
      </IconButton>
      {errorDescarga && (
        <Alert
          severity="error"
          onClose={() => setErrorDescarga(false)}
          sx={{ position: 'absolute', top: 60, right: 12, zIndex: 2 }}
        >
          No se pudo descargar la imagen. Intenta de nuevo.
        </Alert>
      )}
      <Box
        component="svg"
        ref={escritorioRef}
        viewBox="0 0 1600 810"
        role="img"
        aria-label="Registro de destacamentos 2027 por región"
        sx={{ display: { xs: 'none', md: 'block' }, width: '100%', height: 'auto' }}
      >
        <defs>
          <path id="leyenda-nacional" d="M 900 696 Q 1200 881 1502 696" />
        </defs>
        <rect width="1600" height="810" fill={FONDO} />
        {REGIONES.map((region) => (
          <Region
            key={region.nombre}
            region={region}
            fila={filas.find((fila) => fila.region === region.nombre)}
          />
        ))}
        <text
          x="437"
          y="405"
          textAnchor="middle"
          fill="#30384b"
          fontFamily="Barlow, sans-serif"
          fontWeight="800"
          fontSize="25"
        >
          <tspan x="437">DESTACAMENTOS</tspan>
          <tspan x="437" dy="29">
            REGISTRADOS
          </tspan>
        </text>
        <Nacional filas={filas} />
      </Box>
      <Box
        component="svg"
        ref={movilRef}
        viewBox="0 0 400 1840"
        role="img"
        aria-label="Registro de destacamentos 2027 por región"
        sx={{ display: { xs: 'block', md: 'none' }, width: '100%', height: 'auto' }}
      >
        <defs>
          <path id="leyenda-movil" d="M 24 1775 Q 200 1880 376 1775" />
        </defs>
        <rect width="400" height="1840" fill={FONDO} />
        {REGIONES.map((region, indice) => (
          <RegionMovil
            key={region.nombre}
            region={region}
            fila={filas.find((fila) => fila.region === region.nombre)}
            indice={indice}
          />
        ))}
        <text
          x="200"
          y="1335"
          textAnchor="middle"
          fill="#30384b"
          fontFamily="Barlow, sans-serif"
          fontWeight="800"
          fontSize="21"
        >
          DESTACAMENTOS REGISTRADOS
        </text>
        <NacionalMovil filas={filas} />
      </Box>
    </Box>
  );
}
