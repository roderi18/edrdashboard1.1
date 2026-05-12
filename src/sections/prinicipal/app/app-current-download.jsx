import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

export function AppCurrentDownload({
  title,
  subheader,
  videoUrl = 'https://www.youtube.com/embed/ysz5S6PUM-U',
  sx,
  ...other
}) {
  return (
    <Card
      sx={[
        {
          width: { xs: 270, xl: 315 },
          height: { xs: 480, xl: 560 },
          aspectRatio: '9 / 16',
          display: 'flex',
          overflow: 'hidden',
          flexShrink: 0,
          flexDirection: 'column',
          bgcolor: 'common.black',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box
        sx={{
          flex: '1 1 auto',
          minHeight: 0,
          position: 'relative',
          bgcolor: 'common.black',
        }}
      >
        <Box
          component="iframe"
          title={title || 'Video de ejemplo'}
          src={videoUrl}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          sx={{
            inset: 0,
            width: 1,
            height: 1,
            border: 0,
            display: 'block',
            position: 'absolute',
            bgcolor: 'common.black',
          }}
        />

        {(title || subheader) && (
          <Box
            sx={{
              left: 0,
              right: 0,
              bottom: 0,
              p: 2,
              zIndex: 1,
              color: 'common.white',
              position: 'absolute',
              pointerEvents: 'none',
              background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)',
            }}
          >
            {!!title && (
              <Typography variant="subtitle1" noWrap>
                {title}
              </Typography>
            )}
            {!!subheader && (
              <Typography variant="caption" noWrap sx={{ opacity: 0.8, display: 'block' }}>
                {subheader}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Card>
  );
}
