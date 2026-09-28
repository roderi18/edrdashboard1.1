'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';

import { Pie, Portada, Encabezado } from 'src/sections/registro/portada';
import { FormularioRegistro } from 'src/sections/registro/formulario-registro';

// ----------------------------------------------------------------------
// La única página: portada + formulario de registro/actualización.
// ----------------------------------------------------------------------

export default function Page() {
  const [destacamentos, setDestacamentos] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  // El mapa cuenta los destacamentos que ya enviaron, no el padrón entero.
  const [enviados, setEnviados] = useState([]);
  const leerEnviados = useCallback(() => {
    fetch('/api/envios')
      .then((r) => (r.ok ? r.json() : []))
      .then((e) => Array.isArray(e) && setEnviados(e))
      .catch(() => {});
  }, []);

  useEffect(() => leerEnviados(), [leerEnviados]);

  useEffect(() => {
    Promise.all([
      fetch('/api/destacamentos').then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch('/api/secciones').then((r) => (r.ok ? r.json() : Promise.reject(r))),
    ])
      .then(([d, s]) => {
        setDestacamentos(Array.isArray(d) ? d : []);
        setSecciones(Array.isArray(s) ? s : []);
      })
      .catch(() =>
        setErrorCarga('No se pudo cargar la lista de destacamentos. Recarga la página en unos minutos.')
      )
      .finally(() => setCargando(false));
  }, []);

  return (
    <Box sx={{ bgcolor: 'background.neutral', minHeight: '100vh' }}>
      <Encabezado />
      <Portada destacamentos={enviados} secciones={secciones} />
      <Container maxWidth="xl" sx={{ mt: { xs: 4, md: 6 } }}>
        <FormularioRegistro
          destacamentos={destacamentos}
          secciones={secciones}
          cargando={cargando}
          errorCarga={errorCarga}
          enviados={enviados}
          onEnviado={leerEnviados}
        />
      </Container>
      <Pie />
    </Box>
  );
}
