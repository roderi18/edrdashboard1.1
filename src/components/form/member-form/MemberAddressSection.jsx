import Box from '@mui/material/Box';
import DashedAccordion from 'src/components/expandable/DashedAccordion';
import { Field } from 'src/components/hook-form';

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
            <Field.CountrySelect
                fullWidth
                name="country"
                label="País"
                placeholder="Elige un país"
            />

            <Field.Text name="state" label="Provincia" />

            <Field.Text name="city" label="Ciudad" />

            <Field.Text name="address" label="Dirección" />
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