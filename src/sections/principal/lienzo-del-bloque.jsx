'use client';

import { useRef, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';

const SELECTOR = 'h1,h2,h3,h4,h5,h6,p,span,button,a,img,video';

const MARCA_DE_PRECIO = '[data-precio-producto]';

/** Si el elemento es el precio de un producto, de cuál y cuánto (para editarlo en la tienda). */
const precioDelElemento = (elemento) => {
  const marca = elemento?.closest?.(MARCA_DE_PRECIO);

  if (!marca) return {};

  return {
    productoId: marca.dataset.precioProducto,
    precio: Number(marca.dataset.precioActual) || 0,
    productoNombre: marca.dataset.precioNombre || '',
  };
};

const seleccionables = (raiz) =>
  Array.from(raiz?.querySelectorAll(SELECTOR) ?? []).filter((elemento) => {
    if (elemento.closest('[aria-label="Editar en EXPLORA Designer"]')) return false;
    if (elemento.matches('span')) {
      return Array.from(elemento.childNodes).some(
        (nodo) => nodo.nodeType === Node.TEXT_NODE && nodo.nodeValue.trim()
      );
    }
    return true;
  });

const primerTexto = (elemento) =>
  Array.from(elemento.childNodes).find(
    (nodo) => nodo.nodeType === Node.TEXT_NODE && nodo.nodeValue.trim()
  );

const propiedadesCss = (estilo) => ({
  ...(estilo.x === undefined && estilo.y === undefined
    ? {}
    : { translate: `${estilo.x ?? 0}px ${estilo.y ?? 0}px` }),
  ...(estilo.rotate === undefined ? {} : { rotate: `${estilo.rotate}deg` }),
  ...(estilo.width === undefined ? {} : { width: `${estilo.width}px` }),
  ...(estilo.height === undefined ? {} : { height: `${estilo.height}px` }),
  ...(estilo.fontSize === undefined ? {} : { 'font-size': `${estilo.fontSize}px` }),
  ...(estilo.letterSpacing === undefined ? {} : { 'letter-spacing': `${estilo.letterSpacing}px` }),
  ...(estilo.lineHeight === undefined ? {} : { 'line-height': String(estilo.lineHeight) }),
  ...(estilo.opacity === undefined ? {} : { opacity: String(estilo.opacity) }),
  ...(estilo.borderRadius === undefined ? {} : { 'border-radius': `${estilo.borderRadius}px` }),
  ...(estilo.color === undefined ? {} : { color: estilo.color }),
  ...(estilo.backgroundColor === undefined ? {} : { 'background-color': estilo.backgroundColor }),
  ...(estilo.fontFamily === undefined ? {} : { 'font-family': estilo.fontFamily }),
  ...(estilo.fontWeight === undefined ? {} : { 'font-weight': String(estilo.fontWeight) }),
  ...(estilo.textAlign === undefined ? {} : { 'text-align': estilo.textAlign }),
});

function Capa({ capa, editando, seleccionada }) {
  const estilo = capa.estilo ?? {};

  return (
    <Box
      data-lienzo-capa={capa.id}
      sx={{
        position: 'absolute',
        left: `${capa.x}%`,
        top: `${capa.y}%`,
        width: `${capa.width}%`,
        height: `${capa.height}%`,
        zIndex: 3,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: estilo.textAlign === 'center' ? 'center' : 'flex-start',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        color: estilo.color ?? '#FFFFFF',
        bgcolor: estilo.backgroundColor ?? (capa.tipo === 'forma' ? '#2466DB' : 'transparent'),
        borderRadius: estilo.borderRadius === undefined ? 0 : `${estilo.borderRadius}px`,
        fontSize: estilo.fontSize ?? 24,
        fontWeight: estilo.fontWeight ?? 700,
        fontFamily: estilo.fontFamily ?? 'inherit',
        letterSpacing: estilo.letterSpacing === undefined ? undefined : `${estilo.letterSpacing}px`,
        lineHeight: estilo.lineHeight ?? 1.2,
        opacity: estilo.opacity ?? 1,
        rotate: `${estilo.rotate ?? 0}deg`,
        textAlign: estilo.textAlign ?? 'left',
        outline: seleccionada ? '2px solid #438DFF' : 'none',
        outlineOffset: 2,
        cursor: editando ? 'move' : 'default',
        pointerEvents: editando ? 'auto' : 'none',
        userSelect: editando ? 'none' : 'auto',
        touchAction: editando ? 'none' : 'auto',
      }}
    >
      {capa.tipo === 'texto' && capa.texto}
      {capa.tipo === 'imagen' && (
        <Box
          component="img"
          src={capa.src}
          alt=""
          sx={{ width: 1, height: 1, objectFit: 'cover' }}
        />
      )}
      {editando && seleccionada && (
        <Box
          data-lienzo-redimensionar
          aria-label="Cambiar tamaño de capa"
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 14,
            height: 14,
            bgcolor: '#438DFF',
            border: '2px solid white',
            borderRadius: '3px',
            cursor: 'nwse-resize',
          }}
        />
      )}
    </Box>
  );
}

/** El mismo recubrimiento visual para la portada publicada y la vista previa. */
export function LienzoDelBloque({
  children,
  diseno,
  editando = false,
  seleccionado,
  onSeleccionar,
  onMover,
}) {
  const raizRef = useRef(null);
  const contenidoRef = useRef(null);
  const arrastreRef = useRef(null);
  const cuadroRef = useRef(null);
  const originalesRef = useRef(new WeakMap());

  useEffect(() => {
    const raiz = contenidoRef.current;
    if (!raiz) return undefined;
    if (!editando && !Object.keys(diseno?.elementosVisuales ?? {}).length) return undefined;

    const restauraciones = [];
    const originales = originalesRef.current;
    const aplicar = () => {
      const elementos = seleccionables(raiz);

      for (const [clave, estilo] of Object.entries(diseno?.elementosVisuales ?? {})) {
        const elemento = elementos[Number(clave)];
        if (!elemento) continue;

        for (const [propiedad, valor] of Object.entries(propiedadesCss(estilo))) {
          const anterior = elemento.style.getPropertyValue(propiedad);
          const prioridad = elemento.style.getPropertyPriority(propiedad);
          if (
            !restauraciones.some(
              (item) => item.elemento === elemento && item.propiedad === propiedad
            )
          ) {
            restauraciones.push({ elemento, propiedad, anterior, prioridad });
          }
          if (anterior !== valor || prioridad !== 'important') {
            elemento.style.setProperty(propiedad, valor, 'important');
          }
        }

        // Un precio de la tienda no se tapa con texto: se cambia en el producto
        // (ver `precio-de-producto.mjs`). Lo que se escribiera antes se ignora.
        if (estilo.texto !== undefined && !elemento.closest(MARCA_DE_PRECIO)) {
          const nodo = primerTexto(elemento);
          if (nodo) {
            if (!originales.has(nodo)) originales.set(nodo, nodo.nodeValue);
            if (nodo.nodeValue !== estilo.texto) nodo.nodeValue = estilo.texto;
          }
        }
      }

      if (editando && seleccionado?.tipo === 'elemento') {
        const elemento = elementos[Number(seleccionado.id)];
        if (elemento) elemento.setAttribute('data-lienzo-seleccionado', 'si');
      }
    };

    aplicar();
    const observador = new MutationObserver(aplicar);
    observador.observe(raiz, {
      childList: true,
      characterData: Object.values(diseno?.elementosVisuales ?? {}).some(
        (estilo) => estilo.texto !== undefined
      ),
      subtree: true,
    });

    return () => {
      observador.disconnect();
      raiz
        .querySelectorAll('[data-lienzo-seleccionado]')
        .forEach((elemento) => elemento.removeAttribute('data-lienzo-seleccionado'));
      restauraciones.forEach(({ elemento, propiedad, anterior, prioridad }) => {
        if (anterior) elemento.style.setProperty(propiedad, anterior, prioridad);
        else elemento.style.removeProperty(propiedad);
      });
      for (const [clave, estilo] of Object.entries(diseno?.elementosVisuales ?? {})) {
        if (estilo.texto === undefined) continue;
        const elemento = seleccionables(raiz)[Number(clave)];
        const nodo = elemento ? primerTexto(elemento) : null;
        const original = nodo && originales.get(nodo);
        if (nodo && original !== undefined && nodo.nodeValue === estilo.texto)
          nodo.nodeValue = original;
      }
    };
  }, [diseno, editando, seleccionado]);

  const alIniciar = useCallback(
    (evento) => {
      if (!editando) return;
      const capa = evento.target.closest('[data-lienzo-capa]');
      const redimensionar = Boolean(capa && evento.target.closest('[data-lienzo-redimensionar]'));
      const tipo = capa ? 'capa' : 'elemento';
      const elemento = capa || evento.target.closest(SELECTOR);
      if (!elemento || !raizRef.current?.contains(elemento)) return;
      if (elemento.closest('[aria-label="Editar en EXPLORA Designer"]')) return;

      const id =
        capa?.dataset.lienzoCapa ?? String(seleccionables(contenidoRef.current).indexOf(elemento));
      if (id === '-1') return;
      const datosCapa = diseno?.capasVisuales?.find((item) => item.id === id);

      evento.preventDefault();
      evento.stopPropagation();
      onSeleccionar?.({
        tipo,
        id,
        etiqueta: capa
          ? `Capa ${datosCapa?.tipo ?? 'visual'}`
          : elemento.textContent?.trim().slice(0, 80) || elemento.tagName,
        texto: capa ? '' : (primerTexto(elemento)?.nodeValue ?? ''),
        ...(capa ? {} : precioDelElemento(elemento)),
      });
      const medidas = raizRef.current.getBoundingClientRect();
      const ajuste = diseno?.elementosVisuales?.[id] ?? {};
      arrastreRef.current = {
        tipo,
        id,
        x: evento.clientX,
        y: evento.clientY,
        elemento: capa || elemento,
        ancho: medidas.width,
        alto: medidas.height,
        baseX: capa ? (datosCapa?.x ?? 0) : (ajuste.x ?? 0),
        baseY: capa ? (datosCapa?.y ?? 0) : (ajuste.y ?? 0),
        baseWidth: datosCapa?.width ?? 1,
        baseHeight: datosCapa?.height ?? 1,
        redimensionar,
      };
      raizRef.current.setPointerCapture(evento.pointerId);
    },
    [diseno, editando, onSeleccionar]
  );

  const alMover = useCallback((evento) => {
    const arrastre = arrastreRef.current;
    if (!arrastre) return;
    const dx = evento.clientX - arrastre.x;
    const dy = evento.clientY - arrastre.y;
    if (cuadroRef.current) cancelAnimationFrame(cuadroRef.current);
    if (Math.abs(dx) + Math.abs(dy) < 8) return;
    arrastre.activo = true;
    cuadroRef.current = requestAnimationFrame(() => {
      if (arrastre.tipo === 'capa') {
        if (arrastre.redimensionar) {
          arrastre.elemento.style.width = `${Math.max(1, Math.min(100, arrastre.baseWidth + (dx / arrastre.ancho) * 100))}%`;
          arrastre.elemento.style.height = `${Math.max(1, Math.min(100, arrastre.baseHeight + (dy / arrastre.alto) * 100))}%`;
        } else {
          arrastre.elemento.style.left = `${Math.max(0, Math.min(100, arrastre.baseX + (dx / arrastre.ancho) * 100))}%`;
          arrastre.elemento.style.top = `${Math.max(0, Math.min(100, arrastre.baseY + (dy / arrastre.alto) * 100))}%`;
        }
      } else {
        arrastre.elemento.style.setProperty(
          'translate',
          `${arrastre.baseX + dx}px ${arrastre.baseY + dy}px`,
          'important'
        );
      }
    });
  }, []);

  const alTerminar = useCallback(
    (evento) => {
      const arrastre = arrastreRef.current;
      arrastreRef.current = null;
      if (cuadroRef.current) cancelAnimationFrame(cuadroRef.current);
      cuadroRef.current = null;
      if (!arrastre) return;
      const dx = Math.round(evento.clientX - arrastre.x);
      const dy = Math.round(evento.clientY - arrastre.y);
      if (arrastre.activo && Math.abs(dx) + Math.abs(dy) > 8) {
        const medidas = raizRef.current?.getBoundingClientRect();
        onMover?.({
          tipo: arrastre.tipo,
          id: arrastre.id,
          accion: arrastre.redimensionar ? 'redimensionar' : 'mover',
          dx,
          dy,
          ancho: medidas?.width ?? 1,
          alto: medidas?.height ?? 1,
        });
      }
    },
    [onMover]
  );

  return (
    <Box
      ref={raizRef}
      data-everest-lienzo
      onPointerDownCapture={alIniciar}
      onPointerMove={alMover}
      onPointerUp={alTerminar}
      onPointerCancel={alTerminar}
      onClickCapture={
        editando
          ? (evento) => {
              evento.preventDefault();
              evento.stopPropagation();
            }
          : undefined
      }
      sx={{
        position: 'relative',
        width: 1,
        '& [data-lienzo-seleccionado="si"]': {
          outline: '2px solid #438DFF !important',
          outlineOffset: '3px',
          cursor: 'move',
        },
      }}
    >
      <Box ref={contenidoRef}>{children}</Box>
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {(diseno?.capasVisuales ?? []).map((capa) => (
          <Capa
            key={capa.id}
            capa={capa}
            editando={editando}
            seleccionada={seleccionado?.tipo === 'capa' && seleccionado.id === capa.id}
          />
        ))}
      </Box>
    </Box>
  );
}
