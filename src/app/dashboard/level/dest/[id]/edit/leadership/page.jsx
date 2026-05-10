'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { OrganizationalChart } from 'src/components/organizational-chart';

import { ComponentBox } from 'src/sections/_examples/layout';
import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { SIMPLE_DATA } from 'src/sections/_examples/extra/organizational-chart-view/data';
import { StandardNode } from 'src/sections/_examples/extra/organizational-chart-view/standard-node';

export default function Page() {
  return (
    <DestEditLayout maxWidth={false}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Standard
      </Typography>

      <ComponentBox
        sx={{
          mx: 'auto',
          maxWidth: 940,
          overflow: 'auto',
          minHeight: 640,
          px: { xs: 1.5, md: 2 },
        }}
      >
        <Box
          sx={{
            minWidth: 900,
            width: 1,
          }}
        >
          <OrganizationalChart
            lineHeight="34px"
            data={SIMPLE_DATA}
            nodeItem={(props) => <StandardNode sx={{ minWidth: 220, p: 2.25 }} {...props} />}
          />
        </Box>
      </ComponentBox>
    </DestEditLayout>
  );
}
