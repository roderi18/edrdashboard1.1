import { AuthSplitLayout } from 'src/layouts/auth-split';

// ----------------------------------------------------------------------

export default function Layout({ children }) {
  return (
    <AuthSplitLayout
      slotProps={{
        section: {
          title: '',
          subtitle: '',
          method: null,
          imgUrl: '/assets/banner.png',
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
  );
}
