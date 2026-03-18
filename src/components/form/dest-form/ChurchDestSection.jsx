import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { Field } from 'src/components/hook-form';

export default function ChurchDestSection({
    isCreateView,
}) {
    return (
        <>
            {isCreateView && (
                <Box
                    sx={{
                        gridColumn: '1 / -1',
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        mb: 1,
                    }}
                >
                    <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />

                    <Typography
                        sx={{
                            mx: 2,
                            typography: 'subtitle2',
                            color: 'text.secondary',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Información de la iglesia
                    </Typography>

                    <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
                </Box>
            )}

            <Field.Text name="churchName" label="Nombre de la Iglesia" />

            <Field.Text name="pastor" label="Pastor" />

            <Field.Text name="address" label="Dirección" />

            <Field.Text name="provinceId" label="Provincia" />

            <Field.Text name="countryId" label="País" />

            <Field.Text name="sectionId" label="Sección" />
        </>
    );
}