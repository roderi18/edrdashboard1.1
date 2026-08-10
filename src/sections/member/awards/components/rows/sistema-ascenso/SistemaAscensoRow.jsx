import dayjs from 'dayjs';

import TableCell from '@mui/material/TableCell';
import Typography from '@mui/material/Typography';

import { getCompletedAwards } from '../../../utils/get-awards-count';
import { getLastUpdatedFromStorage } from '../../../utils/get-last-updated-from-storage';

// export function SistemaAscensoRow({ row, allData = [], onClick }) {
export function SistemaAscensoRow({ memberId, row, allData = [], onClick }) {
    const updatedAt = getLastUpdatedFromStorage(memberId, row.id)

    return (
        <>
            {/* <TableCell onClick={onClick}>—</TableCell> //columna name en subrow */}
            <TableCell onClick={onClick}>{row.target ?? '—'}</TableCell>
            <TableCell onClick={onClick}>{row.total ?? 0}</TableCell>
            {/* <TableCell onClick={onClick}>{row.completed ?? 0}</TableCell> */}
            <TableCell onClick={onClick}>
                {getCompletedAwards(memberId, row.id, allData)}
            </TableCell>

            {/* <TableCell onClick={onClick}>
                {row.updatedAt ? (
                    <>
                        {fDate(row.updatedAt)}
                        <br />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {fTime(row.updatedAt)}
                        </Typography>
                    </>
                ) : (
                    '—'
                )}
            </TableCell> */}
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
