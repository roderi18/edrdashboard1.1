export const LOCALHOST_NATIONAL_TEST_MEMBER = {
  id: 'localhost-national-test-member',
  fullName: 'Usuario Prueba Nacional',
  firstName: 'Usuario',
  lastName: 'Prueba Nacional',
  email: 'prueba.nacional@localhost.test',
  phoneNumber: '+18090000000',
  avatarUrl: '',
};

export const LOCALHOST_NATIONAL_TEST_ASSIGNMENT = {
  id: 'localhost-national-test-assignment',
  memberId: LOCALHOST_NATIONAL_TEST_MEMBER.id,
  level: 'national',
  entityId: 'national-root',
  role: 'director_nacional',
  status: 'active',
  startDate: '2026-05-21',
  endDate: null,
};

export const LOCALHOST_NATIONAL_TEST_EDIT_RECORD = {
  id: LOCALHOST_NATIONAL_TEST_ASSIGNMENT.id,
  name: LOCALHOST_NATIONAL_TEST_MEMBER.fullName,
  email: LOCALHOST_NATIONAL_TEST_MEMBER.email,
  phoneNumber: LOCALHOST_NATIONAL_TEST_MEMBER.phoneNumber,
  avatarUrl: null,
  country: 'DO',
  state: 'Santo Domingo',
  city: 'Santo Domingo Este',
  address: 'Dirección de prueba local',
  zipCode: '00000',
  company: 'Consejo Nacional',
  role: 'Director Nacional',
  status: 'active',
  isVerified: true,
};

export function isLocalhostNationalTestId(id) {
  return String(id) === LOCALHOST_NATIONAL_TEST_ASSIGNMENT.id;
}
