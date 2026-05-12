const createId = (name) =>
    name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .trim();

const SISTEMA_ASCENSO = createId('Sistema de Ascenso');
const ACADEMIA_MINISTERIAL = createId('Academia Ministerial');
const today = new Date().toLocaleDateString();
const EMPTY_DATE = null;

export const _awards = [
    // =============================
    // ROOT
    // =============================
    {
        id: SISTEMA_ASCENSO,
        name: 'Sistema de Ascenso',
        type: 'folder',
        parentId: null,

        target: 'Muchachos',
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: ACADEMIA_MINISTERIAL,
        name: 'Academia Ministerial',
        type: 'folder',
        parentId: null,

        target: 'Líderes',
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // SISTEMA DE ASCENSO
    // =============================

    {
        id: createId('Navegantes'),
        name: 'Navegantes',
        type: 'folder',
        parentId: SISTEMA_ASCENSO,

        target: 'NV',
        total: 0,
        completed: 0,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // NAVEGANTES
    // =============================
    {
        id: createId('Guía Semanal'),
        name: 'Guía Semanal',
        type: 'folder',
        parentId: createId('Navegantes'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    // =============================
    // GUÍA SEMANAL
    // =============================
    {
        id: createId('Senda de Bronce Navegantes'),
        name: 'Senda de Bronce',
        type: 'folder',
        parentId: createId('Guía Semanal'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Senda de Plata Navegantes'),
        name: 'Senda de Plata',
        type: 'folder',
        parentId: createId('Guía Semanal'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Senda de Oro Navegantes'),
        name: 'Senda de Oro',
        type: 'folder',
        parentId: createId('Guía Semanal'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // SENDA DE BRONCE - TRIMESTRES (NAVEGANTES)
    // =============================
    {
        id: createId('Trimestre 1 - Bronce Navegantes'),
        name: 'Trimestre 1',
        type: 'folder',
        parentId: createId('Senda de Bronce Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Trimestre 2 - Bronce Navegantes'),
        name: 'Trimestre 2',
        type: 'folder',
        parentId: createId('Senda de Bronce Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Trimestre 3 - Bronce Navegantes'),
        name: 'Trimestre 3',
        type: 'folder',
        parentId: createId('Senda de Bronce Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Trimestre 4 - Bronce Navegantes'),
        name: 'Trimestre 4',
        type: 'folder',
        parentId: createId('Senda de Bronce Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // SENDA DE PLATA - TRIMESTRES (NAVEGANTES)
    // =============================
    {
        id: createId('Trimestre 1 - Plata Navegantes'),
        name: 'Trimestre 1',
        type: 'folder',
        parentId: createId('Senda de Plata Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Trimestre 2 - Plata Navegantes'),
        name: 'Trimestre 2',
        type: 'folder',
        parentId: createId('Senda de Plata Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Trimestre 3 - Plata Navegantes'),
        name: 'Trimestre 3',
        type: 'folder',
        parentId: createId('Senda de Plata Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Trimestre 4 - Plata Navegantes'),
        name: 'Trimestre 4',
        type: 'folder',
        parentId: createId('Senda de Plata Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // SENDA DE ORO - TRIMESTRES (NAVEGANTES)
    // =============================
    {
        id: createId('Trimestre 1 - Oro Navegantes'),
        name: 'Trimestre 1',
        type: 'folder',
        parentId: createId('Senda de Oro Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Trimestre 2 - Oro Navegantes'),
        name: 'Trimestre 2',
        type: 'folder',
        parentId: createId('Senda de Oro Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Trimestre 3 - Oro Navegantes'),
        name: 'Trimestre 3',
        type: 'folder',
        parentId: createId('Senda de Oro Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Trimestre 4 - Oro Navegantes'),
        name: 'Trimestre 4',
        type: 'folder',
        parentId: createId('Senda de Oro Navegantes'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },


    // Trimestres
    // 📂 Trimestre 1 – Bronce
    {
        id: createId('Lección 1 - T1 Bronce'),
        name: 'Lección 1',
        type: 'pdf',
        parentId: createId('Trimestre 1 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 2 - T1 Bronce'),
        name: 'Lección 2',
        type: 'pdf',
        parentId: createId('Trimestre 1 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 3 - T1 Bronce'),
        name: 'Lección 3',
        type: 'pdf',
        parentId: createId('Trimestre 1 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 4 - T1 Bronce'),
        name: 'Lección 4',
        type: 'pdf',
        parentId: createId('Trimestre 1 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 5 - T1 Bronce'),
        name: 'Lección 5',
        type: 'pdf',
        parentId: createId('Trimestre 1 - Bronce Navegantes'),
        createdAt: new Date(),
    },

    // 📂 Trimestre 2 – Bronce
    {
        id: createId('Lección 1 - T2 Bronce'),
        name: 'Lección 1',
        type: 'pdf',
        parentId: createId('Trimestre 2 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 2 - T2 Bronce'),
        name: 'Lección 2',
        type: 'pdf',
        parentId: createId('Trimestre 2 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 3 - T2 Bronce'),
        name: 'Lección 3',
        type: 'pdf',
        parentId: createId('Trimestre 2 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 4 - T2 Bronce'),
        name: 'Lección 4',
        type: 'pdf',
        parentId: createId('Trimestre 2 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 5 - T2 Bronce'),
        name: 'Lección 5',
        type: 'pdf',
        parentId: createId('Trimestre 2 - Bronce Navegantes'),
        createdAt: new Date(),
    },


    // 📂 Trimestre 3 – Bronce
    {
        id: createId('Lección 1 - T3 Bronce'),
        name: 'Lección 1',
        type: 'pdf',
        parentId: createId('Trimestre 3 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 2 - T3 Bronce'),
        name: 'Lección 2',
        type: 'pdf',
        parentId: createId('Trimestre 3 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 3 - T3 Bronce'),
        name: 'Lección 3',
        type: 'pdf',
        parentId: createId('Trimestre 3 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 4 - T3 Bronce'),
        name: 'Lección 4',
        type: 'pdf',
        parentId: createId('Trimestre 3 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 5 - T3 Bronce'),
        name: 'Lección 5',
        type: 'pdf',
        parentId: createId('Trimestre 3 - Bronce Navegantes'),
        createdAt: new Date(),
    },


    // 📂 Trimestre 4 – Bronce
    {
        id: createId('Lección 1 - T4 Bronce'),
        name: 'Lección 1',
        type: 'pdf',
        parentId: createId('Trimestre 4 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 2 - T4 Bronce'),
        name: 'Lección 2',
        type: 'pdf',
        parentId: createId('Trimestre 4 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 3 - T4 Bronce'),
        name: 'Lección 3',
        type: 'pdf',
        parentId: createId('Trimestre 4 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 4 - T4 Bronce'),
        name: 'Lección 4',
        type: 'pdf',
        parentId: createId('Trimestre 4 - Bronce Navegantes'),
        createdAt: new Date(),
    },
    {
        id: createId('Lección 5 - T4 Bronce'),
        name: 'Lección 5',
        type: 'pdf',
        parentId: createId('Trimestre 4 - Bronce Navegantes'),
        createdAt: new Date(),
    },

    // Pioneros
    {
        id: createId('Pioneros'),
        name: 'Pioneros',
        type: 'folder',
        parentId: SISTEMA_ASCENSO,

        target: 'PN',
        total: 0,
        completed: 0,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // PIONEROS
    // =============================
    {
        id: createId('Premios de Destreza - Azul'),
        name: 'Premios de Destreza - Azul',
        type: 'folder',
        parentId: createId('Pioneros'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premios de Liderazgo - Rojo'),
        name: 'Premios de Liderazgo - Rojo',
        type: 'folder',
        parentId: createId('Pioneros'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premios Biblicos - Naranja'),
        name: 'Premios Bíblicos - Naranja',
        type: 'folder',
        parentId: createId('Pioneros'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premios Requeridos Pioneros'),
        name: 'Premios Requeridos',
        type: 'folder',
        parentId: createId('Pioneros'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // PREMIOS BÍBLICOS - NARANJA (PDF)
    // =============================
    {
        id: createId('1 Crónicas'),
        name: '1 Crónicas',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Naranja'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('1 Reyes'),
        name: '1 Reyes',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Naranja'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('1 Samuel'),
        name: '1 Samuel',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Naranja'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('2 Crónicas'),
        name: '2 Crónicas',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Naranja'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('2 Reyes'),
        name: '2 Reyes',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Naranja'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('2 Samuel'),
        name: '2 Samuel',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Naranja'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Hechos'),
        name: 'Hechos',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Naranja'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Daniel'),
        name: 'Daniel',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Naranja'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Deuteronomio'),
        name: 'Deuteronomio',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Naranja'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // PREMIOS REQUERIDOS PIONEROS (PDF)
    // =============================
    {
        id: createId('Premio de la Biblia'),
        name: 'Premio de la Biblia',
        type: 'pdf',
        parentId: createId('Premios Requeridos Pioneros'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Primeros Auxilios'),
        name: 'Primeros Auxilios',
        type: 'pdf',
        parentId: createId('Premios Requeridos Pioneros'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Misiones Mundiales'),
        name: 'Misiones Mundiales',
        type: 'pdf',
        parentId: createId('Premios Requeridos Pioneros'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // PREMIOS DE DESTREZA - AZUL (PDF)
    // =============================
    {
        id: createId('Ajedrez'),
        name: 'Ajedrez',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Amarres'),
        name: 'Amarres',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Aplicando la Ley'),
        name: 'Aplicando la Ley',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Artes'),
        name: 'Artes',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Astronomía'),
        name: 'Astronomía',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Brújula'),
        name: 'Brújula',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Cestería'),
        name: 'Cestería',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Ciudadanos Mayores'),
        name: 'Ciudadanos Mayores',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Clima'),
        name: 'Clima',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Cocinando'),
        name: 'Cocinando',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Colecciones'),
        name: 'Colecciones',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Conociendo la Discapacidad'),
        name: 'Conociendo la Discapacidad',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Cohetes'),
        name: 'Cohetes',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Cuidado del Perro'),
        name: 'Cuidado del Perro',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Dardos'),
        name: 'Dardos',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Azul'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // PREMIOS DE LIDERAZGO - ROJO (PDF)
    // =============================
    {
        id: createId('Premio de Liderazgo 101'),
        name: 'Premio de Liderazgo 101',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Rojo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premio de Liderazgo 102'),
        name: 'Premio de Liderazgo 102',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Rojo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premio de Liderazgo 103'),
        name: 'Premio de Liderazgo 103',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Rojo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premio de Liderazgo 104'),
        name: 'Premio de Liderazgo 104',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Rojo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premio de Liderazgo 105'),
        name: 'Premio de Liderazgo 105',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Rojo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premio de Liderazgo 106'),
        name: 'Premio de Liderazgo 106',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Rojo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // Seguidores
    {
        id: createId('Seguidores'),
        name: 'Seguidores',
        type: 'folder',
        parentId: SISTEMA_ASCENSO,

        target: 'SG',
        total: 0,
        completed: 0,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // SEGUIDORES
    // =============================
    {
        id: createId('Premios de Destreza - Verde'),
        name: 'Premios de Destreza - Verde',
        type: 'folder',
        parentId: createId('Seguidores'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premios de Liderazgo - Amarillo'),
        name: 'Premios de Liderazgo - Amarillo',
        type: 'folder',
        parentId: createId('Seguidores'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premios Biblicos - Café'),
        name: 'Premios Bíblicos - Café',
        type: 'folder',
        parentId: createId('Seguidores'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premios Requeridos Seguidores'),
        name: 'Premios Requeridos',
        type: 'folder',
        parentId: createId('Seguidores'),

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },


    // =============================
    // PREMIOS DE LIDERAZGO - AMARILLO (PDF)
    // =============================
    {
        id: createId('Premio de Liderazgo 201'),
        name: 'Premio de Liderazgo 201',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Amarillo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premio de Liderazgo 202'),
        name: 'Premio de Liderazgo 202',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Amarillo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premio de Liderazgo 203'),
        name: 'Premio de Liderazgo 203',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Amarillo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premio de Liderazgo 204'),
        name: 'Premio de Liderazgo 204',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Amarillo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premio de Liderazgo 205'),
        name: 'Premio de Liderazgo 205',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Amarillo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Premio de Liderazgo 206'),
        name: 'Premio de Liderazgo 206',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Amarillo'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // PREMIOS DE DESTREZA - VERDE (PDF)
    // =============================
    {
        id: createId('Académicos'),
        name: 'Académicos',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Alfarería'),
        name: 'Alfarería',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Arquería'),
        name: 'Arquería',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Aviación'),
        name: 'Aviación',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Baloncesto'),
        name: 'Baloncesto',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Béisbol'),
        name: 'Béisbol',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Botánica'),
        name: 'Botánica',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Caminatas'),
        name: 'Caminatas',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Campismo'),
        name: 'Campismo',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Canoa'),
        name: 'Canoa',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Carpintería'),
        name: 'Carpintería',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Ciclismo'),
        name: 'Ciclismo',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Verde'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // PREMIOS BÍBLICOS - CAFÉ (SEGUIDORES) (PDF)
    // =============================
    {
        id: createId('1 Corintios'),
        name: '1 Corintios',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Café'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('1 Pedro'),
        name: '1 Pedro',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Café'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('1 Tesalonicenses'),
        name: '1 Tesalonicenses',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Café'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('2 Corintios'),
        name: '2 Corintios',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Café'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('2 Pedro'),
        name: '2 Pedro',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Café'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('2 Tesalonicenses'),
        name: '2 Tesalonicenses',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Café'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('1 Juan'),
        name: '1 Juan',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Café'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('1 Timoteo'),
        name: '1 Timoteo',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Café'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Colosenses'),
        name: 'Colosenses',
        type: 'pdf',
        parentId: createId('Premios Bíblicos - Café'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // PREMIOS REQUERIDOS SEGUIDORES (PDF)
    // =============================
    {
        id: createId('Biblia'),
        name: 'Biblia',
        type: 'pdf',
        parentId: createId('Premios Requeridos Seguidores'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Misiones Mundiales'),
        name: 'Misiones Mundiales',
        type: 'pdf',
        parentId: createId('Premios Requeridos Seguidores'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Preparación Física'),
        name: 'Preparación Física',
        type: 'pdf',
        parentId: createId('Premios Requeridos Seguidores'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },


    // Exploradores

    {
        id: createId('Exploradores'),
        name: 'Exploradores',
        type: 'folder',
        parentId: SISTEMA_ASCENSO,

        target: 'EX',
        total: 0,
        completed: 0,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // EXPLORADORES
    // =============================
    {
        id: createId('Premios de Destreza - Plata'),
        name: 'Premios de Destreza - Plata',
        type: 'folder',
        parentId: createId('Exploradores'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // PREMIOS DE DESTREZA - PLATA
    // =============================
    {
        id: createId('Arquitectura'),
        name: 'Arquitectura',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Plata'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Arquitectura paisajística'),
        name: 'Arquitectura paisajística',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Plata'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Artes gráficas'),
        name: 'Artes gráficas',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Plata'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    {
        id: createId('Atletismo en pista'),
        name: 'Atletismo en pista',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Plata'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Botes de motor'),
        name: 'Botes de motor',
        type: 'pdf',
        parentId: createId('Premios de Destreza - Plata'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },


    // Premios de Liderazgo
    {
        id: createId('Premios de Liderazgo - Celeste'),
        name: 'Premios de Liderazgo - Celeste',
        type: 'folder',
        parentId: createId('Exploradores'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // PREMIOS DE LIDERAZGO - CELESTE (PDF)
    // =============================
    {
        id: createId('Liderazgo 301'),
        name: 'Liderazgo 301',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Celeste'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Liderazgo 302'),
        name: 'Liderazgo 302',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Celeste'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Liderazgo 303'),
        name: 'Liderazgo 303',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Celeste'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Liderazgo 304'),
        name: 'Liderazgo 304',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Celeste'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Liderazgo 305'),
        name: 'Liderazgo 305',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Celeste'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Liderazgo 306'),
        name: 'Liderazgo 306',
        type: 'pdf',
        parentId: createId('Premios de Liderazgo - Celeste'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },



    // Retos espirituales
    {
        id: createId('Retos Espirituales'),
        name: 'Retos Espirituales',
        type: 'folder',
        parentId: createId('Exploradores'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // RETOS ESPIRITUALES (PDF)
    // =============================
    {
        id: createId('1 La Biblia es única'),
        name: '1 La Biblia es única',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('2 Libro indestructible'),
        name: '2 Libro indestructible',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('3 Libro unificado'),
        name: '3 Libro unificado',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('4 Dos libros en Uno'),
        name: '4 Dos libros en Uno',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('5 Transmitida y confiable'),
        name: '5 Transmitida y confiable',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('6 El plan de Dios'),
        name: '6 El plan de Dios',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('7 Instrumento espiritual'),
        name: '7 Instrumento espiritual',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('8 Libro con respuestas'),
        name: '8 Libro con respuestas',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('9 Guía para la vida'),
        name: '9 Guía para la vida',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('10 Amor por la Biblia'),
        name: '10 Amor por la Biblia',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('11 Mandamientos en el corazón'),
        name: '11 Mandamientos en el corazón',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('12 Palabras de consuelo'),
        name: '12 Palabras de consuelo',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('13 Promesa de vida'),
        name: '13 Promesa de vida',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('14 Tomando decisiones'),
        name: '14 Tomando decisiones',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('15 Vida eterna'),
        name: '15 Vida eterna',
        type: 'pdf',
        parentId: createId('Retos Espirituales'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    //Premios requeridos
    {
        id: createId('Premios Requeridos Exploradores'),
        name: 'Premios Requeridos',
        type: 'folder',
        parentId: createId('Exploradores'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        updatedAt: null,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },


    // =============================
    // PREMIOS REQUERIDOS (PDF)
    // =============================
    {
        id: createId('Ciudadanía'),
        name: 'Ciudadanía',
        type: 'pdf',
        parentId: createId('Premios Requeridos Exploradores'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Presupuesto y Finanzas'),
        name: 'Presupuesto y Finanzas',
        type: 'pdf',
        parentId: createId('Premios Requeridos Exploradores'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Verdades Fundamentales'),
        name: 'Verdades Fundamentales',
        type: 'pdf',
        parentId: createId('Premios Requeridos Exploradores'),
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    {
        id: createId('Manual del Muchacho'),
        name: 'Manual del Muchacho',
        type: 'pdf',
        parentId: createId('Exploradores'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },


    // =============================
    // ACADEMIA MINISTERIAL
    // =============================
    {
        id: createId('Lider Juvenil'),
        name: 'Líder Juvenil',
        type: 'folder',
        parentId: ACADEMIA_MINISTERIAL,

        required: 'Sí',
        total: 0,
        completed: 0,
        updatedAt: null,

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // Lider de Destacamento
    {
        id: createId('Lider de Destacamento'),
        name: 'Líder de Destacamento',
        type: 'folder',
        parentId: ACADEMIA_MINISTERIAL,

        required: 'Sí',
        total: 0,
        completed: 0,
        updatedAt: null,

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },



    // =============================
    // LÍDER DESTACAMENTO (PDF)
    // =============================
    {
        id: createId('Fundamentos'),
        name: 'Fundamentos',
        type: 'pdf',
        parentId: createId('Lider de Destacamento'),
        createdAt: new Date(),
    },
    {
        id: createId('Mentores'),
        name: 'Mentores',
        type: 'pdf',
        parentId: createId('Lider de Destacamento'),
        createdAt: new Date(),
    },
    {
        id: createId('Seguridad y Primeros Auxilios'),
        name: 'Seguridad y Primeros Auxilios',
        type: 'pdf',
        parentId: createId('Lider de Destacamento'),
        createdAt: new Date(),
    },
    {
        id: createId('Campamento de Barras Doradas'),
        name: 'Campamento de Barras Doradas',
        type: 'pdf',
        parentId: createId('Lider Juvenil'),
        createdAt: new Date(),
    },
    {
        id: createId('Destacamento de Clase Mundial'),
        name: 'Destacamento de Clase Mundial',
        type: 'pdf',
        parentId: createId('Lider de Destacamento'),
        createdAt: new Date(),
    },
    {
        id: createId('Campamento Nacional Ministerial'),
        name: 'Campamento Nacional Ministerial',
        type: 'pdf',
        parentId: createId('Lider de Destacamento'),
        createdAt: new Date(),
    },
    {
        id: createId('Cuadro Avanzado'),
        name: 'Cuadro Avanzado',
        type: 'pdf',
        parentId: createId('Lider de Destacamento'),
        createdAt: new Date(),
    },




    // Líder Organizacional
    {
        id: createId('Lider Organizacional'),
        name: 'Líder Organizacional',
        type: 'folder',
        parentId: ACADEMIA_MINISTERIAL,

        required: 'Sí',
        total: 0,
        completed: 0,
        updatedAt: null,

        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },


    {
        id: createId('Instructor'),
        name: 'Instructor',
        type: 'folder',
        parentId: ACADEMIA_MINISTERIAL,

        required: 'Sí',
        total: 0,
        completed: 0,
        updatedAt: null,

        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

    // =============================
    // INSTRUCTOR
    // =============================
    {
        id: createId('Academia de Jefes'),
        name: 'Academia de Jefes',
        type: 'pdf',
        parentId: createId('Instructor'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Academia Nacional'),
        name: 'Academia Nacional',
        type: 'pdf',
        parentId: createId('Instructor'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Academia Avanzada'),
        name: 'Academia Avanzada',
        type: 'pdf',
        parentId: createId('Instructor'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },
    {
        id: createId('Instructor de Academia'),
        name: 'Instructor de Academia',
        type: 'pdf',
        parentId: createId('Instructor'),
        size: 0,
        totalFiles: 0,
        shared: [],
        isFavorited: false,
        createdAt: new Date(),
        modifiedAt: null,
        tags: [],
    },

];
