import dayjs from 'dayjs';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import ListItemText from '@mui/material/ListItemText';
import GlobalStyles from '@mui/material/GlobalStyles';
import InputAdornment from '@mui/material/InputAdornment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { direccionPublica } from 'src/utils/direccion-publica.mjs';
import {
  PESOS_ONERRD,
  regionOnerrd,
  crearIdDeCampo,
  REGIONES_ONERRD,
  crearClaveOnerrd,
  sanearCampoOnerrd,
  pesoDeCampoOnerrd,
  sanearDisenoOnerrd,
  formatearNumeroOnerrd,
  nombreDeArchivoOnerrd,
  textosParaPintarOnerrd,
  esAnioDeRegistroValido,
  urlDelCertificadoOnerrd,
  anioDeRegistroPropuesto,
  PAGINA_ONERRD_POR_DEFECTO,
} from 'src/utils/certificado-onerrd.mjs';

import { getRegionals } from 'src/services/regional-service';
import {
  leerFondoOnerrd,
  leerImagenOnerrd,
  leerDisenoOnerrd,
  publicarPdfOnerrd,
  guardarFondoOnerrd,
  listarFirmasOnerrd,
  guardarImagenOnerrd,
  guardarDisenoOnerrd,
  listarEmitidosOnerrd,
  leerIconosRegionOnerrd,
  leerUltimoNumeroOnerrd,
  emitirCertificadoOnerrd,
  guardarIconoRegionOnerrd,
} from 'src/services/certificado-onerrd-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useAuthContext } from 'src/auth/hooks';

import { VisorOnerrd } from './onerrd-visor';
import { FirmasOnerrd } from './onerrd-firmas';
import { LienzoOnerrd } from './onerrd-lienzo';
import { EmitidosOnerrd } from './onerrd-emitidos';
import { puedeUsarOnerrd } from './puede-usar-onerrd';
import { PropiedadesOnerrd } from './onerrd-propiedades';
import {
  lineaBaseOnerrd,
  generarQrOnerrd,
  medirTextoOnerrd,
  cargarLetrasOnerrd,
  rasterizarSvgOnerrd,
  prepararImagenOnerrd,
  rasterizarTextoOnerrd,
  leerFotoDeRegionOnerrd,
  TIPOS_DE_IMAGEN_ONERRD,
} from './imagenes-onerrd';

// ----------------------------------------------------------------------
// PESTAÑA "ONERRD" DE CERTIFICADOS: Certificado de Renovación anual del
// registro de destacamentos. Reglas y medidas en `src/utils/certificado-onerrd.mjs`.
//
// Cuando exista la landing page de registro, sus datos llenarán los mismos
// `valores` que hoy se escriben a mano en "Datos del registro".
// ----------------------------------------------------------------------

const ESTILOS_DE_FUENTES = (
  <GlobalStyles
    styles={{
      '@font-face': [
        {
          fontFamily: 'OnerrdRoboto',
          src: 'url(/fuentes/Roboto-Regular.ttf)',
          fontWeight: 400,
          fontDisplay: 'swap',
        },
        {
          fontFamily: 'OnerrdRoboto',
          src: 'url(/fuentes/Roboto-Bold.ttf)',
          fontWeight: 700,
          fontDisplay: 'swap',
        },
        // Un archivo por grueso: el navegador baja solo los que se usan.
        ...Object.entries(PESOS_ONERRD).map(([peso, { archivo }]) => ({
          fontFamily: 'OnerrdOswald',
          src: `url(/fuentes/Oswald-${archivo}.ttf)`,
          fontWeight: Number(peso),
          fontDisplay: 'swap',
        })),
        {
          fontFamily: 'OnerrdAnton',
          src: 'url(/fuentes/Anton-Regular.ttf)',
          fontWeight: 400,
          fontDisplay: 'swap',
        },
      ],
    }}
  />
);

// Las que se sirven desde `public/fuentes` (las demás son del sistema).
const FAMILIAS_PROPIAS = ['Roboto', 'Oswald', 'Anton'];

const NUEVO_TEXTO = {
  fijo: {
    titulo: 'Texto fijo',
    detalle: 'Se escribe una vez y sale igual en todos',
    etiqueta: 'Texto nuevo',
  },
  anio: {
    titulo: 'Año del registro',
    detalle: 'El de "Datos del registro"',
    etiqueta: 'Año del registro',
  },
  texto: {
    titulo: 'Dato de cada certificado',
    detalle: 'Se escribe al emitir cada uno',
    etiqueta: 'Dato nuevo',
  },
};

// Dónde se abre el enlace del QR: la dirección publicada del ambiente cuyos
// datos se usan (dev, qa o prod), también al emitir desde localhost; antes era
// la de la pestaña y un QR emitido en local llevaba a `localhost`. Solo con un
// proyecto desconocido queda la de la pestaña.
const origenPublico = () =>
  direccionPublica({
    configurada: process.env.NEXT_PUBLIC_URL_PUBLICA,
    proyecto: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    origenActual: typeof window === 'undefined' ? '' : window.location.origin,
  }) || (typeof window === 'undefined' ? '' : window.location.origin);

const descargarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

const valoresIniciales = () => ({
  anio: anioDeRegistroPropuesto(),
  // A mediodía: guardada como ISO, una fecha a medianoche podía caer en el día
  // anterior al leerla en otra zona horaria.
  fecha: dayjs().hour(12).minute(0).second(0).millisecond(0).toISOString(),
});

export function OnerrdView() {
  const { user } = useAuthContext();
  const puede = puedeUsarOnerrd(user);

  const entradaFondoRef = useRef(null);
  const entradaImagenRef = useRef(null);
  const entradaIconoRegionRef = useRef(null);
  // La región a la que va el archivo que se está eligiendo.
  const regionAlSubir = useRef('');

  const [cargando, setCargando] = useState(true);
  const [fondo, setFondo] = useState(null);
  const [imagen, setImagen] = useState(null);
  // Icono propio subido solo para el certificado (manda si existe).
  const [iconosRegion, setIconosRegion] = useState({});
  // La foto de cada región en Niveles organizacionales: el icono de siempre.
  const [fotosRegion, setFotosRegion] = useState({});
  const [cargandoFotosRegion, setCargandoFotosRegion] = useState(true);
  const [diseno, setDiseno] = useState(() => sanearDisenoOnerrd());
  const [disenoGuardado, setDisenoGuardado] = useState(() => JSON.stringify(sanearDisenoOnerrd()));
  const [firmas, setFirmas] = useState([]);
  const [emitidos, setEmitidos] = useState([]);
  const [ultimo, setUltimo] = useState(0);
  const [valores, setValores] = useState(valoresIniciales);
  const [seleccion, setSeleccion] = useState(null);
  const [modoVista, setModoVista] = useState(false);
  const [menuAgregar, setMenuAgregar] = useState(null);
  const [cuadricula, setCuadricula] = useState(false);
  const [fuentesListas, setFuentesListas] = useState(0);
  const [ocupado, setOcupado] = useState('');
  const [descargando, setDescargando] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const pagina = fondo?.pagina || PAGINA_ONERRD_POR_DEFECTO;
  const anio = Number(valores.anio);

  // ---------------------------------------------------------------- carga

  useEffect(() => {
    if (!puede) return undefined;
    let vivo = true;

    Promise.allSettled([
      leerFondoOnerrd(),
      leerImagenOnerrd(),
      leerDisenoOnerrd(),
      listarFirmasOnerrd(),
      listarEmitidosOnerrd(),
      leerIconosRegionOnerrd(),
    ]).then(([rFondo, rImagen, rDiseno, rFirmas, rEmitidos, rIconos]) => {
      if (!vivo) return;
      if (rFondo.status === 'fulfilled' && rFondo.value?.dataUrl) setFondo(rFondo.value);
      if (rImagen.status === 'fulfilled' && rImagen.value?.dataUrl) setImagen(rImagen.value);
      if (rDiseno.status === 'fulfilled') {
        setDiseno(rDiseno.value);
        setDisenoGuardado(JSON.stringify(rDiseno.value));
      }
      if (rFirmas.status === 'fulfilled') setFirmas(rFirmas.value);
      if (rEmitidos.status === 'fulfilled') setEmitidos(rEmitidos.value);
      if (rIconos.status === 'fulfilled') setIconosRegion(rIconos.value);

      const fallos = [rFondo, rImagen, rDiseno, rFirmas, rEmitidos, rIconos].filter(
        (r) => r.status === 'rejected'
      );
      if (fallos.length) {
        console.error(
          '[onerrd] no se pudo leer todo',
          fallos.map((r) => r.reason)
        );
        toast.error('No se pudo cargar todo el certificado ONERRD. Recarga la página.');
      }
      setCargando(false);
    });

    return () => {
      vivo = false;
    };
  }, [puede]);

  // Las fotos de las regiones llegan aparte: van por la API .NET y el proxy de
  // imágenes, y no deben retrasar el resto de la pantalla.
  useEffect(() => {
    if (!puede) return undefined;
    let vivo = true;
    getRegionals()
      .then((regiones) =>
        Promise.all(
          REGIONES_ONERRD.map(async (region) => {
            const enPadron = regiones.find((r) => String(r.id) === String(region.idRegion));
            try {
              return [region.id, await leerFotoDeRegionOnerrd(enPadron?.avatarUrl)];
            } catch (error) {
              console.error(`[onerrd] no se pudo leer la foto de la ${region.nombre}`, error);
              return [region.id, null];
            }
          })
        )
      )
      .then((pares) => {
        if (vivo) setFotosRegion(Object.fromEntries(pares.filter(([, foto]) => foto?.dataUrl)));
      })
      .catch((error) => console.error('[onerrd] no se pudieron leer las regiones', error))
      .finally(() => vivo && setCargandoFotosRegion(false));
    return () => {
      vivo = false;
    };
  }, [puede]);

  // El icono que sale de cada región: el propio del certificado si se subió
  // uno; si no, su foto de Niveles organizacionales.
  const iconoDeRegion = useCallback(
    (region) => iconosRegion[region] || fotosRegion[region] || null,
    [iconosRegion, fotosRegion]
  );

  useEffect(() => {
    if (!puede || !esAnioDeRegistroValido(anio)) return undefined;
    let vivo = true;
    leerUltimoNumeroOnerrd(anio)
      .then((n) => vivo && setUltimo(n))
      .catch(() => vivo && setUltimo(0));
    return () => {
      vivo = false;
    };
  }, [puede, anio]);

  // Las medidas de "encoger para caber" dependen de la fuente cargada: con
  // Roboto aún bajando, se medía con la de reserva y el tamaño salía otro.
  // Se cargan las letras (y gruesos) que usa el diseño, y se vuelve a medir.
  const letrasUsadas = useMemo(
    () =>
      [
        ...new Set(
          diseno.campos
            .filter((campo) => FAMILIAS_PROPIAS.includes(campo.fuente))
            .map(
              (campo) =>
                `${pesoDeCampoOnerrd(campo)} 16px ${campo.fuente === 'Oswald' ? 'Oswald' : `Onerrd${campo.fuente}`}`
            )
        ),
      ]
        .sort()
        .join('|'),
    [diseno.campos]
  );

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts || !letrasUsadas) return;
    Promise.all(letrasUsadas.split('|').map((letra) => document.fonts.load(letra)))
      .catch(() => null)
      .then(() => setFuentesListas((n) => n + 1));
  }, [letrasUsadas]);

  const disenoSaneado = useMemo(() => JSON.stringify(sanearDisenoOnerrd(diseno)), [diseno]);
  const hayCambios = disenoSaneado !== disenoGuardado;

  useEffect(() => {
    if (!hayCambios) return undefined;
    const avisar = (evento) => {
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayCambios]);

  // ---------------------------------------------------------------- derivados

  const firmasPorId = useMemo(() => Object.fromEntries(firmas.map((f) => [f.id, f])), [firmas]);
  const firmasActivas = useMemo(() => firmas.filter((f) => f.activo !== false), [firmas]);
  const proximoNumero = formatearNumeroOnerrd(anio, ultimo + 1);

  // Una sola función para el lienzo y el PDF: lo que se ve es lo que sale.
  const resolverTextos = useCallback(
    (d, v) => textosParaPintarOnerrd(d, v, pagina.ancho, medirTextoOnerrd),
    // `fuentesListas` obliga a volver a medir cuando llega la fuente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pagina.ancho, fuentesListas]
  );

  const textosDeVista = useMemo(
    () => resolverTextos(diseno, { ...valores, numeroRegistro: proximoNumero }),
    [resolverTextos, diseno, valores, proximoNumero]
  );

  // Lo que se escribe dentro de la caja del lienzo es el dato del registro, el
  // mismo de "Datos del registro" (y el que sale en el PDF).
  const cambiarValor = useCallback((id, texto) => setValores((v) => ({ ...v, [id]: texto })), []);

  // El QR de la vista previa: el mismo tipo de enlace que llevará el PDF (el
  // de verdad se conoce al emitir, con la clave de ese certificado).
  const [qrVista, setQrVista] = useState(null);
  const textoQrVista = useMemo(() => urlDelCertificadoOnerrd(origenPublico(), '', ''), []);
  const colorQr = diseno.qr?.color;
  useEffect(() => {
    let vivo = true;
    const espera = setTimeout(() => {
      generarQrOnerrd(textoQrVista, colorQr)
        .then((dataUrl) => vivo && setQrVista(dataUrl))
        .catch((error) => console.error('[onerrd] no se pudo generar el QR', error));
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [textoQrVista, colorQr]);

  const camposDeTexto = diseno.campos.filter((campo) => campo.tipo === 'texto');

  // ---------------------------------------------------------------- edición

  const cambiarElemento = useCallback((tipo, id, cambios) => {
    setDiseno((actual) => {
      if (tipo === 'imagen') return { ...actual, imagen: { ...actual.imagen, ...cambios } };
      if (tipo === 'qr') return { ...actual, qr: { ...actual.qr, ...cambios } };
      if (tipo === 'iconoRegion') {
        return { ...actual, iconoRegion: { ...actual.iconoRegion, ...cambios } };
      }
      if (tipo === 'firma') {
        return {
          ...actual,
          firmas: actual.firmas.map((r) => (r.id === id ? { ...r, ...cambios } : r)),
        };
      }
      return {
        ...actual,
        campos: actual.campos.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
      };
    });
  }, []);

  // Por defecto, un texto fijo: se escribe una vez y queda guardado con el
  // diseño. El año y los datos de cada certificado, a elección.
  const agregarTexto = (tipo = 'fijo') => {
    setMenuAgregar(null);
    const id = crearIdDeCampo(diseno.campos);
    const campo = sanearCampoOnerrd({
      id,
      tipo,
      etiqueta: NUEVO_TEXTO[tipo].etiqueta,
      contenido: tipo === 'fijo' ? 'Texto nuevo' : '',
      x: 50,
      y: 50,
    });
    setDiseno((actual) => ({ ...actual, campos: [...actual.campos, campo] }));
    setSeleccion({ tipo: 'campo', id });
  };

  const eliminarCampo = (id) => {
    setDiseno((actual) => ({
      ...actual,
      campos: actual.campos.filter((campo) => campo.id !== id),
    }));
    setSeleccion(null);
  };

  const guardarDiseno = async () => {
    setOcupado('diseno');
    try {
      await guardarDisenoOnerrd({ diseno, user });
      setDisenoGuardado(disenoSaneado);
      toast.success('Diseño guardado.');
    } catch (error) {
      console.error('[onerrd] no se pudo guardar el diseño', error);
      toast.error('No se pudo guardar el diseño. Inténtalo de nuevo.');
    } finally {
      setOcupado('');
    }
  };

  const descartarCambios = () => setDiseno(JSON.parse(disenoGuardado));

  // ---------------------------------------------------------------- archivos

  const subirFondo = async (archivo) => {
    if (!archivo) return;
    setOcupado('fondo');
    try {
      const preparado = await rasterizarSvgOnerrd(archivo);
      await guardarFondoOnerrd({ ...preparado, user });
      setFondo(preparado);
      toast.success('Plantilla guardada.');
    } catch (error) {
      console.error('[onerrd] no se pudo subir la plantilla', error);
      // Los errores de Firebase traen `code`; los de preparar el archivo ya
      // vienen escritos para la persona.
      toast.error(
        error?.code || !error?.message
          ? 'No se pudo guardar la plantilla. Inténtalo de nuevo.'
          : error.message
      );
    } finally {
      setOcupado('');
    }
  };

  const pedirFondo = () => {
    if (!fondo) {
      entradaFondoRef.current?.click();
      return;
    }
    setConfirmacion({
      titulo: 'Cambiar la plantilla',
      contenido:
        'La plantilla nueva sustituye a la actual para los certificados que se emitan desde ahora. Los textos, la imagen y las firmas se quedan donde están.',
      boton: 'Elegir otra plantilla',
      color: 'primary',
      accion: () => entradaFondoRef.current?.click(),
    });
  };

  const subirImagen = async (archivo) => {
    if (!archivo) return;
    setOcupado('imagen');
    try {
      const preparada = await prepararImagenOnerrd(archivo);
      await guardarImagenOnerrd({ ...preparada, user });
      setImagen(preparada);
      if (!diseno.imagen.visible) cambiarElemento('imagen', 'imagen', { visible: true });
      setSeleccion({ tipo: 'imagen', id: 'imagen' });
      toast.success('Imagen guardada.');
    } catch (error) {
      console.error('[onerrd] no se pudo subir la imagen', error);
      toast.error(error?.code || !error?.message ? 'No se pudo guardar la imagen.' : error.message);
    } finally {
      setOcupado('');
    }
  };

  const quitarImagen = () =>
    setConfirmacion({
      titulo: 'Quitar la imagen',
      contenido:
        'La imagen deja de salir en los certificados nuevos. Los ya emitidos no cambian de número.',
      boton: 'Quitar',
      color: 'error',
      accion: async () => {
        try {
          await guardarImagenOnerrd({ dataUrl: '', proporcion: 1, user });
          setImagen(null);
        } catch (error) {
          console.error('[onerrd] no se pudo quitar la imagen', error);
          toast.error('No se pudo quitar la imagen.');
        }
      },
    });

  // El icono de cada región se sube una vez y sirve para todos los
  // certificados de esa región.
  const pedirIconoRegion = useCallback((region) => {
    regionAlSubir.current = region;
    entradaIconoRegionRef.current?.click();
  }, []);

  const subirIconoRegion = async (archivo) => {
    const region = regionAlSubir.current;
    if (!archivo || !regionOnerrd(region)) return;
    setOcupado(`region-${region}`);
    try {
      const preparada = await prepararImagenOnerrd(archivo);
      await guardarIconoRegionOnerrd({ ...preparada, region, user });
      setIconosRegion((actual) => ({ ...actual, [region]: preparada }));
      if (!diseno.iconoRegion.visible)
        cambiarElemento('iconoRegion', 'iconoRegion', { visible: true });
      // Se ve al momento: si no había región elegida, la que se acaba de subir.
      setValores((v) => (v.region ? v : { ...v, region }));
      setSeleccion({ tipo: 'iconoRegion', id: 'iconoRegion' });
      toast.success(`Icono de la ${regionOnerrd(region).nombre} guardado.`);
    } catch (error) {
      console.error('[onerrd] no se pudo subir el icono de la región', error);
      toast.error(error?.code || !error?.message ? 'No se pudo guardar el icono.' : error.message);
    } finally {
      setOcupado('');
    }
  };

  const quitarIconoRegion = (region) =>
    setConfirmacion({
      titulo: `Volver a la imagen de Niveles para la ${regionOnerrd(region)?.nombre}`,
      contenido: 'El certificado vuelve a usar la foto de la región en Niveles organizacionales.',
      boton: 'Volver',
      color: 'error',
      accion: async () => {
        try {
          await guardarIconoRegionOnerrd({ region, dataUrl: '', proporcion: 1, user });
          setIconosRegion(({ [region]: _quitado, ...resto }) => resto);
        } catch (error) {
          console.error('[onerrd] no se pudo quitar el icono de la región', error);
          toast.error('No se pudo quitar el icono.');
        }
      },
    });

  const recargarFirmas = useCallback(() => {
    listarFirmasOnerrd()
      .then(setFirmas)
      .catch(() => toast.error('No se pudieron leer las firmas.'));
  }, []);

  // ---------------------------------------------------------------- PDF

  // `claveAcceso`: la del certificado emitido; sin ella (prueba) el QR va a la
  // página que avisa de que no tiene validez. La fecha y hora de generación ya
  // no va bajo el QR: la enseña el contenedor que abre.
  // Devuelve el PDF para poder publicarlo.
  const construirPdf = async (d, v, nombre, { claveAcceso } = {}) => {
    const { generarPdfOnerrd } = await import('./onerrd-pdf');
    const disenoSaneadoPdf = sanearDisenoOnerrd(d);
    const qrPdf = disenoSaneadoPdf.qr.visible
      ? {
          dataUrl: await generarQrOnerrd(
            urlDelCertificadoOnerrd(origenPublico(), v.numeroRegistro, claveAcceso),
            disenoSaneadoPdf.qr.color
          ),
        }
      : null;
    // Con la línea base que tiene cada texto en pantalla, para que el PDF lo
    // ponga a la misma altura.
    const conTexto = resolverTextos(sanearDisenoOnerrd(d), v).filter((t) => t.texto);
    await cargarLetrasOnerrd(conTexto.map((t) => t.campo));
    const campos = conTexto.map((t) => {
      const lineaBase = lineaBaseOnerrd(t.campo);
      return {
        ...t,
        lineaBase,
        // El PDF no rellena letras con degradado: las dibuja el navegador.
        ...(t.campo.degradado && {
          dibujo: rasterizarTextoOnerrd({ ...t, pagina, lineaBase }),
        }),
      };
    });
    const blob = await generarPdfOnerrd({
      pagina,
      fondo: fondo.dataUrl,
      imagen,
      diseno: disenoSaneadoPdf,
      firmasPorId,
      // El de la región del certificado (el que está subido hoy).
      iconoRegion: iconoDeRegion(v.region),
      qr: qrPdf,
      textos: { titulo: `Certificado ONERRD ${v.numeroRegistro || ''}`.trim(), campos },
    });
    descargarBlob(blob, nombre);
    return blob;
  };

  // Lo que abre el QR. Si la subida falla, el certificado sigue emitido y
  // descargado: se vuelve a publicar al descargarlo desde "Certificados emitidos".
  const publicar = async (emitido, blob) => {
    if (!emitido.claveAcceso) return true;
    try {
      await publicarPdfOnerrd(emitido.numeroRegistro, blob);
      return true;
    } catch (error) {
      console.error('[onerrd] no se pudo publicar el PDF del QR', error);
      toast.warning(
        `El código QR de ${emitido.numeroRegistro} aún no abre el PDF: no se pudo publicar. Vuelve a descargarlo desde "Certificados emitidos" para reintentarlo.`
      );
      return false;
    }
  };

  const descargarPrueba = async () => {
    if (!fondo) {
      toast.error('Primero sube la plantilla .svg.');
      return;
    }
    setOcupado('prueba');
    try {
      const v = { ...valores, numeroRegistro: proximoNumero };
      await construirPdf(diseno, v, nombreDeArchivoOnerrd(`prueba-${proximoNumero}`, v));
    } catch (error) {
      console.error('[onerrd] no se pudo generar la prueba', error);
      toast.error('No se pudo generar el PDF de prueba.');
    } finally {
      setOcupado('');
    }
  };

  const camposVacios = camposDeTexto.filter(
    (campo) => campo.visible && !String(valores[campo.id] ?? '').trim()
  );

  const emitir = async () => {
    setOcupado('emitir');
    let emitido;
    try {
      const datos = Object.fromEntries([
        ['fecha', valores.fecha],
        // Para volver a descargarlo con el año que llevaba si un texto lo enseña.
        ['anio', String(anio)],
        ['region', regionOnerrd(valores.region) ? valores.region : ''],
        ...camposDeTexto.map((c) => [c.id, String(valores[c.id] ?? '').trim()]),
      ]);
      emitido = await emitirCertificadoOnerrd({
        anio,
        valores: datos,
        firmas: diseno.firmas.map((r) => ({
          id: r.id,
          idFirma: r.idFirma,
          nombre: firmasPorId[r.idFirma]?.nombre || '',
        })),
        diseno,
        // La clave del enlace del QR, de este certificado y nada más.
        claveAcceso: crearClaveOnerrd(),
        user,
      });
      setUltimo(emitido.secuencia);
      setEmitidos((actual) => [emitido, ...actual.filter((e) => e.id !== emitido.id)]);
    } catch (error) {
      console.error('[onerrd] no se pudo emitir', error);
      toast.error('No se pudo emitir el certificado. No se gastó ningún número.');
      setOcupado('');
      return;
    }

    try {
      const blob = await construirPdf(
        emitido.diseno,
        { anio: emitido.anio, ...emitido.valores },
        nombreDeArchivoOnerrd(emitido.numeroRegistro, emitido.valores),
        { claveAcceso: emitido.claveAcceso }
      );
      if (await publicar(emitido, blob)) {
        toast.success(`Certificado ${emitido.numeroRegistro} emitido.`);
      }
      // Limpio para el siguiente: emitir dos veces lo mismo gastaría otro número.
      setValores((actual) => ({ anio: actual.anio, fecha: actual.fecha }));
    } catch (error) {
      console.error('[onerrd] emitido pero sin PDF', error);
      toast.error(
        `El número ${emitido.numeroRegistro} quedó registrado, pero el PDF falló. Descárgalo desde "Certificados emitidos".`
      );
    } finally {
      setOcupado('');
    }
  };

  const pedirEmitir = () => {
    if (!fondo) {
      toast.error('Primero sube la plantilla .svg.');
      return;
    }
    if (!esAnioDeRegistroValido(anio)) {
      toast.error('Escribe un año de registro válido.');
      return;
    }
    if (hayCambios) {
      toast.info(
        'El certificado sale con el diseño en pantalla. Recuerda guardar el diseño para los siguientes.'
      );
    }
    setConfirmacion({
      titulo: `Emitir el certificado ${proximoNumero}`,
      contenido: camposVacios.length
        ? `Faltan: ${camposVacios.map((c) => c.etiqueta).join(', ')}. Se emitirá igual con esos datos en blanco y el número no se podrá reutilizar.`
        : 'Se reserva el número, queda registrado y se descarga el PDF. El número no se podrá reutilizar.',
      boton: 'Emitir y descargar',
      color: 'primary',
      accion: emitir,
    });
  };

  const redescargar = async (emitido) => {
    setDescargando(emitido.id);
    try {
      const blob = await construirPdf(
        emitido.diseno,
        { anio: emitido.anio, ...emitido.valores },
        nombreDeArchivoOnerrd(emitido.numeroRegistro, emitido.valores),
        // El mismo enlace: volver a descargarlo no cambia el QR, y vuelve a publicar el PDF (por si la primera vez falló).
        { claveAcceso: emitido.claveAcceso }
      );
      await publicar(emitido, blob);
    } catch (error) {
      console.error('[onerrd] no se pudo volver a descargar', error);
      toast.error('No se pudo generar el PDF.');
    } finally {
      setDescargando(null);
    }
  };

  // ---------------------------------------------------------------- pintado

  if (!puede) {
    return (
      <Alert severity="info">
        El certificado ONERRD es de la Oficina Nacional y el Administrador Global.
      </Alert>
    );
  }

  if (cargando) {
    return (
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '380px 1fr' } }}>
        <Stack spacing={3}>
          <Skeleton variant="rounded" height={380} />
          <Skeleton variant="rounded" height={200} />
        </Stack>
        <Skeleton
          variant="rounded"
          sx={{ aspectRatio: `${pagina.ancho} / ${pagina.alto}`, height: 'auto' }}
        />
      </Box>
    );
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap"
        rel="stylesheet"
      />
      {ESTILOS_DE_FUENTES}

      <input
        ref={entradaFondoRef}
        hidden
        type="file"
        accept=".svg,image/svg+xml"
        onChange={(event) => {
          subirFondo(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={entradaImagenRef}
        hidden
        type="file"
        accept={TIPOS_DE_IMAGEN_ONERRD.join(',')}
        onChange={(event) => {
          subirImagen(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={entradaIconoRegionRef}
        hidden
        type="file"
        accept={TIPOS_DE_IMAGEN_ONERRD.join(',')}
        onChange={(event) => {
          subirIconoRegion(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: '380px minmax(0, 1fr)' },
        }}
      >
        <Stack spacing={3}>
          <Card sx={{ p: 2.5 }}>
            <Typography variant="h6">Datos del registro</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
              Lo que cambia en cada certificado. Se ve en vivo en la vista previa.
            </Typography>

            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5}>
                <TextField
                  size="small"
                  type="number"
                  label="Año del registro"
                  value={valores.anio}
                  onChange={(event) => setValores((v) => ({ ...v, anio: event.target.value }))}
                  error={!esAnioDeRegistroValido(anio)}
                  sx={{ width: 140 }}
                />
                <DatePicker
                  label="Fecha"
                  format="DD/MM/YYYY"
                  value={valores.fecha ? dayjs(valores.fecha) : null}
                  onChange={(fecha) =>
                    setValores((v) => ({
                      ...v,
                      fecha: fecha?.isValid()
                        ? fecha.hour(12).minute(0).second(0).millisecond(0).toISOString()
                        : '',
                    }))
                  }
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Stack>

              <TextField
                select
                size="small"
                label="Región"
                value={regionOnerrd(valores.region) ? valores.region : ''}
                onChange={(event) => setValores((v) => ({ ...v, region: event.target.value }))}
                onFocus={() => setSeleccion({ tipo: 'iconoRegion', id: 'iconoRegion' })}
                helperText={
                  valores.region && !cargandoFotosRegion && !iconoDeRegion(valores.region)
                    ? 'Esta región no tiene foto en Niveles organizacionales.'
                    : 'Su imagen (la de Niveles organizacionales) sale en el certificado.'
                }
              >
                <MenuItem value="">Sin región</MenuItem>
                {REGIONES_ONERRD.map((region) => (
                  <MenuItem key={region.id} value={region.id}>
                    {region.nombre}
                  </MenuItem>
                ))}
              </TextField>

              {camposDeTexto.map((campo) => (
                <TextField
                  key={campo.id}
                  size="small"
                  label={campo.etiqueta}
                  placeholder={campo.ejemplo}
                  value={valores[campo.id] ?? ''}
                  disabled={!campo.visible}
                  helperText={
                    campo.visible ? undefined : (
                      // Oculto no sale en el lienzo y no se puede pulsar ahí:
                      // se vuelve a mostrar desde aquí.
                      <>
                        Oculto en el diseño ·{' '}
                        <Link
                          component="button"
                          type="button"
                          variant="caption"
                          onClick={() => {
                            cambiarElemento('campo', campo.id, { visible: true });
                            setSeleccion({ tipo: 'campo', id: campo.id });
                          }}
                        >
                          Mostrar
                        </Link>
                      </>
                    )
                  }
                  onChange={(event) =>
                    setValores((v) => ({ ...v, [campo.id]: event.target.value }))
                  }
                  onFocus={() => setSeleccion({ tipo: 'campo', id: campo.id })}
                  slotProps={{
                    htmlInput: { maxLength: 200 },
                    // El texto fijo del diseño, a la vista: aquí solo va el nombre.
                    input: {
                      startAdornment: campo.prefijo ? (
                        <InputAdornment position="start" sx={{ mr: 0.25 }}>
                          {campo.prefijo}
                        </InputAdornment>
                      ) : undefined,
                      endAdornment: campo.sufijo ? (
                        <InputAdornment position="end" sx={{ ml: 0.25 }}>
                          {campo.sufijo}
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
                />
              ))}

              <Alert severity="info" icon={<Iconify icon="solar:medal-ribbon-star-bold" />}>
                Próximo número: <strong>{proximoNumero || '—'}</strong>. Se confirma al emitir; dos
                personas a la vez nunca reciben el mismo.
              </Alert>

              <Stack direction="row" spacing={1.5}>
                <LoadingButton
                  fullWidth
                  variant="outlined"
                  loading={ocupado === 'prueba'}
                  disabled={!!ocupado && ocupado !== 'prueba'}
                  onClick={descargarPrueba}
                  startIcon={<Iconify icon="solar:eye-bold" />}
                >
                  PDF de prueba
                </LoadingButton>
                <LoadingButton
                  fullWidth
                  variant="contained"
                  loading={ocupado === 'emitir'}
                  disabled={!!ocupado && ocupado !== 'emitir'}
                  onClick={pedirEmitir}
                  startIcon={<Iconify icon="solar:download-bold" />}
                >
                  Emitir PDF
                </LoadingButton>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                La prueba no gasta número ni queda registrada.
              </Typography>
            </Stack>
          </Card>

          <FirmasOnerrd
            diseno={diseno}
            firmasActivas={firmasActivas}
            user={user}
            onCambiarRanura={(id, cambios) => cambiarElemento('firma', id, cambios)}
            onFirmasCambiaron={recargarFirmas}
            onSeleccionar={setSeleccion}
          />

          <Card sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Plantilla e imagen
            </Typography>
            <Stack spacing={1.5}>
              <LoadingButton
                variant="outlined"
                loading={ocupado === 'fondo'}
                loadingPosition="start"
                startIcon={<Iconify icon="eva:cloud-upload-fill" />}
                onClick={pedirFondo}
              >
                {fondo ? 'Cambiar plantilla .svg' : 'Subir plantilla .svg'}
              </LoadingButton>
              {fondo && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {fondo.nombreArchivo || 'Plantilla'} · {Math.round(pagina.ancho)} ×{' '}
                  {Math.round(pagina.alto)} pt
                </Typography>
              )}
              <LoadingButton
                variant="outlined"
                loading={ocupado === 'imagen'}
                loadingPosition="start"
                startIcon={<Iconify icon="solar:gallery-add-bold" />}
                onClick={() => entradaImagenRef.current?.click()}
              >
                {imagen ? 'Cambiar imagen' : 'Subir imagen (PNG, JPG, WebP)'}
              </LoadingButton>
              {imagen && !diseno.imagen.visible && (
                <Button
                  variant="outlined"
                  startIcon={<Iconify icon="solar:eye-bold" />}
                  onClick={() => {
                    cambiarElemento('imagen', 'imagen', { visible: true });
                    setSeleccion({ tipo: 'imagen', id: 'imagen' });
                  }}
                >
                  Mostrar la imagen (está oculta)
                </Button>
              )}
              {!diseno.iconoRegion?.visible && (
                <Button
                  variant="outlined"
                  startIcon={<Iconify icon="solar:eye-bold" />}
                  onClick={() => {
                    cambiarElemento('iconoRegion', 'iconoRegion', { visible: true });
                    setSeleccion({ tipo: 'iconoRegion', id: 'iconoRegion' });
                  }}
                >
                  Mostrar el icono de la región (está oculto)
                </Button>
              )}
              {!diseno.qr?.visible && (
                <Button
                  variant="outlined"
                  startIcon={<Iconify icon="solar:eye-bold" />}
                  onClick={() => {
                    cambiarElemento('qr', 'qr', { visible: true });
                    setSeleccion({ tipo: 'qr', id: 'qr' });
                  }}
                >
                  Mostrar el código QR (está oculto)
                </Button>
              )}
            </Stack>
          </Card>
        </Stack>

        <Card sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 2 }}
          >
            <Typography variant="h6" sx={{ flex: 1, minWidth: 160 }}>
              Diseño del certificado
            </Typography>
            <Button
              size="small"
              startIcon={<Iconify icon="mingcute:add-line" />}
              endIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={16} />}
              onClick={(event) => setMenuAgregar(event.currentTarget)}
            >
              Agregar texto
            </Button>
            <Menu anchorEl={menuAgregar} open={!!menuAgregar} onClose={() => setMenuAgregar(null)}>
              {Object.entries(NUEVO_TEXTO).map(([tipo, { titulo, detalle }]) => (
                <MenuItem key={tipo} onClick={() => agregarTexto(tipo)}>
                  <ListItemText primary={titulo} secondary={detalle} />
                </MenuItem>
              ))}
            </Menu>
            <Button
              size="small"
              color={modoVista ? 'primary' : 'inherit'}
              startIcon={<Iconify icon={modoVista ? 'solar:eye-closed-bold' : 'solar:eye-bold'} />}
              onClick={() => {
                setModoVista((v) => !v);
                setSeleccion(null);
              }}
            >
              {modoVista ? 'Volver a editar' : 'Ver resultado'}
            </Button>
            {hayCambios && (
              <Tooltip title="Volver a lo último guardado">
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<Iconify icon="solar:restart-bold" />}
                  onClick={descartarCambios}
                >
                  Descartar
                </Button>
              </Tooltip>
            )}
            <LoadingButton
              size="small"
              variant="contained"
              loading={ocupado === 'diseno'}
              disabled={!hayCambios}
              onClick={guardarDiseno}
              startIcon={
                <Iconify icon={hayCambios ? 'solar:file-text-bold' : 'solar:check-circle-bold'} />
              }
            >
              {hayCambios ? 'Guardar diseño' : 'Guardado'}
            </LoadingButton>
          </Stack>

          <VisorOnerrd
            cuadricula={cuadricula}
            onCuadricula={setCuadricula}
            mostrarCuadricula={!modoVista && !!fondo}
          >
            <LienzoOnerrd
              pagina={pagina}
              fondo={fondo?.dataUrl}
              imagen={imagen}
              diseno={diseno}
              firmasPorId={firmasPorId}
              qr={qrVista}
              iconoRegion={iconoDeRegion(valores.region) || undefined}
              nombreRegion={regionOnerrd(valores.region)?.nombre}
              textos={textosDeVista}
              valores={valores}
              onCambiarValor={cambiarValor}
              seleccion={seleccion}
              modoVista={modoVista}
              cuadricula={cuadricula}
              onSeleccionar={setSeleccion}
              onCambiarElemento={cambiarElemento}
              onSubirFondo={pedirFondo}
            />
          </VisorOnerrd>

          {!modoVista && fondo && (
            <>
              <Divider sx={{ my: 2.5 }} />
              <PropiedadesOnerrd
                seleccion={seleccion}
                diseno={diseno}
                firmasActivas={firmasActivas}
                onCambiarElemento={cambiarElemento}
                onEliminarCampo={eliminarCampo}
                onSubirImagen={() => entradaImagenRef.current?.click()}
                onQuitarImagen={quitarImagen}
                tieneImagen={!!imagen}
                region={regionOnerrd(valores.region) ? valores.region : ''}
                onCambiarRegion={(region) => setValores((v) => ({ ...v, region }))}
                iconosRegion={iconosRegion}
                fotosRegion={fotosRegion}
                cargandoFotosRegion={cargandoFotosRegion}
                subiendoRegion={ocupado.startsWith('region-') ? ocupado.slice(7) : ''}
                onSubirIconoRegion={pedirIconoRegion}
                onQuitarIconoRegion={quitarIconoRegion}
              />
            </>
          )}
        </Card>
      </Box>

      <EmitidosOnerrd emitidos={emitidos} descargando={descargando} onDescargar={redescargar} />

      <ConfirmDialog
        open={!!confirmacion}
        onClose={() => setConfirmacion(null)}
        title={confirmacion?.titulo}
        content={confirmacion?.contenido}
        action={
          <Button
            variant="contained"
            color={confirmacion?.color || 'primary'}
            onClick={() => {
              const { accion } = confirmacion;
              setConfirmacion(null);
              accion();
            }}
          >
            {confirmacion?.boton}
          </Button>
        }
      />
    </>
  );
}
