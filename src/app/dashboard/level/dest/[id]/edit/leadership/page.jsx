'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';
import { OrganizationalChart } from 'src/components/organizational-chart';

import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { SIMPLE_DATA } from 'src/sections/_examples/extra/organizational-chart-view/data';
import { StandardNode } from 'src/sections/_examples/extra/organizational-chart-view/standard-node';

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;
const CONTROL_BUTTON_SIZE = 36;
const CONTROL_BUTTON_GAP = 6;
const ZOOM_PERCENT_WIDTH = CONTROL_BUTTON_SIZE * 2 + CONTROL_BUTTON_GAP;

export default function Page() {
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const skipNextDragRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
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

  return (
    <DestEditLayout maxWidth={false}>
      <Box
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
        }}
      >
        <Stack
          spacing={0.75}
          onPointerDown={(event) => event.stopPropagation()}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 2,
          }}
        >
          <Stack direction="row" spacing={CONTROL_BUTTON_GAP / 8}>
            <Tooltip title="Centrar vista">
              <IconButton
                size="small"
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

            <Tooltip title="Reducir zoom">
              <span>
                <IconButton
                  size="small"
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
              </span>
            </Tooltip>

            <Tooltip title="Aumentar zoom">
              <span>
                <IconButton
                  size="small"
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
              </span>
            </Tooltip>
          </Stack>

          <Typography
            variant="caption"
            sx={{
              width: ZOOM_PERCENT_WIDTH,
              height: 28,
              minWidth: ZOOM_PERCENT_WIDTH,
              ml: `${CONTROL_BUTTON_SIZE + CONTROL_BUTTON_GAP}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
            lineHeight="34px"
            data={SIMPLE_DATA}
            nodeItem={(props) => <StandardNode sx={{}} {...props} />}
          />
        </Box>
      </Box>
    </DestEditLayout>
  );
}
