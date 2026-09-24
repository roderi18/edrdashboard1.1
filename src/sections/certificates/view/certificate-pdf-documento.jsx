import dayjs from 'dayjs';
import { pdf, Page, Text, View, Image, Document, StyleSheet } from '@react-pdf/renderer';

import { getMemberFullName } from 'src/utils/get-member-fullname';

import {
  PDF_PAGE,
  getTemplateFields,
  isQrTemplateField,
  getTemplateFieldSize,
  getTemplatePdfTypography,
  DEFAULT_TEMPLATE_POSITIONS,
} from './certificates-automation-view';

// ----------------------------------------------------------------------
// EL DOCUMENTO PDF DE LOS CERTIFICADOS, APARTE DE LA PANTALLA.
//
// La pantalla lo trae con `import()` al generar o descargar: importado arriba,
// `@react-pdf/renderer` (cerca de medio megabyte) se descargaba al abrir
// Certificados aunque solo se consultara la lista.
// ----------------------------------------------------------------------

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

export const generarPdfDeCertificadosDocumento = (props) =>
  pdf(<CertificatePdfDocument {...props} />).toBlob();
