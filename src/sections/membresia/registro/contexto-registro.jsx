'use client';

import { useMemo, useState, useEffect, useContext, useCallback, createContext } from 'react';

import { pedirConfiguracion } from '../use-configuracion';

// ----------------------------------------------------------------------
// EL ESTADO DEL REGISTRO, compartido por las cuatro páginas (el layout de
// /registro lo monta una vez y sobrevive a la navegación entre pasos).
//
// Recargar deja todo como estaba: destacamento, plan, correo y teléfono,
// datos corregidos y quién los corrigió se guardan en ESTA pestaña
// (sessionStorage, se borra al cerrarla), y la ruta conserva el paso. Antes
// solo se guardaban destacamento y plan, y recargar vaciaba lo escrito.
// La elegibilidad (qué planes, si ya pagó) se vuelve a pedir al servidor:
// nunca se confía en una copia del navegador.
// ----------------------------------------------------------------------

export const PASOS = [
  {
    id: 'destacamento',
    ruta: '/registro/destacamento/',
    titulo: 'Destacamento',
    texto: 'Selecciona tu destacamento',
    icono: 'eva:search-fill',
  },
  {
    id: 'plan',
    ruta: '/registro/plan/',
    titulo: 'Plan',
    texto: 'Elige tu plan de membresía',
    icono: 'solar:bill-list-bold',
  },
  {
    id: 'pago',
    ruta: '/registro/pago/',
    titulo: 'Pago',
    texto: 'PayPal o transferencia',
    icono: 'solar:wad-of-money-bold',
  },
  {
    id: 'resultado',
    ruta: '/registro/resultado/',
    titulo: 'Resultado',
    texto: 'Tu certificado oficial',
    icono: 'solar:medal-ribbon-star-bold',
  },
];

const CLAVE = 'onerrd-membresia-2027';

const leerGuardado = () => {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE) || '{}') || {};
  } catch {
    return {};
  }
};

const guardar = (valor) => {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ ...leerGuardado(), ...valor }));
  } catch {
    // Sin almacenamiento (ventana privada): el registro sigue, solo no se recuerda.
  }
};

const pedirJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r)));

const ContextoRegistro = createContext(null);

export function ProveedorRegistro({ children }) {
  const [catalogo, setCatalogo] = useState(null);
  const [errorCatalogo, setErrorCatalogo] = useState('');
  const [configuracion, setConfiguracion] = useState(null);

  const [destacamentoId, setDestacamentoId] = useState(null);
  const [elegibilidad, setElegibilidad] = useState(null);
  const [cargandoElegibilidad, setCargandoElegibilidad] = useState(false);
  const [errorElegibilidad, setErrorElegibilidad] = useState('');
  const [planId, setPlanId] = useState(null);
  const [contacto, setContacto] = useState({ correo: '', telefono: '' });
  // Datos del destacamento que la persona corrige ("Corregir datos"): solo lo
  // que cambió. Con alguno, el pago queda en revisión hasta que la Oficina
  // Nacional confirme el cambio. En memoria, como el contacto.
  const [correcciones, setCorrecciones] = useState({});
  // Quién las hizo: { nombre, idMiembro, telefono }.
  const [corregidoPor, setCorregidoPor] = useState(null);
  // Quién registra el destacamento (sale en el reporte de registro anual).
  const [registradoPor, setRegistradoPor] = useState(null);
  const [restaurado, setRestaurado] = useState(false);
  // La solicitud ya enviada (paso Resultado): manda en el resumen del pedido.
  const [solicitud, setSolicitud] = useState(null);

  useEffect(() => {
    pedirJson('/api/catalogo/')
      .then((lista) => setCatalogo(Array.isArray(lista) ? lista : []))
      .catch(() => {
        setCatalogo([]);
        setErrorCatalogo(
          'No se pudo cargar el censo de destacamentos. Recarga la página en unos minutos.'
        );
      });
    pedirConfiguracion().then(setConfiguracion);
  }, []);

  const cargarElegibilidad = useCallback((id) => {
    setElegibilidad(null);
    setErrorElegibilidad('');
    if (!id) return Promise.resolve(null);
    setCargandoElegibilidad(true);
    return pedirJson(`/api/elegibilidad/?id=${encodeURIComponent(id)}`)
      .then((datos) => {
        setElegibilidad(datos);
        return datos;
      })
      .catch(() => {
        setErrorElegibilidad('No se pudo validar el destacamento. Inténtalo de nuevo.');
        return null;
      })
      .finally(() => setCargandoElegibilidad(false));
  }, []);

  // Al recargar en cualquier paso, se recupera lo elegido en esta pestaña.
  useEffect(() => {
    const guardado = leerGuardado();
    if (guardado.contacto) setContacto(guardado.contacto);
    if (guardado.registradoPor) setRegistradoPor(guardado.registradoPor);
    if (guardado.d) {
      setDestacamentoId(String(guardado.d));
      setPlanId(guardado.plan || null);
      setCorrecciones(guardado.correcciones || {});
      setCorregidoPor(guardado.corregidoPor || null);
      cargarElegibilidad(String(guardado.d)).finally(() => setRestaurado(true));
    } else {
      setRestaurado(true);
    }
  }, [cargarElegibilidad]);

  // Lo que se va escribiendo se guarda al momento (una vez restaurado, para
  // no pisar lo guardado con el estado vacío del arranque).
  useEffect(() => {
    if (restaurado) guardar({ contacto, correcciones, corregidoPor, registradoPor });
  }, [restaurado, contacto, correcciones, corregidoPor, registradoPor]);

  // La posición en la página: se anota al salir y se vuelve a ella cuando el
  // paso ya pintó sus datos (sin esperar, el contenido aún no mide lo mismo).
  useEffect(() => {
    const anotar = () => guardar({ scroll: { ruta: window.location.pathname, y: window.scrollY } });
    window.addEventListener('pagehide', anotar);
    return () => window.removeEventListener('pagehide', anotar);
  }, []);
  useEffect(() => {
    if (!restaurado || cargandoElegibilidad) return undefined;
    const { scroll } = leerGuardado();
    if (!scroll || scroll.ruta !== window.location.pathname) return undefined;
    guardar({ scroll: null });
    const espera = setTimeout(() => window.scrollTo({ top: scroll.y }), 150);
    return () => clearTimeout(espera);
  }, [restaurado, cargandoElegibilidad]);

  const elegirDestacamento = useCallback(
    (id) => {
      setDestacamentoId(id);
      setPlanId(null);
      setCorrecciones({});
      setCorregidoPor(null);
      guardar({ d: id || null, plan: null, correcciones: {}, corregidoPor: null });
      return cargarElegibilidad(id);
    },
    [cargarElegibilidad]
  );

  const elegirPlan = useCallback(
    (id) => {
      setPlanId(id);
      guardar({ d: destacamentoId, plan: id });
    },
    [destacamentoId]
  );

  // Un valor igual al del padrón no es una corrección.
  const corregir = useCallback(
    (campo, valor) =>
      setCorrecciones((actual) => {
        const original = String(elegibilidad?.destacamento?.[campo] ?? '').trim();
        const siguiente = { ...actual };
        if (String(valor ?? '').trim() === original) delete siguiente[campo];
        else siguiente[campo] = valor;
        return siguiente;
      }),
    [elegibilidad]
  );

  const reiniciar = useCallback(() => {
    setCorrecciones({});
    setDestacamentoId(null);
    setElegibilidad(null);
    setPlanId(null);
    setCorregidoPor(null);
    setRegistradoPor(null);
    guardar({
      d: null,
      plan: null,
      correcciones: {},
      corregidoPor: null,
      registradoPor: null,
    });
  }, []);

  // Si el plan guardado ya no le corresponde (cambió la elegibilidad), se suelta;
  // con un solo plan posible, queda elegido.
  const planes = useMemo(() => elegibilidad?.planes || [], [elegibilidad]);
  useEffect(() => {
    if (!elegibilidad) return;
    if (planId && !planes.some((p) => p.id === planId)) setPlanId(null);
    if (!planId && planes.length === 1) setPlanId(planes[0].id);
  }, [elegibilidad, planes, planId]);

  const plan = planes.find((p) => p.id === planId) || null;

  const valor = useMemo(
    () => ({
      catalogo,
      errorCatalogo,
      configuracion,
      destacamentoId,
      elegibilidad,
      cargandoElegibilidad,
      errorElegibilidad,
      planes,
      plan,
      contacto,
      restaurado,
      solicitud,
      correcciones,
      corregir,
      corregidoPor,
      setCorregidoPor,
      registradoPor,
      setRegistradoPor,
      descartarCorrecciones: () => {
        setCorrecciones({});
        setCorregidoPor(null);
      },
      setSolicitud,
      setContacto,
      elegirDestacamento,
      elegirPlan,
      reiniciar,
      recargarElegibilidad: () => cargarElegibilidad(destacamentoId),
    }),
    [
      catalogo,
      errorCatalogo,
      configuracion,
      destacamentoId,
      elegibilidad,
      cargandoElegibilidad,
      errorElegibilidad,
      planes,
      plan,
      contacto,
      restaurado,
      solicitud,
      correcciones,
      corregir,
      corregidoPor,
      registradoPor,
      elegirDestacamento,
      elegirPlan,
      reiniciar,
      cargarElegibilidad,
    ]
  );

  return <ContextoRegistro.Provider value={valor}>{children}</ContextoRegistro.Provider>;
}

export const useRegistro = () => {
  const contexto = useContext(ContextoRegistro);
  if (!contexto) throw new Error('useRegistro va dentro de <ProveedorRegistro>.');
  return contexto;
};

// "Destacamento 25 · Monte Horeb"
export const nombreDeDestacamento = (d) => {
  if (!d) return '';
  const nombre = d.nombre && !/^desconocid/i.test(d.nombre) ? d.nombre : '';
  const base = d.numero ? `Destacamento ${d.numero}` : 'Destacamento sin número';
  return nombre ? `${base} · ${nombre}` : base;
};
