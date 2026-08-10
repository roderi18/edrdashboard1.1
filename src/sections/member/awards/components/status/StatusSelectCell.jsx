import { TableCell } from '@mui/material';  // Asegúrate de importar TableCell solo si se usa dentro de él
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

// Opciones por defecto (Sistema de Ascenso): el progreso es gradual.
const DEFAULT_STATUS_OPTIONS = [
    { value: 'no_iniciado', label: 'No iniciado' },
    { value: 'en_progreso', label: 'En progreso' },
    { value: 'completado', label: 'Completado' },
];

// Academia Ministerial: el estado lo determina el certificado, asi que solo
// existen dos situaciones posibles. No hay "En progreso": o esta acreditado o no.
export const ACADEMIA_STATUS_OPTIONS = [
    { value: 'no_iniciado', label: 'No iniciado' },
    { value: 'completado', label: 'Completado' },
];

export function StatusSelectCell({
    value,
    onChange,
    hasCertificate = false,
    onRequireDeleteCertificate,
    isAwardsManagerFileDetails = false, // Recibe el prop adicional
    disabled = false,
    options = DEFAULT_STATUS_OPTIONS,
}) {
    const handleChange = (e) => {
        const next = e.target.value;

        // Solo si está saliendo de COMPLETADO con certificado
        if (hasCertificate && value === 'completado' && next !== 'completado') {
            onRequireDeleteCertificate?.(next);
            return;
        }

        onChange?.(next);
    };

    const renderOptions = () =>
        options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
                {option.label}
            </MenuItem>
        ));

    if (isAwardsManagerFileDetails) {
        return (
            <Select
                size="small"
                value={value}
                disabled={disabled}
                onChange={handleChange}
                fullWidth
            >
                {renderOptions()}
            </Select>
        );
    }

    return (
        <TableCell>
            <Select
                size="small"
                value={value}
                disabled={disabled}
                onChange={handleChange}
                fullWidth
                sx={{
                    height: 40,
                    width: '100%', // Esto hace que ocupe el 100% del ancho disponible
                }}
            >
                {renderOptions()}
            </Select>
        </TableCell>
    );
}
