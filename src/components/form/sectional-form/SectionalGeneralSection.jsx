'use client';

import { useEffect, useState } from 'react';

import { Field } from 'src/components/hook-form';
import { getRegionals } from 'src/services/regional-service';

// ----------------------------------------------------------------------

export default function SectionalGeneralSection({ methods, watch }) {
    const [regionals, setRegionals] = useState([]);

    useEffect(() => {
        const loadRegionals = async () => {
            const data = await getRegionals();
            setRegionals(data);
        };

        loadRegionals();
    }, []);

    return (
        <>
            {/* Nombre de la Sección */}
            <Field.Text
                name="sectionalName"
                label="Nombre de la Sección"
            />

            {/* Región (Autocomplete dinámico) */}
            <Field.Autocomplete
                name="regionalId"
                label="Región"
                options={regionals}
                getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option?.name || ''
                }
                isOptionEqualToValue={(option, value) =>
                    option.regionId === value?.regionId
                }
                value={
                    regionals.find((r) => r.regionId === watch('regionalId')) || null
                }
                onChange={(event, option) => {
                    methods.setValue('regionalId', option?.regionId || '');
                }}
            />
        </>
    );
}