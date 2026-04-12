import { Label } from 'src/components/label';

export default function StatusLabel({
    value,
    activeText = 'Activo',
    inactiveText = 'Inactivo',
    sx = {},
}) {
    return (
        <Label
            color={value ? 'success' : 'error'}
            sx={{
                position: 'absolute',
                top: 24,
                right: 24,
                ...sx,
            }}
        >
            {value ? activeText : inactiveText}
        </Label>
    );
}