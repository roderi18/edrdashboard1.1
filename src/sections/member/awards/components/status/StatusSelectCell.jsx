import { TableCell } from '@mui/material';  // Asegúrate de importar TableCell solo si se usa dentro de él
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

export function StatusSelectCell({
    value,
    onChange,
    hasCertificate = false,
    onRequireDeleteCertificate,
    isAwardsManagerFileDetails = false, // Recibe el prop adicional
}) {
    if (isAwardsManagerFileDetails) {
        return (
            <Select
                size="small"
                value={value}
                onChange={(e) => {
                    const next = e.target.value;


                    // Solo si está saliendo de COMPLETADO con certificado
                    if (hasCertificate && value === 'completado' && next !== 'completado') {
                        onRequireDeleteCertificate?.(next);
                        return;
                    }

                    onChange?.(next);
                }}
                fullWidth

            >
                <MenuItem value="no_iniciado">No iniciado</MenuItem>
                <MenuItem value="en_progreso">En progreso</MenuItem>
                <MenuItem value="completado">Completado</MenuItem>
            </Select>
        );
    }

    return (
        <TableCell>
            <Select
                size="small"
                value={value}
                onChange={(e) => {
                    const next = e.target.value;


                    // Solo si está saliendo de COMPLETADO con certificado
                    if (hasCertificate && value === 'completado' && next !== 'completado') {
                        onRequireDeleteCertificate?.(next);
                        return;
                    }

                    onChange?.(next);
                }}
                fullWidth
                sx={{
                    height: 40,
                    width: '100%', // Esto hace que ocupe el 100% del ancho disponible
                }}
            >
                <MenuItem value="no_iniciado">No iniciado</MenuItem>
                <MenuItem value="en_progreso">En progreso</MenuItem>
                <MenuItem value="completado">Completado</MenuItem>
            </Select>
        </TableCell>
    );
}
