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
import Collapse from '@mui/material/Collapse';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import ListItemText from '@mui/material/ListItemText';
import GlobalStyles from '@mui/material/GlobalStyles';
import InputAdornment from '@mui/material/InputAdornment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { direccionPublica } from 'src/utils/direccion-publica.mjs';
import { valoresDeMembresia } from 'src/utils/valores-membresia-onerrd.mjs';
import {
  venceDeValoresOnerrd,
  LINEA_FACTURA_INICIAL,
  ESTADOS_FACTURA_ONERRD,
  facturarAPropuestoOnerrd,
  disenoFacturaParaGuardar,
  VARIABLE_REGISTRO_FACTURA,
  sanearDisenoFacturaOnerrd,
  facturaDesdeValoresOnerrd,
  descripcionPropuestaOnerrd,
  nombreDeArchivoFacturaOnerrd,
} from 'src/utils/factura-onerrd.mjs';
import {
  regionOnerrd,
  PESOS_ONERRD,
  crearIdDeCampo,
  acotarPosicion,
  REGIONES_ONERRD,
  crearClaveOnerrd,
  sanearCampoOnerrd,
  pesoDeCampoOnerrd,
  sanearDisenoOnerrd,
  nombreDeArchivoOnerrd,
  formatearNumeroOnerrd,
  textosParaPintarOnerrd,
  esAnioDeRegistroValido,
  anioDeRegistroPropuesto,
  urlDelCertificadoOnerrd,
  PAGINA_ONERRD_POR_DEFECTO,
  IMAGEN_SUBIDA_NUEVA_ONERRD,
  MAXIMO_IMAGENES_SUBIDAS_ONERRD,
} from 'src/utils/certificado-onerrd.mjs';

import { getRegionals } from 'src/services/regional-service';
import {
  enviarDocumentosMembresia,
  leerConfiguracionMembresia,
  anotarCertificadoEnMembresia,
} from 'src/services/membresia-onerrd-service';
import {
  leerFondoOnerrd,
  leerImagenOnerrd,
  leerDisenoOnerrd,
  publicarPdfOnerrd,
  guardarFondoOnerrd,
  listarFirmasOnerrd,
  guardarImagenOnerrd,
  guardarDisenoOnerrd,
  publicarFacturaOnerrd,
  leerIconosRegionOnerrd,
  leerUltimoNumeroOnerrd,
  leerDisenoFacturaOnerrd,
  emitirCertificadoOnerrd,
  guardarIconoRegionOnerrd,
  leerImagenesSubidasOnerrd,
  guardarImagenSubidaOnerrd,
  guardarDisenoFacturaOnerrd,
} from 'src/services/certificado-onerrd-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useAuthContext } from 'src/auth/hooks';

import { VisorOnerrd } from './onerrd-visor';
import { FirmasOnerrd } from './onerrd-firmas';
import { LienzoOnerrd } from './onerrd-lienzo';
import { Inscritos2026 } from './inscritos-2026';
import { puedeUsarOnerrd } from './puede-usar-onerrd';
import { usePapeleraOnerrd } from './papelera-onerrd';
import { PropiedadesOnerrd } from './onerrd-propiedades';
import { MembresiaOnerrdPagos } from './membresia-pagos';
import { useBorradorOnerrd } from './use-borrador-onerrd';
import { MembresiaOnerrdConfig } from './membresia-config';
import { TituloDesplegable, EditorFacturaOnerrd } from './factura-editor';
import {
  descargarBlobOnerrd,
  generarFacturaOnerrdBlob,
  descargarFacturaDePruebaOnerrd,
} from './descargas-onerrd';
import {
  copiarOnerrd,
  copiaDeCampoOnerrd,
  recordarPegadoOnerrd,
  leerPortapapelesOnerrd,
} from './portapapeles-onerrd';
import {
  generarQrOnerrd,
  medirTextoOnerrd,
  rasterizarSvgOnerrd,
  prepararImagenOnerrd,
  leerFotoDeRegionOnerrd,
  TIPOS_DE_IMAGEN_ONERRD,
  prepararTextosParaPdfOnerrd,
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
  // La factura (como un recibo): una línea con el precio de siempre, pagada.
  // El nombre de quien registró se toma de la solicitud o se escribe a mano.
  facturaEstado: 'pagada',
  facturaLineas: [{ ...LINEA_FACTURA_INICIAL }],
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
  const [ultimo, setUltimo] = useState(0);
  const [valores, setValores] = useState(valoresIniciales);
  const [seleccion, setSeleccion] = useState(null);
  const [modoVista, setModoVista] = useState(false);
  const [menuAgregar, setMenuAgregar] = useState(null);
  const [cuadricula, setCuadricula] = useState(false);
  const [fuentesListas, setFuentesListas] = useState(0);
  // La factura: su diseño (como el del certificado) y qué desplegable se ve.
  const [disenoFactura, setDisenoFactura] = useState(() => sanearDisenoFacturaOnerrd());
  const [disenoFacturaGuardado, setDisenoFacturaGuardado] = useState(() =>
    JSON.stringify(disenoFacturaParaGuardar(sanearDisenoFacturaOnerrd()))
  );
  const [verCertificado, setVerCertificado] = useState(false);
  const [verFactura, setVerFactura] = useState(false);
  const [verMembresia, setVerMembresia] = useState(false);
  const [verPagos, setVerPagos] = useState(false);
  const [verInscritos, setVerInscritos] = useState(false);
  // La membresía (de "Membresías 2027 · pagos") cuyo certificado se está
  // editando: al emitir no se descarga solo, se pregunta qué hacer.
  const [membresiaEnEdicion, setMembresiaEnEdicion] = useState(null);
  // Sube para que la tabla de pagos se vuelva a leer (tras emitir solo).
  const [versionPagos, setVersionPagos] = useState(0);
  // Las imágenes subidas a la factura: { id: { dataUrl, proporcion, nombreArchivo } }.
  const [imagenesFactura, setImagenesFactura] = useState({});
  // Las subidas al certificado (varias): { id: { dataUrl, proporcion, nombreArchivo } }.
  const [imagenesCertificado, setImagenesCertificado] = useState({});
  // Un solo selector de archivos para las dos; dice a cuál van y a quién avisar.
  const entradaImagenesRef = useRef(null);
  const subidaPendiente = useRef(null);
  // Trabajando solo en la factura: lo de la izquierda que es del certificado
  // (fecha, región, destacamento, firmas, plantilla) se oculta.
  const soloFactura = verFactura && !verCertificado;
  // "Datos del registro" se puede ocultar para que el certificado (y la
  // factura) ocupen todo el ancho: el lienzo se mide por el ancho de su
  // contenedor, así que crece solo. Antes los 380 px del panel lo dejaban
  // pequeño y había que tirar del zoom y de las barras para ver un trozo.
  const [panelOculto, setPanelOculto] = useState(false);
  const [datosAbiertos, setDatosAbiertos] = useState(true);
  const botonPanel = (
    <Tooltip
      title={
        panelOculto ? 'Mostrar «Datos del registro»' : 'Ocultar «Datos del registro» y agrandar'
      }
    >
      <IconButton
        size="small"
        onClick={() => setPanelOculto((v) => !v)}
        sx={{ display: { xs: 'none', lg: 'inline-flex' } }}
      >
        <Iconify
          icon={
            panelOculto
              ? 'solar:quit-full-screen-square-outline'
              : 'solar:full-screen-square-outline'
          }
        />
      </IconButton>
    </Tooltip>
  );
  const [ocupado, setOcupado] = useState('');
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
      leerIconosRegionOnerrd(),
      leerDisenoFacturaOnerrd(),
    ]).then(([rFondo, rImagen, rDiseno, rFirmas, rIconos, rFactura]) => {
      if (!vivo) return;
      if (rFondo.status === 'fulfilled' && rFondo.value?.dataUrl) setFondo(rFondo.value);
      if (rImagen.status === 'fulfilled' && rImagen.value?.dataUrl) setImagen(rImagen.value);
      if (rDiseno.status === 'fulfilled') {
        setDiseno(rDiseno.value);
        setDisenoGuardado(JSON.stringify(rDiseno.value));
        // Sus imágenes subidas llegan aparte (un documento cada una).
        leerImagenesSubidasOnerrd(rDiseno.value.imagenes.map((item) => item.id))
          .then((leidas) => vivo && setImagenesCertificado((actual) => ({ ...actual, ...leidas })))
          .catch((error) => console.error('[onerrd] no se pudieron leer las imágenes', error));
      }
      if (rFirmas.status === 'fulfilled') setFirmas(rFirmas.value);
      if (rIconos.status === 'fulfilled') setIconosRegion(rIconos.value);

      if (rFactura.status === 'fulfilled') {
        setDisenoFactura(rFactura.value);
        setDisenoFacturaGuardado(JSON.stringify(disenoFacturaParaGuardar(rFactura.value)));
        // Sus imágenes llegan aparte (un documento cada una).
        leerImagenesSubidasOnerrd(rFactura.value.imagenes.map((item) => item.id))
          .then((leidas) => vivo && setImagenesFactura((actual) => ({ ...actual, ...leidas })))
          .catch((error) => console.error('[onerrd] no se pudieron leer las imágenes', error));
      }

      const fallos = [rFondo, rImagen, rDiseno, rFirmas, rIconos, rFactura].filter(
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

  // "Ver y editar certificado y factura" de un pago: sus datos van a "Datos del
  // registro" y se abren el certificado y la factura, como al emitir uno a mano.
  const editarMembresia = useCallback((m) => {
    setValores((v) => ({ ...v, ...valoresDeMembresia(m) }));
    setMembresiaEnEdicion(m);
    setVerCertificado(true);
    setVerFactura(true);
    leerConfiguracionMembresia()
      .then((c) => {
        setValores((v) => ({ ...v, ...valoresDeMembresia(m, c.correoRemitente) }));
      })
      .catch(() => {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Envía el certificado y la factura; el servidor registra el resultado y
  // avisa a Administradores Globales y Oficina Nacional cuando sale el correo.
  const enviarEntrega = useCallback(async (actual) => {
    if (!actual) return;
    const { membresia, emitido, certificado, factura } = actual;
    try {
      const { registro } = await enviarDocumentosMembresia({
        id: membresia.id,
        numeroRegistro: emitido.numeroRegistro,
        facturaNumero: emitido.factura?.numero || '',
        certificado,
        factura,
      });
      if (registro.estado === 'enviado') toast.success(`Enviado a ${registro.para}.`);
      else toast.error(registro.error || 'No se pudo enviar el correo.');
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  // AL CONFIRMAR UN PAGO, el certificado y la factura se emiten solos con los
  // datos de la membresía, se guardan (la landing los descarga de ahí) y se
  // envían por correo a quien pagó. Antes había que abrirlos y emitirlos a mano.
  const emitirAlConfirmar = async (m) => {
    if (m.certificadoEmitido?.numeroRegistro) return;
    toast.info('Emitiendo el certificado y la factura…');
    const config = await leerConfiguracionMembresia().catch(() => null);
    await emitir({
      membresia: m,
      valores: { ...valores, ...valoresDeMembresia(m, config?.correoRemitente || '') },
    });
  };

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
      if (tipo === 'imagenes') {
        return {
          ...actual,
          imagenes: actual.imagenes.map((i) => (i.id === id ? { ...i, ...cambios } : i)),
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

  // Eliminar textos: pregunta antes y los deja en "Eliminados" (papelera).
  const papelera = usePapeleraOnerrd({
    diseno,
    onCambiarDiseno: setDiseno,
    onEliminados: () => setSeleccion(null),
    onRestaurado: (id) => setSeleccion({ tipo: 'campo', id }),
  });
  const eliminarCampo = (id) => papelera.pedirEliminar([id]);

  // Ctrl + C / Ctrl + V / Ctrl + D / Supr en el lienzo del certificado. Se
  // copian los textos (también a la factura y desde ella); las formas son
  // de la factura.
  // Pega una lista de copiados y devuelve lo pegado ({ tipo, id }), que el
  // lienzo deja elegido en grupo.
  const pegarTextos = (copiados) => {
    if (!copiados?.length) return [];
    const textos = copiados.filter((copiado) => copiado.tipo === 'campo');
    if (textos.length < copiados.length) toast.info('Las formas solo se pegan en la factura.');
    if (!textos.length) return [];
    const campos = [...diseno.campos];
    const pegados = textos.map((copiado) => {
      const campo = sanearCampoOnerrd(copiaDeCampoOnerrd(copiado.elemento, copiado.texto, campos));
      campos.push(campo);
      return { ...copiado, elemento: campo };
    });
    setDiseno((actual) => ({
      ...actual,
      campos: [...actual.campos, ...pegados.map((p) => p.elemento)],
    }));
    recordarPegadoOnerrd(pegados);
    const elegidos = pegados.map((p) => ({ tipo: 'campo', id: p.elemento.id }));
    setSeleccion(elegidos[elegidos.length - 1]);
    return elegidos;
  };

  // Eliminar: un texto añadido se quita; uno de fábrica, la imagen, el icono
  // de la región y el QR se ocultan (vuelven desde su casilla "Mostrar").
  const eliminarElegido = (sel) => {
    if (sel?.tipo === 'campo') {
      const campo = diseno.campos.find((item) => item.id === sel.id);
      if (campo?.deFabrica) cambiarElemento('campo', sel.id, { visible: false });
      else eliminarCampo(sel.id);
    } else if (sel?.tipo === 'imagenes') {
      quitarImagenSubida(sel.id);
    } else if (['imagen', 'iconoRegion', 'qr'].includes(sel?.tipo)) {
      cambiarElemento(sel.tipo, sel.id, { visible: false });
    } else if (sel?.tipo === 'firma') {
      toast.info('Las firmas no se eliminan: elige «Sin firma» en su panel.');
    }
  };

  // `lista`: lo elegido (uno, o varios con Ctrl + clic). Devuelve lo pegado.
  const alAtajo = (accion, sel, lista = sel ? [sel] : []) => {
    if (accion === 'pegar') return pegarTextos(leerPortapapelesOnerrd());
    if (accion === 'eliminar') {
      // Los textos añadidos van juntos a la papelera (una sola pregunta).
      const aPapelera = lista
        .filter((item) => item.tipo === 'campo')
        .map((item) => diseno.campos.find((campo) => campo.id === item.id))
        .filter((campo) => campo && !campo.deFabrica)
        .map((campo) => campo.id);
      papelera.pedirEliminar(aPapelera);
      lista
        .filter((item) => !(item.tipo === 'campo' && aPapelera.includes(item.id)))
        .forEach(eliminarElegido);
      if (lista.some((item) => item.tipo !== 'firma')) setSeleccion(null);
      return undefined;
    }
    const copiados = lista
      .filter((item) => item.tipo === 'campo')
      .map((item) => textosDeVista.find((t) => t.campo.id === item.id))
      .filter(Boolean)
      .map((pintado) => ({ tipo: 'campo', elemento: pintado.campo, texto: pintado.texto }));
    if (!copiados.length) {
      if (sel) toast.info('Se copian los textos.');
      return undefined;
    }
    if (accion === 'copiar') {
      copiarOnerrd(copiados);
      return undefined;
    }
    return pegarTextos(copiados);
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

  const disenoFacturaSaneado = useMemo(
    () => JSON.stringify(disenoFacturaParaGuardar(disenoFactura)),
    [disenoFactura]
  );
  const hayCambiosFactura = disenoFacturaSaneado !== disenoFacturaGuardado;

  // Lo no guardado sobrevive a recargar o cerrar la página (en este navegador).
  useBorradorOnerrd({
    clave: 'onerrd-borrador-diseno',
    actual: disenoSaneado,
    guardado: disenoGuardado,
    listo: !cargando,
    onRecuperar: (recuperado) => {
      setDiseno(sanearDisenoOnerrd(recuperado));
      toast.info('Se recuperaron los cambios sin guardar del diseño del certificado.');
    },
  });
  useBorradorOnerrd({
    clave: 'onerrd-borrador-factura',
    actual: disenoFacturaSaneado,
    guardado: disenoFacturaGuardado,
    listo: !cargando,
    onRecuperar: (recuperado) => {
      setDisenoFactura(sanearDisenoFacturaOnerrd(recuperado));
      toast.info('Se recuperaron los cambios sin guardar del diseño de la factura.');
    },
  });

  const guardarDisenoFactura = async () => {
    setOcupado('diseno-factura');
    try {
      await guardarDisenoFacturaOnerrd({ diseno: disenoFactura, user });
      setDisenoFacturaGuardado(disenoFacturaSaneado);
      toast.success('Diseño de la factura guardado.');
    } catch (error) {
      console.error('[onerrd] no se pudo guardar el diseño de la factura', error);
      toast.error('No se pudo guardar el diseño de la factura. Inténtalo de nuevo.');
    } finally {
      setOcupado('');
    }
  };

  // SUBIR IMÁGENES al certificado o a la factura (`destino`): con el botón
  // (varias a la vez) o soltándolas encima del lienzo, donde caen. Cada una se
  // guarda en su documento y entra en el diseño; su sitio se guarda con
  // "Guardar diseño". Devuelve los ids subidos.
  const subirImagenes = async (destino, archivos, posicion) => {
    const validas = archivos.filter((archivo) => TIPOS_DE_IMAGEN_ONERRD.includes(archivo.type));
    if (!validas.length) {
      toast.error('Usa imágenes PNG, JPG o WebP.');
      return [];
    }
    const deFactura = destino === 'factura';
    const ocupadas = (deFactura ? disenoFactura : diseno).imagenes?.length || 0;
    const libres = MAXIMO_IMAGENES_SUBIDAS_ONERRD - ocupadas;
    if (libres <= 0) {
      toast.error(`Caben ${MAXIMO_IMAGENES_SUBIDAS_ONERRD} imágenes: quita alguna antes.`);
      return [];
    }
    setOcupado(`imagen-${destino}`);
    const subidas = [];
    try {
      for (const [indice, archivo] of validas.slice(0, libres).entries()) {
        const preparada = await prepararImagenOnerrd(archivo);

        const guardada = await guardarImagenSubidaOnerrd({ ...preparada, destino, user });
        // Varias soltadas a la vez caen en escalera, no una encima de otra.
        const base = posicion || IMAGEN_SUBIDA_NUEVA_ONERRD;
        subidas.push({
          guardada,
          elemento: {
            ...IMAGEN_SUBIDA_NUEVA_ONERRD,
            id: guardada.id,
            x: acotarPosicion(base.x + indice * 3),
            y: acotarPosicion(base.y + indice * 3),
          },
        });
      }
    } catch (error) {
      console.error('[onerrd] no se pudo subir la imagen', error);
      toast.error(error?.code || !error?.message ? 'No se pudo subir la imagen.' : error.message);
    } finally {
      setOcupado('');
    }
    if (!subidas.length) return [];

    const nuevas = Object.fromEntries(subidas.map(({ guardada }) => [guardada.id, guardada]));
    const agregar = (actual) => ({
      ...actual,
      imagenes: [...actual.imagenes, ...subidas.map(({ elemento }) => elemento)],
    });
    if (deFactura) {
      setImagenesFactura((actual) => ({ ...actual, ...nuevas }));
      setDisenoFactura(agregar);
    } else {
      setImagenesCertificado((actual) => ({ ...actual, ...nuevas }));
      setDiseno(agregar);
      setSeleccion({ tipo: 'imagenes', id: subidas[subidas.length - 1].guardada.id });
    }
    if (validas.length > libres) {
      toast.warning(`Solo cabían ${libres}: caben ${MAXIMO_IMAGENES_SUBIDAS_ONERRD} imágenes.`);
    }
    toast.success(
      subidas.length === 1
        ? 'Imagen subida. Colócala y pulsa «Guardar diseño».'
        : `${subidas.length} imágenes subidas. Colócalas y pulsa «Guardar diseño».`
    );
    return subidas.map(({ guardada }) => guardada.id);
  };

  // El botón "Subir imagen": abre el selector (varias a la vez) y devuelve el
  // id de la última subida (la factura la elige en su lienzo).
  const pedirImagenes = (destino) =>
    new Promise((resolver) => {
      subidaPendiente.current = { destino, resolver };
      entradaImagenesRef.current?.click();
    });

  const alElegirImagenes = async (archivos) => {
    const pendiente = subidaPendiente.current;
    subidaPendiente.current = null;
    if (!pendiente || !archivos.length) return;
    const ids = await subirImagenes(pendiente.destino, archivos);
    pendiente.resolver(ids[ids.length - 1]);
  };

  // Quitar una imagen subida del certificado (su documento no se borra).
  const quitarImagenSubida = (id) => {
    setDiseno((actual) => ({
      ...actual,
      imagenes: actual.imagenes.filter((imagenSubida) => imagenSubida.id !== id),
    }));
    setSeleccion(null);
  };

  const descartarFactura = () =>
    setDisenoFactura(sanearDisenoFacturaOnerrd(JSON.parse(disenoFacturaGuardado)));

  // Las líneas de la factura en "Datos del registro".
  const lineasFactura = valores.facturaLineas?.length
    ? valores.facturaLineas
    : [{ ...LINEA_FACTURA_INICIAL }];
  const cambiarLinea = (indice, cambios) =>
    setValores((v) => ({
      ...v,
      facturaLineas: lineasFactura.map((linea, i) =>
        i === indice ? { ...linea, ...cambios } : linea
      ),
    }));

  // ---------------------------------------------------------------- archivos

  const subirFondo = async (archivo) => {
    if (!archivo) return;
    setOcupado('fondo');
    try {
      const preparado = await rasterizarSvgOnerrd(archivo);
      const { rutaSvg } =
        (await guardarFondoOnerrd({ ...preparado, original: archivo, user })) || {};
      setFondo(preparado);
      if (rutaSvg) toast.success('Plantilla guardada (con su .svg original en Firebase).');
      else
        toast.warning('Plantilla guardada, pero su .svg original no se pudo guardar en Firebase.');
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
  const construirPdf = async (d, v, nombre, { claveAcceso, descargar = true } = {}) => {
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
    const campos = await prepararTextosParaPdfOnerrd(
      resolverTextos(sanearDisenoOnerrd(d), v),
      pagina
    );
    const blob = await generarPdfOnerrd({
      pagina,
      fondo: fondo.dataUrl,
      imagen,
      diseno: disenoSaneadoPdf,
      firmasPorId,
      // El de la región del certificado (el que está subido hoy).
      iconoRegion: iconoDeRegion(v.region),
      imagenesSubidas: imagenesCertificado,
      qr: qrPdf,
      textos: { titulo: `Certificado ONERRD ${v.numeroRegistro || ''}`.trim(), campos },
    });
    if (descargar) descargarBlob(blob, nombre);
    return blob;
  };

  // Lo que abre el QR (y lo que se descarga en "Certificados creados"). Se
  // reintenta: la lista de emitidos de esta pestaña, que lo volvía a publicar,
  // ya no está. Si aun así falla, el certificado sigue emitido y descargado.
  const publicar = async (emitido, blob) => {
    if (!emitido.claveAcceso) return true;
    for (let intento = 1; intento <= 3; intento += 1) {
      try {
        await publicarPdfOnerrd(emitido.numeroRegistro, blob);
        return true;
      } catch (error) {
        console.error(`[onerrd] no se pudo publicar el PDF del QR (intento ${intento})`, error);

        if (intento < 3) await new Promise((resolver) => setTimeout(resolver, 1000 * intento));
      }
    }
    toast.warning(
      `El certificado ${emitido.numeroRegistro} se emitió y se descargó, pero su PDF no se pudo guardar: su código QR no lo abrirá. Guarda el PDF descargado.`
    );
    return false;
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
      // Y su factura de prueba (con su diseño en pantalla, sello PRUEBA y sin
      // gastar número).
      await descargarFacturaDePruebaOnerrd(valores, anio, disenoFactura, proximoNumero);
    } catch (error) {
      console.error('[onerrd] no se pudo generar la prueba', error);
      toast.error('No se pudo generar la prueba (certificado y factura).');
    } finally {
      setOcupado('');
    }
  };

  const camposVacios = camposDeTexto.filter(
    (campo) => campo.visible && !String(valores[campo.id] ?? '').trim()
  );

  // Sin argumentos, lo de la pantalla; con { membresia, valores }, la emisión
  // automática al confirmar un pago (sin pasar por la pantalla).
  const emitir = async ({ membresia: membresiaDada, valores: valoresDados } = {}) => {
    const enMembresia = membresiaDada || membresiaEnEdicion;
    const usar = valoresDados || valores;
    setOcupado('emitir');
    let emitido;
    try {
      const datos = Object.fromEntries([
        ['fecha', usar.fecha],
        // Para volver a descargarlo con el año que llevaba si un texto lo enseña.
        ['anio', String(anio)],
        ['region', regionOnerrd(usar.region) ? usar.region : ''],
        ...camposDeTexto.map((c) => [c.id, String(usar[c.id] ?? '').trim()]),
        ['facturaEnvio', String(usar.facturaEnvio || '')],
        ['facturaEnvioDetalle', String(usar.facturaEnvioDetalle || '')],
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
        // Su factura (el número lo reserva la misma transacción).
        factura: facturaDesdeValoresOnerrd(usar),
        disenoFactura,
        user,
      });
      setUltimo(emitido.secuencia);
    } catch (error) {
      console.error('[onerrd] no se pudo emitir', error);
      toast.error('No se pudo emitir el certificado. No se gastó ningún número.');
      setOcupado('');
      return;
    }

    try {
      const blob = await construirPdf(
        emitido.diseno,
        // Con la hora de emisión: la usan los textos "Fecha y hora de emisión".
        { anio: emitido.anio, ...emitido.valores, emitidoEnIso: emitido.emitidoEnIso },
        nombreDeArchivoOnerrd(emitido.numeroRegistro, emitido.valores),
        { claveAcceso: emitido.claveAcceso, descargar: !enMembresia }
      );
      if (await publicar(emitido, blob)) {
        toast.success(`Certificado ${emitido.numeroRegistro} emitido.`);
      }
      // Su factura, guardada para que la abra su QR. Si falla, el certificado
      // sigue emitido y la factura se puede bajar en "Certificados creados".
      // También se descarga, junto al certificado.
      let facturaBlob = null;
      if (emitido.factura) {
        let factura = null;
        try {
          factura = await generarFacturaOnerrdBlob(emitido);
          facturaBlob = factura;
          if (!enMembresia) descargarBlobOnerrd(factura, nombreDeArchivoFacturaOnerrd(emitido));
          if (emitido.claveAcceso) await publicarFacturaOnerrd(emitido.numeroRegistro, factura);
        } catch (error) {
          console.error('[onerrd] no se pudo preparar o guardar la factura', error);
          toast.warning(
            factura
              ? `La factura de ${emitido.numeroRegistro} se descargó, pero no se pudo guardar: su QR no la abrirá.`
              : `No se pudo generar la factura de ${emitido.numeroRegistro}: bájala en «Certificados creados».`
          );
        }
      }
      // De una membresía: se anota en ella y se envía al confirmar el pago.
      if (enMembresia) {
        const nuevaEntrega = {
          membresia: enMembresia,
          emitido,
          certificado: blob,
          factura: facturaBlob,
        };
        setMembresiaEnEdicion(null);
        const anotada = await anotarCertificadoEnMembresia({
          id: enMembresia.id,
          numeroRegistro: emitido.numeroRegistro,
          facturaNumero: emitido.factura?.numero || '',
          destacamento: [enMembresia.destacamento?.numero, enMembresia.destacamento?.nombre]
            .filter(Boolean)
            .join(' '),
          user,
        })
          .then(() => true)
          .catch((error) => {
            console.error('[onerrd] no se pudo anotar en la membresía', error);
            toast.error(
              'No se pudo vincular el certificado a la membresía. El correo no se envió.'
            );
            return false;
          });
        // El enlace del correo solo se entrega cuando la solicitud ya puede
        // encontrar los PDF recién emitidos en el landing.
        if (anotada && enMembresia.estado === 'confirmada') await enviarEntrega(nuevaEntrega);
        setVersionPagos((version) => version + 1);
      }
      // Limpio para el siguiente: emitir dos veces lo mismo gastaría otro número.
      setValores((actual) => ({
        anio: actual.anio,
        fecha: actual.fecha,
        facturaEstado: actual.facturaEstado,
        facturaLineas: [{ ...LINEA_FACTURA_INICIAL }],
      }));
    } catch (error) {
      console.error('[onerrd] emitido pero sin PDF', error);
      toast.error(
        `El número ${emitido.numeroRegistro} quedó registrado, pero el PDF falló. Su factura está en "Certificados creados".`
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
        ref={entradaImagenesRef}
        hidden
        multiple
        type="file"
        accept={TIPOS_DE_IMAGEN_ONERRD.join(',')}
        onChange={(event) => {
          alElegirImagenes([...(event.target.files || [])]);
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
          gridTemplateColumns: {
            xs: '1fr',
            lg: panelOculto ? 'minmax(0, 1fr)' : '380px minmax(0, 1fr)',
          },
        }}
      >
        {/* Oculto con display y no desmontado: lo escrito en el panel se
            conserva al volver a mostrarlo. */}
        <Stack spacing={3} sx={{ display: { lg: panelOculto ? 'none' : 'flex' } }}>
          <Card sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">Datos del registro</Typography>
              <Tooltip
                title={
                  datosAbiertos ? 'Contraer datos del registro' : 'Expandir datos del registro'
                }
              >
                <IconButton
                  size="small"
                  aria-label={
                    datosAbiertos ? 'Contraer datos del registro' : 'Expandir datos del registro'
                  }
                  aria-expanded={datosAbiertos}
                  aria-controls="datos-registro-onerrd"
                  onClick={() => setDatosAbiertos((abiertos) => !abiertos)}
                >
                  <Iconify
                    icon={
                      datosAbiertos ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
                    }
                  />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mb: 2.5, display: datosAbiertos ? 'block' : 'none' }}
            >
              {soloFactura
                ? 'Lo de la factura. Lo del certificado vuelve al abrir «Diseño del certificado».'
                : 'Lo que cambia en cada certificado. Se ve en vivo en la vista previa.'}
            </Typography>

            <Stack
              id="datos-registro-onerrd"
              spacing={2}
              sx={{ display: datosAbiertos ? 'flex' : 'none' }}
            >
              <Stack direction="row" spacing={1.5}>
                <TextField
                  size="small"
                  type="number"
                  label="Año del registro"
                  value={valores.anio}
                  onChange={(event) => setValores((v) => ({ ...v, anio: event.target.value }))}
                  error={!esAnioDeRegistroValido(anio)}
                  helperText={soloFactura ? 'Va en el concepto.' : undefined}
                  sx={{ width: 140 }}
                />
                {/* También trabajando solo en la factura: de ella sale el vencimiento. */}
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
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      helperText: soloFactura ? 'Del registro: da el vencimiento.' : undefined,
                    },
                  }}
                />
              </Stack>

              {!soloFactura && (
                <>
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
                </>
              )}

              {/* La factura de este certificado, con los datos de un recibo
                  (/dashboard/invoice). Su diseño, en "Diseño de la factura";
                  se descarga en "Certificados creados". */}
              <Divider textAlign="left" sx={{ typography: 'overline', color: 'text.secondary' }}>
                Factura
              </Divider>
              <TextField
                size="small"
                label="Registrado por"
                placeholder={facturarAPropuestoOnerrd(valores) || 'Nombre de quien registró'}
                value={valores.facturaA ?? ''}
                onChange={(event) => setValores((v) => ({ ...v, facturaA: event.target.value }))}
                helperText="Nombre de la persona que completó la solicitud."
                slotProps={{ htmlInput: { maxLength: 160 } }}
              />
              <Stack direction="row" spacing={1.5}>
                <TextField
                  select
                  size="small"
                  label="Estado"
                  value={valores.facturaEstado || 'pagada'}
                  onChange={(event) =>
                    setValores((v) => ({ ...v, facturaEstado: event.target.value }))
                  }
                  sx={{ width: 140, flexShrink: 0 }}
                >
                  {ESTADOS_FACTURA_ONERRD.map((estado) => (
                    <MenuItem key={estado.value} value={estado.value}>
                      {estado.label}
                    </MenuItem>
                  ))}
                </TextField>
                {/* Por defecto, 31 dic. del año siguiente a la apertura (1 oct.)
                    que toca a la fecha del registro. Escrito a mano manda; al
                    borrarlo vuelve el automático. */}
                <DatePicker
                  label="Vence"
                  format="DD/MM/YYYY"
                  value={
                    venceDeValoresOnerrd(valores) ? dayjs(venceDeValoresOnerrd(valores)) : null
                  }
                  onChange={(fecha) =>
                    setValores((v) => ({
                      ...v,
                      facturaVence: fecha?.isValid()
                        ? fecha.hour(12).minute(0).second(0).millisecond(0).toISOString()
                        : '',
                    }))
                  }
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      helperText: valores.facturaVence
                        ? 'Escrito a mano (bórralo para el automático).'
                        : 'Automático: 31 dic. del año siguiente al 1 oct.',
                    },
                    field: { clearable: !!valores.facturaVence },
                  }}
                />
              </Stack>

              {lineasFactura.map((linea, indice) => (
                <Stack key={indice} spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      fullWidth
                      label={`Línea ${indice + 1}`}
                      placeholder={descripcionPropuestaOnerrd(valores.anio)}
                      value={linea.descripcion ?? ''}
                      onChange={(event) =>
                        cambiarLinea(indice, { descripcion: event.target.value })
                      }
                      helperText={
                        indice === 0
                          ? `{registro} = número de registro (${proximoNumero || '2027-015'})`
                          : undefined
                      }
                      slotProps={{
                        htmlInput: { maxLength: 160 },
                        // Añade el número de registro al final: "(2027-015)".
                        input: {
                          endAdornment: !String(linea.descripcion ?? '').includes(
                            VARIABLE_REGISTRO_FACTURA
                          ) && (
                            <InputAdornment position="end">
                              <Tooltip title="Añadir el número de registro al final, entre paréntesis">
                                <Button
                                  size="small"
                                  onClick={() =>
                                    cambiarLinea(indice, {
                                      descripcion: `${
                                        String(linea.descripcion ?? '').trim() ||
                                        descripcionPropuestaOnerrd(valores.anio).replace(
                                          ` (${VARIABLE_REGISTRO_FACTURA})`,
                                          ''
                                        )
                                      } (${VARIABLE_REGISTRO_FACTURA})`,
                                    })
                                  }
                                  sx={{ minWidth: 0, px: 0.75, whiteSpace: 'nowrap' }}
                                >
                                  + N.º
                                </Button>
                              </Tooltip>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                    {lineasFactura.length > 1 && (
                      <Tooltip title="Quitar esta línea">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() =>
                            setValores((v) => ({
                              ...v,
                              facturaLineas: lineasFactura.filter((_, i) => i !== indice),
                            }))
                          }
                        >
                          <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      label="Cantidad"
                      value={linea.cantidad ?? ''}
                      onChange={(event) => cambiarLinea(indice, { cantidad: event.target.value })}
                      slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 5 } }}
                      sx={{ width: 100 }}
                    />
                    <TextField
                      size="small"
                      fullWidth
                      label="Precio"
                      value={linea.precio ?? ''}
                      onChange={(event) => cambiarLinea(indice, { precio: event.target.value })}
                      slotProps={{
                        htmlInput: { inputMode: 'decimal', maxLength: 12 },
                        input: {
                          startAdornment: <InputAdornment position="start">RD$</InputAdornment>,
                        },
                      }}
                    />
                  </Stack>
                </Stack>
              ))}
              <Button
                size="small"
                color="inherit"
                disabled={lineasFactura.length >= 20}
                onClick={() =>
                  setValores((v) => ({
                    ...v,
                    facturaLineas: [...lineasFactura, { ...LINEA_FACTURA_INICIAL }],
                  }))
                }
                startIcon={<Iconify icon="mingcute:add-line" />}
                sx={{ alignSelf: 'flex-start' }}
              >
                Agregar línea
              </Button>

              <TextField
                size="small"
                label="Código de descuento"
                placeholder="Opcional"
                value={valores.facturaCodigo ?? ''}
                onChange={(event) =>
                  setValores((v) => ({ ...v, facturaCodigo: event.target.value }))
                }
                slotProps={{ htmlInput: { maxLength: 40 } }}
              />
              <Stack direction="row" spacing={1.5}>
                <TextField
                  size="small"
                  fullWidth
                  label="Descuento"
                  placeholder="0.00"
                  value={valores.facturaDescuento ?? ''}
                  onChange={(event) =>
                    setValores((v) => ({ ...v, facturaDescuento: event.target.value }))
                  }
                  slotProps={{
                    htmlInput: { inputMode: 'decimal', maxLength: 12 },
                    input: {
                      startAdornment: <InputAdornment position="start">RD$</InputAdornment>,
                    },
                  }}
                />
                <TextField
                  size="small"
                  fullWidth
                  label="Impuestos"
                  placeholder="0"
                  value={valores.facturaImpuestos ?? ''}
                  onChange={(event) =>
                    setValores((v) => ({ ...v, facturaImpuestos: event.target.value }))
                  }
                  slotProps={{
                    htmlInput: { inputMode: 'decimal', maxLength: 6 },
                    input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                  }}
                />
              </Stack>

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
                  PDF y Fact.
                </LoadingButton>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                La prueba no gasta número ni queda registrada.
              </Typography>
            </Stack>
          </Card>

          {!soloFactura && (
            <>
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
                  {/* Suma imágenes (no reemplaza): también se sueltan encima del
                      certificado, donde caen. */}
                  <LoadingButton
                    variant="outlined"
                    loading={ocupado === 'imagen-certificado'}
                    loadingPosition="start"
                    disabled={(diseno.imagenes?.length || 0) >= MAXIMO_IMAGENES_SUBIDAS_ONERRD}
                    startIcon={<Iconify icon="solar:gallery-add-bold" />}
                    onClick={() => pedirImagenes('certificado')}
                  >
                    Subir imagen (PNG, JPG, WebP)
                  </LoadingButton>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    O arrástralas encima del certificado. {diseno.imagenes?.length || 0} de{' '}
                    {MAXIMO_IMAGENES_SUBIDAS_ONERRD}.
                  </Typography>
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
            </>
          )}
        </Stack>

        {/* Certificado y factura: dos desplegables que se abren y cierran desde
            su título; pueden estar los dos abiertos. */}
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          {membresiaEnEdicion && (
            <Alert
              severity="success"
              action={
                <Button color="inherit" size="small" onClick={() => setMembresiaEnEdicion(null)}>
                  Salir
                </Button>
              }
            >
              Editando el certificado y la factura de{' '}
              <strong>
                {membresiaEnEdicion.destacamento?.numero
                  ? `#${membresiaEnEdicion.destacamento.numero} `
                  : ''}
                {membresiaEnEdicion.destacamento?.nombre}
              </strong>{' '}
              (membresía 2027). Al emitir, los documentos se enviarán por correo si el pago está
              confirmado.
            </Alert>
          )}
          <Card sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
              {botonPanel}
              <TituloDesplegable
                titulo="Diseño del certificado"
                abierto={verCertificado}
                onAlternar={() => setVerCertificado((v) => !v)}
              />
              {verCertificado && (
                <>
                  <Button
                    size="small"
                    startIcon={<Iconify icon="mingcute:add-line" />}
                    endIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={16} />}
                    onClick={(event) => setMenuAgregar(event.currentTarget)}
                  >
                    Agregar texto
                  </Button>
                  {papelera.boton}
                  <Menu
                    anchorEl={menuAgregar}
                    open={!!menuAgregar}
                    onClose={() => setMenuAgregar(null)}
                  >
                    {Object.entries(NUEVO_TEXTO).map(([tipo, { titulo, detalle }]) => (
                      <MenuItem key={tipo} onClick={() => agregarTexto(tipo)}>
                        <ListItemText primary={titulo} secondary={detalle} />
                      </MenuItem>
                    ))}
                  </Menu>
                  <Button
                    size="small"
                    color={modoVista ? 'primary' : 'inherit'}
                    startIcon={
                      <Iconify icon={modoVista ? 'solar:eye-closed-bold' : 'solar:eye-bold'} />
                    }
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
                      <Iconify
                        icon={hayCambios ? 'solar:file-text-bold' : 'solar:check-circle-bold'}
                      />
                    }
                  >
                    {hayCambios ? 'Guardar diseño' : 'Guardado'}
                  </LoadingButton>
                </>
              )}
            </Stack>

            <Collapse in={verCertificado}>
              <Box sx={{ mt: 2 }}>
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
                    onAtajo={alAtajo}
                    imagenesSubidas={imagenesCertificado}
                    onSoltarArchivos={(archivos, donde) =>
                      subirImagenes('certificado', archivos, donde)
                    }
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
                      imagenesSubidas={imagenesCertificado}
                      onQuitarImagenSubida={quitarImagenSubida}
                    />
                  </>
                )}
              </Box>
            </Collapse>
          </Card>

          {/* Siempre a la vista, recogido como el del certificado: se abre y se
              cierra desde su título. Al abrirlo se recoge el certificado (que
              vuelve desde el suyo: los dos pueden estar abiertos). */}
          <EditorFacturaOnerrd
            abierto={verFactura}
            onAlternar={() => {
              if (!verFactura) setVerCertificado(false);
              setVerFactura((v) => !v);
            }}
            diseno={disenoFactura}
            onCambiarDiseno={setDisenoFactura}
            hayCambios={hayCambiosFactura}
            guardando={ocupado === 'diseno-factura'}
            onGuardar={guardarDisenoFactura}
            onDescartar={descartarFactura}
            valores={valores}
            anio={anio}
            onCambiarValor={cambiarValor}
            fuentesListas={fuentesListas}
            imagenes={imagenesFactura}
            numeroRegistro={proximoNumero}
            onSubirImagen={() => pedirImagenes('factura')}
            onSoltarArchivos={(archivos, donde) => subirImagenes('factura', archivos, donde)}
            subiendoImagen={ocupado === 'imagen-factura'}
            botonPanel={botonPanel}
          />

          {/* Debajo de la factura: lo que la landing de pago lee (montos,
              planes, licencias, banco, PayPal, tasa). */}
          <MembresiaOnerrdConfig
            abierto={verMembresia}
            onAlternar={() => setVerMembresia((v) => !v)}
            user={user}
          />

          {/* Debajo, en verde: los pagos que entran por la landing. */}
          <MembresiaOnerrdPagos
            abierto={verPagos}
            onAlternar={() => setVerPagos((v) => !v)}
            onEditar={editarMembresia}
            onConfirmada={emitirAlConfirmar}
            version={versionPagos}
            user={user}
          />

          {/* Debajo de los pagos: los destacamentos inscritos en 2026 (descuento
              por fidelidad), como el reporte de registro anual. */}
          <Inscritos2026
            abierto={verInscritos}
            onAlternar={() => setVerInscritos((v) => !v)}
            user={user}
          />
        </Stack>
      </Box>

      {papelera.dialogo}
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
