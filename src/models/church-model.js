export const CHURCH_DEFAULT = {
    id: '',

    name: '',
    pastor: '',
    address: '',

    provinceId: '',
    countryId: '',
    sectionId: '',

    createdAt: '',
    updatedAt: '',
};

export function createChurch(data) {
    return {
        ...CHURCH_DEFAULT,

        id: data.id,

        name: data.name ?? '',
        pastor: data.pastor ?? '',
        address: data.address ?? '',

        provinceId: data.provinceId ?? '',
        countryId: data.countryId ?? '',
        sectionId: data.sectionId ?? '',

        createdAt: data.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}