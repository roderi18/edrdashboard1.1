export const REGIONAL_DEFAULT = {
    id: '',
    regionId: '',
    name: '',
    countryId: '',
    createdAt: '',
    updatedAt: '',
    idCargoInstitucional: '',
};

export function createRegional(data) {
    return {
        ...REGIONAL_DEFAULT,

        id: data.id,
        regionId: data.regionId ?? '',

        name: data.name ?? '',
        countryId: data.countryId ?? '',

        createdAt: data.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),

        regionalXSectionalCount: 0,
        regionalXSectionalXDestCount: 0,
        regionalXSectionalMemberCount: 0,
    };
}