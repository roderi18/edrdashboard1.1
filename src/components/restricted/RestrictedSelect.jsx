'use client';

import { useRef, useState, useEffect } from 'react';

import { Field } from 'src/components/hook-form';

export default function RestrictedSelect({
    name,
    label,
    children,

    conditions = [],
    errorText = 'This field is restricted.',
    readOnly = false,
}) {
    const [touched, setTouched] = useState(false);
    const wrapperRef = useRef(null);

    const isAllowed = conditions.every(
        (condition) => condition.value === condition.allowed
    );

    // Bloqueado por la condición del campo (p. ej. requiere seguro) o porque el
    // formulario está en solo lectura.
    const blocked = !isAllowed || readOnly;
    const showError = touched && !isAllowed;

    // 👇 cerrar el mensaje al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(event.target)
            ) {
                setTouched(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div ref={wrapperRef}>
            <Field.Select
                name={name}
                label={label}
                error={showError}
                helperText={showError ? errorText : ''}
                slotProps={{
                    input: {
                        readOnly: blocked,
                        onFocus: () => setTouched(true),
                        onMouseDown: (e) => {
                            if (blocked) {
                                e.preventDefault(); // evita abrir el menú
                                if (!isAllowed) setTouched(true);
                            }
                        },
                    },
                }}
                sx={{
                    '& .MuiSelect-select': {
                        // cursor: !isAllowed ? 'not-allowed' : 'pointer',
                        cursor: 'pointer',
                    },
                }}
            >
                {children}
            </Field.Select>
        </div>
    );
}
