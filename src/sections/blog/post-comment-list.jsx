import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';

import { PostCommentItem } from './post-comment-item';

// ----------------------------------------------------------------------

export function PostCommentList({ comments = [] }) {
  return (
    <>
      {comments.map((comment) => {
        const replyComment = Array.isArray(comment.replyComment) ? comment.replyComment : [];
        const users = Array.isArray(comment.users) ? comment.users : [];
        const hasReply = !!replyComment.length;

        return (
          <Box key={comment.id}>
            <PostCommentItem
              name={comment.name}
              message={comment.message}
              postedAt={comment.postedAt}
              avatarUrl={comment.avatarUrl}
            />
            {hasReply &&
              replyComment.map((reply) => {
                const userReply = users.find((user) => user.id === reply.userId);

                return (
                  <PostCommentItem
                    key={reply.id}
                    name={userReply?.name || ''}
                    message={reply.message}
                    postedAt={reply.postedAt}
                    avatarUrl={userReply?.avatarUrl || ''}
                    tagUser={reply.tagUser}
                    hasReply
                  />
                );
              })}
          </Box>
        );
      })}

      <Pagination
        count={8}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          my: { xs: 5, md: 8 },
        }}
      />
    </>
  );
}
