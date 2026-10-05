'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';

import { Pie, Portada, Encabezado } from 'src/sections/registro/portada';

// El formulario es lo más pesado de la página (validación, calendarios, teléfono,
// subida de fotos): se descarga aparte para que la portada salga antes, con un
// esqueleto de su misma forma mientras llega. Sin servidor: recupera el borrador
// de este dispositivo, que el servidor no puede conocer.
const FormularioRegistro = dynamic(
  () => import('src/sections/registro/formulario-registro').then((m) => m.FormularioRegistro),
  { ssr: false, loading: () => <EsqueletoFormulario /> }
);

function EsqueletoFormulario() {
  return (
    <Box
      sx={{
        gap: 3,
        display: 'grid',
        alignItems: 'start',
        gridTemplateColumns: { xs: '1fr', lg: '260px minmax(0, 1fr) 280px' },
      }}
    >
      <Skeleton variant="rounded" height={360} sx={{ display: { xs: 'none', lg: 'block' } }} />
      <Card sx={{ p: { xs: 2.5, md: 4 } }}>
        <Skeleton height={8} sx={{ mb: 3 }} />
        <Skeleton width="60%" height={40} sx={{ mb: 3 }} />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 2 }} />
        ))}
      </Card>
      <Skeleton variant="rounded" height={360} sx={{ display: { xs: 'none', lg: 'block' } }} />
    </Box>
  );
}

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
    fetch('/api/envios/')
      .then((r) => (r.ok ? r.json() : []))
      .then((e) => Array.isArray(e) && setEnviados(e))
      .catch(() => {});
  }, []);

  useEffect(() => leerEnviados(), [leerEnviados]);

  useEffect(() => {
    Promise.all([
      fetch('/api/destacamentos/').then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch('/api/secciones/').then((r) => (r.ok ? r.json() : Promise.reject(r))),
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
      <Portada
        destacamentos={enviados}
        padron={destacamentos}
        secciones={secciones}
      />
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
