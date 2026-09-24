'use client';

import dynamic from 'next/dynamic';

import Skeleton from '@mui/material/Skeleton';

// ----------------------------------------------------------------------
// EL EDITOR DE TEXTO ENRIQUECIDO, DIFERIDO.
//
// Tiptap, sus extensiones y el resaltado de código (`lowlight`) pesan mucho y
// solo hacen falta donde se escribe texto con formato. Quien importa `Editor` de
// aquí recibe una versión que se descarga al pintarse, con su esqueleto mientras
// tanto; el editor real vive en `./editor`.
// ----------------------------------------------------------------------

export const Editor = dynamic(() => import('./editor').then((modulo) => modulo.Editor), {
  ssr: false,
  loading: () => <Skeleton variant="rounded" sx={{ height: 240 }} />,
});
