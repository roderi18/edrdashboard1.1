import { pdf, Text, View, Page, Image, Document, StyleSheet } from '@react-pdf/renderer';

import { getMemberAge } from 'src/utils/member-age';

import { MASK_PRESETS } from 'src/components/masked-field';

// ----------------------------------------------------------------------
// EL DOCUMENTO PDF DE LA FICHA DEL MIEMBRO, APARTE DEL MENÚ QUE LO PIDE.
//
// El menú se pinta con la ficha; si importaba `@react-pdf/renderer` (cerca de
// medio megabyte), la librería viajaba con cada ficha aunque nadie descargara.
// El menú trae este archivo con `import()` al pulsar "Descargar".
// ----------------------------------------------------------------------

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

const imageToCompactDataUrl = (src) =>
  new Promise((resolve, reject) => {
    const img = new window.Image();

    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxSize = 180;
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));

      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = reject;
    img.src = src;
  });

const fileToCompactDataUrl = async (file) => {
  const url = URL.createObjectURL(file);

  try {
    return await imageToCompactDataUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
};

const getAvatarForPdf = async (value) => {
  if (!value) return null;

  if (value instanceof Blob) {
    return fileToCompactDataUrl(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (value.startsWith('data:image/')) {
    try {
      return await imageToCompactDataUrl(value);
    } catch {
      return null;
    }
  }

  try {
    const proxyResponse = await fetch(`/api/image-data-url/?url=${encodeURIComponent(value)}`);

    if (proxyResponse.ok) {
      const data = await proxyResponse.json();

      if (data?.dataUrl) {
        return await imageToCompactDataUrl(data.dataUrl);
      }
    }
  } catch {
    // Continue with browser-side fallbacks below.
  }

  try {
    const response = await fetch(value);

    if (response.ok) {
      return fileToCompactDataUrl(await response.blob());
    }
  } catch {
    // Continue with direct image loading below.
  }

  try {
    return await imageToCompactDataUrl(value);
  } catch {
    return null;
  }
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

function MemberInfoPdfDocument({
  values,
  memberCode,
  fullName,
  destName,
  avatarSrc,
  selectedSections,
  masked = false,
  // Teléfono y correo se enmascaran aparte de la dirección: los cargos
  // seccionales/regionales los ven en texto plano si el miembro es mayor de edad.
  maskContact = masked,
  // Y la dirección aparte de los dos: quien la ve en pantalla —el Administrador
  // de Gestión de Tienda, que despacha ahí los pedidos— la ve también aquí.
  maskAddress = masked,
  maskBirthdate = false,
}) {
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
          <InfoRow
            label="Fecha de nacimiento"
            // La edad va tambien cuando la fecha sale con asteriscos: es lo que
            // se necesita leer de un vistazo, y no es lo que se protege.
            value={conLaEdad(
              maskBirthdate ? MASK_PRESETS.date : values.birthdate,
              values.birthdate
            )}
          />
          <InfoRow label="División" value={values.memberDivision} />
          <InfoRow
            label="Dirección"
            value={maskAddress ? MASK_PRESETS.text : values.address || values.street}
          />
          <InfoRow label="Teléfono" value={maskContact ? MASK_PRESETS.phone : values.phoneNumber} />
          <InfoRow label="Correo" value={maskContact ? MASK_PRESETS.text : values.email} />
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

// La fecha de nacimiento se acompaña SIEMPRE de la edad actual, este a la vista
// o enmascarada: "**/**/**** (17 años)". La edad se calcula de la fecha real,
// que el componente recibe igual; lo que se oculta es el dia exacto.
const conLaEdad = (mostrado, fechaNacimiento) => {
  // Se formatea aqui —y no se deja para `getValue`— porque al pegarle la edad
  // deja de ser una fecha y pasa a ser texto: sin esto el PDF imprimia la fecha
  // cruda de dayjs en vez de "12/03/2009".
  const texto = getValue(mostrado);
  const edad = getMemberAge({ birthDate: fechaNacimiento });

  if (edad === null || texto === '-') return texto;

  return `${texto} (${edad} años)`;
};

export const generarPdfDeMiembro = async ({ values, avatarUrl, ...props }) => {
  const avatarSrc = await getAvatarForPdf(values.avatarUrl || avatarUrl);

  return pdf(<MemberInfoPdfDocument values={values} avatarSrc={avatarSrc} {...props} />).toBlob();
};
