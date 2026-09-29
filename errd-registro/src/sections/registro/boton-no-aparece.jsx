'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// BOTÓN "NO APARECE" (Tu nombre y Tu destacamento)
// En texto plano pasaba desapercibido y quien no se encontraba en la lista no
// sabía qué hacer. Uno solo para los dos, para que no se separen: azul
// que late del oscuro al claro, crece al pasar el ratón y lleva la ola de "Ver mapa de
// inscritos" (portada.jsx) cruzándolo sin parar.
// ----------------------------------------------------------------------

export function BotonNoAparece({ icono, onClick, children }) {
  return (
    <Button
      size="small"
      variant="contained"
      color="primary"
      startIcon={<Iconify icon={icono} />}
      onClick={onClick}
      sx={(theme) => ({
        position: 'relative',
        // Late solo, sin esperar al ratón: del azul oscuro al claro y vuelta.
        animation: 'latidoNoAparece 2.4s ease-in-out infinite',
        transition: theme.transitions.create(['transform', 'box-shadow']),
        '@keyframes latidoNoAparece': {
          '0%, 100%': { backgroundColor: theme.vars.palette.primary.dark },
          '50%': { backgroundColor: theme.vars.palette.primary.light },
        },
        '&:hover': {
          transform: 'translateY(-2px) scale(1.04)',
          boxShadow: theme.shadows[8],
        },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      })}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          inset: 0,
          position: 'absolute',
          overflow: 'hidden',
          borderRadius: 'inherit',
          pointerEvents: 'none',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '45%',
            left: '-60%',
            background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent)',
            animation: 'olaNoAparece 2.4s ease-in-out infinite',
          },
          '@keyframes olaNoAparece': {
            '0%': { left: '-60%' },
            '60%, 100%': { left: '120%' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            '&::before': { animation: 'none', display: 'none' },
          },
        }}
      />
      {children}
    </Button>
  );
}
