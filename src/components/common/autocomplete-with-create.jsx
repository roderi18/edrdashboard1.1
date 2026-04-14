'use client';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

export default function AutocompleteWithCreate({
    options = [],
    value,
    onChange,
    getOptionLabel,
    isOptionEqualToValue,
    label = 'Seleccionar',
    createLabel = 'Crear',
    createLink = '/',
}) {
    return (
        <Autocomplete
            options={options}
            value={value}
            onChange={onChange}
            getOptionLabel={getOptionLabel}
            isOptionEqualToValue={isOptionEqualToValue}
            disableListWrap
            renderOption={(props, option) => {
                const { key, ...rest } = props;

                return (
                    <li
                        key={key}
                        {...rest}
                        style={{
                            ...rest.style,
                            backgroundColor: 'transparent',
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '';
                        }}
                    >
                        {getOptionLabel(option)}
                    </li>
                );
            }}
            renderInput={(params) => (
                <TextField {...params} label={label} />
            )}
            PaperComponent={(props) => (
                <Box {...props}>
                    <Box
                        sx={{

                        }}
                    >
                        {props.children}
                    </Box>

                    {/* BOTÓN CREAR */}
                    <Box
                        component="li"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            window.location.href = createLink;
                        }}
                        sx={{
                            fontSize: '0.875rem',
                            px: 2,
                            py: 1,
                            color: 'primary.main',
                            cursor: 'pointer',
                            borderTop: '1px solid #eee',
                            listStyle: 'none',
                            '&:hover': {
                                backgroundColor: 'action.hover',
                            },
                        }}
                    >
                        + {createLabel}
                    </Box>
                </Box>
            )}
        />
    );
}