'use client';

import { useState } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import ListItemText from '@mui/material/ListItemText';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

export function EntityInfoPdfMenu({ title, subtitle, avatarUrl, fileName, sections }) {
  const menuActions = usePopover();
  const [selectedSections, setSelectedSections] = useState(['general']);

  const handleToggle = (value) => {
    if (value === 'general') return;

    setSelectedSections((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const handleDownload = async () => {
    // El documento y la librería de PDF se cargan aquí, al pulsar.
    const { generarPdfDeEntidad } = await import('./entity-info-pdf-documento');
    const blob = await generarPdfDeEntidad({
      title,
      subtitle,
      avatarUrl,
      sections,
      selectedSections,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    menuActions.onClose();
  };

  return (
    <>
      <Button
        variant="soft"
        color="inherit"
        onClick={menuActions.onOpen}
        endIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}
      >
        Descargar información
      </Button>

      <CustomPopover
        open={menuActions.open}
        anchorEl={menuActions.anchorEl}
        onClose={menuActions.onClose}
        slotProps={{ arrow: { placement: 'top-center' } }}
      >
        <MenuList sx={{ minWidth: 260 }}>
          {sections.map((section) => (
            <MenuItem key={section.value} onClick={() => handleToggle(section.value)}>
              <Checkbox checked={selectedSections.includes(section.value)} disabled={section.required} />
              <ListItemText primary={section.label} />
            </MenuItem>
          ))}

          <MenuItem onClick={handleDownload}>
            <ListItemText primary="Descargar PDF" />
          </MenuItem>
        </MenuList>
      </CustomPopover>
    </>
  );
}
