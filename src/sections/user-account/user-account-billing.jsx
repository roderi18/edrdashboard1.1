import Grid from '@mui/material/Grid';

import { UserAccountBillingPlan } from './user-account-billing-plan';
import { UserAccountBillingPayment } from './user-account-billing-payment';
import { UserAccountBillingHistory } from './user-account-billing-history';
import { UserAccountBillingAddress } from './user-account-billing-address';

// ----------------------------------------------------------------------

export function UserAccountBilling({ cards, plans, invoices, addressBook }) {
  return (
    <Grid container spacing={5}>
      <Grid size={{ xs: 12, md: 8 }}>
        <UserAccountBillingPlan plans={plans} cardList={cards} addressBook={addressBook} />
        <UserAccountBillingPayment cards={cards} />
        <UserAccountBillingAddress addressBook={addressBook} />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <UserAccountBillingHistory invoices={invoices} />
      </Grid>
    </Grid>
  );
}
