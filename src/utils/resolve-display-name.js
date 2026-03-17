export const resolveById = (list, id) =>
    list.find((item) => item.id === id)?.name || id;
