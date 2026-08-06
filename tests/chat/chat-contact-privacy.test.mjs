import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPublicChatContacts,
  toPublicChatContact,
} from '../../src/server/chat-contact-core.mjs';

const SENSITIVE_FIELDS = [
  'correo',
  'email',
  'telefono',
  'phoneNumber',
  'direccion',
  'address',
  'fechaNacimiento',
  'birthDate',
  'genero',
  'idDestacamento',
  'idDivision',
];

test('la proyección pública elimina todos los datos sensibles del miembro', () => {
  const contact = toPublicChatContact({
    idMiembros: 257,
    codigoMiembro: 'DO-SD-111111044',
    nombres: 'Alanna',
    apellidos: 'Donald',
    correo: 'alanna@example.com',
    telefono: '8095550000',
    direccion: 'Dirección privada',
    fechaNacimiento: '2010-01-01',
    genero: 'F',
    idDestacamento: 196,
    idDivision: 2,
  });

  assert.equal(contact.name, 'Alanna Donald');
  assert.equal(contact.id, '257');
  SENSITIVE_FIELDS.forEach((field) => assert.equal(field in contact, false));
});

test('la lista deduplica por miembro sin reintroducir campos sensibles', () => {
  const contacts = getPublicChatContacts([
    { idMiembros: 257, nombres: 'Alanna', correo: 'privado@example.com' },
    { idMiembros: 257, apellidos: 'Donald', telefono: '8095550000' },
  ]);

  assert.equal(contacts.length, 1);
  SENSITIVE_FIELDS.forEach((field) => assert.equal(field in contacts[0], false));
});
