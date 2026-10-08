'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

const STEPS = [
  ['Destacamento', 'Busca tu grupo en el padrón'],
  ['Plan', 'Confirma la tarifa asignada'],
  ['Pago', 'Elige cómo pagar'],
  ['Resultado', 'Consulta tu solicitud'],
];
const PLANS = [
  { id: 'nuevo', title: 'No registrado en 2026', price: 2500, note: 'RRI TRaC incluido' },
  { id: 'fidelidad', title: 'Registrado en 2026', price: 2250, note: 'Descuento por fidelidad · RRI TRaC incluido' },
  { id: 'licencia', title: 'Licencia RRI TRaC activa', price: 1500, note: 'Solo cuota de registro' },
  { id: 'licencia_con_trac', title: 'Licencia vigente + RRI TRaC', price: 2250, note: 'Cuota de registro + RRI TRaC' },
];
const money = (value) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(value);

async function jsonResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}

function Header() {
  return (
    <Box component="header" sx={{ bgcolor: '#0E2550', color: 'white', py: 1.5 }}>
      <Container maxWidth="xl">
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box component="img" src="/marca/logo-oficina-nacional.png" alt="Oficina Nacional ERRD" sx={{ width: 56, height: 56, objectFit: 'contain' }} />
            <Box><Typography variant="subtitle1" fontWeight={800} lineHeight={1.1}>OFICINA NACIONAL</Typography><Typography variant="caption">EXPLORADORES DEL REY · RD</Typography></Box>
          </Stack>
          <Typography variant="h5" sx={{ display: { xs: 'none', md: 'block' } }}>Membresía ONERRD 2027</Typography>
          <Chip label="Vigencia: 01/01/2027 – 31/12/2027" sx={{ bgcolor: 'white', color: '#0E2550', display: { xs: 'none', sm: 'flex' } }} />
        </Stack>
      </Container>
    </Box>
  );
}

function Sidebar({ step }) {
  return (
    <Card sx={{ p: 2.5, color: 'white', bgcolor: '#0E2550', position: { lg: 'sticky' }, top: 24 }}>
      <Typography variant="h6" fontWeight={800} mb={0.5}>Pasos de registro</Typography>
      <Typography variant="body2" sx={{ opacity: 0.8, mb: 2.5 }}>Una membresía por destacamento y por año.</Typography>
      <Stack spacing={1}>
        {STEPS.map(([title, subtitle], index) => (
          <Stack key={title} direction="row" gap={1.3} alignItems="center" sx={{ p: 1.2, borderRadius: 1.5, bgcolor: step === index ? '#1F4FA6' : 'transparent', opacity: index > step ? 0.65 : 1 }}>
            <Box sx={{ flex: '0 0 32px', width: 32, height: 32, borderRadius: '50%', bgcolor: index < step ? '#168558' : 'white', color: index < step ? 'white' : '#0E2550', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{index < step ? '✓' : index + 1}</Box>
            <Box><Typography variant="subtitle2" fontWeight={750}>{title}</Typography><Typography variant="caption" sx={{ opacity: 0.8 }}>{subtitle}</Typography></Box>
          </Stack>
        ))}
      </Stack>
      <Box component="img" src="/marca/parche-onerrd-2027.png" alt="Parche ONERRD 2027" sx={{ width: 112, display: { xs: 'none', lg: 'block' }, mx: 'auto', mt: 4 }} />
    </Card>
  );
}

function Summary({ plan, selected, config, paymentTab }) {
  return (
    <Card sx={{ p: 2.5, position: { lg: 'sticky' }, top: 24 }}>
      <Typography variant="h6" fontWeight={800}>Resumen del pedido</Typography>
      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary">Destacamento</Typography>
      <Typography fontWeight={700} mb={2}>{selected ? `${selected.numero} · ${selected.nombre}` : 'Pendiente de selección'}</Typography>
      <Typography variant="caption" color="text.secondary">Plan asignado</Typography>
      <Typography fontWeight={700} mb={2}>{plan?.nombre || 'Pendiente de validación'}</Typography>
      <Divider sx={{ my: 2 }} />
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between"><Typography variant="body2">Cuota de registro</Typography><Typography variant="body2">{plan ? money(plan.cuotaRegistro) : '—'}</Typography></Stack>
        <Stack direction="row" justifyContent="space-between"><Typography variant="body2">RRI TRaC</Typography><Typography variant="body2">{plan ? money(plan.rriTrac) : '—'}</Typography></Stack>
        <Stack direction="row" justifyContent="space-between"><Typography variant="body2">Descuento</Typography><Typography variant="body2">{plan ? `− ${money(plan.descuento)}` : '—'}</Typography></Stack>
      </Stack>
      <Box sx={{ bgcolor: '#E7F0FF', p: 2, mt: 2.5, borderRadius: 1.5 }}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={800}>Total</Typography><Typography fontWeight={800} color="primary.main">{plan ? money(plan.precio) : '—'}</Typography></Stack></Box>
      {paymentTab === 'paypal' && config?.rate && plan && <Typography variant="body2" mt={1}>US${(plan.precio / config.rate).toFixed(2)} · RD${config.rate} / US$1</Typography>}
      <Typography variant="caption" color="text.secondary" display="block" mt={2}>🔒 Pago seguro · El importe lo calcula el servidor.</Typography>
    </Card>
  );
}

function Field({ label, value }) {
  return <TextField label={label} value={value || 'No registrado'} disabled />;
}

function StepDestacamento({ catalog, selected, setSelected, eligibility, loadingEligibility, contact, setContact, error }) {
  const d = eligibility?.destacamento;
  return (
    <Stack spacing={2.5}>
      <Autocomplete
        options={catalog}
        value={selected}
        onChange={(_, value) => setSelected(value)}
        getOptionLabel={(item) => `${item.numero || 'S/N'} · ${item.nombre} — ${item.seccion}`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => <TextField {...params} label="Buscar destacamento por número o nombre" placeholder="Escribe el número o el nombre" />}
      />
      {loadingEligibility && <Stack direction="row" gap={1} alignItems="center"><CircularProgress size={18} /><Typography variant="body2">Consultando el padrón…</Typography></Stack>}
      {d && <>
        <Typography variant="subtitle1" fontWeight={800}>Información del padrón</Typography>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' } }}>
          <Field label="Número oficial" value={d.numero} /><Field label="Nombre" value={d.nombre} />
          <Field label="Región" value={d.region} /><Field label="Sección" value={d.seccion} />
          <Field label="Iglesia" value={d.iglesia} /><Field label="Estatus" value={eligibility.validaciones?.activo ? 'Habilitado 2027' : 'Pendiente'} />
          <Field label="Coordinador(a)" value={d.coordinador} /><Field label="Pastor(a)" value={d.pastor} />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {Object.entries({ existe: 'Existe en censo 2026', jurisdiccion: 'Jurisdicción correcta', activo: 'Estatus activo', sinMembresia: 'Sin membresía 2027 previa' }).map(([key, label]) => (
            <Chip key={key} size="small" color={eligibility.validaciones?.[key] ? 'success' : 'default'} label={`${eligibility.validaciones?.[key] ? '✓ ' : '· '}${label}`} />
          ))}
        </Box>
        {!eligibility.disponible && <Alert severity="warning">{eligibility.motivo}</Alert>}
        <Typography variant="subtitle1" fontWeight={800}>Contacto para recibir los documentos</Typography>
        <Typography variant="body2" color="text.secondary">Escribe el correo y teléfono del responsable. Estos datos no se muestran en el catálogo público.</Typography>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' } }}>
          <TextField label="Correo electrónico" type="email" required value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
          <TextField label="Teléfono" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
        </Box>
      </>}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

function StepPlan({ plans, plan, setPlan }) {
  return (
    <Stack spacing={2}>
      <Alert severity="info">El sistema determina qué opciones te corresponden. Si tienes licencia RRI TRaC vigente, puedes elegir entre dos planes.</Alert>
      {PLANS.map((item) => <Card key={item.id} variant="outlined" onClick={() => { if (plans.some((p) => p.id === item.id)) setPlan(item.id); }} sx={{ p: 2.5, border: item.id === plan?.id ? '2px solid #1F4FA6' : '1px solid #E2E8F0', bgcolor: item.id === plan?.id ? '#F1F6FF' : 'white', opacity: plans.some((p) => p.id === item.id) ? 1 : 0.45, cursor: plans.some((p) => p.id === item.id) ? 'pointer' : 'default', boxShadow: 'none' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
          <Box><Typography fontWeight={800}>{item.title}</Typography><Typography variant="body2" color="text.secondary">{item.note}</Typography></Box>
          <Box textAlign={{ sm: 'right' }}><Typography variant="h5" color="primary.main">{money(item.price)}</Typography>{item.id === plan?.id && <Chip color="primary" size="small" label="Tu plan" />}</Box>
        </Stack>
      </Card>)}
      <Typography variant="caption" color="text.secondary">RRI TRaC es la plataforma digital de registro, control y capacitación de miembros.</Typography>
    </Stack>
  );
}

function StepPago({ plan, config, paymentTab, setPaymentTab, payment, setPayment, onSubmit, busy, error }) {
  const bankReady = Boolean(config?.bank?.name && config?.bank?.accountNumber);
  return <Stack spacing={2.5}>
    <Tabs value={paymentTab} onChange={(_, value) => setPaymentTab(value)}><Tab label="PayPal" value="paypal" /><Tab label="Transferencia bancaria" value="transferencia" /></Tabs>
    {paymentTab === 'paypal' ? <Stack spacing={2}>
      <Typography variant="body1">Total en RD$: <strong>{money(plan.precio)}</strong></Typography>
      {config?.paypalEnabled ? <Alert severity="info">US${(plan.precio / config.rate).toFixed(2)} · Tasa del día: RD${config.rate} = US$1. Se confirmará antes de autorizar.</Alert> : <Alert severity="warning">PayPal aún no está configurado por la Oficina Nacional.</Alert>}
      <Button variant="contained" size="large" disabled={!config?.paypalEnabled || busy} onClick={onSubmit} sx={{ bgcolor: '#FFCC00', color: '#082C65', '&:hover': { bgcolor: '#E6B800' } }}>Pagar con PayPal</Button>
    </Stack> : <Stack spacing={2}>
      {bankReady ? <Alert severity="info">{config.bank.name} · {config.bank.accountType} · {config.bank.accountNumber} · Titular: {config.bank.accountName}</Alert> : <Alert severity="warning">Los datos bancarios están pendientes de configuración.</Alert>}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' } }}>
        <TextField label="Monto depositado (RD$)" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
        <TextField label="Fecha del depósito" type="date" slotProps={{ inputLabel: { shrink: true } }} value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })} />
        <TextField label="Número de referencia" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
        <Button component="label" variant="outlined" sx={{ minHeight: 60, borderStyle: 'dashed' }}>{payment.file?.name || 'Adjuntar comprobante JPG, PNG o PDF'}<input hidden type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setPayment({ ...payment, file: e.target.files?.[0] || null })} /></Button>
      </Box>
      <Alert severity="info">Quedará pendiente de validación por la Oficina Nacional.</Alert>
      <Button variant="contained" size="large" disabled={!bankReady || busy} onClick={onSubmit}>{busy ? 'Enviando…' : 'Enviar comprobante'}</Button>
    </Stack>}
    {error && <Alert severity="error">{error}</Alert>}
  </Stack>;
}

function StepResult({ result }) {
  if (!result) return <Alert severity="info">Aún no hay una solicitud enviada.</Alert>;
  return <Stack spacing={2.5}>
    <Alert severity={result.estado === 'confirmada' ? 'success' : result.estado === 'rechazada' ? 'error' : 'info'}>
      {result.estado === 'confirmada' ? `Pago confirmado · ${result.codigo}` : result.estado === 'rechazada' ? `Depósito rechazado: ${result.motivo}` : 'Depósito pendiente de validación'}
    </Alert>
    <Typography>Referencia: <strong>{result.referencia}</strong></Typography>
    <Typography variant="body2" color="text.secondary">Guarda este identificador y el enlace de esta página. La Oficina Nacional revisará los depósitos.</Typography>
    {result.estado === 'confirmada' && <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
      <Button href={`/api/documentos/${result.token}/certificado/`} variant="contained">Descargar certificado con QR</Button>
      <Button href={`/api/documentos/${result.token}/factura/`} variant="outlined">Descargar factura</Button>
    </Stack>}
    <Alert severity="info">Los documentos solo se habilitan después de confirmar el pago.</Alert>
  </Stack>;
}

function Stats({ stats }) {
  return <Card sx={{ p: 3, mt: 4 }}><Typography variant="h5" mb={2}>Avance nacional</Typography>
    <Typography variant="body2" color="text.secondary" mb={2}>Totales públicos por región; sin montos ni datos personales.</Typography>
    {stats?.length ? <Stack spacing={1.5}>{stats.map((row) => <Box key={row.region} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 145px', sm: '130px 1fr 310px' }, alignItems: 'center', gap: 1 }}><Typography fontWeight={700}>{row.region}</Typography><Box sx={{ display: { xs: 'none', sm: 'block' } }}><LinearProgress variant="determinate" value={row.porcentaje} sx={{ height: 10, borderRadius: 9 }} /></Box><Typography variant="body2" textAlign="right">{row.total} total · {row.pagadas} pagadas · {row.pendientes} pendientes · {row.porcentaje}%</Typography></Box>)}</Stack>
      : <Typography variant="body2">Las estadísticas aparecerán cuando se configure el padrón y existan pagos confirmados.</Typography>}
  </Card>;
}

export function MembresiaWizard() {
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [contact, setContact] = useState({ email: '', phone: '' });
  const [paymentTab, setPaymentTab] = useState('transferencia');
  const [payment, setPayment] = useState({ amount: '', date: '', reference: '', file: null });
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/catalogo/').then(jsonResponse).then(setCatalog).catch((e) => setError(e.message));
    fetch('/api/configuracion/').then(jsonResponse).then(setConfig).catch(() => {});
    fetch('/api/estadisticas/').then(jsonResponse).then(setStats).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const token = params.get('solicitud');
    if (token) fetch(`/api/solicitudes/${encodeURIComponent(token)}/`).then(jsonResponse)
      .then((data) => { setResult({ ...data, token }); setStep(3); })
      .catch(() => setError('No se pudo consultar el estado del pago.'));
    if (params.get('paypal') === 'cancelado') queueMicrotask(() => setError('El pago de PayPal fue cancelado; no se confirmó ninguna membresía.'));
    if (params.get('paypal') === 'error') queueMicrotask(() => setError('PayPal no pudo confirmar el pago. Contacta a la Oficina Nacional antes de intentar de nuevo.'));
  }, []);

  useEffect(() => {
    if (!result?.token || result.estado === 'confirmada' || result.estado === 'rechazada') return undefined;
    const timer = setInterval(() => fetch(`/api/solicitudes/${result.token}/`).then(jsonResponse)
      .then((data) => setResult({ ...data, token: result.token })).catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [result?.token, result?.estado]);

  useEffect(() => {
    if (!selected) return undefined;
    let active = true;
    fetch(`/api/elegibilidad/?id=${encodeURIComponent(selected.id)}`).then(jsonResponse)
      .then((data) => { if (active) { setEligibility(data); setSelectedPlanId(data.planes?.[0]?.id || ''); setPayment((before) => ({ ...before, amount: data.planes?.[0]?.precio || '' })); } })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoadingEligibility(false); });
    return () => { active = false; };
  }, [selected]);

  const selectedPlan = eligibility?.planes?.find((item) => item.id === selectedPlanId) || null;
  const chooseDestacamento = (value) => {
    setSelected(value);
    setEligibility(null);
    setSelectedPlanId('');
    setLoadingEligibility(Boolean(value));
    setError('');
  };
  const choosePlan = (id) => {
    const plan = eligibility?.planes?.find((item) => item.id === id);
    if (plan) { setSelectedPlanId(id); setPayment((before) => ({ ...before, amount: plan.precio })); }
  };

  const next = () => {
    setError('');
    if (step === 0 && (!eligibility?.disponible || !/^\S+@\S+\.\S+$/.test(contact.email))) {
      setError('Selecciona un destacamento habilitado y escribe un correo válido.'); return;
    }
    if (step === 1 && !selectedPlan) { setError('Elige un plan habilitado.'); return; }
    setStep((value) => Math.min(value + 1, 3));
  };

  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (paymentTab === 'paypal') {
        const response = await fetch('/api/paypal/crear/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destacamentoId: selected.id, planId: selectedPlanId, email: contact.email, phone: contact.phone }) });
        const data = await jsonResponse(response);
        window.location.assign(data.approve);
        return;
      }
      const body = new FormData();
      body.set('destacamentoId', selected.id);
      body.set('planId', selectedPlanId);
      body.set('email', contact.email);
      body.set('phone', contact.phone);
      body.set('amount', String(payment.amount));
      body.set('date', payment.date);
      body.set('reference', payment.reference);
      if (payment.file) body.set('proof', payment.file);
      const response = await fetch('/api/membresias/', { method: 'POST', body });
      const data = await jsonResponse(response);
      setResult(data);
      window.history.replaceState(null, '', `/?solicitud=${encodeURIComponent(data.token)}`);
      setStep(3);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return <Box sx={{ minHeight: '100vh', pb: 4 }}>
    <Header />
    <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 4 } }}>
      {config && !config.lanzamientoHabilitado && <Alert severity="info" sx={{ mb: 2 }}>La membresía 2027 está en preparación. Aún no se reciben pagos.</Alert>}
      <Box sx={{ display: 'grid', gap: 2, alignItems: 'start', gridTemplateColumns: { xs: '1fr', lg: '245px minmax(0,1fr) 280px' } }}>
        <Sidebar step={step} />
        <Card sx={{ p: { xs: 2, md: 3.5 }, minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}><Typography variant="overline" color="primary.main" fontWeight={800}>PASO {step + 1} DE 4</Typography><Typography variant="caption">{(step + 1) * 25}% completado</Typography></Stack>
          <LinearProgress variant="determinate" value={(step + 1) * 25} sx={{ height: 7, borderRadius: 5, mb: 2.5 }} />
          <Typography variant="h4" mb={0.8}>{['Selecciona tu destacamento', 'Confirma tu plan', 'Selecciona el método de pago', 'Estado de tu membresía'][step]}</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>Registra tu destacamento, paga y recibe el certificado oficial con QR y la factura.</Typography>
          {step === 0 && <StepDestacamento catalog={catalog} selected={selected} setSelected={chooseDestacamento} eligibility={eligibility} loadingEligibility={loadingEligibility} contact={contact} setContact={setContact} error={error} />}
          {step === 1 && <StepPlan plans={eligibility?.planes || []} plan={selectedPlan} setPlan={choosePlan} />}
          {step === 2 && <StepPago plan={selectedPlan} config={config} paymentTab={paymentTab} setPaymentTab={setPaymentTab} payment={payment} setPayment={setPayment} onSubmit={submit} busy={busy} error={error} />}
          {step === 3 && <StepResult result={result} />}
          <Divider sx={{ my: 3 }} />
          <Stack direction="row" justifyContent="space-between">
            <Button variant="outlined" disabled={step === 0 || step === 3 || busy} onClick={() => setStep((value) => value - 1)}>Atrás</Button>
            {step < 2 && <Button variant="contained" onClick={next} disabled={loadingEligibility}>{step === 0 ? 'Continuar al plan' : 'Continuar al pago'} →</Button>}
          </Stack>
        </Card>
        <Summary plan={selectedPlan} selected={selected} config={config} paymentTab={paymentTab} />
      </Box>
      <Stats stats={stats} />
    </Container>
    <Box component="footer" sx={{ bgcolor: '#0E2550', color: 'white', mt: 4, py: 3 }}><Container maxWidth="xl"><Typography variant="body2">Oficina Nacional de Exploradores del Rey · Pago seguro · Certificado con verificación QR</Typography></Container></Box>
  </Box>;
}
