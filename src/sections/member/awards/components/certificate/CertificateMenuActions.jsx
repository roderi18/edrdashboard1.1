import MenuList from '@mui/material/MenuList';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import { Iconify } from 'src/components/iconify';
import { DownloadCertificateMenuItem } from './DownloadCertificateMenuItem';

export function CertificateMenuActions({
    certificate,
    hasCertificate,
    actions,
    onClose,
    onDelete,
}) {
    if (!hasCertificate) return null;

    return (
        <MenuList>
            <DownloadCertificateMenuItem
                certificate={certificate}
                onClose={onClose}
            />

            <Divider sx={{ borderStyle: 'dashed' }} />

            <MenuItem
                sx={{ color: 'error.main' }}
                onClick={() => {
                    onClose?.();
                    onDelete?.();
                    actions.deleteCertificate();
                }}
            >
                <Iconify icon="solar:trash-bin-trash-bold" />
                Eliminar certificado
            </MenuItem>
        </MenuList>
    );
}
