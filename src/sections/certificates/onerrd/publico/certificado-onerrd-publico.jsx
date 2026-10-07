'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// EL CONTENEDOR QUE ABRE EL CÓDIGO QR: arriba, qué certificado es y la fecha y
// hora en que se generó; dentro, el PDF guardado en Firebase.
//
// El PDF se pinta con pdf.js en lienzos y no en un <iframe>: Chrome de Android
// no enseña PDFs incrustados y Safari del iPhone solo la primera página, y casi
// todo el que escanea el QR lo hace con el móvil.
// ----------------------------------------------------------------------

const AVISOS = {
  prueba: {
    titulo: 'Certificado de prueba',
    texto:
      'Este código pertenece a un PDF de prueba del Certificado de Registro ONERRD: no tiene validez. Los certificados emitidos abren aquí su certificado.',
    color: 'info',
    icono: 'solar:info-circle-bold',
  },
  'no-encontrado': {
    titulo: 'Certificado no encontrado',
    texto:
      'Este código no corresponde a ningún certificado ONERRD emitido. Si lo escaneó de un certificado impreso, comuníquese con la Oficina Nacional de Exploradores del Rey.',
    color: 'error',
    icono: 'solar:danger-triangle-bold',
  },
  'sin-pdf': {
    titulo: 'Certificado aún no disponible',
    texto:
      'El certificado está registrado, pero su PDF todavía no se ha guardado. Comuníquese con la Oficina Nacional de Exploradores del Rey.',
    color: 'warning',
    icono: 'solar:danger-triangle-bold',
  },
  'no-disponible': {
    titulo: 'Servicio no disponible',
    texto: 'No se pudo consultar el certificado en este momento. Inténtelo más tarde.',
    color: 'warning',
    icono: 'solar:danger-bold',
  },
};

// Ancho al que se pinta cada página: nítido en un móvil de pantalla densa sin
// pasarse de memoria. El lienzo se encoge al ancho del contenedor por CSS.
const ANCHO_DE_PINTADO = 2000;

function PaginasDelPdf({ url }) {
  const contenedor = useRef(null);
  const [estado, setEstado] = useState('cargando');

  useEffect(() => {
    let cancelado = false;
    let documento = null;

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = '/app/pdf.worker.min.mjs';
        documento = await pdfjs.getDocument({ url }).promise;

        const lienzos = [];
        for (let n = 1; n <= documento.numPages; n += 1) {
          const pagina = await documento.getPage(n);
          const escala = ANCHO_DE_PINTADO / pagina.getViewport({ scale: 1 }).width;
          const viewport = pagina.getViewport({ scale: escala });
          const lienzo = document.createElement('canvas');
          lienzo.width = Math.round(viewport.width);
          lienzo.height = Math.round(viewport.height);
          lienzo.style.cssText = 'display:block;width:100%;height:auto';
          lienzo.setAttribute('role', 'img');
          lienzo.setAttribute('aria-label', `Certificado, página ${n}`);

          await pagina.render({ canvasContext: lienzo.getContext('2d'), canvas: lienzo, viewport })
            .promise;
          lienzos.push(lienzo);
        }

        if (cancelado || !contenedor.current) return;
        contenedor.current.replaceChildren(...lienzos);
        setEstado('listo');
      } catch (error) {
        console.error('[onerrd] no se pudo pintar el certificado', error);
        if (!cancelado) setEstado('error');
      }
    })();

    return () => {
      cancelado = true;
      documento?.destroy();
    };
  }, [url]);

  return (
    <>
      {estado === 'cargando' && (
        // Un certificado apaisado (carta): el esqueleto ya ocupa su sitio.
        <Skeleton
          variant="rectangular"
          sx={{ width: 1, aspectRatio: '11 / 8.5', borderRadius: 1 }}
        />
      )}

      {estado === 'error' && (
        <Stack spacing={1.5} alignItems="center" sx={{ py: 6, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No se pudo mostrar el certificado aquí. Ábralo directamente:
          </Typography>
          <Button
            variant="outlined"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<Iconify icon="eva:external-link-fill" />}
          >
            Abrir el PDF
          </Button>
        </Stack>
      )}

      <Box
        ref={contenedor}
        sx={{
          display: estado === 'listo' ? 'grid' : 'none',
          gap: 2,
          '& canvas': { borderRadius: 1, boxShadow: (theme) => theme.vars.customShadows.z8 },
        }}
      />
    </>
  );
}

export function CertificadoOnerrdPublico({
  estado,
  numero,
  generadoEn,
  destacamento,
  urlPdf,
  urlDescarga,
}) {
  const aviso = AVISOS[estado];

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.neutral',
        px: 2,
        py: { xs: 3, md: 6 },
        display: 'flex',
        alignItems: aviso ? 'center' : 'flex-start',
        justifyContent: 'center',
      }}
    >
      <Card sx={{ width: 1, maxWidth: aviso ? 480 : 1000 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          sx={{ p: { xs: 2, md: 3 } }}
        >
          <Box
            component="img"
            src="/marca/watermark.webp"
            alt="Exploradores del Rey"
            sx={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }}
          />

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Exploradores del Rey · Oficina Nacional
            </Typography>
            <Typography variant="h5">
              {aviso ? aviso.titulo : 'Certificado de Registro ONERRD'}
            </Typography>
            {!aviso && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                N.º {numero}
                {destacamento ? ` · Destacamento ${destacamento}` : ''}
              </Typography>
            )}
          </Box>

          {!aviso && (
            <Stack spacing={1} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
              <Label
                color="success"
                variant="soft"
                startIcon={<Iconify icon="solar:verified-check-bold" />}
              >
                Certificado emitido
              </Label>
              {generadoEn && (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Iconify
                    icon="solar:clock-circle-bold"
                    width={18}
                    sx={{ color: 'text.disabled' }}
                  />
                  <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
                    Generado: {generadoEn}
                  </Typography>
                </Stack>
              )}
            </Stack>
          )}
        </Stack>

        <Divider />

        {aviso ? (
          <Stack direction="row" spacing={1.5} sx={{ p: { xs: 2, md: 3 } }}>
            <Iconify
              icon={aviso.icono}
              width={24}
              sx={{ color: `${aviso.color}.main`, flexShrink: 0 }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {aviso.texto}
            </Typography>
          </Stack>
        ) : (
          <Box sx={{ p: { xs: 1.5, md: 3 } }}>
            <PaginasDelPdf url={urlPdf} />

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              justifyContent="flex-end"
              sx={{ mt: 3 }}
            >
              <Button
                variant="outlined"
                href={urlPdf}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<Iconify icon="eva:external-link-fill" />}
              >
                Abrir el PDF
              </Button>
              <Button
                variant="contained"
                href={urlDescarga}
                startIcon={<Iconify icon="solar:download-bold" />}
              >
                Descargar PDF
              </Button>
            </Stack>
          </Box>
        )}
      </Card>
    </Box>
  );
}
