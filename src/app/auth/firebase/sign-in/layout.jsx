import { AuthSplitLayout } from 'src/layouts/auth-split';

import { GuestGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export default function Layout({ children }) {
  return (
        <GuestGuard>
      <AuthSplitLayout
        slotProps={{
          section: {
            title: '',
            subtitle: '',
            method: null,
            imgUrl: '/assets/banner1.png',
            sx: {
              px: 0,
              pt: 0,
              pb: 0,
              gap: 0,
              justifyContent: 'stretch',
            },
            imgSx: {
              height: '100vh',
              aspectRatio: 'unset',
              objectFit: 'cover',
              objectPosition: 'center',
            },
          },
        }}
      >
        {children}
      </AuthSplitLayout>
    </GuestGuard>
  );
}
