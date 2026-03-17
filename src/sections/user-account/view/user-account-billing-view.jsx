'use client';

import { _userPlans, _userPayment, _userInvoices, _userAddressBook } from 'src/_mock';

import { UserAccountBilling } from '../user-account-billing';

// ----------------------------------------------------------------------

export function UserAccountBillingView() {
  return (
    <UserAccountBilling
      plans={_userPlans}
      cards={_userPayment}
      invoices={_userInvoices}
      addressBook={_userAddressBook}
    />
  );
}
