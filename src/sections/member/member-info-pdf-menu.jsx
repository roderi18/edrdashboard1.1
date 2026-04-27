'use client';

import { useState } from 'react';
import { usePopover } from 'minimal-shared/hooks';
import { pdf, Text, View, Page, Image, Document, StyleSheet } from '@react-pdf/renderer';

import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import ListItemText from '@mui/material/ListItemText';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

const SECTION_OPTIONS = [
  { value: 'general', label: 'General', required: true },
  { value: 'health', label: 'Salud' },
  { value: 'awards', label: 'Premios' },
  { value: 'parents', label: 'Padres' },
  { value: 'history', label: 'Historial' },
];

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', gap: 16, marginBottom: 20, alignItems: 'center' },
  avatar: { width: 82, height: 82, borderRadius: 41, objectFit: 'cover' },
  title: { fontSize: 18, marginBottom: 4, fontWeight: 700 },
  subtitle: { color: '#52606d' },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#102a43' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e4e7ec' },
  label: { width: '32%', padding: 5, fontWeight: 700, backgroundColor: '#f6f8fb' },
  value: { width: '68%', padding: 5 },
});

const getValue = (value) => {
  if (value === 0) return '0';
  if (value instanceof Date) return value.toLocaleDateString();
  if (value?.format) return value.format('DD/MM/YYYY');
  return value ? String(value) : '-';
};

function InfoRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{getValue(value)}</Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MemberInfoPdfDocument({ values, memberCode, fullName, destName, selectedSections }) {
  const avatarSrc = typeof values.avatarUrl === 'string' ? values.avatarUrl : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {avatarSrc && <Image src={avatarSrc} style={styles.avatar} />}
          <View>
            <Text style={styles.title}>{fullName || 'Miembro'}</Text>
            <Text style={styles.subtitle}>{memberCode || 'Sin código'}</Text>
            <Text style={styles.subtitle}>{destName}</Text>
          </View>
        </View>

        <Section title="General">
          <InfoRow label="Nombres" value={values.firstName} />
          <InfoRow label="Apellidos" value={values.lastName} />
          <InfoRow label="Fecha de nacimiento" value={values.birthdate} />
          <InfoRow label="División" value={values.memberDivision} />
          <InfoRow label="Teléfono" value={values.phoneNumber} />
          <InfoRow label="Correo" value={values.email} />
          <InfoRow label="Destacamento" value={destName} />
          <InfoRow label="Sexo" value={values.gender?.label || values.gender} />
        </Section>

        {selectedSections.includes('health') && (
          <Section title="Salud">
            <InfoRow label="Información" value="Sin información de salud registrada en esta vista." />
          </Section>
        )}

        {selectedSections.includes('awards') && (
          <Section title="Premios">
            <InfoRow label="Información" value="Sin premios registrados en esta vista." />
          </Section>
        )}

        {selectedSections.includes('parents') && (
          <Section title="Padres">
            <InfoRow label="Información" value="Sin información de padres registrada en esta vista." />
          </Section>
        )}

        {selectedSections.includes('history') && (
          <Section title="Historial">
            <InfoRow label="Información" value="Sin historial registrado en esta vista." />
          </Section>
        )}
      </Page>
    </Document>
  );
}

export function MemberInfoPdfMenu({ values, memberCode, fullName, destName }) {
  const menuActions = usePopover();
  const [selectedSections, setSelectedSections] = useState(['general']);

  const handleToggle = (value) => {
    if (value === 'general') return;

    setSelectedSections((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const handleDownload = async () => {
    const blob = await pdf(
      <MemberInfoPdfDocument
        values={values}
        memberCode={memberCode}
        fullName={fullName}
        destName={destName}
        selectedSections={selectedSections}
      />
    ).toBlob();
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
        Imprimir información
      </Button>

      <CustomPopover
        open={menuActions.open}
        anchorEl={menuActions.anchorEl}
        onClose={menuActions.onClose}
        slotProps={{ arrow: { placement: 'top-center' } }}
      >
        <MenuList sx={{ minWidth: 260 }}>
          {SECTION_OPTIONS.map((option) => (
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
