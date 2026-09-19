// ----------------------------------------------------------------------
// LA CERTIFICACIÓN CI, COMO LA GUARDA LA FICHA DEL MIEMBRO.
//
// El padrón la devuelve como números (`0`/`1`) y la ficha la guarda como
// booleanos, con el estatus de vigencia en blanco (`null`) cuando la persona no
// es instructor. El historial comparaba el `0` de antes con el `false`/`null` de
// después y, en CADA guardado, apuntaba "Instructor certificado CI 0 → No" y
// "Estatus vigencia CI 0 → Sin dato" aunque nadie los hubiera tocado. Los dos
// lados del historial pasan por aquí para hablar el mismo idioma.
// ----------------------------------------------------------------------

const aBooleano = (valor) => {
  if (valor === true || valor === 1 || valor === '1' || valor === 'true') return true;
  if (valor === false || valor === 0 || valor === '0' || valor === 'false') return false;

  return null;
};

/**
 * `{ instructorCertificadoCi, estatusVigenciaCi }` con las reglas de la ficha:
 * un menor nunca es instructor, y sin ser instructor el estatus no aplica.
 */
export const certificacionCi = ({ instructor, estatus, esMenor = false } = {}) => {
  const instructorCertificadoCi = esMenor ? false : aBooleano(instructor);

  return {
    instructorCertificadoCi,
    estatusVigenciaCi: instructorCertificadoCi === true ? aBooleano(estatus) : null,
  };
};
