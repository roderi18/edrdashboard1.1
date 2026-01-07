import { _mock } from './_mock';

// ----------------------------------------------------------------------

export const MEMBER_DIVISION_OPTIONS = [
  { value: 'Liderazgo', label: 'Liderazgo' },
  { value: 'Exploradores', label: 'Exploradores' },
  { value: 'Seguidores', label: 'Seguidores' },
  { value: 'Pioneros', label: 'Pioneros' },
  { value: 'Navegantes', label: 'Navegantes' },
];

export const MEMBER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'banned', label: 'Banned' },
  { value: 'rejected', label: 'Rejected' },
];


// const MEMBER_DIVISION_OPTIONS = [
//   { value: 'all', label: 'Todos' },
//   { value: 'Exploradores', label: 'Exploradores' },
//   { value: 'Seguidores', label: 'Seguidores' },
//   { value: 'Pioneros', label: 'Pioneros' },
//   { value: 'Navegantes', label: 'Navegantes' },
// ];


export const _memberAbout = {
  id: _mock.id(1),
  memberPosition: _mock.memberPosition(1),
  // memberEmail: _mock.memberEmail(1),
  school: _mock.memberDivisionNames(2),
  // company: _mock.companyNames(1),
  memberDivision: _mock.memberDivisionNames(1),
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

export const _memberFollowers = Array.from({ length: 18 }, (_, index) => ({
  id: _mock.id(index),
  memberName: _mock.memberFullName(index),
  country: _mock.countryNames(index),
  avatarUrl: _mock.image.avatar(index),
}));

export const _memberFriends = Array.from({ length: 18 }, (_, index) => ({
  id: _mock.id(index),
  memberPosition: _mock.memberPosition(index),
  memberName: _mock.memberFullName(index),
  avatarUrl: _mock.image.avatar(index),
}));

export const _memberGallery = Array.from({ length: 12 }, (_, index) => ({
  id: _mock.id(index),
  postedAt: _mock.time(index),
  title: _mock.postTitle(index),
  imageUrl: _mock.image.cover(index),
}));

export const _memberFeeds = Array.from({ length: 3 }, (_, index) => ({
  id: _mock.id(index),
  createdAt: _mock.time(index),
  media: _mock.image.travel(index + 1),
  message: _mock.sentence(index),
  personLikes: Array.from({ length: 20 }, (__, personIndex) => ({
    memberName: _mock.memberFullName(personIndex),
    avatarUrl: _mock.image.avatar(personIndex + 2),
  })),
  comments: (index === 2 && []) || [
    {
      id: _mock.id(7),
      author: {
        id: _mock.id(8),
        avatarUrl: _mock.image.avatar(index + 5),
        memberName: _mock.memberFullName(index + 5),
      },
      createdAt: _mock.time(2),
      message: 'Praesent venenatis metus at',
    },
    {
      id: _mock.id(9),
      author: {
        id: _mock.id(10),
        avatarUrl: _mock.image.avatar(index + 6),
        memberName: _mock.memberFullName(index + 6),
      },
      createdAt: _mock.time(3),
      message:
        'Etiam rhoncus. Nullam vel sem. Pellentesque libero tortor, tincidunt et, tincidunt eget, semper nec, quam. Sed lectus.',
    },
  ],
}));

export const _memberCards = Array.from({ length: 21 }, (_, index) => ({
  id: _mock.id(index),
  memberPosition: _mock.memberPosition(index),
  memberName: _mock.memberFullName(index),
  coverUrl: _mock.image.cover(index),
  avatarUrl: _mock.image.avatar(index),
  totalFollowers: _mock.number.nativeL(index),
  totalPosts: _mock.number.nativeL(index + 2),
  totalFollowing: _mock.number.nativeL(index + 1),
}));

export const _memberPayment = Array.from({ length: 3 }, (_, index) => ({
  id: _mock.id(index),
  cardNumber: ['**** **** **** 1234', '**** **** **** 5678', '**** **** **** 7878'][index],
  cardType: ['mastercard', 'visa', 'visa'][index],
  primary: index === 1,
}));

export const _memberAddressBook = Array.from({ length: 4 }, (_, index) => ({
  id: _mock.id(index),
  primary: index === 0,
  memberName: _mock.memberFullName(index),
  memberPhoneNumber: _mock.memberPhoneNumber(index),
  fullAddress: _mock.fullAddress(index),
  addressType: (index === 0 && 'Home') || 'Office',
}));

export const _memberInvoices = Array.from({ length: 10 }, (_, index) => ({
  id: _mock.id(index),
  invoiceNumber: `INV-199${index}`,
  createdAt: _mock.time(index),
  price: _mock.number.price(index),
}));

export const _memberPlans = [
  { subscription: 'basic', price: 0, primary: false },
  { subscription: 'starter', price: 4.99, primary: true },
  { subscription: 'premium', price: 9.99, primary: false },
];

export const _memberList = Array.from({ length: 20 }, (_, index) => ({
  id: _mock.id(index),
  zipCode: '85807',
  state: 'Virginia',
  city: 'Rancho Cordova',
  memberPosition: _mock.memberPosition(index),
  memberEmail: _mock.memberEmail(index),
  address: '908 Jack Locks',
  memberName: _mock.memberFullName(index),
  isVerified: _mock.boolean(index),
  // company: _mock.companyNames(index),
  memberDivision: _mock.memberDivisionNames(index),
  country: _mock.countryNames(index),
  avatarUrl: _mock.image.avatar(index),
  memberPhoneNumber: _mock.memberPhoneNumber(index),
  status:
    (index % 2 && 'pending') || (index % 3 && 'banned') || (index % 4 && 'rejected') || 'active',
}));
