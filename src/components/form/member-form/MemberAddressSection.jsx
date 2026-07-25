import Box from '@mui/material/Box';

import LocationSelect from 'src/components/location/location-select';
import DashedAccordion from 'src/components/expandable/DashedAccordion';

export default function MemberAddressSection({ isEdit = false, masked = false }) {

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
            <LocationSelect />
        </Box>
    );

    // NEW → sin accordion
    if (!isEdit) {
        return Content;
    }

    // EDIT → con accordion dashed. Cuando la información está enmascarada (usuario
    // sin permiso a datos sensibles), el desplegable sale deshabilitado y sin la
    // flechita: no puede abrirse ni mostrar la dirección.
    return (
        <DashedAccordion title="Dirección" disabled={masked}>
            {Content}
        </DashedAccordion>
    );
}
