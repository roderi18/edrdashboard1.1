'use client';

import 'dayjs/locale/es';

import dayjs from 'dayjs';
import { useRef, useMemo, useState, useEffect } from 'react';
import { pdf, Page, Text, View, Image, Document, StyleSheet } from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
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
  guardarPlantillaCertificado,
  listarPlantillasCertificados,
  eliminarPlantillaCertificado,
} from 'src/services/certificate-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const CERTIFICATE_BATCHES_STORAGE_KEY = 'certificate-created-batches';
const CERTIFICATE_TEMPLATES_STORAGE_KEY = 'certificate-imported-templates';
const IMPORTED_TEMPLATE_COURSE_PREFIX = 'template:';
const DEFAULT_COURSE_PREFIX = 'course:';

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
  memberName: { x: 50, y: 80, align: 'center' },
  date: { x: 50, y: 89, align: 'center' },
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

const getDefaultTemplateFields = () =>
  CERTIFICATE_TEMPLATE_FIELDS.map(buildTemplateField);

const getTemplateFields = (template) =>
  (Array.isArray(template?.fields) && template.fields.length
    ? template.fields
    : getDefaultTemplateFields()
  ).filter(
    (field) =>
      field.id !== 'courseName' &&
      field.id !== 'place' &&
      field.id !== 'signature1' &&
      field.id !== 'signature2'
  );

const getTemplateFieldPreview = (field) => field.text || field.preview || field.label;

const getScaledTemplatePreviewFontSize = (field) =>
  Math.max(6, Math.round((Number(field.fontSize) || 14) * 0.5));

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

function ImportedTemplateCertificatePage({ course, member, formValues, template }) {
  return (
    <Page size="A4" orientation="landscape" wrap={false}>
      <View style={certificateStyles.importedCanvas}>
        <Image src={template.dataUrl} style={certificateStyles.importedBackground} />

        {getTemplateFields(template).map((field) => {
          const position =
            template.positions?.[field.id] || DEFAULT_TEMPLATE_POSITIONS[field.id] || {
              x: 50,
              y: 50,
            };
          const value = getFieldValue({ field, member, course, formValues });

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

function CertificatePdfDocument({ course, members, formValues, template }) {
  return (
    <Document>
      {members.map((member) => {
        const memberName = getMemberFullName(member) || member.memberId || 'Miembro';

        if (template?.dataUrl) {
          return (
            <ImportedTemplateCertificatePage
              key={member.id}
              course={course}
              member={member}
              template={template}
              formValues={formValues}
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

const loadCertificateBatches = () => {
  try {
    const raw = window.localStorage.getItem(CERTIFICATE_BATCHES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveCertificateBatches = (batches) => {
  window.localStorage.setItem(CERTIFICATE_BATCHES_STORAGE_KEY, JSON.stringify(batches));
};

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

const loadImportedTemplates = () => {
  try {
    const raw = window.localStorage.getItem(CERTIFICATE_TEMPLATES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.map((template) => ({
      ...template,
      fields: getTemplateFields(template),
    }));
  } catch {
    return [];
  }
};

const saveImportedTemplates = (templates) => {
  window.localStorage.setItem(CERTIFICATE_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
};

const getSecurityTemplatesFromLocalStorage = () =>
  loadImportedTemplates().filter((template) => normalizeText(template.name).includes('seguridad'));

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
  textColor: '#111827',
  fields: getDefaultTemplateFields(),
  positions: { ...DEFAULT_TEMPLATE_POSITIONS },
});

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
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const [createdBatches, setCreatedBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteTemplateConfirmOpen, setDeleteTemplateConfirmOpen] = useState(false);
  const [importedTemplates, setImportedTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateDraft, setTemplateDraft] = useState(createEmptyTemplateDraft);
  const [downloadingCertificates, setDownloadingCertificates] = useState(false);
  const [downloadingCertificateId, setDownloadingCertificateId] = useState('');
  const [convertingTemplateFile, setConvertingTemplateFile] = useState(false);
  const [selectedTemplateFieldId, setSelectedTemplateFieldId] = useState('memberName');
  const [showTemplateGrid, setShowTemplateGrid] = useState(false);
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

  const selectedTemplateField = useMemo(
    () =>
      getTemplateFields(templateDraft).find((field) => field.id === selectedTemplateFieldId) ||
      null,
    [selectedTemplateFieldId, templateDraft]
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
        const localSecurityTemplates = getSecurityTemplatesFromLocalStorage();
        const missingSecurityTemplates = localSecurityTemplates.filter(
          (localTemplate) =>
            !remoteTemplates.some(
              (remoteTemplate) =>
                remoteTemplate.id === localTemplate.id ||
                normalizeText(remoteTemplate.name) === normalizeText(localTemplate.name)
            )
        );

        const migratedTemplates = await Promise.all(
          missingSecurityTemplates.map((template) =>
            guardarPlantillaCertificado({ template, user }).catch(() => null)
          )
        );
        const templates = [
          ...migratedTemplates.filter(Boolean),
          ...remoteTemplates,
        ].filter((template) => normalizeText(template.name).includes('seguridad'));

        setImportedTemplates(templates);
        setSelectedTemplateId(templates[0]?.id || '');
        setCreatedBatches(remoteBatches.length ? remoteBatches : loadCertificateBatches());
      } catch (error) {
        const localTemplates = getSecurityTemplatesFromLocalStorage();

        setImportedTemplates(localTemplates);
        setSelectedTemplateId(localTemplates[0]?.id || '');
        setCreatedBatches(loadCertificateBatches());
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

  const filteredMembers = useMemo(() => {
    const searchValue = normalizeText(search);

    if (!searchValue) return members;

    return members.filter((member) => {
      const fullName = getMemberFullName(member);
      const memberCode = member.memberId || member.codigoMiembro || '';

      return normalizeText(`${fullName} ${memberCode}`).includes(searchValue);
    });
  }, [members, search]);

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedMemberIds.includes(String(member.id))),
    [members, selectedMemberIds]
  );

  const allFilteredSelected =
    !!filteredMembers.length &&
    filteredMembers.every((member) => selectedMemberIds.includes(String(member.id)));

  const someFilteredSelected = filteredMembers.some((member) =>
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

  const handleToggleFilteredMembers = () => {
    const filteredIds = filteredMembers.map((member) => String(member.id));

    setSelectedMemberIds((current) => {
      if (allFilteredSelected) {
        return current.filter((id) => !filteredIds.includes(id));
      }

      return Array.from(new Set([...current, ...filteredIds]));
    });
  };

  const handleFormValue = (field) => (event) => {
    setFormValues((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleOpenImportDialog = () => {
    const emptyDraft = createEmptyTemplateDraft();
    setTemplateDraft(emptyDraft);
    setSelectedTemplateFieldId(emptyDraft.fields[0]?.id || '');
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
    setSelectedTemplateFieldId(draft.fields[0]?.id || '');
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

    const currentPosition =
      templateDraft.positions?.[fieldId] || DEFAULT_TEMPLATE_POSITIONS[fieldId] || { x: 50, y: 50 };
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

  const handleSaveTemplate = async () => {
    if (!templateDraft.name.trim()) {
      toast.error('Coloca un nombre para la plantilla.');
      return;
    }

    if (!templateDraft.dataUrl) {
      toast.error('Importa una imagen del certificado.');
      return;
    }

    try {
      const savedTemplate = await guardarPlantillaCertificado({ template: templateDraft, user });

      setImportedTemplates((current) => {
        const next = [savedTemplate, ...current.filter((item) => item.id !== savedTemplate.id)];
        saveImportedTemplates(next);
        return next;
      });
      setSelectedTemplateId(savedTemplate.id);
      setImportDialogOpen(false);
      toast.success('Plantilla guardada en Firebase.');
    } catch (error) {
      setImportedTemplates((current) => {
        const next = [templateDraft, ...current.filter((item) => item.id !== templateDraft.id)];
        saveImportedTemplates(next);
        return next;
      });
      setSelectedTemplateId(templateDraft.id);
      setImportDialogOpen(false);
      toast.error(error?.message || 'No se pudo guardar la plantilla en Firebase.');
    }
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
      saveImportedTemplates(next);
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
      })),
    };
  };

  const handleDownloadCertificates = async () => {
    if (!selectedMembers.length || downloadingCertificates) return;

    try {
      setDownloadingCertificates(true);
      const batch = buildCertificateBatch();

      if (!batch) return;

      const blob = await pdf(
        <CertificatePdfDocument
          course={selectedCourse}
          members={selectedMembers}
          template={selectedTemplate}
          formValues={formValues}
        />
      ).toBlob();
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
              template={selectedTemplate}
              formValues={formValues}
            />
          ).toBlob(),
        }))
      );
      const savedBatch = await guardarLoteCertificados({ batch, certificateFiles, user });

      setCreatedBatches((current) => {
        const next = [savedBatch, ...current.filter((item) => item.id !== savedBatch.id)].slice(
          0,
          100
        );
        saveCertificateBatches(next);
        return next;
      });
      downloadPdfBlob(blob, buildCertificateFileName(selectedCourse, selectedMembers.length));
      toast.success('Certificados guardados en Firebase.');
    } catch (error) {
      toast.error(error?.message || 'No se pudieron guardar los certificados.');
    } finally {
      setDownloadingCertificates(false);
    }
  };

  const handleDownloadSingleCertificate = async ({ course, member, template, values }) => {
    const certificateId = String(member.id || member.memberId || '');

    if (downloadingCertificateId) return;

    try {
      setDownloadingCertificateId(certificateId);
      const blob = await pdf(
        <CertificatePdfDocument
          course={course}
          members={[member]}
          template={template}
          formValues={values}
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

    return (
      <Button
        fullWidth
        variant="contained"
        disabled={downloadingCertificates}
        onClick={handleDownloadCertificates}
        startIcon={
          downloadingCertificates ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <Iconify icon="solar:download-bold" />
          )
        }
      >
        {downloadingCertificates ? 'Preparando PDF...' : 'Descargar certificados'}
      </Button>
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
                  <TableCell>{batch.totalCertificates || batch.certificates?.length || 0}</TableCell>
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
                      <Typography variant="subtitle1">Todavía no hay certificados creados</Typography>
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
              {selectedBatch.course?.certificateTitle} Â·{' '}
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
                  <TableCell align="right">Descarga</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {selectedBatch.certificates.map((certificate) => {
                  const isDownloading = downloadingCertificateId === String(certificate.id);

                  return (
                    <TableRow key={certificate.id}>
                      <TableCell>
                        {certificate.memberName || getMemberFullName(certificate) || 'Sin nombre'}
                      </TableCell>
                      <TableCell>{certificate.memberId || '-'}</TableCell>
                      <TableCell>{certificate.memberDivision || '-'}</TableCell>
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

  const renderImportDialog = () => (
    <Dialog
      fullWidth
      maxWidth="lg"
      open={importDialogOpen}
      onClose={() => setImportDialogOpen(false)}
    >
      <DialogTitle>Importar certificado</DialogTitle>

      <DialogContent dividers>
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
              Los objetos (textos) sobre el certificado son ejemplos para ubicar los datos. Al guardar la
              plantilla y generar el certificado, cada dato real aparecerá en el lugar elegido.
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
                const position =
                  templateDraft.positions?.[field.id] ||
                  DEFAULT_TEMPLATE_POSITIONS[field.id] || { x: 50, y: 50 };

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
                        `solid 1px ${selectedTemplateFieldId === field.id
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
                        value={field.fontSize ?? ''}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          handleUpdateTemplateField(field.id, {
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
                        {TEMPLATE_FONT_SIZE_OPTIONS.map((size) => (
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
                        label="TamaÃ±o"
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
                cursor: convertingTemplateFile ? 'wait' : templateDraft.dataUrl ? 'default' : 'pointer',
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
                  const position =
                    templateDraft.positions?.[field.id] ||
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
                        px: 1,
                        py: 0.5,
                        width: field.width || 220,
                        borderRadius: 0.75,
                        position: 'absolute',
                        left: `${position.x}%`,
                        top: `${position.y}%`,
                        userSelect: 'none',
                        cursor: 'grab',
                        textAlign: 'center',
                        color: templateDraft.textColor,
                        fontSize: Number(field.fontSize) || 14,
                        ...getTemplatePreviewTypography(field),
                        bgcolor: 'transparent',
                        border:
                          selectedTemplateFieldId === field.id
                            ? '1px dashed rgba(15,23,42,0.86)'
                            : '1px dashed rgba(15,23,42,0.38)',
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
                      {field.kind === 'custom' ? (
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
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" onClick={() => setImportDialogOpen(false)}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSaveTemplate}>
          Guardar plantilla
        </Button>
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
                      src={selectedTemplate.dataUrl}
                      alt={selectedTemplate.name}
                      sx={{ width: 1, height: 1, display: 'block', objectFit: 'cover' }}
                    />
                    {getTemplateFields(selectedTemplate).map((field) => {
                      const position =
                        selectedTemplate.positions?.[field.id] ||
                        DEFAULT_TEMPLATE_POSITIONS[field.id] || { x: 50, y: 50 };

                      return (
                        <Box
                          key={field.id}
                          sx={{
                            px: 0.75,
                            py: 0.25,
                            width: Math.max(60, Math.round(Number(field.width || 180) * 0.5)),
                            borderRadius: 0.75,
                            position: 'absolute',
                            left: `${position.x}%`,
                            top: `${position.y}%`,
                            color: selectedTemplate.textColor,
                            fontSize: getScaledTemplatePreviewFontSize(field),
                            ...getTemplatePreviewTypography(field),
                            textAlign: 'center',
                            bgcolor: 'rgba(255,255,255,0.72)',
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          {getTemplateFieldPreview(field)}
                        </Box>
                      );
                    })}
                  </Box>
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
                  label={`${selectedMembers.length} seleccionado${selectedMembers.length === 1 ? '' : 's'
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

            <TableContainer sx={{ maxHeight: 560 }}>
              <Scrollbar>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={allFilteredSelected}
                          indeterminate={!allFilteredSelected && someFilteredSelected}
                          onChange={handleToggleFilteredMembers}
                          disabled={!filteredMembers.length}
                        />
                      </TableCell>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Código</TableCell>
                      <TableCell>División</TableCell>
                      <TableCell>Estado</TableCell>
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

                        return (
                          <TableRow
                            hover
                            key={memberId}
                            selected={checked}
                            sx={{ cursor: 'pointer' }}
                            onClick={() => handleToggleMember(memberId)}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={checked}
                                onClick={(event) => event.stopPropagation()}
                                onChange={() => handleToggleMember(memberId)}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="subtitle2">
                                {getMemberFullName(member) || 'Sin nombre'}
                              </Typography>
                            </TableCell>
                            <TableCell>{member.memberId || member.codigoMiembro || '-'}</TableCell>
                            <TableCell>{member.memberDivision || '-'}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                variant="soft"
                                color={member.status === 'inactive' ? 'default' : 'success'}
                                label={member.status === 'inactive' ? 'Inactivo' : 'Activo'}
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
    </DashboardContent>
  );
}
