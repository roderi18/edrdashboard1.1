'use client';

import { Fragment } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Collapse from '@mui/material/Collapse';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import {
    TableHeadCustom,
    TableSelectedAction,
} from 'src/components/table';

import { FileManagerTableRow } from
    'src/sections/file-manager/file-manager-table-row';

const HEALTH_DOCUMENT_SECTIONS = [
    {
        id: 'seguro_medico',
        title: 'Seguro Médico',
    },
    {
        id: 'cedula_identidad',
        title: 'Cédula de Identidad',
    },
];

const TABLE_HEAD = [
    { id: 'name', label: 'Nombre' },
    { id: 'size', label: 'Peso', width: 180 },
    { id: 'modifiedAt', label: 'Fecha', width: 200 },
    { id: '', width: 100 },
];

function HealthDocumentSectionRow({ section, onUpload }) {
    const menuActions = usePopover();

    return (
        <>
            <TableRow
                sx={{
                    '& td': {
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.neutral',
                    },
                }}
            >
                <TableCell padding="checkbox" />

                <TableCell>
                    <Typography variant="subtitle2">
                        {section.title}
                    </Typography>
                </TableCell>

                <TableCell />
                <TableCell />

                <TableCell align="right" sx={{ px: 1 }}>
                    <IconButton
                        color={menuActions.open ? 'inherit' : 'default'}
                        onClick={menuActions.onOpen}
                    >
                        <Iconify icon="eva:more-vertical-fill" />
                    </IconButton>
                </TableCell>
            </TableRow>

            <CustomPopover
                open={menuActions.open}
                anchorEl={menuActions.anchorEl}
                onClose={menuActions.onClose}
                slotProps={{ arrow: { placement: 'right-top' } }}
            >
                <MenuList>
                    <MenuItem
                        onClick={() => {
                            menuActions.onClose();
                            onUpload(section.id);
                        }}
                    >
                        <Iconify icon="eva:cloud-upload-fill" />
                        Subir
                    </MenuItem>
                </MenuList>
            </CustomPopover>
        </>
    );
}

export function HealthDocumentsSection({
    open,
    onToggle,
    renderCollapseButton,
    table,
    medicalDocuments,
    onDeleteOne,
    onDeleteSelected,
    onUpload,
    onRename,
}) {
    const displayedDocuments = medicalDocuments.filter((file) =>
        HEALTH_DOCUMENT_SECTIONS.some((section) => section.id === file.documentCategory)
    );
    const selectedDisplayedDocuments = displayedDocuments.filter((row) =>
        table.selected.includes(row.id)
    );

    return (
        <Card>
            <CardHeader
                title="📁 Documentos"
                subheader="Seguro médico y cédula de identidad del miembro"
                action={renderCollapseButton(open, onToggle)}
                sx={{ mb: 3 }}
            />

            <Collapse in={open}>
                <Divider />

                <Box
                    sx={(theme) => ({
                        position: 'relative',
                        m: { md: theme.spacing(-2, -3, 0, -3) },
                    })}
                >
                    <TableSelectedAction
                        dense
                        numSelected={selectedDisplayedDocuments.length}
                        rowCount={displayedDocuments.length}
                        onSelectAllRows={(checked) =>
                            table.onSelectAllRows(
                                checked,
                                displayedDocuments.map((row) => row.id)
                            )
                        }
                        action={
                            <>
                                <Tooltip title="Compartir">
                                    <IconButton color="primary">
                                        <Iconify icon="solar:share-bold" />
                                    </IconButton>
                                </Tooltip>

                                <Tooltip title="Eliminar">
                                    <IconButton color="primary" onClick={onDeleteSelected}>
                                        <Iconify icon="solar:trash-bin-trash-bold" />
                                    </IconButton>
                                </Tooltip>
                            </>
                        }
                        sx={{
                            pl: 1,
                            pr: 2,
                            top: 16,
                            left: 24,
                            right: 24,
                            width: 'auto',
                            borderRadius: 1.5,
                        }}
                    />

                    <TableContainer sx={{ px: { md: 3 } }}>
                        <Table
                            size="small"
                            sx={{
                                minWidth: 860,
                                borderCollapse: 'separate',
                                borderSpacing: '0 8px',
                            }}
                        >
                            <TableHeadCustom
                                headCells={TABLE_HEAD}
                                rowCount={displayedDocuments.length}
                                numSelected={selectedDisplayedDocuments.length}
                                onSelectAllRows={(checked) =>
                                    table.onSelectAllRows(
                                        checked,
                                        displayedDocuments.map((row) => row.id)
                                    )
                                }
                            />

                            <TableBody>
                                {HEALTH_DOCUMENT_SECTIONS.map((section) => {
                                    const sectionDocuments = medicalDocuments.filter(
                                        (file) => file.documentCategory === section.id
                                    );

                                    return (
                                        <Fragment key={section.id}>
                                            <HealthDocumentSectionRow
                                                section={section}
                                                onUpload={onUpload}
                                            />

                                            {sectionDocuments.map((file) => (
                                                <FileManagerTableRow
                                                    key={file.id}
                                                    row={file}
                                                    selected={table.selected.includes(file.id)}
                                                    onSelectRow={() => table.onSelectRow(file.id)}
                                                    onDeleteRow={() => onDeleteOne(file.id)}
                                                    onRename={onRename}
                                                    canDelete
                                                    showType={false}
                                                    showAvatar={false}
                                                    showThumbnail
                                                    showRowOutline={false}
                                                />
                                            ))}
                                        </Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>

                <Box sx={{ height: 8 }} />
            </Collapse>
        </Card>
    );
}
