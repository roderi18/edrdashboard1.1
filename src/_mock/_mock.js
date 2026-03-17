import { fSub } from 'src/utils/format-time';

import { CONFIG } from 'src/global-config';
import { DESTS, SECTIONALS, REGIONALS, CHURCHES } from './assets';


import {
  _id,
  _ages,
  _roles,
  _memberPosition,
  _sectionalXDestMemberCounts,
  _nationalXAssignedRegionals,
  _nationalEstructures,
  _memberPositions,
  _prices,
  _emails,
  // _sectionalEmails,
  // _churches,
  _regionalXSectionalEmails,
  _ratings,
  _nativeS,
  _nativeM,
  _nativeL,
  _percents,
  _booleans,
  _sentences,
  _lastNames,
  _fullNames,
  _memberFullNames,
  // _destNames,
  // _sectionalNames,
  _tourNames,
  _jobTitles,
  _taskNames,
  _fileNames,
  _postTitles,
  _firstNames,
  _eventNames,
  _courseNames,
  _fullAddress,
  _companyNames,
  _sectionalDestCounts,
  _nationalXMemberPositions,
  _destMemberCounts,
  _destMemberships,
  _regionalXSectionalCounts,
  _regionalXSectionalMemberCounts,
  _regionalXSectionalXDestCounts,
  _memberDivisionNames,
  _productNames,
  _descriptions,
  _phoneNumbers,
  // _regionalNames,
  _countryNames,
} from './assets';

// ----------------------------------------------------------------------

export const _mock = {
  id: (index) => _id[index],
  time: (index) => fSub({ days: index, hours: index }),
  boolean: (index) => _booleans[index],
  role: (index) => _roles[index],
  memberPosition: (index) => _memberPositions[index],
  sectionalXDestMemberCount: (index) => _sectionalXDestMemberCounts[index],
  nationalXAssignedRegional: (index) => _nationalXAssignedRegionals[index],
  nationalEstructure: (index) => _nationalEstructures[index],
  regionalXSectionalMemberCount: (index) => _regionalXSectionalMemberCounts[index],
  regionalXSectionalXDestCount: (index) => _regionalXSectionalXDestCounts[index],
  sectionalNameById: (sectionalId) =>
    SECTIONALS.find((s) => s.id === sectionalId)?.name, courseNames: (index) => _courseNames[index],
  fileNames: (index) => _fileNames[index],
  eventNames: (index) => _eventNames[index],
  taskNames: (index) => _taskNames[index],
  postTitle: (index) => _postTitles[index],
  jobTitle: (index) => _jobTitles[index],
  tourName: (index) => _tourNames[index],
  productName: (index) => _productNames[index],
  sentence: (index) => _sentences[index],
  description: (index) => _descriptions[index],
  // Contact
  // sectionalEmail: (index) => _sectionalEmails[index],
  // church: (index) => _churches[index],
  email: (index) => _emails[index],
  phoneNumber: (index) => _phoneNumbers[index],
  memberFullName: (index) => _memberFullNames[index],

  //Regional
  // regionalXSectionalEmail: (index) => _regionalXSectionalEmails[index],
  // regionalName: (index) => _regionalNames[index % _regionalNames.length],
  regionalById: (regionalId) => REGIONALS.find((r) => r.id === regionalId),
  regionalId: (index) => REGIONALS[index % REGIONALS.length].id,
  regionalNameById: (regionalId) => REGIONALS.find((r) => r.id === regionalId)?.name,
  regionalEmailById: (regionalId) => REGIONALS.find((r) => r.id === regionalId)?.email,

  //Seccional
  sectionalById: (sectionalId) => SECTIONALS.find((r) => r.id === sectionalId),
  sectionalId: (index) => SECTIONALS[index % SECTIONALS.length].id,
  sectionalNameById: (sectionalId) => SECTIONALS.find((r) => r.id === sectionalId)?.name,
  sectionalEmailById: (sectionalId) => SECTIONALS.find((r) => r.id === sectionalId)?.email,

  //Destacamento
  // destName: (index) => _destNames[index],
  destById: (destId) => DESTS.find((d) => d.id === destId),
  destId: (index) => DESTS[index % DESTS.length].id,
  destNameById: (destId) => DESTS.find((d) => d.id === destId)?.name,
  destEmailById: (destId) => DESTS.find((d) => d.id === destId)?.email,




  fullAddress: (index) => _fullAddress[index],
  // Name
  firstName: (index) => _firstNames[index],
  lastName: (index) => _lastNames[index],
  fullName: (index) => _fullNames[index],
  memberFullName: (index) => _memberFullNames[index],

  companyNames: (index) => _companyNames[index],
  sectionalDestCount: (index) => _sectionalDestCounts[index],
  nationalXMemberPosition: (index) => _nationalXMemberPositions[index],
  regionalXSectionalCount: (index) => _regionalXSectionalCounts[index],
  destMemberCount: (index) => _destMemberCounts[index],
  memberDivisionNames: (index) => _memberDivisionNames[index],
  countryNames: (index) => _countryNames[index],
  // Number
  number: {
    percent: (index) => _percents[index],
    rating: (index) => _ratings[index],
    age: (index) => _ages[index],
    price: (index) => _prices[index],
    nativeS: (index) => _nativeS[index],
    nativeM: (index) => _nativeM[index],
    nativeL: (index) => _nativeL[index],
  },
  // Image
  image: {
    cover: (index) => `${CONFIG.assetsDir}/assets/images/mock/cover/cover-${index + 1}.webp`,
    avatar: (index) => `${CONFIG.assetsDir}/assets/images/mock/avatar/avatar-${index + 1}.webp`,
    travel: (index) => `${CONFIG.assetsDir}/assets/images/mock/travel/travel-${index + 1}.webp`,
    course: (index) => `${CONFIG.assetsDir}/assets/images/mock/course/course-${index + 1}.webp`,
    company: (index) => `${CONFIG.assetsDir}/assets/images/mock/company/company-${index + 1}.webp`,
    product: (index) =>
      `${CONFIG.assetsDir}/assets/images/mock/m-product/product-${index + 1}.webp`,
    portrait: (index) =>
      `${CONFIG.assetsDir}/assets/images/mock/portrait/portrait-${index + 1}.webp`,
  },
};
