'use client';

import { _userAbout } from 'src/_mock';

import { UserAccountSocials } from '../user-account-socials';

// ----------------------------------------------------------------------

export function UserAccountSocialsView() {
  return <UserAccountSocials socialLinks={_userAbout.socialLinks} />;
}
