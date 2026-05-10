'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';

import { OrganizationalChart } from 'src/components/organizational-chart';

import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { SIMPLE_DATA } from 'src/sections/_examples/extra/organizational-chart-view/data';
import { StandardNode } from 'src/sections/_examples/extra/organizational-chart-view/standard-node';

export default function Page() {
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const skipNextDragRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });

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
      'button, a, input, textarea, select, [role="button"]'
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
        <Box
          sx={{
            '--chart-pan-x': `${pan.x}px`,
            '--chart-pan-y': `${pan.y}px`,
            width: 1080,
            flexShrink: 0,
            transform: {
              xs: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(0.42)',
              sm: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(0.5)',
              md: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(0.58)',
              lg: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(0.68)',
              xl: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(0.78)',
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
