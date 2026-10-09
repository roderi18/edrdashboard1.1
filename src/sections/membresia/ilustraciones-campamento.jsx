'use client';

import { useId } from 'react';

import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// ILUSTRACIONES DEL CAMPAMENTO (portada). Dibujos con volumen —luz de un lado,
// sombra del otro, brillos y sombras en el suelo— hechos en SVG con los
// colores de la paleta de la casa: pesan unos pocos KB, no se pixelan en
// ninguna pantalla y no dependen de imágenes externas. Cada dibujo lleva sus
// propios ids (`useId`) para poder repetirse en la misma página.
// ----------------------------------------------------------------------

const useColores = () => {
  const { palette: p } = useTheme();
  return {
    noche: p.brand.navyDarker,
    navy: p.brand.navy,
    navyClaro: p.brand.navyLight,
    navyMas: p.brand.navyLighter,
    oro: p.brand.oro,
    oroClaro: p.brand.oroLight,
    oroMas: p.brand.oroLighter,
    oroOscuro: p.brand.oroDark,
    azul: p.primary.main,
    azulClaro: p.primary.light,
    azulOscuro: p.primary.dark,
    azulMas: p.primary.lighter,
    verde: p.success.dark,
    verdeClaro: p.success.main,
    verdeOscuro: p.success.darker,
    llamaMedia: p.warning.main,
    llamaRoja: p.error.main,
    madera: p.warning.darker,
    maderaClara: p.warning.dark,
    piedra: p.grey[500],
    piedraClara: p.grey[300],
    blanco: p.common.white,
  };
};

// LA LLAMA SE MUEVE: cada capa se estira y se ladea desde su base con su propio
// ritmo (así no laten a la vez), el resplandor respira y las chispas suben y se
// apagan. Quien pide menos movimiento en su sistema la ve quieta.
export const animacionFogata = {
  '@keyframes llamaBaila': {
    '0%, 100%': { transform: 'scale(1, 1) skewX(0deg)' },
    '25%': { transform: 'scale(0.96, 1.07) skewX(2deg)' },
    '50%': { transform: 'scale(1.03, 0.95) skewX(-2deg)' },
    '75%': { transform: 'scale(0.98, 1.04) skewX(1deg)' },
  },
  '@keyframes brilloRespira': {
    '0%, 100%': { opacity: 0.85, transform: 'scale(1)' },
    '50%': { opacity: 1, transform: 'scale(1.08)' },
  },
  '@keyframes chispaSube': {
    '0%': { opacity: 0, transform: 'translateY(30px)' },
    '20%': { opacity: 1 },
    '100%': { opacity: 0, transform: 'translateY(-30px)' },
  },
  '& .llama': {
    transformBox: 'fill-box',
    transformOrigin: '50% 100%',
    animation: 'llamaBaila 1.4s ease-in-out infinite',
  },
  '& .llama-medio': { animationDuration: '1.1s', animationDelay: '-0.3s' },
  '& .llama-dentro': { animationDuration: '0.9s', animationDelay: '-0.6s' },
  '& .brillo': {
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animation: 'brilloRespira 2.2s ease-in-out infinite',
  },
  '& .chispa': { animation: 'chispaSube 2.2s ease-out infinite' },
  '@media (prefers-reduced-motion: reduce)': {
    '& .llama, & .brillo, & .chispa': { animation: 'none' },
  },
};

const sinMovimiento = (selectores) => ({
  '@media (prefers-reduced-motion: reduce)': { [selectores]: { animation: 'none' } },
});

// La tienda: los pinos se mecen desde la base, la lona respira con el viento,
// la puerta se abre un poco y el banderín ondea.
export const animacionTienda = {
  '@keyframes pinoSeMece': {
    '0%, 100%': { transform: 'rotate(-5deg)' },
    '50%': { transform: 'rotate(5deg)' },
  },
  '@keyframes lonaRespira': {
    '0%, 100%': { transform: 'scale(1, 1)' },
    '50%': { transform: 'scale(1.05, 0.95)' },
  },
  '@keyframes puertaViento': {
    '0%, 100%': { transform: 'skewY(0deg)' },
    '50%': { transform: 'skewY(-14deg)' },
  },
  '@keyframes banderinOndea': {
    '0%, 100%': { transform: 'scale(1, 1) skewY(0deg)' },
    '50%': { transform: 'scale(0.75, 1.15) skewY(14deg)' },
  },
  '& .pino-copa, & .tienda-lona, & .tienda-puerta, & .banderin': {
    transformBox: 'fill-box',
    transformOrigin: '50% 100%',
  },
  '& .pino-copa': { animation: 'pinoSeMece 2.4s ease-in-out infinite' },
  '& .tienda-lona': { animation: 'lonaRespira 2.4s ease-in-out infinite' },
  '& .tienda-puerta': {
    transformOrigin: '0% 100%',
    animation: 'puertaViento 2.4s ease-in-out infinite',
  },
  '& .banderin': {
    transformOrigin: '0% 50%',
    animation: 'banderinOndea 1.2s ease-in-out infinite',
  },
  '@keyframes luciernagaVuela': {
    '0%, 100%': { transform: 'translate(0, 0)', opacity: 0.2 },
    '25%': { transform: 'translate(8px, -10px)', opacity: 1 },
    '50%': { transform: 'translate(-6px, -18px)', opacity: 0.4 },
    '75%': { transform: 'translate(10px, -6px)', opacity: 1 },
  },
  '& .luciernaga': {
    filter: 'drop-shadow(0 0 4px currentColor)',
    animation: 'luciernagaVuela 3s ease-in-out infinite',
  },
  ...sinMovimiento('& .pino-copa, & .tienda-lona, & .tienda-puerta, & .banderin, & .luciernaga'),
};

// El certificado: el certificado y la factura flotan a destiempo, la sombra se
// encoge cuando suben, el sello se balancea como colgado y su estrella brilla.
export const animacionCertificado = {
  '@keyframes papelFlota': {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-10px)' },
  },
  '@keyframes sombraFlota': {
    '0%, 100%': { transform: 'scaleX(1)', opacity: 0.15 },
    '50%': { transform: 'scaleX(0.9)', opacity: 0.1 },
  },
  '@keyframes selloBalancea': {
    '0%, 100%': { transform: 'rotate(-6deg)' },
    '50%': { transform: 'rotate(6deg)' },
  },
  '@keyframes estrellaBrilla': {
    '0%, 100%': { transform: 'scale(1)', opacity: 1 },
    '50%': { transform: 'scale(1.18)', opacity: 0.85 },
  },
  '& .flota-certificado, & .flota-factura, & .sombra, & .sello, & .estrella': {
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  '& .flota-certificado': { animation: 'papelFlota 4s ease-in-out infinite' },
  '& .flota-factura': { animation: 'papelFlota 4s ease-in-out infinite', animationDelay: '-2s' },
  '& .sombra': { animation: 'sombraFlota 4s ease-in-out infinite' },
  '& .sello': { transformOrigin: '50% 0%', animation: 'selloBalancea 3s ease-in-out infinite' },
  '& .estrella': { animation: 'estrellaBrilla 1.8s ease-in-out infinite' },
  ...sinMovimiento('& .flota-certificado, & .flota-factura, & .sombra, & .sello, & .estrella'),
};

// Un pino con volumen: cada piso tiene su cara iluminada y su cara en sombra.
function Pino({ x, y, escala = 1, c, ids, retraso = 0 }) {
  const pisos = [0, 1, 2];
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <rect x={-4} y={-6} width={8} height={18} rx={2} fill={c.madera} />
      <g className="pino-copa" style={{ animationDelay: `${retraso}s` }}>
        {pisos.map((i) => {
          const base = -i * 22;
          const ancho = 30 - i * 6;
          const alto = 38 - i * 4;
          return (
            <g key={i}>
              <polygon
                points={`0,${base - alto} ${-ancho},${base} 0,${base}`}
                fill={`url(#${ids.pinoLuz})`}
              />
              <polygon
                points={`0,${base - alto} ${ancho},${base} 0,${base}`}
                fill={`url(#${ids.pinoSombra})`}
              />
            </g>
          );
        })}
      </g>
    </g>
  );
}

// La fogata: piedras, troncos cruzados, tres llamas y chispas.
function FogataSvg({ cx, cy, escala = 1, c, ids, conBrillo = true }) {
  const piedras = [-34, -20, -5, 10, 25, 36].map((dx, i) => ({
    dx,
    dy: i % 2 ? 4 : 0,
    rx: 9 + (i % 3),
  }));
  return (
    <g transform={`translate(${cx} ${cy}) scale(${escala})`}>
      {conBrillo && <circle r={120} className="brillo" fill={`url(#${ids.brillo})`} />}
      <ellipse cx={0} cy={14} rx={58} ry={12} fill={c.noche} opacity={0.35} />
      {/* Troncos cruzados, con la punta clara del corte. */}
      <g>
        <rect
          x={-46}
          y={-2}
          width={92}
          height={13}
          rx={6.5}
          fill={`url(#${ids.tronco})`}
          transform="rotate(-14)"
        />
        <rect
          x={-46}
          y={-2}
          width={92}
          height={13}
          rx={6.5}
          fill={`url(#${ids.tronco})`}
          transform="rotate(14)"
        />
        <ellipse cx={-44} cy={-8} rx={4} ry={6.5} fill={c.oroClaro} transform="rotate(-14)" />
        <ellipse cx={44} cy={-8} rx={4} ry={6.5} fill={c.oroClaro} transform="rotate(14)" />
      </g>
      {/* Llamas: de fuera (roja) a dentro (casi blanca). */}
      <path
        d="M0,-96 C26,-58 40,-34 30,-8 C22,12 -22,12 -30,-8 C-40,-34 -18,-50 0,-96 Z"
        className="llama llama-fuera"
        fill={`url(#${ids.llamaFuera})`}
      />
      <path
        d="M-4,-70 C14,-46 24,-28 18,-10 C12,4 -14,4 -19,-10 C-24,-28 -12,-40 -4,-70 Z"
        className="llama llama-medio"
        fill={`url(#${ids.llamaMedio})`}
      />
      <path
        d="M2,-44 C12,-30 14,-20 10,-10 C6,-2 -8,-2 -10,-10 C-12,-20 -4,-28 2,-44 Z"
        className="llama llama-dentro"
        fill={c.oroMas}
      />
      {/* Chispas. */}
      {[
        [-22, -112, 2.2],
        [18, -128, 1.8],
        [34, -100, 1.5],
        [-8, -142, 1.4],
      ].map(([x, y, r], i) => (
        <circle
          key={`${x}${y}`}
          cx={x}
          cy={y}
          r={r}
          fill={c.oroClaro}
          className="chispa"
          style={{ animationDelay: `${i * 0.55}s` }}
        />
      ))}
      {piedras.map((p) => (
        <g key={p.dx}>
          <ellipse cx={p.dx} cy={8 + p.dy} rx={p.rx} ry={6.5} fill={c.piedra} />
          <ellipse
            cx={p.dx - 2}
            cy={6 + p.dy}
            rx={p.rx * 0.6}
            ry={3}
            fill={c.piedraClara}
            opacity={0.7}
          />
        </g>
      ))}
    </g>
  );
}

// Una tienda de campaña en prisma: cara de luz, cara de sombra, puerta abierta.
function TiendaSvg({ x, y, escala = 1, c, ids }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <ellipse cx={30} cy={4} rx={118} ry={14} fill={c.noche} opacity={0.35} />
      {/* Banderín en el mástil. */}
      <path className="banderin" d="M0,-132 L26,-126 L0,-118 Z" fill={c.oro} />
      <g className="tienda-lona">
        {/* Lado largo (en sombra), hacia atrás. */}
        <polygon points="0,-118 120,-96 150,0 -10,0" fill={`url(#${ids.tiendaSombra})`} />
        {/* Frente (con la luz de la fogata). */}
        <polygon points="0,-118 -82,0 82,0" fill={`url(#${ids.tiendaLuz})`} />
      </g>
      {/* Puerta abierta con luz dentro. */}
      <polygon points="0,-90 -34,0 34,0" fill={c.noche} />
      <polygon points="0,-90 -34,0 -6,0" fill={c.oroOscuro} opacity={0.55} />
      <polygon
        className="tienda-puerta"
        points="0,-90 34,0 18,0 6,-30"
        fill={c.azulClaro}
        opacity={0.9}
      />
      {/* Costuras y vientos. */}
      <line
        x1={0}
        y1={-118}
        x2={0}
        y2={-132}
        stroke={c.madera}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <line
        x1={-82}
        y1={0}
        x2={-108}
        y2={6}
        stroke={c.blanco}
        strokeOpacity={0.5}
        strokeWidth={1.5}
      />
      <line
        x1={150}
        y1={0}
        x2={172}
        y2={8}
        stroke={c.blanco}
        strokeOpacity={0.5}
        strokeWidth={1.5}
      />
      <polygon points="0,-118 -82,0 -70,0 0,-104" fill={c.blanco} opacity={0.18} />
    </g>
  );
}

function DefsComunes({ c, ids }) {
  return (
    <>
      <radialGradient id={ids.brillo}>
        <stop offset="0%" stopColor={c.oroClaro} stopOpacity={0.55} />
        <stop offset="45%" stopColor={c.llamaMedia} stopOpacity={0.18} />
        <stop offset="100%" stopColor={c.llamaMedia} stopOpacity={0} />
      </radialGradient>
      <linearGradient id={ids.llamaFuera} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor={c.llamaRoja} />
        <stop offset="100%" stopColor={c.llamaMedia} />
      </linearGradient>
      <linearGradient id={ids.llamaMedio} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor={c.llamaMedia} />
        <stop offset="100%" stopColor={c.oroClaro} />
      </linearGradient>
      <linearGradient id={ids.tronco} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={c.maderaClara} />
        <stop offset="100%" stopColor={c.madera} />
      </linearGradient>
      <linearGradient id={ids.pinoLuz} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={c.verdeClaro} />
        <stop offset="100%" stopColor={c.verde} />
      </linearGradient>
      <linearGradient id={ids.pinoSombra} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={c.verde} />
        <stop offset="100%" stopColor={c.verdeOscuro} />
      </linearGradient>
      <linearGradient id={ids.tiendaLuz} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={c.azulClaro} />
        <stop offset="100%" stopColor={c.azul} />
      </linearGradient>
      <linearGradient id={ids.tiendaSombra} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={c.azulOscuro} />
        <stop offset="100%" stopColor={c.navyClaro} />
      </linearGradient>
    </>
  );
}

const useIds = (nombres) => {
  const base = useId().replace(/:/g, '');
  return Object.fromEntries(nombres.map((n) => [n, `${base}-${n}`]));
};

const NOMBRES = [
  'cielo',
  'suelo',
  'brillo',
  'llamaFuera',
  'llamaMedio',
  'tronco',
  'pinoLuz',
  'pinoSombra',
  'tiendaLuz',
  'tiendaSombra',
  'recorte',
];

// ----------------------------------------------------------------------
// LA ESCENA DEL INICIO: un campamento al anochecer.
// ----------------------------------------------------------------------

export function EscenaCampamento({ sx }) {
  const c = useColores();
  const ids = useIds(NOMBRES);
  const estrellas = [
    [60, 50, 1.6],
    [120, 92, 1.2],
    [196, 40, 1.8],
    [262, 78, 1.1],
    [330, 34, 1.4],
    [384, 112, 1],
    [520, 60, 1.5],
    [92, 150, 1],
    [300, 140, 1.2],
  ];
  return (
    <Box
      component="svg"
      viewBox="0 0 560 440"
      role="img"
      aria-label="Campamento de Exploradores al anochecer, con tienda y fogata"
      sx={{ width: 1, height: 'auto', display: 'block', ...animacionFogata, ...sx }}
    >
      <defs>
        <DefsComunes c={c} ids={ids} />
        <linearGradient id={ids.cielo} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.noche} />
          <stop offset="55%" stopColor={c.navyClaro} />
          <stop offset="85%" stopColor={c.azulOscuro} />
          <stop offset="100%" stopColor={c.oroOscuro} />
        </linearGradient>
        <linearGradient id={ids.suelo} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.verde} />
          <stop offset="100%" stopColor={c.verdeOscuro} />
        </linearGradient>
        <clipPath id={ids.recorte}>
          <rect width={560} height={440} rx={32} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${ids.recorte})`}>
        <rect width={560} height={440} fill={`url(#${ids.cielo})`} />
        {estrellas.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c.blanco} opacity={0.85} />
        ))}
        {/* Luna creciente. */}
        <circle cx={372} cy={70} r={24} fill={c.oroMas} />
        <circle cx={383} cy={62} r={21} fill={c.noche} opacity={0.92} />

        {/* Montañas: dos cordilleras, la de atrás más clara (aire). */}
        <polygon
          points="0,260 90,170 160,230 250,140 350,236 440,160 560,250 560,440 0,440"
          fill={c.navyMas}
          opacity={0.75}
        />
        <polygon
          points="250,140 275,165 262,168 250,158 238,170 228,162"
          fill={c.azulMas}
          opacity={0.8}
        />
        <polygon
          points="440,160 462,182 448,184 440,176 430,186 420,180"
          fill={c.azulMas}
          opacity={0.8}
        />
        <polygon
          points="0,300 110,220 200,290 300,210 420,300 560,232 560,440 0,440"
          fill={c.navyClaro}
        />

        {/* Pinos del fondo. */}
        <Pino x={44} y={318} escala={0.9} c={c} ids={ids} />
        <Pino x={92} y={326} escala={1.15} c={c} ids={ids} />
        <Pino x={500} y={318} escala={1.05} c={c} ids={ids} />
        <Pino x={536} y={330} escala={0.8} c={c} ids={ids} />

        {/* El suelo del claro. */}
        <path d="M0,330 C140,300 420,300 560,330 L560,440 L0,440 Z" fill={`url(#${ids.suelo})`} />

        <TiendaSvg x={170} y={378} escala={0.95} c={c} ids={ids} />
        <FogataSvg cx={392} cy={384} escala={0.95} c={c} ids={ids} />

        {/* Un tronco para sentarse, en primer plano. */}
        <g transform="translate(470 420)">
          <ellipse cx={0} cy={10} rx={58} ry={8} fill={c.noche} opacity={0.35} />
          <rect x={-56} y={-14} width={112} height={24} rx={12} fill={`url(#${ids.tronco})`} />
          <ellipse cx={-56} cy={-2} rx={8} ry={12} fill={c.oroClaro} />
          <ellipse cx={-56} cy={-2} rx={4} ry={6} fill={c.maderaClara} />
        </g>
      </g>
    </Box>
  );
}

// ----------------------------------------------------------------------
// Piezas sueltas para las secciones (fondo transparente).
// ----------------------------------------------------------------------

export function Fogata({ tamano = 160, sx }) {
  const c = useColores();
  const ids = useIds(NOMBRES);
  return (
    <Box
      component="svg"
      viewBox="-130 -160 260 220"
      aria-hidden
      sx={{ width: tamano, height: 'auto', display: 'block', ...animacionFogata, ...sx }}
    >
      <defs>
        <DefsComunes c={c} ids={ids} />
      </defs>
      {/* El resplandor, más pequeño que en la escena: cabe entero sin cortarse. */}
      <circle cy={-40} r={95} className="brillo" fill={`url(#${ids.brillo})`} />
      <FogataSvg cx={0} cy={0} c={c} ids={ids} conBrillo={false} />
    </Box>
  );
}

export function Tienda({ tamano = 180, sx }) {
  const c = useColores();
  const ids = useIds(NOMBRES);
  return (
    <Box
      component="svg"
      viewBox="-120 -150 320 180"
      aria-hidden
      sx={{ width: tamano, height: 'auto', display: 'block', ...animacionTienda, ...sx }}
    >
      <defs>
        <DefsComunes c={c} ids={ids} />
      </defs>
      <Pino x={-90} y={8} escala={0.9} c={c} ids={ids} />
      <TiendaSvg x={20} y={10} escala={0.95} c={c} ids={ids} />
      <Pino x={180} y={12} escala={0.7} c={c} ids={ids} retraso={-1.3} />
      {/* Luciérnagas que flotan y parpadean alrededor de la tienda. */}
      {[
        [-50, -90, 0],
        [110, -120, -0.8],
        [150, -60, -1.6],
        [-20, -40, -2.2],
        [60, -140, -1.1],
      ].map(([x, y, retraso]) => (
        <circle
          key={`${x}${y}`}
          cx={x}
          cy={y}
          r={3}
          fill={c.oro}
          className="luciernaga"
          style={{ animationDelay: `${retraso}s` }}
        />
      ))}
    </Box>
  );
}

// El certificado con su sello y su QR, en perspectiva, sobre su sombra.
export function CertificadoIlustrado({ tamano = 320, sx }) {
  const c = useColores();
  const base = useId().replace(/:/g, '');
  const papel = `${base}-papel`;
  const sello = `${base}-sello`;
  const qr = [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [4, 0],
    [5, 1],
    [4, 2],
    [3, 3],
    [5, 3],
    [0, 4],
    [2, 4],
    [4, 4],
    [1, 5],
    [3, 5],
    [5, 5],
  ];
  return (
    <Box
      component="svg"
      viewBox="0 0 360 300"
      aria-hidden
      sx={{
        width: tamano,
        maxWidth: 1,
        height: 'auto',
        display: 'block',
        ...animacionCertificado,
        ...sx,
      }}
    >
      <defs>
        <linearGradient id={papel} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.blanco} />
          <stop offset="100%" stopColor={c.azulMas} />
        </linearGradient>
        <radialGradient id={sello} cx="35%" cy="30%">
          <stop offset="0%" stopColor={c.oroMas} />
          <stop offset="60%" stopColor={c.oro} />
          <stop offset="100%" stopColor={c.oroOscuro} />
        </radialGradient>
      </defs>
      <ellipse className="sombra" cx={186} cy={272} rx={140} ry={14} fill={c.navy} opacity={0.15} />
      {/* La factura detrás, girada. */}
      <g className="flota-factura">
        <g transform="rotate(8 230 140)">
          <rect
            x={150}
            y={40}
            width={160}
            height={210}
            rx={10}
            fill={c.blanco}
            stroke={c.azulMas}
            strokeWidth={2}
          />
          <rect x={168} y={62} width={70} height={10} rx={5} fill={c.azul} />
          {[96, 116, 136, 156].map((y) => (
            <rect key={y} x={168} y={y} width={124} height={6} rx={3} fill={c.azulMas} />
          ))}
          <rect x={232} y={196} width={60} height={14} rx={7} fill={c.verdeClaro} opacity={0.8} />
        </g>
      </g>
      {/* El certificado. */}
      <g className="flota-certificado">
        <g transform="rotate(-6 140 150)">
          <rect
            x={40}
            y={30}
            width={230}
            height={170}
            rx={12}
            fill={c.navy}
            opacity={0.12}
            transform="translate(6 8)"
          />
          <rect x={40} y={30} width={230} height={170} rx={12} fill={`url(#${papel})`} />
          <rect
            x={50}
            y={40}
            width={210}
            height={150}
            rx={8}
            fill="none"
            stroke={c.oro}
            strokeWidth={2}
          />
          <rect x={86} y={58} width={140} height={12} rx={6} fill={c.oroOscuro} />
          <rect x={110} y={78} width={92} height={7} rx={3.5} fill={c.azulClaro} />
          {[104, 118, 132].map((y) => (
            <rect key={y} x={70} y={y} width={120} height={6} rx={3} fill={c.azulMas} />
          ))}
          <g transform="translate(206 128)">
            {qr.map(([x, y]) => (
              <rect key={`${x}${y}`} x={x * 6} y={y * 6} width={5} height={5} fill={c.navy} />
            ))}
          </g>
          <line x1={70} y1={176} x2={140} y2={176} stroke={c.navyMas} strokeWidth={2} />
        </g>
      </g>
      {/* El sello dorado con su cinta. */}
      <g className="sello">
        <polygon points="74,212 92,212 98,262 83,250 68,262" fill={c.azul} />
        <polygon points="92,212 110,212 116,262 101,250 86,262" fill={c.azulOscuro} />
        <circle cx={92} cy={200} r={30} fill={`url(#${sello})`} />
        <circle
          cx={92}
          cy={200}
          r={21}
          fill="none"
          stroke={c.oroMas}
          strokeWidth={2}
          strokeDasharray="3 3"
        />
        <path
          className="estrella"
          d="M92,186 l4,9 10,1 -7.5,6.5 2.5,10 -9,-5.5 -9,5.5 2.5,-10 -7.5,-6.5 10,-1 z"
          fill={c.oroMas}
        />
      </g>
    </Box>
  );
}
