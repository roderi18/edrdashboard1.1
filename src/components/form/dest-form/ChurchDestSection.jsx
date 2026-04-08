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
    const { watch, setValue } = useFormContext();

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
                <Field.Text name="address" label="Dirección" />
                <Field.Text name="provinceId" label="Provincia" />
                <Field.Text name="countryId" label="País" />
                <Field.Autocomplete
                    name="sectionalName"
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
                    value={
                        Array.isArray(sectionals)
                            ? sectionals.find((s) => String(s.id) === String(watch('sectionId'))) || null
                            : null
                    }
                    onChange={(event, option) => {
                        // Guardar el ID real (lo que necesita la API)
                        setValue('sectionId', option?.id ? String(option.id) : '', {
                            shouldValidate: true,
                            shouldDirty: true,
                        });

                        // Guardar el label para mostrar
                        setValue('sectionId', option?.id ? String(option.id) : '', {
                            shouldValidate: true,
                            shouldDirty: true,
                        });

                        setValue('sectionalName', option?.sectionalName || '', {
                            shouldValidate: true,
                            shouldDirty: true,
                        });
                    }}
                />
            </Box>
        </Box>
    );
}