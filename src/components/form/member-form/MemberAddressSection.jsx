import Box from '@mui/material/Box';
import DashedAccordion from 'src/components/expandable/DashedAccordion';
import LocationSelect from 'src/components/location/location-select';

export default function MemberAddressSection({ isEdit = false }) {

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

    // EDIT → con accordion dashed
    return (
        <DashedAccordion title="Dirección">
            {Content}
        </DashedAccordion>


    );
}