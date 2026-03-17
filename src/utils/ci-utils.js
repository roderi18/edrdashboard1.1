import dayjs from 'dayjs';

// --------------------------------------------------
// RANGO PERMITIDO PARA FECHA INICIO CI
// --------------------------------------------------

export function getMinFechaInicioCI() {
    return dayjs().subtract(5, 'year').add(1, 'day');
}

export function getMaxFechaInicioCI() {
    return dayjs();
}

// --------------------------------------------------
// CALCULAR VENCIMIENTO CI
// --------------------------------------------------

export function calcularVencimientoCI(fechaInicio) {
    if (!fechaInicio) return null;

    return dayjs(fechaInicio).add(5, 'year');
}

// --------------------------------------------------
// CALCULAR ESTATUS CI
// --------------------------------------------------

export function calcularEstatusCI(fechaVencimiento) {
    if (!fechaVencimiento) return 'na';

    const hoy = dayjs();
    const vencimiento = dayjs(fechaVencimiento);

    return hoy.isAfter(vencimiento) ? 0 : 1;
}

// --------------------------------------------------
// DIAS RESTANTES
// --------------------------------------------------

export function calcularDiasRestantesCI(fechaVencimiento) {
    if (!fechaVencimiento) return null;

    return dayjs(fechaVencimiento).diff(dayjs(), 'day');
}