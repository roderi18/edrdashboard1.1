import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';

export function PdfViewerDialog({ open, onClose, fileBase64 }) {
    return (
        <Dialog fullScreen open={open} onClose={onClose}>
            <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <DialogActions sx={{ p: 1.5 }}>
                    <Button variant="contained" onClick={onClose}>
                        Cerrar
                    </Button>
                </DialogActions>

                {/* PDF */}
                <Box
                    sx={{
                        flexGrow: 1,
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                        bgcolor: 'background.default',
                    }}
                >
                    {fileBase64 && (
                        <iframe
                            src={`${fileBase64}#zoom=100`}
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                            }}
                        />
                    )}
                </Box>

            </Box>
        </Dialog>
    );
}
