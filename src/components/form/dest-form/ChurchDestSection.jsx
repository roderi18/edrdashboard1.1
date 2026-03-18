import Box from '@mui/material/Box';
import DashedAccordion from 'src/components/expandable/DashedAccordion';
import { Field } from 'src/components/hook-form';

export default function ChurchDestSection({
    isCreateView,
}) {
    return (
        <DashedAccordion title="Información de la iglesia">
            <Box
                sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                }}
            >
                <Field.Text name="churchName" label="Nombre de la Iglesia" />
                <Field.Text name="pastor" label="Pastor" />
                <Field.Text name="address" label="Dirección" />
                <Field.Text name="provinceId" label="Provincia" />
                <Field.Text name="countryId" label="País" />
                <Field.Text name="sectionId" label="Sección" />
            </Box>
        </DashedAccordion>
    );
}