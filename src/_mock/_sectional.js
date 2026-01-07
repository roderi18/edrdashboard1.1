import { _mock } from './_mock';

// ----------------------------------------------------------------------

export const SECTIONAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'banned', label: 'Banned' },
  { value: 'rejected', label: 'Rejected' },
];

export const _sectionalAbout = {
  id: _mock.id(1),
  sectionalXDestMemberCount: _mock.sectionalXDestMemberCount(1),
  email: _mock.email(1),
  memberEmail: _mock.memberEmail(1),
  sectionalEmail: _mock.sectionalEmail(1),
  school: _mock.sectionalDestCount(2),
  sectionalDestCount: _mock.sectionalDestCount(1),
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

export const _sectionalFollowers = Array.from({ length: 18 }, (_, index) => ({
  id: _mock.id(index),
  sectionalName: _mock.sectionalFullName(index),
  country: _mock.countryNames(index),
  avatarUrl: _mock.image.avatar(index),
}));

export const _sectionalFriends = Array.from({ length: 18 }, (_, index) => ({
  id: _mock.id(index),
  sectionalXDestMemberCount: _mock.sectionalXDestMemberCount(index),
  sectionalName: _mock.sectionalFullName(index),
  avatarUrl: _mock.image.avatar(index),
}));

export const _sectionalGallery = Array.from({ length: 12 }, (_, index) => ({
  id: _mock.id(index),
  postedAt: _mock.time(index),
  title: _mock.postTitle(index),
  imageUrl: _mock.image.cover(index),
}));

export const _sectionalFeeds = Array.from({ length: 3 }, (_, index) => ({
  id: _mock.id(index),
  createdAt: _mock.time(index),
  media: _mock.image.travel(index + 1),
  message: _mock.sentence(index),
  personLikes: Array.from({ length: 20 }, (__, personIndex) => ({
    sectionalName: _mock.sectionalFullName(personIndex),
    avatarUrl: _mock.image.avatar(personIndex + 2),
  })),
  comments: (index === 2 && []) || [
    {
      id: _mock.id(7),
      author: {
        id: _mock.id(8),
        avatarUrl: _mock.image.avatar(index + 5),
        sectionalName: _mock.sectionalFullName(index + 5),
      },
      createdAt: _mock.time(2),
      message: 'Praesent venenatis metus at',
    },
    {
      id: _mock.id(9),
      author: {
        id: _mock.id(10),
        avatarUrl: _mock.image.avatar(index + 6),
        sectionalName: _mock.sectionalFullName(index + 6),
      },
      createdAt: _mock.time(3),
      message:
        'Etiam rhoncus. Nullam vel sem. Pellentesque libero tortor, tincidunt et, tincidunt eget, semper nec, quam. Sed lectus.',
    },
  ],
}));

export const _sectionalCards = Array.from({ length: 21 }, (_, index) => ({
  id: _mock.id(index),
  sectionalXDestMemberCount: _mock.sectionalXDestMemberCount(index),
  sectionalName: _mock.sectionalFullName(index),
  coverUrl: _mock.image.cover(index),
  avatarUrl: _mock.image.avatar(index),
  totalFollowers: _mock.number.nativeL(index),
  totalPosts: _mock.number.nativeL(index + 2),
  totalFollowing: _mock.number.nativeL(index + 1),
}));

export const _sectionalPayment = Array.from({ length: 3 }, (_, index) => ({
  id: _mock.id(index),
  cardNumber: ['**** **** **** 1234', '**** **** **** 5678', '**** **** **** 7878'][index],
  cardType: ['mastercard', 'visa', 'visa'][index],
  primary: index === 1,
}));

export const _sectionalAddressBook = Array.from({ length: 4 }, (_, index) => ({
  id: _mock.id(index),
  primary: index === 0,
  sectionalName: _mock.sectionalFullName(index),
  sectionalCoordName: _mock.sectionalCoordName(index),
  fullAddress: _mock.fullAddress(index),
  addressType: (index === 0 && 'Home') || 'Office',
}));

export const _sectionalInvoices = Array.from({ length: 10 }, (_, index) => ({
  id: _mock.id(index),
  invoiceNumber: `INV-199${index}`,
  createdAt: _mock.time(index),
  price: _mock.number.price(index),
}));

export const _sectionalPlans = [
  { subscription: 'basic', price: 0, primary: false },
  { subscription: 'starter', price: 4.99, primary: true },
  { subscription: 'premium', price: 9.99, primary: false },
];

export const _sectionalList = Array.from({ length: 20 }, (_, index) => ({
  id: _mock.id(index),
  zipCode: '85807',
  state: 'Virginia',
  city: 'Rancho Cordova',
  sectionalXDestMemberCount: _mock.sectionalXDestMemberCount(index),
  sectionalEmail: _mock.sectionalEmail(index),
  memberEmail: _mock.memberEmail(index),
  address: '908 Jack Locks',
  sectionalName: _mock.sectionalFullName(index),
  isVerified: _mock.boolean(index),
  sectionalDestCount: _mock.sectionalDestCount(index),
  country: _mock.countryNames(index),
  avatarUrl: _mock.image.avatar(index),
  sectionalCoordName: _mock.sectionalCoordName(index),
  status:
    (index % 2 && 'pending') || (index % 3 && 'banned') || (index % 4 && 'rejected') || 'active',
}));
