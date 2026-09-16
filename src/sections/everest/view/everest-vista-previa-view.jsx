'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';

import { isAdminGlobal } from 'src/utils/org-level-access';
import {
  mensajeAlto,
  mensajeLista,
  mensajeValido,
  FUENTE_DESIGNER,
  TIPOS_DE_MENSAJE,
} from 'src/utils/everest/mensajes-vista-previa.mjs';

import { useAuthContext } from 'src/auth/hooks';

import { BloqueDeLaPortada } from '../bloque-de-la-portada';

// ----------------------------------------------------------------------
// LO QUE SE VE DENTRO DEL IFRAME DE LA VISTA PREVIA.
//
// Una pagina casi vacia: sin menu, sin cabecera, solo el bloque que se esta
// editando, pintado con sus componentes de verdad. El contenido no lo lee de
// Firestore: se lo manda el Designer por mensaje, en cuanto cambia, para que la
// vista previa vaya al mismo ritmo que se escribe y enseñe tambien lo que aun no
// se guardo.
//
// Solo pinta para el Administrador Global: la pagina se puede abrir a mano, y
// aunque no escribe nada, no tiene por que enseñarle a nadie mas lo que esta a
// medio editar.
// ----------------------------------------------------------------------

export function EverestVistaPreviaView() {
  const { user } = useAuthContext();
  const contenedorRef = useRef(null);
  const [recibido, setRecibido] = useState(null);

  const puedeVer = isAdminGlobal(user);

  useEffect(() => {
    if (!puedeVer || window.parent === window) return undefined;

    const alRecibir = (evento) => {
      // Solo del Designer que nos contiene, y de esta misma aplicacion.
      if (evento.source !== window.parent) return;

      const mensaje = mensajeValido(evento, window.location.origin, FUENTE_DESIGNER);

      if (mensaje?.tipo === TIPOS_DE_MENSAJE.contenido) {
        setRecibido({ idBloque: mensaje.idBloque, contenido: mensaje.contenido });
      }
    };

    window.addEventListener('message', alRecibir);
    window.parent.postMessage(mensajeLista(), window.location.origin);

    return () => window.removeEventListener('message', alRecibir);
  }, [puedeVer]);

  // EL ALTO, CADA VEZ QUE CAMBIA. Una tarjeta crece al escribirle un titulo mas
  // largo o al cargar su foto; sin avisarlo, el recuadro del Designer la cortaria.
  useEffect(() => {
    const contenedor = contenedorRef.current;

    if (!contenedor || window.parent === window || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observador = new ResizeObserver(() => {
      window.parent.postMessage(mensajeAlto(contenedor.scrollHeight), window.location.origin);
    });

    observador.observe(contenedor);

    return () => observador.disconnect();
  }, [recibido]);

  if (!puedeVer) return null;

  return (
    <Box ref={contenedorRef} sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}>
      {recibido && (
        <BloqueDeLaPortada idBloque={recibido.idBloque} contenido={recibido.contenido} />
      )}
    </Box>
  );
}
