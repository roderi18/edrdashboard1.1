import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatMemberUploadBirthDate,
  normalizeMemberUploadPhone,
} from '../../src/sections/member/utils/member-upload-normalizers.js';

test('normaliza teléfonos dominicanos de 10 y 11 dígitos', () => {
  assert.equal(normalizeMemberUploadPhone('8297878833'), '+18297878833');
  assert.equal(normalizeMemberUploadPhone('+1 829-787-8833'), '+18297878833');
  assert.equal(normalizeMemberUploadPhone(8297878833), '+18297878833');
  assert.equal(normalizeMemberUploadPhone(''), '');
});

test('rechaza teléfonos que no tienen 10 dígitos dominicanos', () => {
  assert.throws(() => normalizeMemberUploadPhone('829787883'), /10 dígitos/);
});

test('convierte fechas DD-MM-AAAA y conserva fechas ISO', () => {
  assert.equal(formatMemberUploadBirthDate('18-06-2000'), '2000-06-18');
  assert.equal(formatMemberUploadBirthDate('18/06/2000'), '2000-06-18');
  assert.equal(formatMemberUploadBirthDate('2000-06-18'), '2000-06-18');
  assert.equal(formatMemberUploadBirthDate(new Date(2000, 5, 18)), '2000-06-18');
  assert.equal(formatMemberUploadBirthDate(''), '');
});

test('rechaza fechas imposibles y sugiere corregir el archivo', () => {
  assert.throws(
    () => formatMemberUploadBirthDate('31-02-2000'),
    /Corrige el archivo y vuelve a subirlo/
  );
  assert.throws(() => formatMemberUploadBirthDate('2000/06/18'), /DD-MM-AAAA/);
});
