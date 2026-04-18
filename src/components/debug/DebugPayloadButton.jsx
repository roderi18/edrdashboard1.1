import Button from '@mui/material/Button';

export default function DebugPayloadButton({
    getValues,
    buildPayload,
    label = 'Debug payload',
}) {
    const handleDebug = () => {
        const data = getValues();

        const payload = buildPayload(data);

        console.log('🧪 DEBUG PAYLOAD 👉', payload);
    };

    return (
        <Button variant="outlined" color="warning" onClick={handleDebug}>
            {label}
        </Button>
    );
}