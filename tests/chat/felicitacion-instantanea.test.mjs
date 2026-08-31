import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const leer = (ruta) => readFile(new URL(ruta, import.meta.url), 'utf8');

const servicio = await leer('../../src/services/felicitaciones-cumpleanos-service.js');
const boton = await leer(
  '../../src/layouts/components/notifications-drawer/notification-item.jsx'
);
const rutaChat = await leer('../../src/app/api/chat/route.js');

// Elegir el mensaje no cuesta nada: es una lista en memoria. Lo que tardaba era
// el viaje al servidor, y quien pulsaba se quedaba mirando el boton.
test('la felicitacion se devuelve al instante, con la entrega aparte', () => {
  assert.match(servicio, /export function enviarFelicitacionDeCumpleanos/);
  assert.doesNotMatch(servicio, /export async function enviarFelicitacionDeCumpleanos/);
  assert.match(servicio, /return \{ id: elegida\.id, texto: cuerpo, entrega \}/);
});

// Dar por enviado algo que no salio seria mentir: el cumpleañero no recibiria
// nada y nadie se enteraria.
test('si la entrega falla, se dice', () => {
  assert.match(boton, /enviada\.entrega/);
  assert.match(boton, /No se pudo enviar la felicitación/);
});

// Se ponia a cero para todos, incluido a quien le acababan de escribir: estrenar
// una conversacion no le encendia la bolita a nadie.
test('el primer mensaje deja no leido a quien lo recibe', () => {
  assert.match(rutaChat, /primerMensaje && Number\(id\) !== Number\(primerMensaje\.remitenteIdMiembros\)/);
});
