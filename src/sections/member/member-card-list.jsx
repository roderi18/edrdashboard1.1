import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';

import { CompactEntityCardSkeleton } from 'src/sections/common/compact-entity-card';

import { MemberCard } from './member-card';

// ----------------------------------------------------------------------

export function MemberCardList({
  members,
  canManage = true,
  dests = [],
  loading = false,
  memberPhotoUrls = {},
}) {
  const [page, setPage] = useState(1);

  const rowsPerPage = 12;

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  return (
    <Box sx={{ mt: { xs: 2, md: 2.5 } }}>
      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        }}
      >
        {loading
          ? Array.from({ length: rowsPerPage }, (_, index) => (
              <CompactEntityCardSkeleton key={index} />
            ))
          : members
              .slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage)
              .map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  avatarUrl={memberPhotoUrls[String(member.id)]}
                  canManage={canManage}
                  dests={dests}
                />
              ))}
      </Box>

      {!loading && members.length > rowsPerPage && (
        <Box
          sx={{
            mt: { xs: 2, md: 4 },
            mb: { xs: 2, md: 2 },
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Pagination
            page={page}
            shape="circular"
            count={Math.ceil(members.length / rowsPerPage)}
            onChange={handleChangePage}
          />
        </Box>
      )}
    </Box>
  );
}
