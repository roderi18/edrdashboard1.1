'use client';

import { useState } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import ListItemText from '@mui/material/ListItemText';

import {
  canViewMemberAwardsTab,
  canViewMemberHealthTab,
  canViewMemberParentsTab,
  canViewMemberHistoryTab,
} from 'src/utils/member-access';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// El PDF refleja EXACTAMENTE lo que el usuario ve en la ficha: si un dato está
// enmascarado en pantalla (dirección, teléfono, correo, fecha de nacimiento),
// sale enmascarado en el documento, y las secciones sin permiso ni se ofrecen.
// El valor real nunca llega al PDF.
// ----------------------------------------------------------------------

const SECTION_OPTIONS = [
  { value: 'general', label: 'General', required: true },
  { value: 'health', label: 'Salud' },
  { value: 'awards', label: 'Premios' },
  { value: 'parents', label: 'Padres' },
  { value: 'history', label: 'Historial' },
];

export function MemberInfoPdfMenu({
  // Se recibe un LECTOR, no los valores.
  //
  // Antes llegaban ya leidos, y para tenerlos siempre frescos el formulario
  // tenia que suscribirse a TODOS sus campos: cada tecla repintaba tres mil
  // lineas. El PDF se arma solo al pulsar descargar, asi que basta con poder
  // leerlos en ese instante —y ademas asi son mas frescos que antes—.
  obtenerValores,
  memberCode,
  fullName,
  destName,
  avatarUrl,
  masked = false,
  maskContact = masked,
  maskAddress = masked,
  maskBirthdate = false,
}) {
  const { user } = useAuthContext();
  const menuActions = usePopover();
  const [selectedSections, setSelectedSections] = useState(['general']);

  // Para decidir QUE pestañas se ofrecen basta con leerlos ahora; el contenido
  // del PDF se lee otra vez al descargar, que es cuando tiene que estar fresco.
  const valoresActuales = obtenerValores?.() ?? {};

  // Cada pestaña de la ficha se ofrece en el PDF solo si el usuario puede verla.
  const canExportSection = {
    general: true,
    health: canViewMemberHealthTab(user),
    awards: canViewMemberAwardsTab(user),
    parents: canViewMemberParentsTab(user),
    history: canViewMemberHistoryTab(user, valoresActuales),
  };
  const availableSections = SECTION_OPTIONS.filter((option) => canExportSection[option.value]);

  const handleToggle = (value) => {
    if (value === 'general' || !canExportSection[value]) return;

    setSelectedSections((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const handleDownload = async () => {
    const values = obtenerValores?.() ?? {};
    // El documento y la librería de PDF se cargan aquí, al pulsar.
    const { generarPdfDeMiembro } = await import('./member-info-pdf-documento');
    const blob = await generarPdfDeMiembro({
      values,
      avatarUrl,
      memberCode,
      fullName,
      destName,
      // Doble filtro: aunque el estado arrastrara una sección, solo se exportan
      // las que el usuario puede ver.
      selectedSections: selectedSections.filter((section) => canExportSection[section]),
      masked,
      maskContact,
      maskAddress,
      maskBirthdate,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${memberCode || 'miembro'}-informacion.pdf`;
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
          {availableSections.map((option) => (
            <MenuItem key={option.value} onClick={() => handleToggle(option.value)}>
              <Checkbox checked={selectedSections.includes(option.value)} disabled={option.required} />
              <ListItemText primary={option.label} />
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
