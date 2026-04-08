import Box from '@mui/material/Box';
import DashedAccordion from 'src/components/expandable/DashedAccordion';
import { Field } from 'src/components/hook-form';
import { useEffect, useState } from 'react';
import { getSectionals } from 'src/services/sectional-service';
import { useFormContext } from 'react-hook-form';

export default function ChurchDestSection({
    isCreateView,

    methods,
}) {
    const [sectionals, setSectionals] = useState([]);
    const { watch, setValue, register } = useFormContext();

    useEffect(() => {
        const loadSectionals = async () => {
            const data = await getSectionals();
            setSectionals(Array.isArray(data) ? data : []);
        };

        loadSectionals();
    }, []);
    return (
        <Box>
            <Box
                sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                }}
            >
                <Field.Text
                    name="churchName"
                    label="Nombre de la Iglesia"
                    InputProps={{
                        startAdornment: 'Iglesia ',
                    }}
                />
                <Field.Text name="pastor" label="Pastor" />
                <Field.Text
                    name="correo"
                    label="Correo"
                    type="email"
                />
                <Field.Text name="address" label="Dirección" />
                <Field.Text name="provinceId" label="Provincia" />
                <Field.Text name="countryId" label="País" />
                <Field.Autocomplete
                    name="sectionId"
                    label="Sección"
                    options={sectionals}
                    getOptionLabel={(option) =>
                        typeof option === 'string'
                            ? option
                            : option?.sectionalName || ''
                    }
                    isOptionEqualToValue={(option, value) =>
                        option.id === value?.id
                    }
                    onChange={(event, option) => {
                        setValue('sectionId', option?.id ? String(option.id) : '', {
                            shouldValidate: true,
                            shouldDirty: true,
                        });
                    }}
                />
            </Box>
        </Box>
    );
}