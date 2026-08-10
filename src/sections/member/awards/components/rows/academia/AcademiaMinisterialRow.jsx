import dayjs from 'dayjs';

import TableCell from '@mui/material/TableCell';
import Typography from '@mui/material/Typography';

import { getCompletedAwards } from '../../../utils/get-awards-count';
import { getLastUpdatedFromStorage } from '../../../utils/get-last-updated-from-storage';

export function AcademiaMinisterialRow({ memberId, row, allData = [], onClick, showTarget = false }) {

    const updatedAt = getLastUpdatedFromStorage(memberId, row.id);

    return (
        <>
            {showTarget && (
                <TableCell onClick={onClick}>{row.target ?? '—'}</TableCell>
            )}
            <TableCell onClick={onClick}>{row.total ?? 0}</TableCell>
            <TableCell onClick={onClick}>
                {getCompletedAwards(memberId, row.id, allData)}
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
