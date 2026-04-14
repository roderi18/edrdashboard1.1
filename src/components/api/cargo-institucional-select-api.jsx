'use client';

import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

export default function CargoSelectApi({ name, label = 'Cargo Nacional' }) {
    const { setValue, watch } = useFormContext();

    const [cargos, setCargos] = useState([]);

    useEffect(() => {
        const load = async () => {
            const res = await fetch('/api/cargos');
            const data = await res.json();
            setCargos(Array.isArray(data?.Data) ? data.Data : []);
        };

        load();
    }, []);

    return (
        <Autocomplete
            options={cargos}
            value={
                cargos.find(
                    (c) => String(c.idCargo) === String(watch(name))
                ) || null
            }
            getOptionLabel={(option) => option?.nombre || ''}
            isOptionEqualToValue={(option, value) =>
                String(option.idCargo) === String(value.idCargo)
            }
            onChange={(_, newValue) => {
                setValue(name, newValue?.idCargo || '');
            }}
            renderInput={(params) => (
                <TextField {...params} label={label} />
            )}
        />
    );
}