'use client';

import { useState, useEffect } from 'react';

import { getLocalInvoices } from 'src/utils/local-commerce-storage';

import { _userPlans, _userPayment } from 'src/_mock';
import { getDestsApi } from 'src/services/dest-service';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';

import { useAuthContext } from 'src/auth/hooks';

import { AccountBilling } from '../account-billing';

// ----------------------------------------------------------------------

const NO_PHONE = 'Sin número de teléfono';
const NO_ADDRESS = 'Dirección no especificada';

const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const splitAddressFields = (address = '') => {
  const [province = '', municipality = '', sector = '', detail = ''] = String(address)
    .split(',')
    .map((part) => part.trim());

  return {
    province,
    municipality,
    sector,
    detail,
  };
};

const getUserKeys = (user, member) =>
  new Set(
    [
      user?.uid,
      user?.id,
      user?.idMiembros,
      user?.memberId,
      user?.codigoMiembro,
      user?.codigo,
      user?.email,
      user?.correo,
      member?.id,
      member?.memberId,
      member?.codigoMiembro,
      member?.email,
    ]
      .filter(hasValue)
      .map(normalizeKey)
  );

const findCurrentMember = (members, user) => {
  const keys = getUserKeys(user);

  return (
    members.find((member) =>
      [member?.id, member?.memberId, member?.codigoMiembro, member?.email].some((value) =>
        keys.has(normalizeKey(value))
      )
    ) || null
  );
};

const invoiceBelongsToUser = (invoice, userKeys) => {
  if (!userKeys.size) return false;

  const sources = [invoice, invoice?.invoiceTo, invoice?.customer, invoice?.billing];

  return sources.some((source) =>
    [
      source?.id,
      source?.uid,
      source?.memberId,
      source?.idMiembros,
      source?.codigoMiembro,
      source?.email,
      source?.correo,
      source?.company,
    ].some((value) => userKeys.has(normalizeKey(value)))
  );
};

export function AccountBillingView() {
  const { user } = useAuthContext();
  const [addressBook, setAddressBook] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    const loadBillingData = async () => {
      const [members, dests, churches] = await Promise.all([
        getMembers(),
        getDestsApi(),
        getChurches(),
      ]);

      const member = findCurrentMember(members, user);
      const destId =
        member?.idDestacamento ||
        member?.destId ||
        user?.idDestacamento ||
        user?.destId ||
        user?.alcance?.destacamentos?.[0] ||
        null;
      const dest = dests.find((item) => String(item.id) === String(destId));
      const church = churches.find((item) => String(item.id) === String(dest?.churchId));
      const profileName =
        user?.displayName ||
        user?.nombre ||
        member?.name ||
        [member?.firstName, member?.lastName].filter(Boolean).join(' ') ||
        'Perfil';
      const memberAddress = member?.memberAddress || member?.direccion || user?.direccion || '';
      const memberPhone = member?.phoneNumber || user?.phoneNumber || user?.telefono || '';

      const nextAddressBook = [
        {
          id: 'member-primary-address',
          name: profileName,
          addressType: 'Primaria',
          fullAddress: memberAddress || NO_ADDRESS,
          addressFields: splitAddressFields(memberAddress),
          phoneNumber: memberPhone || NO_PHONE,
          primary: false,
          locked: true,
        },
        {
          id: 'dest-address',
          name: church?.name || dest?.name || 'Iglesia del destacamento',
          addressType: 'Destacamento',
          fullAddress: church?.address || NO_ADDRESS,
          phoneNumber: church?.telefono || NO_PHONE,
          primary: true,
          locked: true,
          editLocked: true,
        },
      ];

      const userKeys = getUserKeys(user, member);
      const nextInvoices = getLocalInvoices().filter((invoice) =>
        invoiceBelongsToUser(invoice, userKeys)
      );

      setAddressBook(nextAddressBook);
      setInvoices(nextInvoices);
    };

    loadBillingData();
  }, [user]);

  return (
    <AccountBilling
      plans={_userPlans}
      cards={_userPayment}
      invoices={invoices}
      addressBook={addressBook}
    />
  );
}
