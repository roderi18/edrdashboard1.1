import { _mock } from './_mock';

// ----------------------------------------------------------------------

export const USER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'banned', label: 'Banned' },
  { value: 'rejected', label: 'Rejected' },
];

export const _userAbout = {
  id: _mock.id(1),
  role: _mock.role(1),
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

export const _userFollowers = Array.from({ length: 18 }, (_, index) => ({
  id: _mock.id(index),
  name: _mock.fullName(index),
  country: _mock.countryNames(index),
  avatarUrl: _mock.image.avatar(index),
}));

export const _userFriends = Array.from({ length: 18 }, (_, index) => ({
  id: _mock.id(index),
  role: _mock.role(index),
  name: _mock.fullName(index),
  avatarUrl: _mock.image.avatar(index),
}));

export const _userGallery = Array.from({ length: 12 }, (_, index) => ({
  id: _mock.id(index),
  postedAt: _mock.time(index),
  title: _mock.postTitle(index),
  imageUrl: _mock.image.cover(index),
}));

const PRINCIPAL_POST_MESSAGES = [
  'Hola equipo, hoy cerramos una semana buenísima. Gracias por estar pendientes y compartir sus avances.',
  'Fotos del encuentro de líderes. Fue una tarde de mucha energía, ideas claras y buen ánimo.',
  'Recordatorio amistoso: revisen sus materiales antes de la próxima reunión. #Preparados',
  'Me encantó ver a todos participando en las dinámicas. Cada pequeño paso suma.',
  'Estamos organizando nuevas actividades para el mes. Pronto compartimos los detalles.',
  'Gracias a quienes ayudaron con la logística de hoy. Se notó el cariño en cada detalle.',
  'Una imagen del campamento para no olvidar que las mejores historias se construyen juntos.',
  'Seguimos aprendiendo, sirviendo y creciendo como grupo. #Exploradores',
  'La salida de hoy quedó preciosa. Les comparto una foto para el recuerdo.',
  'Equipo, revisen sus chats durante la semana. Hay varias coordinaciones pendientes.',
  'Hoy tuvimos nuevos retos y mucho aprendizaje. Orgulloso del trabajo de todos.',
  'Una pequeña pausa para agradecer por los amigos que hacen el camino más ligero.',
  'Preparando lo próximo con mucha ilusión. Gracias por la disposición de siempre.',
];

const PRINCIPAL_COMMENT_MESSAGES = [
  'Excelente, seguimos atentos.',
  'Me gustó mucho esta parte.',
  'Gracias por compartirlo.',
  'Cuenta conmigo para apoyar.',
  'Qué buena foto.',
  'Listo, lo reviso hoy.',
  'Muy buen trabajo de todos.',
  'Esto quedó genial.',
  'Me alegra ver el avance.',
  'Vamos con todo.',
];

const createPrincipalComment = ({ postIndex, commentIndex, reply = false }) => ({
  id: _mock.id(100 + postIndex * 10 + commentIndex + (reply ? 5 : 0)),
  author: {
    id: _mock.id(150 + postIndex * 10 + commentIndex),
    avatarUrl: _mock.image.avatar(postIndex + commentIndex + 3),
    name: _mock.fullName(postIndex + commentIndex + 3),
  },
  createdAt: _mock.time(commentIndex + 2),
  message: reply
    ? 'Totalmente de acuerdo, gracias por responder.'
    : PRINCIPAL_COMMENT_MESSAGES[(postIndex + commentIndex) % PRINCIPAL_COMMENT_MESSAGES.length],
});

export const _userFeeds = Array.from({ length: 13 }, (_, index) => ({
  id: _mock.id(index),
  createdAt: _mock.time(index),
  media: _mock.image.travel(index + 1),
  message: PRINCIPAL_POST_MESSAGES[index],
  personLikes: Array.from({ length: 4 + (index % 5) }, (__, personIndex) => ({
    name: _mock.fullName(personIndex + index),
    avatarUrl: _mock.image.avatar(personIndex + index + 2),
  })),
  comments: Array.from({ length: 2 + (index % 3) }, (__, commentIndex) => ({
    ...createPrincipalComment({ postIndex: index, commentIndex }),
    replies:
      commentIndex === 0 && index % 2 === 0
        ? [createPrincipalComment({ postIndex: index, commentIndex, reply: true })]
        : [],
  })),
}));

export const _userCards = Array.from({ length: 21 }, (_, index) => ({
  id: _mock.id(index),
  role: _mock.role(index),
  name: _mock.fullName(index),
  coverUrl: _mock.image.cover(index),
  avatarUrl: _mock.image.avatar(index),
  totalFollowers: _mock.number.nativeL(index),
  totalPosts: _mock.number.nativeL(index + 2),
  totalFollowing: _mock.number.nativeL(index + 1),
}));

export const _userPayment = Array.from({ length: 3 }, (_, index) => ({
  id: _mock.id(index),
  cardNumber: ['**** **** **** 1234', '**** **** **** 5678', '**** **** **** 7878'][index],
  cardType: ['mastercard', 'visa', 'visa'][index],
  primary: index === 1,
}));

export const _userAddressBook = Array.from({ length: 4 }, (_, index) => ({
  id: _mock.id(index),
  primary: index === 0,
  name: _mock.fullName(index),
  phoneNumber: _mock.phoneNumber(index),
  fullAddress: _mock.fullAddress(index),
  addressType: (index === 0 && 'Home') || 'Office',
}));

export const _userInvoices = Array.from({ length: 10 }, (_, index) => ({
  id: _mock.id(index),
  invoiceNumber: `INV-199${index}`,
  createdAt: _mock.time(index),
  price: _mock.number.price(index),
}));

export const _userPlans = [
  { subscription: 'basic', price: 0, primary: false },
  { subscription: 'starter', price: 4.99, primary: true },
  { subscription: 'premium', price: 9.99, primary: false },
];

export const _userList = Array.from({ length: 20 }, (_, index) => ({
  id: _mock.id(index),
  zipCode: '85807',
  state: 'Virginia',
  city: 'Rancho Cordova',
  role: _mock.role(index),
  email: _mock.email(index),
  address: '908 Jack Locks',
  name: _mock.fullName(index),
  isVerified: _mock.boolean(index),
  company: _mock.companyNames(index),
  country: _mock.countryNames(index),
  avatarUrl: _mock.image.avatar(index),
  phoneNumber: _mock.phoneNumber(index),
  status:
    (index % 2 && 'pending') || (index % 3 && 'banned') || (index % 4 && 'rejected') || 'active',
}));
