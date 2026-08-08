'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import { useTheme, useMediaQuery } from '@mui/material';

export function MobileInfoPopover({ children, content }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [anchorEl, setAnchorEl] = useState(null);

    const handleOpen = (event) => {
        if (isMobile) {
            setAnchorEl(event.currentTarget);
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    return (
        <>
            <Box
                component="span"
                onClick={handleOpen}
                sx={{
                    cursor: isMobile ? 'default' : 'default',
                    textDecoration: isMobile ? 'underline' : 'none',
                    textUnderlineOffset: '3px',
                }}
            >
                {children}
            </Box>

            {isMobile && (
                <Popover
                    open={open}
                    anchorEl={anchorEl}
                    onClose={handleClose}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'center',
                    }}
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'center',
                    }}
                >
                    <Box sx={{ p: 1.5, typography: 'caption' }}>
                        {content}
                    </Box>
                </Popover>
            )}
        </>
    );
}
