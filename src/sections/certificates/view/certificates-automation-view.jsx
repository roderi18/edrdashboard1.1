'use client';

import 'dayjs/locale/es';

import dayjs from 'dayjs';
import QRCode from 'qrcode';
import { useRef, useMemo, useState, useEffect } from 'react';
import { pdf, Page, Text, View, Image, Document, StyleSheet } from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Menu from '@mui/material/Menu';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { getMemberFullName } from 'src/utils/get-member-fullname';

import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';
import {
  listarLotesCertificados,
  guardarLoteCertificados,
  guardarEstadoCertificado,
  listarEstadosCertificados,
  guardarPlantillaCertificado,
  listarPlantillasCertificados,
  eliminarPlantillaCertificado,
} from 'src/services/certificate-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { AwardsPathSelector } from 'src/sections/member/awards/components/awards-path-selector';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const IMPORTED_TEMPLATE_COURSE_PREFIX = 'template:';
const DEFAULT_COURSE_PREFIX = 'course:';

const CERTIFICATE_STATUS_OPTIONS = [
  { value: 'presente', label: 'Presente', color: 'success' },
  { value: 'ausente', label: 'Ausente', color: 'warning' },
  { value: 'no_finalizado', label: 'No finalizado', color: 'error' },
];

const DEFAULT_CERTIFICATE_STATUS = 'presente';

const PDF_PAGE = {
  width: 841.89,
  height: 595.28,
};

const CERTIFICATE_TEMPLATE_FIELDS = [
  {
    id: 'memberName',
    label: 'Nombre',
    preview: 'Nombre del miembro',
    fontSize: 22,
    fontFamily: 'Cursive',
    width: 300,
    fontWeight: 700,
  },
  {
    id: 'date',
    label: 'Fecha',
    preview: 'Emitido el 22 de agosto del 2025',
    fontSize: 12,
    width: 260,
    fontWeight: 500,
  },
  {
    id: 'qrCode',
    label: 'QR',
    preview: 'QR',
    kind: 'qr',
    size: 64,
    width: 64,
    fontSize: 12,
  },
  {
    id: 'place',
    label: 'Lugar',
    preview: 'República Dominicana',
    fontSize: 12,
    width: 180,
    fontWeight: 500,
  },
  {
    id: 'signature1',
    label: 'Firma 1',
    preview: 'Firma principal',
    fontSize: 12,
    width: 180,
    fontWeight: 500,
  },
  {
    id: 'signature2',
    label: 'Firma 2',
    preview: 'Firma secundaria',
    fontSize: 12,
    width: 180,
    fontWeight: 500,
  },
];

const TEMPLATE_FONT_OPTIONS = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Cursive', label: 'Cursiva' },
  { value: 'Times-Roman', label: 'Times' },
  { value: 'Courier', label: 'Courier' },
];

const TEMPLATE_FONT_SIZE_OPTIONS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];
const TEMPLATE_QR_SIZE_OPTIONS = [32, 40, 48, 56, 64, 72, 80, 96, 112, 128, 144];

const normalizeTemplateFont = (fontFamily) =>
  fontFamily === 'Helvetica-Oblique' || fontFamily === 'Times-BoldItalic'
    ? 'Cursive'
    : fontFamily || 'Helvetica';

const getTemplatePreviewTypography = (field) => {
  const fontFamily = normalizeTemplateFont(field.fontFamily);

  if (fontFamily === 'Cursive') {
    return {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontStyle: 'italic',
      fontWeight: field.fontWeight || 700,
    };
  }

  return {
    fontFamily,
    fontStyle: 'normal',
    fontWeight: field.fontWeight,
  };
};

const getTemplatePdfTypography = (field) => {
  const fontFamily = normalizeTemplateFont(field.fontFamily);

  if (fontFamily === 'Cursive') {
    return {
      fontFamily: 'Times-BoldItalic',
      fontWeight: 'normal',
    };
  }

  return {
    fontFamily,
    fontWeight: field.fontWeight,
  };
};

dayjs.locale('es');

const DEFAULT_TEMPLATE_POSITIONS = {
  memberName: { x: 50, y: 77, align: 'center' },
  date: { x: 50, y: 87, align: 'center' },
  qrCode: { x: 11, y: 14, align: 'center' },
  place: { x: 50, y: 79, align: 'center' },
  signature1: { x: 83, y: 86, align: 'center' },
  signature2: { x: 50, y: 88, align: 'center' },
};

const buildTemplateField = (field) => ({
  ...field,
  kind: field.kind || 'dynamic',
  fontFamily: normalizeTemplateFont(field.fontFamily),
  width: field.width || 220,
});

const getDefaultTemplateFields = () => CERTIFICATE_TEMPLATE_FIELDS.map(buildTemplateField);

const getTemplateFields = (template) => {
  const source = (
    Array.isArray(template?.fields) && template.fields.length
      ? template.fields
      : getDefaultTemplateFields()
  ).map(buildTemplateField);
  const withRequiredFields = [
    ...source,
    ...getDefaultTemplateFields().filter(
      (defaultField) =>
        ['memberName', 'date', 'qrCode'].includes(defaultField.id) &&
        !source.some((field) => field.id === defaultField.id)
    ),
  ];

  return withRequiredFields.filter(
    (field) =>
      field.id !== 'courseName' &&
      field.id !== 'place' &&
      field.id !== 'signature1' &&
      field.id !== 'signature2'
  );
};

const getTemplateFieldPreview = (field) => {
  const value = field?.text || field?.preview || field?.label || field?.id || '';

  return String(value).trim() || field?.label || 'Texto';
};

const getScaledTemplatePreviewFontSize = (field) =>
  Math.max(6, Math.round((Number(field.fontSize) || 14) * 0.5));

const isQrTemplateField = (field) => field?.kind === 'qr' || field?.id === 'qrCode';

const getTemplateFieldSize = (field) => Number(field?.size || field?.width || 72);

const SAMPLE_QR_CODE_SRC = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 116 116">
  <rect width="116" height="116" fill="#fff"/>
  <path fill="#000" d="M8 8h28v28H8zM14 14v16h16V14zM80 8h28v28H80zM86 14v16h16V14zM8 80h28v28H8zM14 86v16h16V86z"/>
  <path fill="#000" d="M44 8h8v8h-8zM60 8h8v8h-8zM72 8h4v12h-4zM44 20h20v8H52v8h-8zM68 24h8v8h-8zM40 40h8v8h-8zM52 36h8v8h-8zM64 40h12v8H64zM84 40h8v8h-8zM100 40h8v12h-8zM8 44h12v8H8zM28 44h8v12h-8zM44 52h12v8H44zM60 52h8v8h-8zM76 52h8v8h-8zM88 56h20v8H96v8h-8zM16 60h8v8h-8zM32 64h12v8H32zM48 68h8v12h-8zM60 64h20v8H68v8h-8zM84 76h8v8h-8zM100 76h8v8h-8zM44 88h8v8h-8zM56 84h8v8h-8zM68 88h8v8h-8zM80 92h28v8H88v8h-8zM44 104h16v4H44zM68 104h8v4h-8z"/>
  <path fill="#000" d="M40 12h4v4h-4zM56 16h4v4h-4zM68 16h4v4h-4zM40 28h4v8h-4zM56 32h12v4H56zM76 36h4v8h-4zM20 40h8v4h-8zM36 56h4v8h-4zM56 60h4v4h-4zM72 60h4v4h-4zM92 44h4v8h-4zM8 68h8v4H8zM24 72h8v4h-8zM40 76h4v8h-4zM56 76h4v8h-4zM72 80h8v4h-8zM96 88h4v4h-4zM40 96h4v8h-4zM60 96h8v4h-8z"/>
</svg>
`)}`;

const DEFAULT_COURSE = {
  id: 'seguridad',
  name: 'Seguridad',
  certificateTitle: 'Certificado de Seguridad',
  label: 'Plantilla',
  accent: '#1570EF',
  body: '',
};

const COURSE_TEMPLATES = [];

const DEFAULT_FORM = {
  instructor: '',
  signature2: '',
  issuedAt: dayjs().format('YYYY-MM-DD'),
  place: 'República Dominicana',
};

const certificateStyles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: '#F8FAFC',
    fontFamily: 'Helvetica',
  },
  frame: {
    flex: 1,
    padding: 36,
    borderWidth: 4,
    borderColor: '#0F172A',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 20,
  },
  divider: {
    width: 180,
    height: 4,
    borderRadius: 4,
    marginBottom: 30,
  },
  presented: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
  },
  memberName: {
    fontSize: 28,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    maxWidth: 540,
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 1.6,
    marginBottom: 28,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 12,
  },
  metaBox: {
    minWidth: 150,
    alignItems: 'center',
  },
  metaLine: {
    width: 150,
    height: 1,
    backgroundColor: '#CBD5E1',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 9,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 11,
    color: '#0F172A',
    marginBottom: 8,
  },
  importedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PDF_PAGE.width,
    height: PDF_PAGE.height,
  },
  importedCanvas: {
    position: 'relative',
    width: PDF_PAGE.width,
    height: PDF_PAGE.height,
  },
});

const getFieldValue = ({ field, member, course, formValues }) => {
  if (field.kind === 'custom') {
    return field.text || '';
  }

  const values = {
    memberName: getMemberFullName(member) || member.memberId || 'Miembro',
    courseName: course.certificateTitle || course.name || 'Curso',
    date: `Emitido el ${dayjs(formValues.issuedAt).format('D [de] MMMM [del] YYYY')}`,
    place: formValues.place || '',
    signature1: formValues.instructor || '',
    signature2: formValues.signature2 || '',
  };

  return values[field.id] || '';
};

function ImportedTemplateCertificatePage({ course, member, formValues, template, certificateQr }) {
  const imageSource = template?.pdfDataUrl || template?.dataUrl || template?.previewImageUrl;

  return (
    <Page size="A4" orientation="landscape" wrap={false}>
      <View style={certificateStyles.importedCanvas}>
        {!!imageSource && <Image src={imageSource} style={certificateStyles.importedBackground} />}

        {getTemplateFields(template).map((field) => {
          const position = template.positions?.[field.id] ||
            DEFAULT_TEMPLATE_POSITIONS[field.id] || {
              x: 50,
              y: 50,
            };
          const value = getFieldValue({ field, member, course, formValues });

          if (isQrTemplateField(field)) {
            if (!certificateQr) return null;

            const size = getTemplateFieldSize(field);

            return (
              <Image
                key={field.id}
                src={certificateQr}
                style={{
                  position: 'absolute',
                  top: (Number(position.y) / 100) * PDF_PAGE.height - size / 2,
                  left: (Number(position.x) / 100) * PDF_PAGE.width - size / 2,
                  width: size,
                  height: size,
                }}
              />
            );
          }

          if (!value) return null;

          return (
            <Text
              key={field.id}
              style={{
                position: 'absolute',
                top: (Number(position.y) / 100) * PDF_PAGE.height,
                left: (Number(position.x) / 100) * PDF_PAGE.width - Number(field.width || 220) / 2,
                width: Number(field.width || 220),
                fontSize: Number(field.fontSize) || 14,
                ...getTemplatePdfTypography(field),
                color: template.textColor || '#111827',
                textAlign: position.align || 'center',
              }}
            >
              {value}
            </Text>
          );
        })}
      </View>
    </Page>
  );
}

function CertificatePdfDocument({ course, members, formValues, template, certificateQrs = {} }) {
  return (
    <Document>
      {members.map((member) => {
        const memberName = getMemberFullName(member) || member.memberId || 'Miembro';

        if (template?.dataUrl) {
          const qrKey = String(member.id || member.memberId || member.codigoMiembro || '');

          return (
            <ImportedTemplateCertificatePage
              key={member.id}
              course={course}
              member={member}
              template={template}
              formValues={formValues}
              certificateQr={certificateQrs[qrKey] || certificateQrs[String(member.memberId || '')]}
            />
          );
        }

        return (
          <Page key={member.id} size="A4" orientation="landscape" style={certificateStyles.page}>
            <View style={[certificateStyles.frame, { borderColor: course.accent }]}>
              <Text style={certificateStyles.eyebrow}>Exploradores del Rey</Text>
              <Text style={certificateStyles.title}>{course.certificateTitle}</Text>
              <View style={[certificateStyles.divider, { backgroundColor: course.accent }]} />
              <Text style={certificateStyles.presented}>Se otorga a</Text>
              <Text style={certificateStyles.memberName}>{memberName}</Text>
              <Text style={certificateStyles.body}>{course.body}</Text>

              <View style={certificateStyles.metaRow}>
                <View style={certificateStyles.metaBox}>
                  <Text style={certificateStyles.metaValue}>
                    {dayjs(formValues.issuedAt).format('DD/MM/YYYY')}
                  </Text>
                  <View style={certificateStyles.metaLine} />
                  <Text style={certificateStyles.metaLabel}>Fecha</Text>
                </View>

                <View style={certificateStyles.metaBox}>
                  <Text style={certificateStyles.metaValue}>{formValues.place || 'Lugar'}</Text>
                  <View style={certificateStyles.metaLine} />
                  <Text style={certificateStyles.metaLabel}>Lugar</Text>
                </View>

                <View style={certificateStyles.metaBox}>
                  <Text style={certificateStyles.metaValue}>
                    {formValues.instructor || 'Instructor'}
                  </Text>
                  <View style={certificateStyles.metaLine} />
                  <Text style={certificateStyles.metaLabel}>Instructor</Text>
                </View>
              </View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getTemplateAwardRoute = (template = {}) =>
  template.vinculoAscenso || template.rutaAscenso || null;

const formatAwardRouteText = (routeText = '') =>
  String(routeText || '').replace(/\s*\/\s*/g, ' > ');

const getAwardRouteKey = (route) => {
  const safeRoute = route || {};

  return [
    safeRoute.sistema || '',
    safeRoute.idDivision || '',
    safeRoute.idGrupo || '',
    safeRoute.idItemAscenso || '',
  ]
    .map((value) => String(value || '').trim())
    .join('|');
};

const buildCertificateFileName = (course, selectedCount) => {
  const courseName = normalizeText(course.name).replace(/\s+/g, '-');
  const date = dayjs().format('YYYY-MM-DD');

  return `certificados-${courseName}-${selectedCount}-miembros-${date}.pdf`;
};

const buildSingleCertificateFileName = (course, member) => {
  const courseName = normalizeText(course.name).replace(/\s+/g, '-');
  const memberName = normalizeText(getMemberFullName(member) || member.memberId || 'miembro')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return `certificado-${courseName}-${memberName}.pdf`;
};

const getCreatorName = (user) =>
  user?.displayName ||
  user?.name ||
  [user?.nombres, user?.apellidos].filter(Boolean).join(' ') ||
  user?.email ||
  user?.codigoMiembro ||
  'Usuario';

const getMemberEmail = (member = {}) =>
  member.email || member.correo || member.memberEmail || member.emailAddress || '';

const downloadPdfBlob = (blob, fileName) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

const isRemoteImageUrl = (value = '') => /^https?:\/\//i.test(String(value));

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const buildQrCodeDataUrl = (value) =>
  QRCode.toDataURL(value || 'Certificado pendiente', {
    margin: 1,
    width: 512,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
  });

const resolveTemplateForPdf = async (template) => {
  const imageSource = template?.pdfDataUrl || template?.dataUrl || template?.previewImageUrl;

  if (!template || !imageSource) {
    return template;
  }

  if (!isRemoteImageUrl(imageSource)) {
    return {
      ...template,
      dataUrl: imageSource,
      pdfDataUrl: imageSource,
    };
  }

  try {
    const response = await fetch(imageSource, { mode: 'cors' });
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);

    return {
      ...template,
      dataUrl: dataUrl || imageSource,
      pdfDataUrl: dataUrl || template.pdfDataUrl || '',
    };
  } catch {
    return template;
  }
};

const convertPdfFileToImageDataUrl = async (file) => {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');

  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdfDocument.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
  const pageCount = pdfDocument.numPages;

  await pdfDocument.destroy();

  return { dataUrl, pageCount };
};

const createEmptyTemplateDraft = () => ({
  id: `TPL-${Date.now()}`,
  name: '',
  fileName: '',
  sourceType: '',
  pageCount: 0,
  dataUrl: '',
  pdfDataUrl: '',
  textColor: '#111827',
  fields: getDefaultTemplateFields(),
  positions: { ...DEFAULT_TEMPLATE_POSITIONS },
  vinculoAscenso: null,
});

const sortObjectByKey = (value = {}) =>
  Object.fromEntries(
    Object.entries(value || {}).sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
  );

const normalizeTemplateDraftForComparison = (template = {}) => ({
  name: template.name || '',
  fileName: template.fileName || '',
  sourceType: template.sourceType || '',
  pageCount: Number(template.pageCount || 0),
  dataUrl: template.dataUrl || '',
  pdfDataUrl: template.pdfDataUrl || '',
  textColor: template.textColor || '',
  fields: getTemplateFields(template).map((field) => ({
    id: field.id || '',
    kind: field.kind || '',
    label: field.label || '',
    text: field.text || '',
    preview: field.preview || '',
    fontFamily: normalizeTemplateFont(field.fontFamily),
    fontSize: Number(field.fontSize || 0),
    width: Number(field.width || 0),
    size: Number(field.size || 0),
    fontWeight: field.fontWeight || '',
  })),
  positions: sortObjectByKey(template.positions || {}),
  rutaAscenso: getAwardRouteKey(template.vinculoAscenso || template.rutaAscenso),
});

const getCertificateStatusOption = (value) =>
  CERTIFICATE_STATUS_OPTIONS.find((option) => option.value === value) ||
  CERTIFICATE_STATUS_OPTIONS.find((option) => option.value === DEFAULT_CERTIFICATE_STATUS);

const getInitialCertificateStatus = (index) => {
  if (index < 2) return 'ausente';
  if (index < 4) return 'no_finalizado';

  return DEFAULT_CERTIFICATE_STATUS;
};

function CertificateStatusSelect({ value, disabled, onChange }) {
  const currentOption = getCertificateStatusOption(value);

  return (
    <Select
      variant="standard"
      size="small"
      value={currentOption.value}
      disabled={disabled}
      disableUnderline
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      renderValue={(selected) => {
        const option = getCertificateStatusOption(selected);

        return <Chip size="small" variant="soft" color={option.color} label={option.label} />;
      }}
      sx={{
        minWidth: 0,
        width: 'auto',
        bgcolor: 'transparent',
        '& .MuiSelect-select': {
          p: 0,
          pr: '22px !important',
          display: 'flex',
          alignItems: 'center',
        },
        '& .MuiSelect-icon': {
          right: 0,
        },
      }}
    >
      {CERTIFICATE_STATUS_OPTIONS.map((option) => (
        <MenuItem
          key={option.value}
          value={option.value}
          onClick={(event) => event.stopPropagation()}
        >
          <Chip size="small" variant="soft" color={option.color} label={option.label} />
        </MenuItem>
      ))}
    </Select>
  );
}

// ----------------------------------------------------------------------

export function CertificatesAutomationView() {
  const { user } = useAuthContext();
  const templatePreviewRef = useRef(null);
  const templateFileInputRef = useRef(null);
  const [members, setMembers] = useState([]);
  const [currentTab, setCurrentTab] = useState('create');
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState(DEFAULT_COURSE.id);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [certificateStatuses, setCertificateStatuses] = useState({});
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const [createdBatches, setCreatedBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [certificateMenuAnchor, setCertificateMenuAnchor] = useState(null);
  const [certificateActionMode, setCertificateActionMode] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteTemplateConfirmOpen, setDeleteTemplateConfirmOpen] = useState(false);
  const [duplicateRouteConfirmOpen, setDuplicateRouteConfirmOpen] = useState(false);
  const [duplicateRouteTemplate, setDuplicateRouteTemplate] = useState(null);
  const [importedTemplates, setImportedTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateDraft, setTemplateDraft] = useState(createEmptyTemplateDraft);
  const [templateDraftBaseline, setTemplateDraftBaseline] = useState(createEmptyTemplateDraft);
  const [downloadingCertificates, setDownloadingCertificates] = useState(false);
  const [downloadingCertificateId, setDownloadingCertificateId] = useState('');
  const [convertingTemplateFile, setConvertingTemplateFile] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [selectedTemplateFieldId, setSelectedTemplateFieldId] = useState('memberName');
  const [showTemplateGrid, setShowTemplateGrid] = useState(false);
  const [importDialogStep, setImportDialogStep] = useState('template');
  const [templateCenterGuide, setTemplateCenterGuide] = useState({
    horizontal: false,
    vertical: false,
  });

  const selectedTemplate = useMemo(
    () => importedTemplates.find((template) => template.id === selectedTemplateId) || null,
    [importedTemplates, selectedTemplateId]
  );

  const selectedCourse = useMemo(() => {
    if (selectedTemplate) {
      return {
        id: selectedTemplate.id,
        name: selectedTemplate.name,
        certificateTitle: selectedTemplate.name,
        body: '',
        accent: '#0F172A',
        label: 'Importada',
      };
    }

    return COURSE_TEMPLATES.find((course) => course.id === courseId) || DEFAULT_COURSE;
  }, [courseId, selectedTemplate]);

  const courseSelectValue = selectedTemplateId
    ? `${IMPORTED_TEMPLATE_COURSE_PREFIX}${selectedTemplateId}`
    : `${DEFAULT_COURSE_PREFIX}${courseId}`;
  const certificateStatusScopeId = selectedTemplateId || courseId;

  const selectedTemplateField = useMemo(
    () =>
      getTemplateFields(templateDraft).find((field) => field.id === selectedTemplateFieldId) ||
      null,
    [selectedTemplateFieldId, templateDraft]
  );

  const templateDraftHasChanges = useMemo(
    () =>
      JSON.stringify(normalizeTemplateDraftForComparison(templateDraft)) !==
      JSON.stringify(normalizeTemplateDraftForComparison(templateDraftBaseline)),
    [templateDraft, templateDraftBaseline]
  );

  const usedAwardRoutes = useMemo(
    () =>
      importedTemplates
        .filter((template) => String(template.id) !== String(templateDraft.id))
        .map((template) => {
          const route = getTemplateAwardRoute(template);
          const routeKey = getAwardRouteKey(route);

          if (!routeKey.replace(/\|/g, '')) return null;

          return {
            id: route?.id || '',
            key: routeKey,
            templateName: template.name || 'Plantilla existente',
            routeText: route?.rutaTexto || '',
          };
        })
        .filter(Boolean),
    [importedTemplates, templateDraft.id]
  );

  const handleCourseSelect = (value) => {
    if (value.startsWith(IMPORTED_TEMPLATE_COURSE_PREFIX)) {
      setSelectedTemplateId(value.replace(IMPORTED_TEMPLATE_COURSE_PREFIX, ''));
      return;
    }

    setCourseId(value.replace(DEFAULT_COURSE_PREFIX, ''));
    setSelectedTemplateId('');
  };

  useEffect(() => {
    const loadCertificateData = async () => {
      try {
        const [remoteTemplates, remoteBatches] = await Promise.all([
          listarPlantillasCertificados(),
          listarLotesCertificados(),
        ]);
        const templates = remoteTemplates
          .map((remoteTemplate) => ({
            ...remoteTemplate,
            fields: getTemplateFields(remoteTemplate),
          }))
          .filter((template) => normalizeText(template.name).includes('seguridad'));

        setImportedTemplates(templates);
        setSelectedTemplateId(templates[0]?.id || '');
        setCreatedBatches(remoteBatches);
      } catch (error) {
        setImportedTemplates([]);
        setSelectedTemplateId('');
        setCreatedBatches([]);
        toast.error(error?.message || 'No se pudieron cargar los certificados desde Firebase.');
      }
    };

    loadCertificateData();
  }, [user]);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        const data = await getMembers();
        setMembers(Array.isArray(data) ? data : []);
      } catch (error) {
        toast.error(error?.message || 'No se pudo cargar la lista de miembros.');
        setMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, []);

  useEffect(() => {
    let active = true;

    const loadCertificateStatuses = async () => {
      try {
        const statuses = await listarEstadosCertificados(certificateStatusScopeId);

        if (!active) return;

        setCertificateStatuses(
          Object.fromEntries(
            statuses.map((item) => [
              String(item.memberDocId || item.memberId || item.id),
              item.status || DEFAULT_CERTIFICATE_STATUS,
            ])
          )
        );
      } catch (error) {
        if (active) {
          setCertificateStatuses({});
          toast.error(error?.message || 'No se pudieron cargar los estados de certificados.');
        }
      }
    };

    loadCertificateStatuses();

    return () => {
      active = false;
    };
  }, [certificateStatusScopeId]);

  const filteredMembers = useMemo(() => {
    const searchValue = normalizeText(search);

    if (!searchValue) return members;

    return members.filter((member) => {
      const fullName = getMemberFullName(member);
      const memberCode = member.memberId || member.codigoMiembro || '';

      return normalizeText(`${fullName} ${memberCode}`).includes(searchValue);
    });
  }, [members, search]);

  const memberCertificateStatusById = useMemo(
    () =>
      Object.fromEntries(
        members.map((member, index) => {
          const memberId = String(member.id);

          return [memberId, certificateStatuses[memberId] || getInitialCertificateStatus(index)];
        })
      ),
    [certificateStatuses, members]
  );

  const selectedMembers = useMemo(
    () =>
      members
        .filter((member) => selectedMemberIds.includes(String(member.id)))
        .map((member) => ({
          ...member,
          certificateStatus: memberCertificateStatusById[String(member.id)],
        })),
    [memberCertificateStatusById, members, selectedMemberIds]
  );

  const selectableFilteredMembers = useMemo(
    () =>
      filteredMembers.filter(
        (member) => memberCertificateStatusById[String(member.id)] === 'presente'
      ),
    [filteredMembers, memberCertificateStatusById]
  );

  const allFilteredSelected =
    !!selectableFilteredMembers.length &&
    selectableFilteredMembers.every((member) => selectedMemberIds.includes(String(member.id)));

  const someFilteredSelected = selectableFilteredMembers.some((member) =>
    selectedMemberIds.includes(String(member.id))
  );

  const handleToggleMember = (memberId) => {
    const normalizedId = String(memberId);

    setSelectedMemberIds((current) =>
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId]
    );
  };

  const handleToggleFilteredMembers = (event) => {
    const shouldSelect = event.target.checked;
    const filteredIds = filteredMembers.map((member) => String(member.id));
    const selectableIds = selectableFilteredMembers.map((member) => String(member.id));

    setSelectedMemberIds((current) => {
      if (!shouldSelect) {
        return current.filter((id) => !filteredIds.includes(id));
      }

      return Array.from(new Set([...current, ...selectableIds]));
    });
  };

  const handleChangeCertificateStatus = async (member, status) => {
    const memberKey = String(member.id);
    const previousStatus = certificateStatuses[memberKey] || DEFAULT_CERTIFICATE_STATUS;

    setCertificateStatuses((current) => ({ ...current, [memberKey]: status }));

    try {
      await guardarEstadoCertificado({
        scopeId: certificateStatusScopeId,
        member: {
          ...member,
          memberName: getMemberFullName(member) || member.memberId || member.codigoMiembro || '',
        },
        status,
        user,
      });
    } catch (error) {
      setCertificateStatuses((current) => ({ ...current, [memberKey]: previousStatus }));
      toast.error(error?.message || 'No se pudo guardar el estado en Firebase.');
    }
  };

  const handleFormValue = (field) => (event) => {
    setFormValues((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleOpenImportDialog = () => {
    const emptyDraft = createEmptyTemplateDraft();
    setTemplateDraft(emptyDraft);
    setTemplateDraftBaseline(emptyDraft);
    setSelectedTemplateFieldId(emptyDraft.fields[0]?.id || '');
    setImportDialogStep('template');
    setImportDialogOpen(true);
  };

  const handleEditSelectedTemplate = () => {
    if (!selectedTemplate) return;

    const draft = {
      ...selectedTemplate,
      fields: getTemplateFields(selectedTemplate),
      positions: {
        ...DEFAULT_TEMPLATE_POSITIONS,
        ...(selectedTemplate.positions || {}),
      },
    };

    setTemplateDraft(draft);
    setTemplateDraftBaseline(draft);
    setSelectedTemplateFieldId(draft.fields[0]?.id || '');
    setImportDialogStep('template');
    setImportDialogOpen(true);
  };

  const handleTemplateFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    await processTemplateFile(file);
  };

  const processTemplateFile = async (file) => {
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isPdf) {
      toast.error('Importa una imagen o un PDF.');
      return;
    }

    if (isPdf) {
      try {
        setConvertingTemplateFile(true);
        const { dataUrl, pageCount } = await convertPdfFileToImageDataUrl(file);

        setTemplateDraft((current) => ({
          ...current,
          name: current.name || file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          sourceType: 'pdf',
          pageCount,
          dataUrl,
          pdfDataUrl: dataUrl,
        }));

        toast.success('PDF convertido a plantilla.');
      } catch (error) {
        toast.error(error?.message || 'No se pudo convertir el PDF.');
      } finally {
        setConvertingTemplateFile(false);
      }

      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setTemplateDraft((current) => ({
        ...current,
        name: current.name || file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        sourceType: 'image',
        pageCount: 0,
        dataUrl: String(reader.result || ''),
        pdfDataUrl: String(reader.result || ''),
      }));
    };

    reader.readAsDataURL(file);
  };

  const handleDropTemplateFile = async (event) => {
    event.preventDefault();
    await processTemplateFile(event.dataTransfer.files?.[0]);
  };

  const handleMoveTemplateField = (fieldId, event) => {
    const rect = templatePreviewRef.current?.getBoundingClientRect();

    if (!rect) return;

    const currentPosition = templateDraft.positions?.[fieldId] ||
      DEFAULT_TEMPLATE_POSITIONS[fieldId] || { x: 50, y: 50 };
    const currentCenterX = rect.left + (currentPosition.x / 100) * rect.width;
    const currentCenterY = rect.top + (currentPosition.y / 100) * rect.height;
    const pointerOffsetX = event.clientX - currentCenterX;
    const pointerOffsetY = event.clientY - currentCenterY;
    const startX = event.clientX;
    const startY = event.clientY;
    let hasDragged = false;

    const updatePosition = (clientX, clientY) => {
      const nextCenterX = clientX - pointerOffsetX;
      const nextCenterY = clientY - pointerOffsetY;
      const x = Math.min(96, Math.max(4, ((nextCenterX - rect.left) / rect.width) * 100));
      const y = Math.min(96, Math.max(4, ((nextCenterY - rect.top) / rect.height) * 100));
      const isNearVerticalCenter = Math.abs(x - 50) <= 1.2;
      const isNearHorizontalCenter = Math.abs(y - 50) <= 1.2;

      setTemplateCenterGuide({
        horizontal: isNearHorizontalCenter,
        vertical: isNearVerticalCenter,
      });

      setTemplateDraft((current) => ({
        ...current,
        positions: {
          ...current.positions,
          [fieldId]: {
            ...(current.positions?.[fieldId] || DEFAULT_TEMPLATE_POSITIONS[fieldId]),
            x: Number(x.toFixed(1)),
            y: Number(y.toFixed(1)),
          },
        },
      }));
    };

    const handlePointerMove = (moveEvent) => {
      const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);

      if (!hasDragged && distance < 4) return;

      hasDragged = true;
      updatePosition(moveEvent.clientX, moveEvent.clientY);
    };

    const handlePointerUp = () => {
      setTemplateCenterGuide({ horizontal: false, vertical: false });
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleRemoveTemplateField = (fieldId) => {
    setTemplateDraft((current) => {
      const nextPositions = { ...(current.positions || {}) };
      const nextFields = getTemplateFields(current).filter((field) => field.id !== fieldId);
      delete nextPositions[fieldId];

      if (selectedTemplateFieldId === fieldId) {
        setSelectedTemplateFieldId(nextFields[0]?.id || '');
      }

      return {
        ...current,
        fields: nextFields,
        positions: nextPositions,
      };
    });
  };

  const handleAddTemplateText = () => {
    const fieldId = `customText-${Date.now()}`;

    setTemplateDraft((current) => ({
      ...current,
      fields: [
        ...getTemplateFields(current),
        {
          id: fieldId,
          kind: 'custom',
          label: 'Texto',
          text: 'Nuevo texto',
          preview: 'Nuevo texto',
          fontFamily: 'Helvetica',
          fontSize: 12,
          width: 220,
          fontWeight: 500,
        },
      ],
      positions: {
        ...(current.positions || {}),
        [fieldId]: { x: 50, y: 50, align: 'center' },
      },
    }));
    setSelectedTemplateFieldId(fieldId);
  };

  const handleUpdateTemplateField = (fieldId, patch) => {
    setTemplateDraft((current) => ({
      ...current,
      fields: getTemplateFields(current).map((field) =>
        field.id === fieldId ? { ...field, ...patch } : field
      ),
    }));
  };

  const handleResizeTemplateField = (fieldId, event) => {
    event.preventDefault();
    event.stopPropagation();

    const field = getTemplateFields(templateDraft).find((item) => item.id === fieldId);
    const startX = event.clientX;
    const startWidth = Number(field?.width || 220);

    const handlePointerMove = (moveEvent) => {
      const nextWidth = Math.max(80, Math.round(startWidth + moveEvent.clientX - startX));
      handleUpdateTemplateField(fieldId, { width: nextWidth });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const findTemplateWithSameRoute = () => {
    const routeKey = getAwardRouteKey(templateDraft.vinculoAscenso);

    if (!routeKey.replace(/\|/g, '')) return null;

    return (
      importedTemplates.find((template) => {
        if (String(template.id) === String(templateDraft.id)) return false;

        return getAwardRouteKey(getTemplateAwardRoute(template)) === routeKey;
      }) || null
    );
  };

  const handleSaveTemplate = async ({ skipRouteCheck = false } = {}) => {
    if (!templateDraft.name.trim()) {
      toast.error('Coloca un nombre para la plantilla.');
      return;
    }

    if (!templateDraft.dataUrl) {
      toast.error('Importa una imagen del certificado.');
      return;
    }

    if (isRemoteImageUrl(templateDraft.dataUrl) && !templateDraft.pdfDataUrl) {
      toast.error(
        'Reemplaza el archivo de la plantilla antes de guardar para que el PDF no salga en blanco.'
      );
      return;
    }

    if (!templateDraft.vinculoAscenso?.idItemAscenso) {
      toast.error('Selecciona la ruta de Awards donde se guardará este certificado.');
      setImportDialogStep('awards');
      return;
    }

    if (!skipRouteCheck) {
      const templateWithSameRoute = findTemplateWithSameRoute();

      if (templateWithSameRoute) {
        setDuplicateRouteTemplate(templateWithSameRoute);
        setDuplicateRouteConfirmOpen(true);
        return;
      }
    }

    try {
      setSavingTemplate(true);
      const savedTemplate = await guardarPlantillaCertificado({ template: templateDraft, user });

      setImportedTemplates((current) => {
        const next = [savedTemplate, ...current.filter((item) => item.id !== savedTemplate.id)];
        return next;
      });
      setSelectedTemplateId(savedTemplate.id);
      setTemplateDraftBaseline(savedTemplate);
      setImportDialogOpen(false);
      setDuplicateRouteConfirmOpen(false);
      setDuplicateRouteTemplate(null);
      toast.success('Plantilla guardada en Firebase.');
    } catch (error) {
      setDuplicateRouteConfirmOpen(false);
      setDuplicateRouteTemplate(null);
      toast.error(error?.message || 'No se pudo guardar la plantilla en Firebase.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleGoToAwardPathSelection = () => {
    if (!templateDraft.name.trim()) {
      toast.error('Coloca un nombre para la plantilla.');
      return;
    }

    if (!templateDraft.dataUrl) {
      toast.error('Importa una imagen del certificado.');
      return;
    }

    if (isRemoteImageUrl(templateDraft.dataUrl) && !templateDraft.pdfDataUrl) {
      toast.error('Reemplaza el archivo de la plantilla antes de continuar.');
      return;
    }

    setImportDialogStep('awards');
  };

  const handleDeleteSelectedTemplate = async () => {
    if (!selectedTemplate) return;

    const templateName = selectedTemplate.name;

    try {
      await eliminarPlantillaCertificado(selectedTemplate);
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar la plantilla en Firebase.');
      return;
    }

    setImportedTemplates((current) => {
      const next = current.filter((item) => item.id !== selectedTemplate.id);
      return next;
    });
    setSelectedTemplateId('');
    setCourseId(DEFAULT_COURSE.id);
    setDeleteTemplateConfirmOpen(false);
    toast.success(`Plantilla "${templateName}" eliminada.`);
  };

  const buildCertificateBatch = () => {
    if (!selectedMembers.length) return null;

    const now = dayjs();

    return {
      id: `CERT-${now.format('YYYYMMDD-HHmmss')}`,
      course: selectedCourse,
      templateId: selectedTemplate?.id || '',
      templateName: selectedTemplate?.name || '',
      formValues,
      createdAt: now.toISOString(),
      createdBy: getCreatorName(user),
      certificates: selectedMembers.map((member) => ({
        id: String(member.id),
        memberId: member.memberId || member.codigoMiembro || '',
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        memberDivision: member.memberDivision || '',
        certificateStatus: member.certificateStatus || DEFAULT_CERTIFICATE_STATUS,
      })),
    };
  };

  const buildCertificatesForSelectedMembers = async () => {
    const batch = buildCertificateBatch();

    if (!batch) return null;

    const pdfTemplate = await resolveTemplateForPdf(selectedTemplate);
    const certificateFiles = await Promise.all(
      selectedMembers.map(async (member) => ({
        member: {
          ...member,
          memberName: getMemberFullName(member) || member.memberId || member.codigoMiembro || '',
        },
        fileName: buildSingleCertificateFileName(selectedCourse, member),
        blob: await pdf(
          <CertificatePdfDocument
            course={selectedCourse}
            members={[member]}
            template={pdfTemplate}
            formValues={formValues}
          />
        ).toBlob(),
      }))
    );
    const savedBatch = await guardarLoteCertificados({
      batch,
      certificateFiles,
      user,
      buildFinalBlob: async ({ member, pdfUrl }) => {
        const qrDataUrl = await buildQrCodeDataUrl(pdfUrl);
        const qrKey = String(member.id || member.memberId || member.codigoMiembro || '');

        return pdf(
          <CertificatePdfDocument
            course={selectedCourse}
            members={[member]}
            template={pdfTemplate}
            formValues={formValues}
            certificateQrs={{ [qrKey]: qrDataUrl, [String(member.memberId || '')]: qrDataUrl }}
          />
        ).toBlob();
      },
    });
    const certificateQrs = {};

    await Promise.all(
      savedBatch.certificates.map(async (certificate) => {
        const qrDataUrl = await buildQrCodeDataUrl(certificate.pdfUrl);

        [certificate.memberDocId, certificate.memberId, certificate.id]
          .filter(Boolean)
          .forEach((key) => {
            certificateQrs[String(key)] = qrDataUrl;
          });
      })
    );
    const combinedBlob = await pdf(
      <CertificatePdfDocument
        course={selectedCourse}
        members={selectedMembers}
        template={pdfTemplate}
        formValues={formValues}
        certificateQrs={certificateQrs}
      />
    ).toBlob();

    setCreatedBatches((current) => {
      const next = [savedBatch, ...current.filter((item) => item.id !== savedBatch.id)].slice(
        0,
        100
      );
      return next;
    });

    return { savedBatch, combinedBlob };
  };

  const openCertificatesEmailDraft = (savedBatch) => {
    const recipients = Array.from(
      new Set(
        selectedMembers
          .map(getMemberEmail)
          .filter(Boolean)
          .map((email) => email.trim())
      )
    );

    if (!recipients.length) {
      toast.error('Los miembros seleccionados no tienen correo registrado.');
      return false;
    }

    const certificatesByMemberId = new Map(
      (savedBatch.certificates || []).map((certificate) => [
        String(certificate.memberDocId || certificate.id || certificate.memberId || ''),
        certificate,
      ])
    );
    const certificateLines = selectedMembers.map((member) => {
      const certificate =
        certificatesByMemberId.get(String(member.id || '')) ||
        (savedBatch.certificates || []).find(
          (item) =>
            String(item.memberId || '') === String(member.memberId || member.codigoMiembro || '')
        );
      const memberName = getMemberFullName(member) || member.memberId || member.codigoMiembro || '';

      return `${memberName}: ${certificate?.pdfUrl || 'certificado pendiente'}`;
    });
    const subject = `Certificados - ${selectedCourse.certificateTitle || selectedCourse.name}`;
    const body = [
      'Saludos,',
      '',
      'Comparto los certificados generados:',
      '',
      ...certificateLines,
      '',
      'Exploradores del Rey, Rep. Dominicana 🇩🇴',
    ].join('\n');
    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(recipients.join(','))}&subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;
    toast.success('Se abrió el correo con los enlaces de certificados.');

    return true;
  };

  const handleCertificateMenuClose = () => {
    setCertificateMenuAnchor(null);
  };

  const handleCertificateAction = async (mode) => {
    if (!selectedMembers.length || downloadingCertificates) return;

    handleCertificateMenuClose();
    setCertificateActionMode(mode);

    try {
      setDownloadingCertificates(true);
      const result = await buildCertificatesForSelectedMembers();

      if (!result) return;

      if (mode === 'download' || mode === 'download-and-send') {
        downloadPdfBlob(
          result.combinedBlob,
          buildCertificateFileName(selectedCourse, selectedMembers.length)
        );
      }

      if (mode === 'send' || mode === 'download-and-send') {
        openCertificatesEmailDraft(result.savedBatch);
      }

      toast.success('Certificados guardados en Firebase.');
    } catch (error) {
      toast.error(error?.message || 'No se pudieron guardar los certificados.');
    } finally {
      setDownloadingCertificates(false);
      setCertificateActionMode('');
    }
  };

  const handleDownloadSingleCertificate = async ({ course, member, template, values }) => {
    const certificateId = String(member.id || member.memberId || '');

    if (downloadingCertificateId) return;

    try {
      setDownloadingCertificateId(certificateId);
      const pdfTemplate = await resolveTemplateForPdf(template);
      const qrValue = member.pdfUrl || member.url || '';
      const qrDataUrl = qrValue ? await buildQrCodeDataUrl(qrValue) : '';
      const blob = await pdf(
        <CertificatePdfDocument
          course={course}
          members={[member]}
          template={pdfTemplate}
          formValues={values}
          certificateQrs={{
            [String(member.id || '')]: qrDataUrl,
            [String(member.memberId || '')]: qrDataUrl,
          }}
        />
      ).toBlob();

      downloadPdfBlob(blob, buildSingleCertificateFileName(course, member));
    } catch (error) {
      toast.error(error?.message || 'No se pudo generar el certificado.');
    } finally {
      setDownloadingCertificateId('');
    }
  };

  const renderDownloadButton = () => {
    if (!selectedMembers.length) {
      return (
        <Button
          fullWidth
          disabled
          variant="contained"
          startIcon={<Iconify icon="solar:download-bold" />}
        >
          Descargar certificados
        </Button>
      );
    }

    const actionLabel =
      certificateActionMode === 'send'
        ? 'Enviando certificados...'
        : certificateActionMode === 'download-and-send'
          ? 'Descargando y enviando...'
          : 'Preparando PDF...';

    return (
      <>
        <Button
          fullWidth
          variant="contained"
          disabled={downloadingCertificates}
          onClick={(event) => setCertificateMenuAnchor(event.currentTarget)}
          startIcon={
            downloadingCertificates ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <Iconify icon="solar:download-bold" />
            )
          }
          endIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}
        >
          {downloadingCertificates ? actionLabel : 'Certificados'}
        </Button>

        <Menu
          open={Boolean(certificateMenuAnchor)}
          anchorEl={certificateMenuAnchor}
          onClose={handleCertificateMenuClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          slotProps={{ paper: { sx: { minWidth: certificateMenuAnchor?.offsetWidth || 220 } } }}
        >
          <MenuItem onClick={() => handleCertificateAction('download')}>
            <Iconify icon="solar:download-bold" sx={{ mr: 1.5 }} />
            Descargar certificados
          </MenuItem>
          <MenuItem onClick={() => handleCertificateAction('send')}>
            <Iconify icon="solar:letter-bold" sx={{ mr: 1.5 }} />
            Enviar certificados
          </MenuItem>
          <MenuItem onClick={() => handleCertificateAction('download-and-send')}>
            <Iconify icon="solar:mailbox-bold" sx={{ mr: 1.5 }} />
            Descargar y enviar certificados
          </MenuItem>
        </Menu>
      </>
    );
  };

  const renderCreatedBatches = () => (
    <Card>
      <Stack spacing={2} sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h6">Certificados creados</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Historial de lotes guardados en Firebase.
            </Typography>
          </Box>

          <Chip
            color="primary"
            variant="soft"
            label={`${createdBatches.length} lote${createdBatches.length === 1 ? '' : 's'}`}
          />
        </Stack>
      </Stack>

      <TableContainer>
        <Scrollbar>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Lote</TableCell>
                <TableCell>Certificado</TableCell>
                <TableCell>Cantidad</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Hora</TableCell>
                <TableCell>Creado por</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {createdBatches.map((batch) => (
                <TableRow key={batch.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{batch.id}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">{batch.course?.certificateTitle}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {batch.course?.name}
                      </Typography>
                      {!!batch.templateName && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Plantilla: {batch.templateName}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {batch.totalCertificates || batch.certificates?.length || 0}
                  </TableCell>
                  <TableCell>{dayjs(batch.createdAt).format('DD/MM/YYYY')}</TableCell>
                  <TableCell>{dayjs(batch.createdAt).format('hh:mm A')}</TableCell>
                  <TableCell>
                    {typeof batch.createdBy === 'string'
                      ? batch.createdBy
                      : batch.createdBy?.name || 'Usuario'}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Iconify icon="solar:list-bold" />}
                      onClick={() => setSelectedBatch(batch)}
                    >
                      Ver lista
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!createdBatches.length && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                      <Typography variant="subtitle1">
                        Todavía no hay certificados creados
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Cuando descargues un lote, aparecerá aquí con su detalle.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>
    </Card>
  );

  const renderBatchDialog = () => {
    if (!selectedBatch) return null;

    const batchTemplate = importedTemplates.find(
      (template) => template.id === selectedBatch.templateId
    );

    return (
      <Dialog
        fullWidth
        maxWidth="md"
        open={Boolean(selectedBatch)}
        onClose={() => setSelectedBatch(null)}
      >
        <DialogTitle>
          <Stack spacing={0.5}>
            <Typography variant="h6">{selectedBatch.id}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {selectedBatch.course?.certificateTitle} ?{' '}
              {dayjs(selectedBatch.createdAt).format('DD/MM/YYYY hh:mm A')}
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Miembro</TableCell>
                  <TableCell>Código</TableCell>
                  <TableCell>División</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Descarga</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {selectedBatch.certificates.map((certificate) => {
                  const isDownloading = downloadingCertificateId === String(certificate.id);
                  const statusOption = getCertificateStatusOption(
                    certificate.certificateStatus ||
                      certificate.status ||
                      DEFAULT_CERTIFICATE_STATUS
                  );

                  return (
                    <TableRow key={certificate.id}>
                      <TableCell>
                        {certificate.memberName || getMemberFullName(certificate) || 'Sin nombre'}
                      </TableCell>
                      <TableCell>{certificate.memberId || '-'}</TableCell>
                      <TableCell>{certificate.memberDivision || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="soft"
                          color={statusOption.color}
                          label={statusOption.label}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          disabled={Boolean(downloadingCertificateId)}
                          onClick={() =>
                            handleDownloadSingleCertificate({
                              course: selectedBatch.course,
                              member: certificate,
                              template: batchTemplate,
                              values: selectedBatch.formValues,
                            })
                          }
                          startIcon={
                            isDownloading ? (
                              <CircularProgress size={16} color="inherit" />
                            ) : (
                              <Iconify icon="solar:download-bold" />
                            )
                          }
                        >
                          {isDownloading ? 'Preparando...' : 'Descargar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={() => setSelectedBatch(null)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const canSelectAwardPath = Boolean(templateDraft.dataUrl) && !convertingTemplateFile;
  const canSaveTemplateChanges =
    Boolean(templateDraft.vinculoAscenso?.idItemAscenso) &&
    Boolean(templateDraft.dataUrl) &&
    templateDraftHasChanges &&
    !convertingTemplateFile;
  const selectAwardPathTooltip = !templateDraft.dataUrl
    ? 'Primero debes seleccionar una plantilla.'
    : convertingTemplateFile
      ? 'Cargando plantilla...'
      : '';

  const renderImportDialog = () => (
    <Dialog
      fullWidth
      maxWidth="lg"
      open={importDialogOpen}
      onClose={() => setImportDialogOpen(false)}
    >
      <DialogTitle>
        {importDialogStep === 'template' ? (
          'Importar certificado'
        ) : (
          <Stack spacing={0.75}>
            <Typography variant="h6">Seleccionar ruta de Sistema Ascenso</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Esta ruta se guardará junto a la plantilla para depositar el certificado en el premio
              correcto del miembro.
            </Typography>
          </Stack>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {importDialogStep === 'template' ? (
          <Box
            sx={{
              gap: 3,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
              alignItems: 'start',
            }}
          >
            <Stack spacing={2.5} sx={{ pt: 0.75 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Los objetos (textos) sobre el certificado son ejemplos para ubicar los datos. Al
                guardar la plantilla y generar el certificado, cada dato real aparecerá en el lugar
                elegido.
              </Typography>

              <TextField
                fullWidth
                sx={{ mt: 0.75 }}
                label="Nombre de la plantilla"
                value={templateDraft.name}
                onChange={(event) =>
                  setTemplateDraft((current) => ({ ...current, name: event.target.value }))
                }
                slotProps={{
                  inputLabel: {
                    shrink: true,
                    sx: { px: 0.5, bgcolor: 'background.paper' },
                  },
                }}
              />

              <TextField
                fullWidth
                type="color"
                label="Color del texto"
                value={templateDraft.textColor}
                onChange={(event) =>
                  setTemplateDraft((current) => ({ ...current, textColor: event.target.value }))
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <Stack spacing={1}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Letra del texto seleccionado
                </Typography>

                <TextField
                  select
                  fullWidth
                  size="small"
                  disabled={!selectedTemplateField}
                  value={normalizeTemplateFont(selectedTemplateField?.fontFamily)}
                  onChange={(event) =>
                    handleUpdateTemplateField(selectedTemplateFieldId, {
                      fontFamily: event.target.value,
                    })
                  }
                >
                  {TEMPLATE_FONT_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Divider />

              <Stack
                spacing={1.5}
                sx={{
                  opacity: templateDraft.dataUrl ? 1 : 0.48,
                  pointerEvents: templateDraft.dataUrl ? 'auto' : 'none',
                }}
              >
                {getTemplateFields(templateDraft).map((field) => {
                  const position = templateDraft.positions?.[field.id] ||
                    DEFAULT_TEMPLATE_POSITIONS[field.id] || { x: 50, y: 50 };
                  const sizeOptions = isQrTemplateField(field)
                    ? TEMPLATE_QR_SIZE_OPTIONS
                    : TEMPLATE_FONT_SIZE_OPTIONS;

                  return (
                    <Stack
                      key={field.id}
                      spacing={1}
                      onClick={() => setSelectedTemplateFieldId(field.id)}
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        border: (theme) =>
                          `solid 1px ${
                            selectedTemplateFieldId === field.id
                              ? theme.vars.palette.text.primary
                              : theme.vars.palette.divider
                          }`,
                      }}
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography
                          variant="body2"
                          sx={{
                            width: 54,
                            flexShrink: 0,
                          }}
                        >
                          {field.label}
                        </Typography>
                        <TextField
                          select
                          size="small"
                          value={
                            isQrTemplateField(field)
                              ? getTemplateFieldSize(field)
                              : (field.fontSize ?? '')
                          }
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            isQrTemplateField(field)
                              ? handleUpdateTemplateField(field.id, {
                                  size: Number(event.target.value) || 72,
                                  width: Number(event.target.value) || 72,
                                })
                              : handleUpdateTemplateField(field.id, {
                                  fontSize: Number(event.target.value) || 14,
                                })
                          }
                          sx={{
                            width: 66,
                            mr: 'auto',
                            '& .MuiInputBase-root': {
                              height: 32,
                              alignItems: 'center',
                            },
                            '& .MuiSelect-select': {
                              py: 0,
                              display: 'flex',
                              alignItems: 'center',
                              pr: '24px !important',
                            },
                          }}
                        >
                          {sizeOptions.map((size) => (
                            <MenuItem key={size} value={size}>
                              {size}
                            </MenuItem>
                          ))}
                        </TextField>
                        <Chip
                          size="small"
                          variant="soft"
                          label={`${Math.round(position.x)}%, ${Math.round(position.y)}%`}
                        />
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveTemplateField(field.id)}
                        >
                          <Iconify width={16} icon="solar:close-circle-bold" />
                        </IconButton>
                      </Stack>

                      <Stack direction="row" spacing={1} sx={{ display: 'none' }}>
                        <TextField
                          select
                          size="small"
                          label="Tama?o"
                          value={field.fontSize ?? ''}
                          onChange={(event) =>
                            handleUpdateTemplateField(field.id, {
                              fontSize: Number(event.target.value) || 14,
                            })
                          }
                          sx={{
                            width: 82,
                            '& .MuiSelect-select': {
                              py: 0.75,
                              pr: '28px !important',
                            },
                          }}
                        >
                          {TEMPLATE_FONT_SIZE_OPTIONS.map((size) => (
                            <MenuItem key={size} value={size}>
                              {size}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Stack>
                    </Stack>
                  );
                })}

                <Button
                  fullWidth
                  variant="outlined"
                  disabled={!templateDraft.dataUrl}
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={handleAddTemplateText}
                >
                  Agregar texto
                </Button>
              </Stack>
            </Stack>

            <Stack spacing={1.25}>
              <Box
                ref={templatePreviewRef}
                onClick={() => {
                  if (!templateDraft.dataUrl) {
                    templateFileInputRef.current?.click();
                  }
                }}
                onDrop={handleDropTemplateFile}
                onDragOver={(event) => event.preventDefault()}
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 1,
                  aspectRatio: '1.414 / 1',
                  bgcolor: 'background.neutral',
                  cursor: convertingTemplateFile
                    ? 'wait'
                    : templateDraft.dataUrl
                      ? 'default'
                      : 'pointer',
                  border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
                }}
              >
                <Box
                  ref={templateFileInputRef}
                  hidden
                  component="input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
                  onChange={handleTemplateFile}
                />

                {templateDraft.dataUrl ? (
                  <Box
                    component="img"
                    loading="lazy"
                    decoding="async"
                    src={templateDraft.dataUrl}
                    alt={templateDraft.name || 'Certificado importado'}
                    sx={{ width: 1, height: 1, display: 'block', objectFit: 'cover' }}
                  />
                ) : (
                  <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ height: 1 }}>
                    {convertingTemplateFile ? (
                      <CircularProgress size={34} />
                    ) : (
                      <Iconify width={40} icon="solar:gallery-add-bold" />
                    )}
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Presiona o arrastra una imagen/PDF de certificado
                    </Typography>
                  </Stack>
                )}

                {templateDraft.dataUrl && showTemplateGrid && (
                  <Box
                    sx={{
                      inset: 0,
                      zIndex: 1,
                      opacity: 0.5,
                      position: 'absolute',
                      pointerEvents: 'none',
                      backgroundImage: `
                    linear-gradient(to right, rgba(37, 99, 235, 0.42) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(37, 99, 235, 0.42) 1px, transparent 1px)
                  `,
                      backgroundSize: '5% 5%',
                    }}
                  />
                )}

                {templateDraft.dataUrl && templateCenterGuide.vertical && (
                  <Box
                    sx={{
                      top: 0,
                      bottom: 0,
                      left: '50%',
                      zIndex: 1,
                      width: 2,
                      position: 'absolute',
                      bgcolor: 'primary.main',
                      pointerEvents: 'none',
                      transform: 'translateX(-50%)',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.72)',
                    }}
                  />
                )}

                {templateDraft.dataUrl && templateCenterGuide.horizontal && (
                  <Box
                    sx={{
                      left: 0,
                      right: 0,
                      top: '50%',
                      zIndex: 1,
                      height: 2,
                      position: 'absolute',
                      bgcolor: 'primary.main',
                      pointerEvents: 'none',
                      transform: 'translateY(-50%)',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.72)',
                    }}
                  />
                )}

                {templateDraft.dataUrl &&
                  getTemplateFields(templateDraft).map((field) => {
                    const position = templateDraft.positions?.[field.id] ||
                      DEFAULT_TEMPLATE_POSITIONS[field.id] || { x: 50, y: 50 };

                    return (
                      <Box
                        key={field.id}
                        onClick={(event) => event.preventDefault()}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setSelectedTemplateFieldId(field.id);
                          handleMoveTemplateField(field.id, event);
                        }}
                        sx={{
                          px: isQrTemplateField(field) ? 0 : 1,
                          py: isQrTemplateField(field) ? 0 : 0.5,
                          width: isQrTemplateField(field)
                            ? getTemplateFieldSize(field)
                            : field.width || 220,
                          height: isQrTemplateField(field) ? getTemplateFieldSize(field) : 'auto',
                          borderRadius: 0.75,
                          position: 'absolute',
                          zIndex: 2,
                          left: `${position.x}%`,
                          top: `${position.y}%`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          userSelect: 'none',
                          cursor: 'grab',
                          lineHeight: 1.2,
                          textAlign: 'center',
                          color: templateDraft.textColor || '#111827',
                          fontSize: Number(field.fontSize) || 14,
                          ...(isQrTemplateField(field) ? {} : getTemplatePreviewTypography(field)),
                          bgcolor: isQrTemplateField(field)
                            ? 'transparent'
                            : 'rgba(255,255,255,0.3)',
                          border:
                            selectedTemplateFieldId === field.id
                              ? '1px dashed rgba(15,23,42,0.86)'
                              : '1px dashed rgba(15,23,42,0.38)',
                          textShadow:
                            '0 1px 2px rgba(255,255,255,0.95), 0 -1px 2px rgba(255,255,255,0.95)',
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <IconButton
                          size="small"
                          color="error"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveTemplateField(field.id);
                          }}
                          sx={{
                            p: 0,
                            top: -11,
                            right: -11,
                            position: 'absolute',
                            bgcolor: 'background.paper',
                            '&:hover': { bgcolor: 'background.paper' },
                          }}
                        >
                          <Iconify width={16} icon="solar:close-circle-bold" />
                        </IconButton>
                        {!isQrTemplateField(field) && (
                          <Box
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onPointerDown={(event) => handleResizeTemplateField(field.id, event)}
                            sx={{
                              top: 'calc(50% + 8px)',
                              right: -7,
                              width: 12,
                              height: 28,
                              zIndex: 2,
                              borderRadius: 1,
                              cursor: 'ew-resize',
                              position: 'absolute',
                              bgcolor: 'background.paper',
                              border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
                              transform: 'translateY(-50%)',
                              '&::before': {
                                content: '""',
                                width: 2,
                                height: 14,
                                top: 6,
                                left: 4,
                                borderRadius: 1,
                                position: 'absolute',
                                bgcolor: 'text.disabled',
                              },
                            }}
                          />
                        )}
                        {isQrTemplateField(field) ? (
                          <Box
                            component="img"
                            loading="lazy"
                            decoding="async"
                            src={SAMPLE_QR_CODE_SRC}
                            alt="QR"
                            sx={{ width: 1, height: 1, display: 'block' }}
                          />
                        ) : field.kind === 'custom' ? (
                          <Box
                            component="span"
                            contentEditable
                            suppressContentEditableWarning
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                            onInput={(event) =>
                              handleUpdateTemplateField(field.id, {
                                text: event.currentTarget.textContent || '',
                                preview: event.currentTarget.textContent || '',
                              })
                            }
                            sx={{
                              display: 'block',
                              minHeight: 1,
                              cursor: 'text',
                              outline: 'none',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {getTemplateFieldPreview(field)}
                          </Box>
                        ) : (
                          getTemplateFieldPreview(field)
                        )}
                      </Box>
                    );
                  })}
              </Box>

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  size="small"
                  variant={showTemplateGrid ? 'contained' : 'outlined'}
                  startIcon={<Iconify icon="mingcute:dot-grid-fill" />}
                  onClick={() => setShowTemplateGrid((current) => !current)}
                >
                  Cuadrí­cula
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={convertingTemplateFile}
                  startIcon={<Iconify icon="solar:gallery-add-bold" />}
                  onClick={() => templateFileInputRef.current?.click()}
                >
                  Reemplazar
                </Button>
              </Stack>
            </Stack>
          </Box>
        ) : (
          <AwardsPathSelector
            value={templateDraft.vinculoAscenso}
            usedRoutes={usedAwardRoutes}
            onChange={(route) =>
              setTemplateDraft((current) => ({
                ...current,
                vinculoAscenso: route,
              }))
            }
          />
        )}
      </DialogContent>

      <DialogActions sx={{ gap: 1 }}>
        {importDialogStep === 'template' ? (
          <>
            <LoadingButton
              variant="contained"
              loading={savingTemplate}
              disabled={!canSaveTemplateChanges}
              onClick={() => handleSaveTemplate()}
              sx={{ mr: 'auto' }}
            >
              Guardar cambios
            </LoadingButton>
            <Button variant="outlined" onClick={() => setImportDialogOpen(false)}>
              Cancelar
            </Button>
            <Tooltip title={selectAwardPathTooltip}>
              <span>
                <Button
                  variant="contained"
                  disabled={!canSelectAwardPath}
                  onClick={handleGoToAwardPathSelection}
                >
                  Seleccionar ruta de Sistema Ascenso
                </Button>
              </span>
            </Tooltip>
          </>
        ) : (
          <>
            <Button variant="outlined" onClick={() => setImportDialogStep('template')}>
              Atrás
            </Button>
            <LoadingButton
              variant="contained"
              loading={savingTemplate}
              disabled={!templateDraft.vinculoAscenso?.idItemAscenso}
              onClick={() => handleSaveTemplate()}
            >
              Guardar plantilla
            </LoadingButton>
          </>
        )}
      </DialogActions>
    </Dialog>
  );

  const renderDeleteTemplateConfirmDialog = () => (
    <ConfirmDialog
      open={deleteTemplateConfirmOpen}
      onClose={() => setDeleteTemplateConfirmOpen(false)}
      title="Eliminar plantilla"
      content={
        <>
          ¿Seguro que deseas eliminar la plantilla{' '}
          <strong>{selectedTemplate?.name || 'seleccionada'}</strong>?
        </>
      }
      action={
        <Button variant="contained" color="error" onClick={handleDeleteSelectedTemplate}>
          Eliminar
        </Button>
      }
    />
  );

  const renderDuplicateRouteConfirmDialog = () => (
    <ConfirmDialog
      open={duplicateRouteConfirmOpen}
      onClose={() => {
        setDuplicateRouteConfirmOpen(false);
        setDuplicateRouteTemplate(null);
      }}
      title="Ruta ya vinculada"
      content={
        <>
          Ya existe una plantilla con la misma ruta
          {duplicateRouteTemplate?.name ? (
            <>
              : <strong>{duplicateRouteTemplate.name}</strong>
            </>
          ) : null}
          .<br />
          ¿Realmente deseas cambiarla?
        </>
      }
      action={
        <LoadingButton
          variant="contained"
          loading={savingTemplate}
          onClick={() => handleSaveTemplate({ skipRouteCheck: true })}
        >
          Sí, cambiarla
        </LoadingButton>
      }
    />
  );

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Certificados"
        links={[{ name: 'Panel' }, { name: 'Certificados' }]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="solar:import-bold" />}
            onClick={handleOpenImportDialog}
          >
            Importar certificado
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Tabs
        value={currentTab}
        onChange={(event, newValue) => setCurrentTab(newValue)}
        sx={{ mb: { xs: 3, md: 5 } }}
      >
        <Tab
          value="create"
          label="Crear certificados"
          icon={<Iconify width={24} icon="solar:document-add-bold" />}
        />
        <Tab
          value="created"
          label="Certificados creados"
          icon={<Iconify width={24} icon="solar:folder-check-bold" />}
        />
      </Tabs>

      {currentTab === 'create' ? (
        <Box
          sx={{
            gap: 3,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '360px 1fr' },
            alignItems: 'start',
          }}
        >
          <Stack spacing={3}>
            <Card sx={{ p: 3 }}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6">Plantilla del curso</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    Selecciona la plantilla guardada en Firebase para generar certificados.
                  </Typography>
                </Box>

                <TextField
                  select
                  fullWidth
                  label="Curso"
                  value={courseSelectValue}
                  onChange={(event) => handleCourseSelect(event.target.value)}
                >
                  {!importedTemplates.length && (
                    <MenuItem value={`${DEFAULT_COURSE_PREFIX}${DEFAULT_COURSE.id}`} disabled>
                      Importa la plantilla Seguridad
                    </MenuItem>
                  )}
                  {importedTemplates.map((template) => (
                    <MenuItem
                      key={template.id}
                      value={`${IMPORTED_TEMPLATE_COURSE_PREFIX}${template.id}`}
                    >
                      {template.name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  fullWidth
                  type="date"
                  label="Fecha de emisión"
                  value={formValues.issuedAt}
                  onChange={handleFormValue('issuedAt')}
                  slotProps={{ inputLabel: { shrink: true } }}
                />

                <TextField
                  fullWidth
                  label="Instructor / firma"
                  value={formValues.instructor}
                  onChange={handleFormValue('instructor')}
                />
              </Stack>
            </Card>

            <Card sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle1">Vista previa</Typography>
                  {selectedTemplate ? (
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Tooltip title="Modificar plantilla">
                        <IconButton
                          size="small"
                          onClick={handleEditSelectedTemplate}
                          sx={{
                            width: 32,
                            height: 32,
                            border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
                            borderRadius: 1,
                          }}
                        >
                          <Iconify icon="solar:pen-linear" width={18} />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Eliminar plantilla">
                        <IconButton
                          size="small"
                          onClick={() => setDeleteTemplateConfirmOpen(true)}
                          sx={{
                            width: 32,
                            height: 32,
                            border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
                            borderRadius: 1,
                            '&:hover': {
                              color: 'error.main',
                              borderColor: 'error.main',
                              bgcolor: 'error.lighter',
                            },
                          }}
                        >
                          <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ) : (
                    <Chip size="small" label={selectedCourse.label} />
                  )}
                </Stack>

                {selectedTemplate ? (
                  <>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      Se guardará en{' '}
                      {formatAwardRouteText(getTemplateAwardRoute(selectedTemplate)?.rutaTexto) ||
                        'Ruta no seleccionada'}
                    </Typography>

                    <Box
                      sx={{
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: 1,
                        aspectRatio: '1.414 / 1',
                        bgcolor: 'background.neutral',
                        border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
                      }}
                    >
                      <Box
                        component="img"
                        loading="lazy"
                        decoding="async"
                        src={selectedTemplate.dataUrl}
                        alt={selectedTemplate.name}
                        sx={{ width: 1, height: 1, display: 'block', objectFit: 'cover' }}
                      />
                      {getTemplateFields(selectedTemplate).map((field) => {
                        const position = selectedTemplate.positions?.[field.id] ||
                          DEFAULT_TEMPLATE_POSITIONS[field.id] || { x: 50, y: 50 };
                        const previewSize = Math.max(
                          24,
                          Math.round(getTemplateFieldSize(field) * 0.5)
                        );

                        return (
                          <Box
                            key={field.id}
                            sx={{
                              px: isQrTemplateField(field) ? 0 : 0.75,
                              py: isQrTemplateField(field) ? 0 : 0.25,
                              width: isQrTemplateField(field)
                                ? previewSize
                                : Math.max(60, Math.round(Number(field.width || 180) * 0.5)),
                              height: isQrTemplateField(field) ? previewSize : 'auto',
                              borderRadius: 0.75,
                              position: 'absolute',
                              left: `${position.x}%`,
                              top: `${position.y}%`,
                              color: selectedTemplate.textColor,
                              fontSize: getScaledTemplatePreviewFontSize(field),
                              ...(isQrTemplateField(field)
                                ? {}
                                : getTemplatePreviewTypography(field)),
                              textAlign: 'center',
                              bgcolor: 'rgba(255,255,255,0.72)',
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            {isQrTemplateField(field) ? (
                              <Box
                                component="img"
                                loading="lazy"
                                decoding="async"
                                src={SAMPLE_QR_CODE_SRC}
                                alt="QR"
                                sx={{ width: 1, height: 1, display: 'block' }}
                              />
                            ) : (
                              getTemplateFieldPreview(field)
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </>
                ) : (
                  <Box
                    sx={{
                      p: 3,
                      minHeight: 220,
                      borderRadius: 1,
                      display: 'flex',
                      textAlign: 'center',
                      alignItems: 'center',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      border: (theme) =>
                        `4px solid ${selectedCourse.accent || theme.palette.divider}`,
                      bgcolor: 'background.neutral',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Exploradores del Rey
                    </Typography>
                    <Typography variant="h5" sx={{ mt: 1 }}>
                      {selectedCourse.certificateTitle}
                    </Typography>
                    <Divider
                      sx={{
                        my: 2,
                        width: 120,
                        borderWidth: 2,
                        borderColor: selectedCourse.accent,
                      }}
                    />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {selectedCourse.body}
                    </Typography>
                  </Box>
                )}

                {renderDownloadButton()}
              </Stack>
            </Card>
          </Stack>

          <Card>
            <Stack
              spacing={2}
              sx={{
                p: 3,
                pb: 2,
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="h6">Personas para certificar</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    Selecciona los miembros que recibirán el certificado.
                  </Typography>
                </Box>

                <Chip
                  color="primary"
                  variant="soft"
                  label={`${selectedMembers.length} seleccionado${
                    selectedMembers.length === 1 ? '' : 's'
                  }`}
                />
              </Stack>

              <TextField
                fullWidth
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre o código"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="solar:magnifer-linear" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Stack>

            <TableContainer sx={{ maxHeight: 560, overflowX: 'hidden' }}>
              <Scrollbar sx={{ overflowX: 'hidden' }}>
                <Table stickyHeader sx={{ tableLayout: 'fixed', width: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ width: 52 }}>
                        <Checkbox
                          checked={allFilteredSelected}
                          indeterminate={!allFilteredSelected && someFilteredSelected}
                          onChange={handleToggleFilteredMembers}
                          disabled={!selectableFilteredMembers.length}
                        />
                      </TableCell>
                      <TableCell sx={{ width: '40%' }}>Nombre</TableCell>
                      <TableCell sx={{ width: '22%' }}>Código</TableCell>
                      <TableCell sx={{ width: '14%' }}>División</TableCell>
                      <TableCell sx={{ width: 132 }}>Estado</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {loadingMembers ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Stack
                            spacing={1}
                            alignItems="center"
                            justifyContent="center"
                            sx={{ py: 8 }}
                          >
                            <CircularProgress size={28} />
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              Cargando miembros...
                            </Typography>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMembers.map((member) => {
                        const memberId = String(member.id);
                        const checked = selectedMemberIds.includes(memberId);
                        const certificateStatus =
                          memberCertificateStatusById[memberId] || DEFAULT_CERTIFICATE_STATUS;

                        return (
                          <TableRow
                            hover
                            key={memberId}
                            selected={checked}
                            sx={{ cursor: 'pointer' }}
                            onClick={() => handleToggleMember(memberId)}
                          >
                            <TableCell padding="checkbox" sx={{ width: 52 }}>
                              <Checkbox
                                checked={checked}
                                onClick={(event) => event.stopPropagation()}
                                onChange={() => handleToggleMember(memberId)}
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 0 }}>
                              <Typography
                                noWrap
                                variant="subtitle2"
                                sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                              >
                                {getMemberFullName(member) || 'Sin nombre'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ minWidth: 0 }}>
                              <Typography
                                noWrap
                                variant="body2"
                                sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                              >
                                {member.memberId || member.codigoMiembro || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ minWidth: 0 }}>
                              <Typography
                                noWrap
                                variant="body2"
                                sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                              >
                                {member.memberDivision || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ width: 132 }}>
                              <CertificateStatusSelect
                                value={certificateStatus}
                                onChange={(status) => handleChangeCertificateStatus(member, status)}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}

                    {!loadingMembers && !filteredMembers.length && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Box sx={{ py: 8, textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              No hay miembros para mostrar.
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>
          </Card>
        </Box>
      ) : (
        renderCreatedBatches()
      )}

      {renderBatchDialog()}
      {renderImportDialog()}
      {renderDeleteTemplateConfirmDialog()}
      {renderDuplicateRouteConfirmDialog()}
    </DashboardContent>
  );
}
