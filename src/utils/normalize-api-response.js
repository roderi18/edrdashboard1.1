export const normalizeApiResponse = (payload, fallbackData = []) => {
    if (Array.isArray(payload)) {
        return { data: payload };
    }

    if (!payload || typeof payload !== 'object') {
        return { data: fallbackData };
    }

    const normalizedData = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.Data)
            ? payload.Data
            : fallbackData;

    const { Data, data, ...rest } = payload;

    return {
        ...rest,
        data: normalizedData,
    };
};

