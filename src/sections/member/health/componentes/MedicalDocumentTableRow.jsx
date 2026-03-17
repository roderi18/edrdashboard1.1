import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { fData } from 'src/utils/format-number';
import { fDate, fTime } from 'src/utils/format-time';

export function MedicalDocumentTableRow({ row, selected, onSelectRow }) {
    return (
        <TableRow selected={selected}>
            {/* Checkbox */}
            <TableCell padding="checkbox">
                <Checkbox checked={selected} onClick={onSelectRow} />
            </TableCell>

            {/* Nombre */}
            <TableCell>
                {row.name}
            </TableCell>

            {/* Tamaño */}
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {fData(row.size)}
            </TableCell>

            {/* Fecha */}
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <ListItemText
                    primary={fDate(row.modifiedAt)}
                    secondary={fTime(row.modifiedAt)}
                />
            </TableCell>

            {/* Acciones (vacío por ahora) */}
            <TableCell align="right" />
        </TableRow>
    );
}
