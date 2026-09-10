'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';

import {
  fondoACss,
  efectoACss,
  figuraACss,
  elementoACss,
  sanearDiseno,
  elementosVisibles,
} from 'src/utils/store-header-design.mjs';

import { CuentaRegresiva } from './cuenta-regresiva';

// ----------------------------------------------------------------------
// EL LIENZO: lo que se ve, con o sin editor.
//
// ES EL MISMO COMPONENTE para el cliente y para quien edita. Si fueran dos, el
// editor enseñaria una cosa y la tienda otra, que es la forma clasica de que un
// diseño se guarde "bien" y salga mal.
//
// Lo que cambia entre los dos no es el pintado, sino lo que se le cuelga
// encima: la cuadricula, el contorno de lo seleccionado y las asas. Eso llega
// por `children` y por `slotElemento`, asi que aqui no hay ni una condicion
// sobre quien esta mirando.
//
// El movimiento tampoco se escribe aqui: sale de `efectoACss`, la misma funcion
// que usan las vistas previas del editor. Escrito en dos sitios, la muestra y
// el resultado acabarian siendo cosas distintas.
// ----------------------------------------------------------------------

export function HeaderVisualCanvas({
  diseno,
  fotoUrl = '',
  animaciones = true,
  // El editor pinta TODO, incluida una promocion que aun no ha empezado o que ya
  // caduco: si no, se colocaria a ciegas algo que no se ve.
  mostrarProgramados = false,
  slotElemento,
  onImpresion,
  onClicElemento,
  children,
  sx,
  ...other
}) {
  const seguro = sanearDiseno(diseno);
  const anotados = useRef('');

  // EL RELOJ, EN ESTADO Y NO LEIDO AL PINTAR. Dos motivos: pintar tiene que dar
  // siempre el mismo resultado con las mismas entradas —si no, el servidor y el
  // navegador dibujan cosas distintas y React protesta—, y sobre todo una
  // promocion programada para las 20:00 tiene que APARECER a las 20:00, sin que
  // haga falta recargar. Medio minuto de precision sobra para una oferta; la
  // cuenta regresiva lleva su propio segundero.
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 30000);

    return () => clearInterval(reloj);
  }, []);

  const elementos = elementosVisibles(seguro, ahora, { todos: mostrarProgramados });

  // LA IMPRESION SE CUENTA UNA VEZ POR LO QUE SE VE, no una por pintado. React
  // vuelve a pintar por muchos motivos —un cambio de tamaño de ventana, un
  // estado de al lado— y sin esta guarda una sola visita valia por veinte.
  const idsVisibles = elementos.map((elemento) => elemento.id).join(',');

  useEffect(() => {
    if (!onImpresion || !idsVisibles) return;
    if (anotados.current === idsVisibles) return;

    anotados.current = idsVisibles;
    onImpresion(idsVisibles.split(','));
  }, [idsVisibles, onImpresion]);

  const conMovimiento = (elemento) => (animaciones ? efectoACss(elemento) : null);

  const renderContenido = (elemento) => {
    if (elemento.tipo === 'imagen') {
      return (
        <Box
          component="img"
          alt=""
          src={elemento.url}
          data-elemento={elemento.id}
          draggable={false}
          sx={{
            position: 'absolute',
            zIndex: elemento.capa,
            // Entera dentro de su ancho y sin deformarse: el escudo se reconoce
            // por su forma, y estirarlo lo estropea.
            height: 'auto',
            objectFit: 'contain',
            ...elementoACss(elemento),
            ...conMovimiento(elemento),
          }}
        />
      );
    }

    if (elemento.tipo === 'linea' || elemento.tipo === 'forma') {
      return (
        <Box
          data-elemento={elemento.id}
          sx={{
            position: 'absolute',
            zIndex: elemento.capa,
            ...figuraACss(elemento),
            ...conMovimiento(elemento),
          }}
        />
      );
    }

    return (
      <Box
        data-elemento={elemento.id}
        sx={{
          position: 'absolute',
          zIndex: elemento.capa,
          lineHeight: 1.2,
          // LAS PALABRAS NO SE PARTEN. Con corte por letra, "¡Oferta!" en un
          // bloque estrecho salia como "¡Ofert / a!". Si no cabe, que se salga
          // del bloque: se ve y se corrige, en vez de quedarse escrito a medias.
          wordBreak: 'keep-all',
          overflowWrap: 'normal',
          ...elementoACss(elemento),
          ...conMovimiento(elemento),
          // COMO BOTON: el mismo texto, con cuerpo. Se pinta con el color del
          // elemento de fondo y el texto oscuro encima, para que una llamada a
          // la accion parezca lo que es y se pueda pulsar con el pulgar.
          ...(elemento.comoBoton && {
            px: 2,
            py: 1,
            color: '#212B36',
            borderRadius: 999,
            textAlign: 'center',
            backgroundColor: elemento.color,
            backgroundImage: 'none',
            WebkitBackgroundClip: 'border-box',
            backgroundClip: 'border-box',
          }),
        }}
      >
        {elemento.tipo === 'cuenta' ? (
          <CuentaRegresiva
            hasta={elemento.hasta}
            textoFinal={elemento.texto}
            formato={elemento.formatoCuenta}
            prefijo={elemento.prefijoCuenta}
          />
        ) : (
          elemento.texto
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={[
        {
          width: 1,
          minWidth: 0,
          overflow: 'hidden',
          position: 'relative',
          minHeight: seguro.altura,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          // La foto va DEBAJO de la capa de fondo, en la misma propiedad: asi un
          // fondo con opacidad la deja asomar sin necesitar dos capas apiladas.
          backgroundImage: fotoUrl
            ? `${fondoACss(seguro.fondo)}, url(${fotoUrl})`
            : fondoACss(seguro.fondo),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {elementos.map((elemento) => {
        // Una imagen sin direccion valida no se pinta: dejaria un <img> roto en
        // la portada de todos.
        if (elemento.tipo === 'imagen' && !elemento.url) return null;

        const contenido = renderContenido(elemento);

        if (slotElemento) return slotElemento(elemento, contenido);

        // CON ENLACE, ES UN ENLACE DE VERDAD. Un `div` con `onClick` no se abre
        // en otra pestaña, no se puede copiar y el teclado no llega a el.
        return elemento.enlace ? (
          <Box
            key={elemento.id}
            component="a"
            href={elemento.enlace}
            onClick={() => onClicElemento?.(elemento.id)}
            // Solo lo externo se abre fuera; dentro del panel, la navegacion
            // propia es mas rapida y no pierde la sesion.
            {...(elemento.enlace.startsWith('http') && {
              target: '_blank',
              rel: 'noopener noreferrer',
            })}
            sx={{ display: 'contents', color: 'inherit', textDecoration: 'none' }}
          >
            {contenido}
          </Box>
        ) : (
          <Box key={elemento.id} sx={{ display: 'contents' }}>
            {contenido}
          </Box>
        );
      })}

      {children}
    </Box>
  );
}
