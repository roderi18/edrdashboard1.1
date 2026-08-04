'use client';

import ToggleButton from '@mui/material/ToggleButton';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { Field } from 'src/components/hook-form';


const formatMetersInput = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 3);
    if (digits.length === 0) return '';
    if (digits.length === 1) return `${digits},`;

    const formatted = `${digits[0]},${digits.slice(1)}`;
    return Number(formatted.replace(',', '.')) > 2.1 ? '2,10' : formatted;
};

const formatFeetInput = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 3);
    if (digits.length === 0) return '';
    if (digits.length === 1) return `${digits},`;

    const feet = Number(digits[0]);
    let inches = Number(digits.slice(1));

    if (feet > 6) return '6,11';
    if (feet === 6 && inches > 11) inches = 11;
    if (feet < 6 && inches > 11) inches = 11;

    return `${feet},${inches.toString().padStart(2, '0')}`;
};

const formatCmInput = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 3);
    if (digits === '') return '';
    return Number(digits) > 210 ? '210' : digits;
};

// ---------- CONVERSIONS ----------
const metersToCm = (m) => Math.round(m * 100);
const cmToMeters = (cm) => (cm / 100).toFixed(2);
const cmToFeet = (cm) => {
    const totalInches = Math.round(cm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet},${inches.toString().padStart(2, '0')}`;
};
const feetToCm = (feet, inches) => Math.round((feet * 12 + inches) * 2.54);

// ---------- PARSERS ----------
const parseMeters = (val) => Number(val.replace(',', '.'));
const parseFeet = (val) => {
    const [f = '0', i = '0'] = val.split(',');
    return { feet: Number(f), inches: Number(i) };
};

export default function HeightInput({
    name = 'heightApprox',
    unitName = 'heightUnit',
    label = 'Estatura aproximada',
    watch,
    setValue,
    readOnly = false,
}) {
    const unit = watch(unitName);
    const value = watch(name);

    const getPlaceholder = () => {
        if (unit === 'meters') return '1,77';
        if (unit === 'feet') return '5,7';
        if (unit === 'cm') return '177';
        return '';
    };


    const handleChange = (e) => {
        const raw = e.target.value;
        const prev = value || '';

        if (
            prev.endsWith(',') &&
            raw === prev.slice(0, -1)
        ) {
            setValue(name, raw);
            return;
        }

        if (unit === 'meters') {
            setValue(name, formatMetersInput(raw));
        } else if (unit === 'feet') {
            setValue(name, formatFeetInput(raw));
        } else {
            setValue(name, formatCmInput(raw));
        }
    };

    const handleUnitChange = (_, newUnit) => {
        if (!newUnit || !value) {
            setValue(unitName, newUnit);
            return;
        }

        let cm;

        if (unit === 'meters') {
            cm = metersToCm(parseMeters(value));
        } else if (unit === 'feet') {
            const { feet, inches } = parseFeet(value);
            cm = feetToCm(feet, inches);
        } else {
            cm = Number(value);
        }

        if (newUnit === 'meters') {
            setValue(name, cmToMeters(cm).replace('.', ','));
        } else if (newUnit === 'feet') {
            setValue(name, cmToFeet(cm));
        } else {
            setValue(name, Math.min(cm, 210).toString());
        }

        setValue(unitName, newUnit);
    };

    return (
        <Field.Text
            name={name}
            label={label}
            placeholder={getPlaceholder()}
            onChange={handleChange}
            InputProps={{
                // En solo lectura el VALOR no se edita (input readOnly), pero los
                // botones de unidad SÍ funcionan: cambiar metros/pies/cm es una
                // preferencia de visualización, no una edición del dato.
                readOnly,
                endAdornment: (
                    <InputAdornment position="end">
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={unit}
                            onChange={handleUnitChange}
                        >
                            <ToggleButton value="meters">Metros</ToggleButton>
                            <ToggleButton value="feet">Pies</ToggleButton>
                            <ToggleButton value="cm">CM</ToggleButton>
                        </ToggleButtonGroup>
                    </InputAdornment>
                ),
            }}
        />
    );
}
