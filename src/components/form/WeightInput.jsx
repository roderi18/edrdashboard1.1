'use client';

import ToggleButton from '@mui/material/ToggleButton';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { Field } from 'src/components/hook-form';

// ---------- FORMATTERS ----------
const formatKgInput = (value) => {
    // solo números, máximo 3 dígitos
    let digits = value.replace(/\D/g, '').slice(0, 3);
    if (digits === '') return '';
    const num = Number(digits);
    // límite razonable: 0–250 kg
    if (num > 250) return '250';
    return digits;
};

const formatLbsInput = (value) => {
    // solo números, máximo 3 dígitos
    let digits = value.replace(/\D/g, '').slice(0, 3);
    if (digits === '') return '';
    const num = Number(digits);
    // límite razonable: 0–550 lb
    if (num > 550) return '550';
    return digits;
};

// ---------- CONVERSIONS ----------
const kgToLbs = (kg) => Math.round(kg * 2.20462);
const lbsToKg = (lbs) => Math.round(lbs / 2.20462);

export default function WeightInput({
    name = 'weightApprox',
    unitName = 'weightUnit',
    label = 'Peso aproximado',
    watch,
    setValue,
    readOnly = false,
}) {
    const unit = watch(unitName);
    const value = watch(name);

    const handleChange = (e) => {
        const raw = e.target.value;

        if (unit === 'kg') {
            setValue(name, formatKgInput(raw));
        } else {
            setValue(name, formatLbsInput(raw));
        }
    };

    const handleUnitChange = (_, newUnit) => {
        if (!newUnit || !value) {
            setValue(unitName, newUnit);
            return;
        }

        const num = Number(value);
        if (Number.isNaN(num)) {
            setValue(unitName, newUnit);
            return;
        }

        if (unit === 'kg' && newUnit === 'lbs') {
            setValue(name, kgToLbs(num).toString());
        } else if (unit === 'lbs' && newUnit === 'kg') {
            setValue(name, lbsToKg(num).toString());
        }

        setValue(unitName, newUnit);
    };

    return (
        <Field.Text
            name={name}
            label={label}
            onChange={handleChange}
            InputProps={{
                endAdornment: (
                    <InputAdornment position="end">
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={unit}
                            onChange={handleUnitChange}
                        >
                            <ToggleButton value="lbs" component={readOnly ? 'span' : 'button'}>
                                Lbs
                            </ToggleButton>
                            <ToggleButton value="kg" component={readOnly ? 'span' : 'button'}>
                                Kgs
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </InputAdornment>
                ),
            }}
        />
    );
}
