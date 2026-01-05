import { _mock } from './_mock';

// ----------------------------------------------------------------------

// export const NATIONAL_STATUS_OPTIONS = [
//   { value: 'active', label: 'Active' },
//   { value: 'pending', label: 'Pending' },
//   { value: 'banned', label: 'Banned' },
//   { value: 'rejected', label: 'Rejected' },
// ];

export const NATIONAL_X_ASSIGNED_REGIONAL_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'Región Central', label: 'Región Central' },
  { value: 'Región Norte', label: 'Región Norte' },
  { value: 'Región Sur', label: 'Región Sur' },
  { value: 'Región Oeste', label: 'Región Oeste' },
];

export const _nationalAbout = {
  id: _mock.id(1),
  nationalXAssignedRegional: _mock.nationalXAssignedRegional(1),
  email: _mock.email(1),
  school: _mock.companyNames(2),
  company: _mock.companyNames(1),
  country: _mock.countryNames(2),
  coverUrl: _mock.image.cover(3),
  totalFollowers: _mock.number.nativeL(1),
  totalFollowing: _mock.number.nativeL(2),
  quote:
    'Tart I love sugar plum I love oat cake. Sweet roll caramels I love jujubes. Topping cake wafer..',
  socialLinks: {
    facebook: `https://www.facebook.com/frankie`,
    instagram: `https://www.instagram.com/frankie`,
    linkedin: `https://www.linkedin.com/in/frankie`,
    twitter: `https://www.twitter.com/frankie`,
  },
};

export const _nationalFollowers = Array.from({ length: 18 }, (_, index) => ({
  id: _mock.id(index),
  nationalXMemberName: _mock.nationalXMemberFullName(index),
  country: _mock.countryNames(index),
  avatarUrl: _mock.image.avatar(index),
}));

export const _nationalFriends = Array.from({ length: 18 }, (_, index) => ({
  id: _mock.id(index),
  nationalXAssignedRegional: _mock.nationalXAssignedRegional(index),
  nationalXMemberName: _mock.nationalXMemberFullName(index),
  avatarUrl: _mock.image.avatar(index),
}));

export const _nationalGallery = Array.from({ length: 12 }, (_, index) => ({
  id: _mock.id(index),
  postedAt: _mock.time(index),
  title: _mock.postTitle(index),
  imageUrl: _mock.image.cover(index),
}));

export const _nationalFeeds = Array.from({ length: 3 }, (_, index) => ({
  id: _mock.id(index),
  createdAt: _mock.time(index),
  media: _mock.image.travel(index + 1),
  message: _mock.sentence(index),
  personLikes: Array.from({ length: 20 }, (__, personIndex) => ({
    nationalXMemberName: _mock.nationalXMemberFullName(personIndex),
    avatarUrl: _mock.image.avatar(personIndex + 2),
  })),
  comments: (index === 2 && []) || [
    {
      id: _mock.id(7),
      author: {
        id: _mock.id(8),
        avatarUrl: _mock.image.avatar(index + 5),
        nationalXMemberName: _mock.nationalXMemberFullName(index + 5),
      },
      createdAt: _mock.time(2),
      message: 'Praesent venenatis metus at',
    },
    {
      id: _mock.id(9),
      author: {
        id: _mock.id(10),
        avatarUrl: _mock.image.avatar(index + 6),
        nationalXMemberName: _mock.nationalXMemberFullName(index + 6),
      },
      createdAt: _mock.time(3),
      message:
        'Etiam rhoncus. Nullam vel sem. Pellentesque libero tortor, tincidunt et, tincidunt eget, semper nec, quam. Sed lectus.',
    },
  ],
}));

export const _nationalCards = Array.from({ length: 21 }, (_, index) => ({
  id: _mock.id(index),
  nationalXAssignedRegional: _mock.nationalXAssignedRegional(index),
  nationalEstructure: _mock.nationalEstructure(index),
  nationalXMemberName: _mock.nationalXMemberFullName(index),
  coverUrl: _mock.image.cover(index),
  avatarUrl: _mock.image.avatar(index),
  totalFollowers: _mock.number.nativeL(index),
  totalPosts: _mock.number.nativeL(index + 2),
  totalFollowing: _mock.number.nativeL(index + 1),
}));

export const _nationalPayment = Array.from({ length: 3 }, (_, index) => ({
  id: _mock.id(index),
  cardNumber: ['**** **** **** 1234', '**** **** **** 5678', '**** **** **** 7878'][index],
  cardType: ['mastercard', 'visa', 'visa'][index],
  primary: index === 1,
}));

export const _nationalAddressBook = Array.from({ length: 4 }, (_, index) => ({
  id: _mock.id(index),
  primary: index === 0,
  nationalXMemberName: _mock.nationalXMemberFullName(index),
  nationalXMemberPhoneNumber: _mock.nationalXMemberPhoneNumber(index),
  fullAddress: _mock.fullAddress(index),
  addressType: (index === 0 && 'Home') || 'Office',
}));

export const _nationalInvoices = Array.from({ length: 10 }, (_, index) => ({
  id: _mock.id(index),
  invoiceNumber: `INV-199${index}`,
  createdAt: _mock.time(index),
  price: _mock.number.price(index),
}));

export const _nationalPlans = [
  { subscription: 'basic', price: 0, primary: false },
  { subscription: 'starter', price: 4.99, primary: true },
  { subscription: 'premium', price: 9.99, primary: false },
];

export const _nationalList = Array.from({ length: 20 }, (_, index) => ({
  id: _mock.id(index),
  zipCode: '85807',
  state: 'Virginia',
  city: 'Rancho Cordova',
  nationalXAssignedRegional: _mock.nationalXAssignedRegional(index),
  nationalEstructure: _mock.nationalEstructure(index),
  email: _mock.email(index),
  address: '908 Jack Locks',
  nationalXMemberName: _mock.nationalXMemberFullName(index),
  isVerified: _mock.boolean(index),
  nationalXMemberPosition: _mock.nationalXMemberPosition(index),
  country: _mock.countryNames(index),
  avatarUrl: _mock.image.avatar(index),
  nationalXMemberPhoneNumber: _mock.nationalXMemberPhoneNumber(index),
  status:
    (index % 2 && 'pending') || (index % 3 && 'banned') || (index % 4 && 'rejected') || 'active',
}));
