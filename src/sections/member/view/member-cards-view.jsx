// 'use client';

// import Button from '@mui/material/Button';

// import { paths } from 'src/routes/paths';
// import { RouterLink } from 'src/routes/components';

// import { _memberCards } from 'src/_mock';
// import { DashboardContent } from 'src/layouts/dashboard';

// import { Iconify } from 'src/components/iconify';
// import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// import { MemberCardList } from '../member-card-list';

// // ----------------------------------------------------------------------

// export function MemberCardsView() {
//   return (
//     <DashboardContent>
//       <CustomBreadcrumbs
//         heading="Cards"
//         links={[
//           { name: 'Panel', href: paths.dashboard.root },
//           { name: 'Miembros', href: paths.dashboard.level.member.root },
//           { name: 'Cards' },
//         ]}
//         action={
//           <Button
//             component={RouterLink}
//             href={paths.dashboard.level.member.new}
//             variant="contained"
//             startIcon={<Iconify icon="mingcute:add-line" />}
//           >
//             Agregar miembro
//           </Button>
//         }
//         sx={{ mb: { xs: 3, md: 5 } }}
//       />

//       <MemberCardList members={_memberCards} />
//     </DashboardContent>
//   );
// }
