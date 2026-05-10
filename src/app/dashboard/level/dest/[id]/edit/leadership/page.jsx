'use client';

import { useRef, useState, useEffect } from 'react';
import { pdf, Text, Document, StyleSheet, Page as PdfPage, Image as PdfImage } from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { useParams } from 'src/routes/hooks';

import { Iconify } from 'src/components/iconify';
import { OrganizationalChart } from 'src/components/organizational-chart';

import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { StandardNode } from 'src/sections/_examples/extra/organizational-chart-view/standard-node';
import { SIMPLE_DATA, LEADER_GROUP_DATA } from 'src/sections/_examples/extra/organizational-chart-view/data';

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;
const CONTROL_BUTTON_SIZE = 36;
const CONTROL_BUTTON_GAP = 6;
const ZOOM_PERCENT_WIDTH = CONTROL_BUTTON_SIZE * 2 + CONTROL_BUTTON_GAP;

const pdfStyles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: 'Helvetica',
    color: '#1C252E',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    marginBottom: 4,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 10,
    marginBottom: 18,
    color: '#637381',
  },
  chartImage: {
    width: '100%',
    objectFit: 'contain',
  },
});

function LeadershipPdfDocument({ destName, chartImage }) {
  return (
    <Document>
      <PdfPage size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>Organigrama de directiva</Text>
        <Text style={pdfStyles.subtitle}>Destacamento: {destName}</Text>

        <PdfImage src={chartImage} style={pdfStyles.chartImage} />
      </PdfPage>
    </Document>
  );
}

function DivisionNode({ name, avatarUrl, role, sx }) {
  return (
    <Card
      sx={[
        () => ({
          px: 1.5,
          py: 1,
          gap: 1,
          minWidth: 200,
          borderRadius: 1.5,
          textAlign: 'left',
          alignItems: 'center',
          display: 'inline-flex',
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Avatar alt={name} src={avatarUrl} sx={{ width: 32, height: 32 }} />

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {name}
        </Typography>

        <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary' }}>
          {role}
        </Typography>
      </Box>
    </Card>
  );
}

const slugify = (value) =>
  String(value || 'destacamento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const getDocumentStyleText = () =>
  Array.from(document.styleSheets)
    .map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');

const inlineComputedStyles = (source, target) => {
  const computedStyle = window.getComputedStyle(source);

  Array.from(computedStyle).forEach((property) => {
    target.style.setProperty(
      property,
      computedStyle.getPropertyValue(property),
      computedStyle.getPropertyPriority(property)
    );
  });

  Array.from(source.children).forEach((sourceChild, index) => {
    const targetChild = target.children[index];

    if (targetChild) {
      inlineComputedStyles(sourceChild, targetChild);
    }
  });
};

const inlineImages = async (element) => {
  const images = Array.from(element.querySelectorAll('img'));

  await Promise.all(
    images.map(async (image) => {
      const src = image.currentSrc || image.src;

      if (!src || src.startsWith('data:')) {
        return;
      }

      try {
        const response = await fetch(src);

        if (!response.ok) {
          return;
        }

        const blob = await response.blob();
        image.src = await blobToDataUrl(blob);
      } catch {
        // Keep the original source if the browser cannot inline it.
      }
    })
  );
};

const elementToPngDataUrl = async (element) => {
  const rect = element.getBoundingClientRect();
  const clone = element.cloneNode(true);
  const hiddenElements = clone.querySelectorAll('[data-pdf-hidden="true"]');

  inlineComputedStyles(element, clone);
  hiddenElements.forEach((hiddenElement) => hiddenElement.remove());

  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;

  const styleElement = document.createElement('style');

  styleElement.textContent = getDocumentStyleText();
  clone.prepend(styleElement);

  await inlineImages(clone);

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
      <foreignObject width="100%" height="100%">${serialized}</foreignObject>
    </svg>
  `;
  const image = new Image();
  const canvas = document.createElement('canvas');
  const scale = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.ceil(rect.width * scale);
  canvas.height = Math.ceil(rect.height * scale);

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('No se pudo preparar el lienzo del organigrama.');
  }

  context.scale(scale, scale);
  context.drawImage(image, 0, 0);

  return canvas.toDataURL('image/png');
};

export default function Page() {
  const params = useParams();
  const destId = params?.id;
  const chartCaptureRef = useRef(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const skipNextDragRef = useRef(false);
  const [destName, setDestName] = useState('Destacamento');
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const zoomPercentage = Math.round(zoom * 100);

  useEffect(() => {
    const handleClickAwayPopover = (event) => {
      const popoverPaper = document.querySelector('.MuiPopover-paper');

      if (!popoverPaper || popoverPaper.contains(event.target)) {
        return;
      }

      skipNextDragRef.current = true;
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
        })
      );
    };

    document.addEventListener('pointerdown', handleClickAwayPopover, true);

    return () => {
      document.removeEventListener('pointerdown', handleClickAwayPopover, true);
    };
  }, []);

  useEffect(() => {
    const loadDest = async () => {
      try {
        const res = await fetch('/api/dest');
        const data = await res.json();
        const found = (data?.data || []).find(
          (dest) =>
            String(dest.idDestacamento) === String(destId) || String(dest.id) === String(destId)
        );

        if (found?.nombre || found?.name) {
          setDestName(found.nombre || found.name);
        }
      } catch (error) {
        console.error('Error cargando destacamento:', error);
      }
    };

    if (destId) {
      loadDest();
    }
  }, [destId]);

  const handlePointerDown = (event) => {
    const interactiveElement = event.target.closest?.(
      '.MuiCard-root, button, a, input, textarea, select, [role="button"]'
    );

    if (skipNextDragRef.current) {
      skipNextDragRef.current = false;
      return;
    }

    if (event.button !== 0 || interactiveElement) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!isDragging) {
      return;
    }

    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;

    setPan({
      x: dragRef.current.panX + deltaX,
      y: dragRef.current.panY + deltaY,
    });
  };

  const handlePointerUp = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
  };

  const handleZoomOut = () => {
    setZoom((currentZoom) => Math.max(MIN_ZOOM, Number((currentZoom - ZOOM_STEP).toFixed(2))));
  };

  const handleZoomIn = () => {
    setZoom((currentZoom) => Math.min(MAX_ZOOM, Number((currentZoom + ZOOM_STEP).toFixed(2))));
  };

  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleDownloadPdf = async () => {
    if (!chartCaptureRef.current) {
      return;
    }

    setIsDownloading(true);

    try {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
        })
      );

      const chartImage = await elementToPngDataUrl(chartCaptureRef.current);
      const blob = await pdf(
        <LeadershipPdfDocument destName={destName} chartImage={chartImage} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `organigrama-${slugify(destName)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <DestEditLayout>
      <Box
        ref={chartCaptureRef}
        aria-label="Mover organigrama"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        sx={{
          width: 1,
          mx: 'auto',
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          minHeight: 680,
          justifyContent: 'center',
          bgcolor: 'background.neutral',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          py: { xs: 3, md: 4 },
          px: { xs: 1.5, md: 2 },
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          touchAction: 'none',
          '& button, & a, & input, & textarea, & select, & [role="button"]': {
            cursor: 'pointer',
            touchAction: 'auto',
          },
          '& .MuiCard-root': {
            cursor: 'default',
            touchAction: 'auto',
          },
          '& .MuiCard-root button': {
            cursor: 'pointer',
          },
        }}
      >
        <Stack
          data-pdf-hidden="true"
          spacing={0.75}
          onPointerDown={(event) => event.stopPropagation()}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 2,
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gap: `${CONTROL_BUTTON_GAP}px`,
              gridTemplateColumns: `repeat(3, ${CONTROL_BUTTON_SIZE}px)`,
            }}
          >
            <Tooltip title="Centrar vista">
              <IconButton
                size="small"
                aria-label="Centrar vista"
                onClick={handleResetView}
                sx={{
                  width: CONTROL_BUTTON_SIZE,
                  height: CONTROL_BUTTON_SIZE,
                  minWidth: CONTROL_BUTTON_SIZE,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  boxShadow: 1,
                  '&:hover': { bgcolor: 'background.paper' },
                }}
              >
                <Iconify width={18} icon="solar:restart-bold" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Descargar PDF">
              <Box component="span" sx={{ gridColumn: '1', gridRow: '2' }}>
                <IconButton
                  size="small"
                  aria-label="Descargar PDF"
                  disabled={isDownloading}
                  onClick={handleDownloadPdf}
                  sx={{
                    width: CONTROL_BUTTON_SIZE,
                    height: CONTROL_BUTTON_SIZE,
                    minWidth: CONTROL_BUTTON_SIZE,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    boxShadow: 1,
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  <Iconify width={18} icon="solar:download-bold" />
                </IconButton>
              </Box>
            </Tooltip>

            <Tooltip title="Reducir zoom">
              <Box component="span" sx={{ gridColumn: '2', gridRow: '1' }}>
                <IconButton
                  size="small"
                  aria-label="Reducir zoom"
                  disabled={zoom <= MIN_ZOOM}
                  onClick={handleZoomOut}
                  sx={{
                    width: CONTROL_BUTTON_SIZE,
                    height: CONTROL_BUTTON_SIZE,
                    minWidth: CONTROL_BUTTON_SIZE,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    boxShadow: 1,
                    fontSize: 20,
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  -
                </IconButton>
              </Box>
            </Tooltip>

            <Tooltip title="Aumentar zoom">
              <Box component="span" sx={{ gridColumn: '3', gridRow: '1' }}>
                <IconButton
                  size="small"
                  aria-label="Aumentar zoom"
                  disabled={zoom >= MAX_ZOOM}
                  onClick={handleZoomIn}
                  sx={{
                    width: CONTROL_BUTTON_SIZE,
                    height: CONTROL_BUTTON_SIZE,
                    minWidth: CONTROL_BUTTON_SIZE,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    boxShadow: 1,
                    fontSize: 20,
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  +
                </IconButton>
              </Box>
            </Tooltip>

            <Typography
              variant="caption"
              sx={{
                width: ZOOM_PERCENT_WIDTH,
                height: CONTROL_BUTTON_SIZE,
                minWidth: ZOOM_PERCENT_WIDTH,
                display: 'flex',
                gridColumn: '2 / 4',
                gridRow: '2',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                borderRadius: 1,
                boxShadow: 1,
                lineHeight: 1.5,
                fontWeight: 700,
                color: 'text.secondary',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {zoomPercentage}%
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            '--chart-pan-x': `${pan.x}px`,
            '--chart-pan-y': `${pan.y}px`,
            '--chart-zoom': zoom,
            width: 1080,
            flexShrink: 0,
            '--chart-base-scale': {
              xs: 0.42,
              sm: 0.5,
              md: 0.58,
              lg: 0.68,
              xl: 0.78,
            },
            transform: {
              xs: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              sm: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              md: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              lg: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              xl: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
            },
            transformOrigin: 'top center',
          }}
        >
          <OrganizationalChart
            lineWidth="1px"
            lineHeight="34px"
            lineColor="var(--palette-grey-500)"
            data={SIMPLE_DATA}
            nodeItem={(props) => <StandardNode sx={{}} {...props} />}
          />

          <Box
            sx={{
              mt: '34px',
              display: 'flex',
              gap: 1,
              justifyContent: 'center',
            }}
          >
            {LEADER_GROUP_DATA.map((node) => (
              <OrganizationalChart
                key={node.id}
                lineWidth="1px"
                lineHeight="34px"
                lineColor="var(--palette-grey-500)"
                data={node}
                nodeItem={(props) =>
                  props.isDivision ? (
                    <DivisionNode sx={{}} {...props} />
                  ) : (
                    <StandardNode sx={{}} {...props} />
                  )
                }
              />
            ))}
          </Box>
        </Box>
      </Box>
    </DestEditLayout>
  );
}
