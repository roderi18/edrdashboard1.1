'use client';

import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';

import { DashboardContent } from 'src/layouts/dashboard';
import { MotivationIllustration } from 'src/assets/illustrations';
import {
  _ecommerceNewProducts,
  _ecommerceBestSalesman,
  _ecommerceSalesPrincipal,
  _ecommerceLatestProducts,
} from 'src/_mock';

import { useMockedUser } from 'src/auth/hooks';

import { EcommerceWelcome } from '../ecommerce-welcome';
import { EcommerceNewProducts } from '../ecommerce-new-products';
import { EcommerceYearlySales } from '../ecommerce-yearly-sales';
import { EcommerceBestSalesman } from '../ecommerce-best-salesman';
import { EcommerceSaleByGender } from '../ecommerce-sale-by-gender';
import { EcommerceWidgetSummary } from '../ecommerce-widget-summary';
import { EcommerceSalesPrincipal } from '../ecommerce-sales-principal';
import { EcommerceLatestProducts } from '../ecommerce-latest-products';
import { EcommerceCurrentBalance } from '../ecommerce-current-balance';

// ----------------------------------------------------------------------

export function PrincipalEcommerceView() {
  const { user } = useMockedUser();

  const theme = useTheme();

  return (
    <DashboardContent maxWidth="xl">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <EcommerceWelcome
            title={`¡Felicidades!\n${user?.displayName}`}
            description="Fuiste el mejor vendedor del mes y hoy lograste 57.6% más ventas."
            img={<MotivationIllustration hideBackground />}
            action={
              <Button variant="contained" color="primary">
                Ir ahora
              </Button>
            }
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <EcommerceNewProducts list={_ecommerceNewProducts} />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <EcommerceWidgetSummary
            title="Productos vendidos"
            percent={2.6}
            total={765}
            chart={{
              categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'],
              series: [22, 8, 35, 50, 82, 84, 77, 12],
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <EcommerceWidgetSummary
            title="Balance total"
            percent={-0.1}
            total={18765}
            chart={{
              colors: [theme.palette.warning.light, theme.palette.warning.main],
              categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'],
              series: [56, 47, 40, 62, 73, 30, 23, 54],
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <EcommerceWidgetSummary
            title="Ganancia en ventas"
            percent={0.6}
            total={4876}
            chart={{
              colors: [theme.palette.error.light, theme.palette.error.main],
              categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'],
              series: [40, 70, 75, 70, 50, 28, 7, 64],
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <EcommerceSaleByGender
            title="Ventas por género"
            total={2324}
            chart={{
              series: [
                { label: 'Hombres', value: 25 },
                { label: 'Mujeres', value: 50 },
                { label: 'Niños', value: 75 },
              ],
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 8 }}>
          <EcommerceYearlySales
            title="Ventas anuales"
            subheader="(+43%) respecto al año pasado"
            chart={{
              categories: [
                'Ene',
                'Feb',
                'Mar',
                'Abr',
                'May',
                'Jun',
                'Jul',
                'Ago',
                'Sep',
                'Oct',
                'Nov',
                'Dic',
              ],
              series: [
                {
                  name: '2022',
                  data: [
                    {
                      name: 'Ingresos totales',
                      data: [10, 41, 35, 51, 49, 62, 69, 91, 148, 35, 51, 49],
                    },
                    {
                      name: 'Gastos totales',
                      data: [10, 34, 13, 56, 77, 88, 99, 77, 45, 13, 56, 77],
                    },
                  ],
                },
                {
                  name: '2023',
                  data: [
                    {
                      name: 'Ingresos totales',
                      data: [51, 35, 41, 10, 91, 69, 62, 148, 91, 69, 62, 49],
                    },
                    {
                      name: 'Gastos totales',
                      data: [56, 13, 34, 10, 77, 99, 88, 45, 77, 99, 88, 77],
                    },
                  ],
                },
              ],
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 8 }}>
          <EcommerceSalesPrincipal title="Resumen de ventas" data={_ecommerceSalesPrincipal} />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <EcommerceCurrentBalance
            title="Balance actual"
            earning={25500}
            refunded={1600}
            orderTotal={287650}
            currentBalance={187650}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 8 }}>
          <EcommerceBestSalesman
            title="Mejores vendedores"
            tableData={_ecommerceBestSalesman}
            headCells={[
              { id: 'name', label: 'Vendedor' },
              { id: 'category', label: 'Producto' },
              { id: 'country', label: 'País', align: 'center' },
              { id: 'totalAmount', label: 'Total', align: 'right' },
              { id: 'rank', label: 'Rango', align: 'right' },
            ]}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <EcommerceLatestProducts title="Últimos productos" list={_ecommerceLatestProducts} />
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
