import { _mock } from 'src/_mock';

// To get the user from the <AuthContext/>, you can use

// Change:
// import { useMockedUser } from 'src/auth/hooks';
// const { user } = useMockedUser();

// To:
// import { useAuthContext } from 'src/auth/hooks';
// const { user } = useAuthContext();

// ----------------------------------------------------------------------

export function useMockedLevel() {
  const level = {
    id: '8864c717-587d-472a-929a-8e5f298024da-0',
    displayName: 'Roderi Peña',
    email: 'Roderi@minimals.cc',
    photoURL: _mock.image.avatar(24),
    phoneNumber: _mock.phoneNumber(1),
    country: _mock.countryNames(1),
    address: '90210 Broadway Blvd Roderi',
    state: 'California Roderi',
    city: 'San Francisco Roderi',
    zipCode: '94116 Roderi',
    about: 'Roderi Praesent turpis. Phasellus viverra nulla ut metus varius laoreet. Phasellus tempus.',
    role: 'admin Roderi',
    isPublic: true,
  };

  return { level };
}
