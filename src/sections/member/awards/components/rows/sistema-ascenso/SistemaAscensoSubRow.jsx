import TableCell from '@mui/material/TableCell';
import Typography from '@mui/material/Typography';
import { getCompletedAwards } from '../../../utils/get-awards-count';
import dayjs from 'dayjs';
import { getLastUpdatedFromStorage } from '../../../utils/get-last-updated-from-storage';

export function SistemaAscensoSubRow({ memberId, row, allData = [], onClick }) {
    const updatedAt = getLastUpdatedFromStorage(memberId, row.id)

    return (
        <>
            <TableCell onClick={onClick}>{row.total ?? '—'}</TableCell>
            <TableCell onClick={onClick}>
                {getCompletedAwards(memberId, row.id)}
            </TableCell>

            <TableCell onClick={onClick}>
                {updatedAt ? (
                    <>
                        {dayjs(updatedAt).format('DD/MM/YYYY')}
                        <br />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {dayjs(updatedAt).format('hh:mm A')}
                        </Typography>
                    </>
                ) : (
                    '—'
                )}
            </TableCell>

        </>
    );
}
