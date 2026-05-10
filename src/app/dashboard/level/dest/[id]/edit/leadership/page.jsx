'use client';

import Box from '@mui/material/Box';

import { OrganizationalChart } from 'src/components/organizational-chart';

import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { SIMPLE_DATA } from 'src/sections/_examples/extra/organizational-chart-view/data';
import { StandardNode } from 'src/sections/_examples/extra/organizational-chart-view/standard-node';

export default function Page() {
  return (
    <DestEditLayout maxWidth={false}>
      <Box
        sx={{
          width: 1,
          mx: 'auto',
          display: 'flex',
          overflow: 'hidden',
          minHeight: 640,
          justifyContent: 'center',
          px: { xs: 1.5, md: 2 },
        }}
      >
        <Box
          sx={{
            width: 1080,
            flexShrink: 0,
            transform: {
              xs: 'scale(0.42)',
              sm: 'scale(0.5)',
              md: 'scale(0.58)',
              lg: 'scale(0.68)',
              xl: 'scale(0.78)',
            },
            transformOrigin: 'top center',
          }}
        >
          <OrganizationalChart
            lineHeight="34px"
            data={SIMPLE_DATA}
            nodeItem={(props) => <StandardNode sx={{}} {...props} />}
          />
        </Box>
      </Box>
    </DestEditLayout>
  );
}
