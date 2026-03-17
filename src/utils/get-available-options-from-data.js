export const getAvailableOptionsFromData = ({
    inputData = [],
    property,
    labelResolver,
}) => {
    const values = [
        ...new Set(
            inputData
                .map((item) => item?.[property])
                .filter(Boolean)
        ),
    ];

    return values
        .map((value) => {
            const resolvedLabel = labelResolver ? labelResolver(value) : value;

            return {
                value,
                label: resolvedLabel ?? '',
            };
        })
        .sort((a, b) =>
            (a.label || '').localeCompare(b.label || '')
        );
};