import { _mock } from './_mock';
import { DESTS, SECTIONALS } from './assets';

// ----------------------------------------------------------------------

export const REGIONAL_FULL_NAME_OPTIONS = [
  { value: 'Región Central', label: 'Región Central' },
  { value: 'Región Norte', label: 'Región Norte' },
  { value: 'Región Sur', label: 'Región Sur' },
  { value: 'Región Este', label: 'Región Este' },
];


export const _destAbout = {
  id: _mock.id(1),
  sectionalName: _mock.sectionalNameById(SECTIONALS[1 % SECTIONALS.length].id),
  email: _mock.email(1),
  // church: _mock.church(1),
  school: _mock.destMemberCount(2),
  destMemberCount: _mock.destMemberCount(1),
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

export const _destFollowers = Array.from({ length: 18 }, (_, index) => ({
  id: _mock.id(index),
  // destName: _mock.destName(index),
  destId: DESTS[index % DESTS.length].id,
  destName: DESTS[index % DESTS.length].name,
  country: _mock.countryNames(index),
  avatarUrl: _mock.image.avatar(index),
}));

export const _destFriends = Array.from({ length: 18 }, (_, index) => ({
  id: _mock.id(index),
  sectionalName: _mock.sectionalNameById(DESTS[index % DESTS.length].sectionalId),
  sectionalId: DESTS[index % DESTS.length].sectionalId,

  // destName: _mock.destName(index),
  destId: DESTS[index % DESTS.length].id,
  destName: DESTS[index % DESTS.length].name,
  avatarUrl: _mock.image.avatar(index),
}));

export const _destGallery = Array.from({ length: 12 }, (_, index) => ({
  id: _mock.id(index),
  postedAt: _mock.time(index),
  title: _mock.postTitle(index),
  imageUrl: _mock.image.cover(index),
}));

export const _destFeeds = Array.from({ length: 3 }, (_, index) => ({
  id: _mock.id(index),
  createdAt: _mock.time(index),
  media: _mock.image.travel(index + 1),
  message: _mock.sentence(index),
  personLikes: Array.from({ length: 20 }, (__, personIndex) => ({
    // destName: _mock.destName(personIndex),
    destName: DESTS[personIndex % DESTS.length].name,
    avatarUrl: _mock.image.avatar(personIndex + 2),
  })),
  comments: (index === 2 && []) || [
    {
      id: _mock.id(7),
      author: {
        id: _mock.id(8),
        avatarUrl: _mock.image.avatar(index + 5),
        // destName: _mock.destName(index + 5),
        destId: DESTS[index % DESTS.length].id
      },
      createdAt: _mock.time(2),
      message: 'Praesent venenatis metus at',
    },
    {
      id: _mock.id(9),
      author: {
        id: _mock.id(10),
        avatarUrl: _mock.image.avatar(index + 6),
        // destName: _mock.destName(index + 6),
        destId: DESTS[index % DESTS.length].id
      },
      createdAt: _mock.time(3),
      message:
        'Etiam rhoncus. Nullam vel sem. Pellentesque libero tortor, tincidunt et, tincidunt eget, semper nec, quam. Sed lectus.',
    },
  ],
}));

export const _destCards = Array.from({ length: 21 }, (_, index) => ({
  id: _mock.id(index),
  sectionalName: SECTIONALS[index % SECTIONALS.length].name,
  // destName: _mock.destName(index),
  destId: DESTS[index % DESTS.length].id,
  destName: DESTS[index % DESTS.length].name,
  coverUrl: _mock.image.cover(index),
  avatarUrl: _mock.image.avatar(index),
  totalFollowers: _mock.number.nativeL(index),
  totalPosts: _mock.number.nativeL(index + 2),
  totalFollowing: _mock.number.nativeL(index + 1),
}));

export const _destPayment = Array.from({ length: 3 }, (_, index) => ({
  id: _mock.id(index),
  cardNumber: ['**** **** **** 1234', '**** **** **** 5678', '**** **** **** 7878'][index],
  cardType: ['mastercard', 'visa', 'visa'][index],
  primary: index === 1,
}));

export const _destAddressBook = Array.from({ length: 4 }, (_, index) => ({
  id: _mock.id(index),
  primary: index === 0,
  // destName: _mock.destName(index),
  destId: DESTS[index % DESTS.length].id,
  destName: DESTS[index % DESTS.length].name,
  phoneNumber: _mock.phoneNumber(index),
  memberFullName: _mock.memberFullName(index),
  fullAddress: _mock.fullAddress(index),
  addressType: (index === 0 && 'Home') || 'Office',
}));

export const _destInvoices = Array.from({ length: 10 }, (_, index) => ({
  id: _mock.id(index),
  invoiceNumber: `INV-199${index}`,
  createdAt: _mock.time(index),
  price: _mock.number.price(index),
}));

export const _destPlans = [
  { subscription: 'basic', price: 0, primary: false },
  { subscription: 'starter', price: 4.99, primary: true },
  { subscription: 'premium', price: 9.99, primary: false },
];

export const _destList = DESTS.map((dest) => ({
  id: dest.id,
  destName: dest.name,
  churchId: dest.churchId,
  churchAddress: dest.churchAddress,
  sectionalId: dest.sectionalId,
  membershipStatus: dest.membershipStatus,
  coordinatorMemberId: dest.coordinatorMemberId ?? null,
  assistantCoordinatorMemberId: dest.assistantCoordinatorMemberId ?? null,

  // derivados reales
  sectionalName: SECTIONALS.find(s => s.id === dest.sectionalId)?.name ?? '',

  avatarUrl: dest.avatarUrl,

  // placeholders estructurales (temporales hasta Firebase)
  email: '',
  country: 'Dominican Republic',
  isVerified: true,
}));
