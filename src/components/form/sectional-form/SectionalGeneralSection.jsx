'use client';

import { useEffect, useState } from 'react';

import { Field } from 'src/components/hook-form';
import { getRegionals } from 'src/services/regional-service';

// ----------------------------------------------------------------------

export default function SectionalGeneralSection({ methods, watch }) {
    const [regionals, setRegionals] = useState([]);
    const regionalId = watch('regionalId');

    useEffect(() => {
        const loadRegionals = async () => {
            const data = await getRegionals();

            const unique = Array.from(
                new Map(data.map((item) => [item.regionId, item])).values()
            );

            const prepared = unique.map((item) => ({
                ...item,
                name: item.name || `Región ${item.regionId}`, // limpio
                label: `${item.name || 'Región'}-${item.regionId}`, // 👈 clave única interna
            }));

            setRegionals(prepared);
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
                renderOption={(props, option) => (
                    <li {...props} key={option.regionId}>
                        {option.name}
                    </li>
                )}
                isOptionEqualToValue={(option, value) =>
                    option.regionId === value?.regionId
                }
                value={
                    regionals.find((r) => String(r.regionId) === regionalId) || null
                }
                onChange={(event, option) => {
                    methods.setValue('regionalId', option?.regionId?.toString() || '', {
                        shouldDirty: true,
                        shouldValidate: true,
                    });
                }}
            />
        </>
    );
}