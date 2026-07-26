import Box from '@mui/material/Box';

import LocationSelect from 'src/components/location/location-select';
import DashedAccordion from 'src/components/expandable/DashedAccordion';

export default function MemberAddressSection({ isEdit = false, readOnly = false, masked = false }) {

    const Content = (
        <Box
            sx={{
                gridColumn: '1 / -1',
                rowGap: 3,
                columnGap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
            }}
        >
            <LocationSelect disabled={readOnly} masked={masked} />
        </Box>
    );

    // NEW → sin accordion
    if (!isEdit) {
        return Content;
    }

    // EDIT → con accordion dashed. El desplegable Dirección siempre funciona
    // (se puede abrir); en solo lectura, sus campos internos salen deshabilitados.
    return (
        <DashedAccordion title="Dirección">
            {Content}
        </DashedAccordion>
    );
}
