'use client';

import { useState, useEffect } from 'react';

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
      <Portada destacamentos={destacamentos} secciones={secciones} />
      <Container maxWidth="xl" sx={{ mt: { xs: 4, md: 6 } }}>
        <FormularioRegistro
          destacamentos={destacamentos}
          secciones={secciones}
          cargando={cargando}
          errorCarga={errorCarga}
        />
      </Container>
      <Pie />
    </Box>
  );
}
