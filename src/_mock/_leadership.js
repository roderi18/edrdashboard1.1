// ----------------------------------------------------------------------

export const _leadershipLevels = [
    { value: 'dest', label: 'Destacamento' },
    { value: 'sectional', label: 'Seccional' },
    { value: 'regional', label: 'Regional' },
    { value: 'national', label: 'Nacional' },
];

// ----------------------------------------------------------------------

export const _leadershipRolesByLevel = {
    dest: [
        {
            value: 'coordinador_dest',
            label: 'Coord. Destacamento',
            structure: 'directiva_local',
            leadershipType: 'adult',
        },
        {
            value: 'coordinador_asist_dest',
            label: 'Coord. As. Destacamento',
            structure: 'directiva_local',
            leadershipType: 'adult',
        },
        {
            value: 'subcoordinador_dest',
            label: 'Subcoord. Destacamento',
            structure: 'directiva_local',
            leadershipType: 'adult',
        },
        {
            value: 'capellan_dest',
            label: 'Capellán',
            structure: 'directiva_local',
            leadershipType: 'adult',
        },

        // Liderazgo juvenil
        {
            value: 'lider_grupo_exploradores',
            label: 'Líder de Grupo Exploradores',
            structure: 'liderazgo_juvenil',
            leadershipType: 'youth',
        },
        {
            value: 'guia_patrulla',
            label: 'Guía de patrulla',
            structure: 'liderazgo_juvenil',
            leadershipType: 'youth',
        },
        {
            value: 'guia_mayor',
            label: 'Guía Mayor',
            structure: 'liderazgo_juvenil',
            leadershipType: 'youth',
        },
    ],

    sectional: [
        {
            value: 'director_sectional',
            label: 'Director Seccional',
            structure: 'directivas_seccionales',
        },
        {
            value: 'subdirector_sectional',
            label: 'Subdirector Seccional',
            structure: 'directivas_seccionales',
        },
        {
            value: 'secretario_sectional',
            label: 'Secretario Seccional',
            structure: 'directivas_seccionales',
        },
        {
            value: 'tesorero_sectional',
            label: 'Tesorero Seccional',
            structure: 'directivas_seccionales',
        },
        {
            value: 'vocal_sectional',
            label: 'Vocal Seccional',
            structure: 'directivas_seccionales',
        },
    ],

    regional: [
        {
            value: 'director_regional',
            label: 'Director Regional',
            structure: 'directivas_regionales',
        },
        {
            value: 'subdirector_regional',
            label: 'Subdirector Regional',
            structure: 'directivas_regionales',
        },
        {
            value: 'secretario_regional',
            label: 'Secretario Regional',
            structure: 'directivas_regionales',
        },
        {
            value: 'tesorero_regional',
            label: 'Tesorero Regional',
            structure: 'directivas_regionales',
        },
    ],

    national: [
        // -----------------------------
        // CONSEJO EJECUTIVO
        // -----------------------------
        {
            value: 'director_nacional',
            label: 'Director Nacional',
            structure: 'consejo_ejecutivo',
        },
        {
            value: 'subdirector_nacional',
            label: 'Subdirector Nacional',
            structure: 'consejo_ejecutivo',
        },
        {
            value: 'tesorero_ejecutivo',
            label: 'Tesorero Ejecutivo',
            structure: 'consejo_ejecutivo',
        },
        {
            value: 'capellan_nacional',
            label: 'Capellán Nacional',
            structure: 'consejo_ejecutivo',
        },
        {
            value: 'coordinador_nacional_adiestramiento',
            label: 'Coordinador Nacional de Adiestramiento',
            structure: 'consejo_ejecutivo',
        },

        // -----------------------------
        // MINISTERIOS INFANTILES
        // -----------------------------
        {
            value: 'director_ministerios_infantiles',
            label: 'Director Ministerios Infantiles',
            structure: 'ministerios_infantiles',
        },

        // -----------------------------
        // OFICIALES ESPECIALES NACIONALES
        // -----------------------------
        {
            value: 'oficial_especial_nacional',
            label: 'Oficial Especial Nacional',
            structure: 'oficiales_especiales_nacionales',
        },

        // -----------------------------
        // DIRECTIVAS
        // -----------------------------

        //Directiva Regional
        {
            value: 'director_regional_directiva',
            label: 'Director Regional',
            structure: 'directivas_regionales',
        },
        {
            value: 'capellan_regional_directiva',
            label: 'Capellán Regional',
            structure: 'directivas_regionales',
        },
        {
            value: 'subdirector_regional_directiva',
            label: 'Subdirector Regional',
            structure: 'directivas_regionales',
        },
        {
            value: 'coordinador_adiestramiento_regional',
            label: 'Coord. Adiestramiento Reg.',
            structure: 'directivas_regionales',
        },
        {
            value: 'coordinador_produccion_regional',
            label: 'Coord. Producción Reg.',
            structure: 'directivas_regionales',
        },
        {
            value: 'coordinador_promocion_regional',
            label: 'Coord. Promoción Reg.',
            structure: 'directivas_regionales',
        },
        {
            value: 'coordinador_programa_regional',
            label: 'Coord. Programa Reg.',
            structure: 'directivas_regionales',
        },
        {
            value: 'secretario_regional_directiva',
            label: 'Secretario Regional',
            structure: 'directivas_regionales',
        },
        {
            value: 'directiva_seccional',
            label: 'Directiva Seccional',
            structure: 'directivas_seccionales',
        },
        {
            value: 'directiva_zonal',
            label: 'Directiva Zonal',
            structure: 'directivas_zonales',
        },
        {
            value: 'directiva_local',
            label: 'Directiva Local',
            structure: 'directiva_local',
        },
    ],
};

// ----------------------------------------------------------------------

export const _allLeadershipRoles = [
    ..._leadershipRolesByLevel.dest,
    ..._leadershipRolesByLevel.sectional,
    ..._leadershipRolesByLevel.regional,
    ..._leadershipRolesByLevel.national,
];