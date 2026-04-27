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

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', gap: 16, marginBottom: 20, alignItems: 'center' },
  avatar: { width: 82, height: 82, borderRadius: 41, objectFit: 'cover' },
  title: { fontSize: 18, marginBottom: 4, fontWeight: 700 },
  subtitle: { color: '#52606d' },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e4e7ec' },
  label: { width: '34%', padding: 5, fontWeight: 700, backgroundColor: '#f6f8fb' },
  value: { width: '66%', padding: 5 },
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

function EntityInfoPdfDocument({ title, subtitle, avatarUrl, sections, selectedSections }) {
  const avatarSrc = typeof avatarUrl === 'string' ? avatarUrl : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {avatarSrc && <Image src={avatarSrc} style={styles.avatar} />}
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        {sections
          .filter((section) => selectedSections.includes(section.value))
          .map((section) => (
            <View key={section.value} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              {section.rows.map((row) => (
                <InfoRow key={`${section.value}-${row.label}`} label={row.label} value={row.value} />
              ))}
            </View>
          ))}
      </Page>
    </Document>
  );
}

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
    const blob = await pdf(
      <EntityInfoPdfDocument
        title={title}
        subtitle={subtitle}
        avatarUrl={avatarUrl}
        sections={sections}
        selectedSections={selectedSections}
      />
    ).toBlob();
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
        Imprimir información
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
