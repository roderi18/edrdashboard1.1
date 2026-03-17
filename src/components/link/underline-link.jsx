import Link from '@mui/material/Link';
import { RouterLink } from 'src/routes/components';

export function UnderlineLink({
    href,
    underline = 'always',
    sx,
    children,
    ...props
}) {
    return (
        <Link
            component={RouterLink}
            href={href}
            underline={underline}
            sx={(theme) => ({
                cursor: 'pointer',

                color: theme.palette.mode === 'dark'
                    ? '#ffffff'
                    : 'inherit',

                textUnderlineOffset: '3px',

                textDecorationColor: 'rgba(128,128,128,0.5)',

                '&:hover': {
                    textDecorationColor: 'rgba(128,128,128,0.5)',
                },

                ...sx,
            })}
            {...props}
        >
            {children}
        </Link>
    );
}