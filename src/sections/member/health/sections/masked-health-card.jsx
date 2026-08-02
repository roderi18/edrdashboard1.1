import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import CardHeader from '@mui/material/CardHeader';

import { MaskedField } from 'src/components/masked-field';

// ----------------------------------------------------------------------
// Reemplazo enmascarado de una sección de salud (Medicación, Alergias,
// Condiciones, Documentos): muestra el encabezado y los datos ocultos con
// asteriscos, para roles de consulta sin acceso (p. ej. el Director Nacional).
// ----------------------------------------------------------------------

export function MaskedHealthCard({ title, subheader }) {
    return (
        <Card>
            <CardHeader title={title} subheader={subheader} sx={{ mb: 3 }} />

            <Divider />

            <Stack spacing={3} sx={{ p: 3 }}>
                <MaskedField label="Información" preset="text" />
            </Stack>
        </Card>
    );
}
