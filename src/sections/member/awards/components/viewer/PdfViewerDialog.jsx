import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';

import { esCertificadoDeImagen } from 'src/sections/member/awards/utils/tipo-de-certificado';

// ----------------------------------------------------------------------
// EL CERTIFICADO SE VE ENTERO, CENTRADO Y A LA MEDIDA DE LA PANTALLA.
//
// Casi ningun certificado es un PDF: son FOTOS del diploma de papel. Y una foto
// dentro de un <iframe> la pinta el navegador con su visor nativo, que la saca a
// tamano natural y pegada a la esquina: en pantalla se veia un trozo gigante del
// certificado y habia que desplazarse para leer el nombre.
//
// Por eso se mira que hay dentro antes de decidir con que se pinta:
//
//   - Imagen  -> <img> centrada, escalada para caber sin recortarse.
//   - PDF     -> el <iframe> de siempre, pero pidiendole al visor que ajuste la
//                pagina a la ventana en vez de fijarla al 100%.
// ----------------------------------------------------------------------

export function PdfViewerDialog({ open, onClose, fileBase64, urlPdf, fileName }) {
  const pdfSrc = fileBase64 || urlPdf;
  const imagen = esCertificadoDeImagen(pdfSrc, fileName);

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <DialogActions sx={{ p: 1.5 }}>
          <Button variant="contained" onClick={onClose}>
            Cerrar
          </Button>
        </DialogActions>

        {/* El certificado */}
        <Box
          sx={{
            flexGrow: 1,
            // `minHeight: 0` para que el hueco NO crezca con la imagen: sin el,
            // un elemento flexible se estira a su contenido y la foto volvia a
            // desbordar la pantalla en vez de encogerse.
            minHeight: 0,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            p: imagen ? { xs: 1, sm: 2 } : 0,
            bgcolor: 'background.default',
          }}
        >
          {pdfSrc &&
            (imagen ? (
              <Box
                component="img"
                src={pdfSrc}
                alt={fileName || 'Certificado'}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  // Se escala hasta caber; nunca se recorta ni se deforma.
                  objectFit: 'contain',
                }}
              />
            ) : (
              <iframe
                src={`${pdfSrc}#view=Fit`}
                title={fileName || 'Certificado'}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            ))}
        </Box>
      </Box>
    </Dialog>
  );
}
