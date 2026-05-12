export function createAwardsActions({
    system,     // 'academia' | 'sistemaAscenso'
    memberId,
    context,    // { sectionId?, parentId, rowId }
}) {


    const statusKey = `awards-status-${memberId}`;
    if (
        !system ||
        !memberId ||
        !context?.rowId ||
        (system === 'sistemaAscenso' && !context?.sectionId)
    ) {
        return {
            setStatus: () => { },
            setCompletedDate: () => { },
            uploadCertificate: () => { },
            deleteCertificate: () => { },
            updateTimesCompleted: () => { },
        };
    }

    const dataKey = `awards-data-${memberId}`;

    const readStatus = () =>
        JSON.parse(localStorage.getItem(statusKey) || '{}');

    const readData = () =>
        JSON.parse(localStorage.getItem(dataKey) || '{}');

    const saveAll = (status, data) => {
        localStorage.setItem(statusKey, JSON.stringify(status));
        localStorage.setItem(dataKey, JSON.stringify(data));

        window.dispatchEvent(
            new CustomEvent('awards-status-changed', { detail: { memberId } })
        );
    };

    const ensurePath = (obj, path) => {
        let ref = obj;
        path.forEach((k) => {
            ref[k] ??= {};
            ref = ref[k];
        });
        return ref;
    };

    const setStatus = (nextStatus) => {
        const now = new Date().toISOString();
        const status = readStatus();
        const data = readData();

        if (system === 'academia') {
            const { parentId, rowId } = context;

            ensurePath(status, ['academia', parentId])[rowId] = nextStatus;

            const existing =
                data.academia?.[parentId]?.[rowId] || {};

            ensurePath(data, ['academia', parentId])[rowId] = {
                ...existing,
                status: nextStatus,
                updatedAt: now,

                ...(nextStatus === 'completado' && {
                    completedDate:
                        existing.completedDate || now,
                }),

                ...(nextStatus !== 'completado' && {
                    completedDate: null,
                }),
            };

            localStorage.setItem(statusKey, JSON.stringify(status));
            localStorage.setItem(dataKey, JSON.stringify(data));
        }

        if (system === 'sistemaAscenso') {
            const { sectionId, parentId, rowId } = context;

            ensurePath(status, ['sistemaAscenso', sectionId, parentId])[rowId] = nextStatus;


            ensurePath(data, ['sistemaAscenso', sectionId, parentId])[rowId] = {
                ...(data.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId] || {}),
                status: nextStatus,
                updatedAt: now,

                ...(nextStatus === 'completado' && {
                    completedDate:
                        data.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId]
                            ?.completedDate || new Date().toISOString(),
                    timesCompleted:
                        data.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId]
                            ?.timesCompleted || 1,
                }),

                ...(nextStatus !== 'completado' && {
                    timesCompleted: 0,
                    completedDate: null,
                }),
            };

            localStorage.setItem(statusKey, JSON.stringify(status));
            localStorage.setItem(dataKey, JSON.stringify(data));
        }

        window.dispatchEvent(new CustomEvent('awards-status-changed', { detail: { memberId } }));
    };

    const setCompletedDate = (isoDate) => {
        if (!isoDate) return;

        const status = readStatus();
        const data = readData();
        const now = new Date().toISOString();

        if (system === 'academia') {
            const { parentId, rowId } = context;

            ensurePath(status, ['academia', parentId])[rowId] = 'completado';

            ensurePath(data, ['academia', parentId])[rowId] = {
                ...(data.academia?.[parentId]?.[rowId] || {}),
                status: 'completado',
                completedDate: isoDate,
                updatedAt: now,
            };
        }

        if (system === 'sistemaAscenso') {
            const { sectionId, parentId, rowId } = context;

            ensurePath(status, ['sistemaAscenso', sectionId, parentId])[rowId] = 'completado';

            ensurePath(data, ['sistemaAscenso', sectionId, parentId])[rowId] = {
                ...(data.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId] || {}),
                status: 'completado',
                completedDate: isoDate,
                updatedAt: now,
            };
        }

        saveAll(status, data);
    };


    const uploadCertificate = (certificate) => {
        if (!certificate) return;
        setStatus('completado');

        const data = readData();
        const now = new Date().toISOString();

        if (system === 'academia') {
            const { parentId, rowId } = context;
            ensurePath(data, ['academia', parentId])[rowId].certificate =
                certificate;
            ensurePath(data, ['academia', parentId])[rowId].updatedAt = now;
        }

        if (system === 'sistemaAscenso') {
            const { sectionId, parentId, rowId } = context;
            ensurePath(data, ['sistemaAscenso', sectionId, parentId])[rowId] = {
                ...(data.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId] || {}),
                certificate,
                timesCompleted:
                    data.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId]
                        ?.timesCompleted || 1,
                completedDate:
                    data.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId]
                        ?.completedDate || new Date().toISOString(),
                updatedAt: now,
            };
        }

        saveAll(readStatus(), data);
    };

    const deleteCertificate = () => {
        const data = readData();
        const now = new Date().toISOString();

        if (system === 'academia') {
            const { parentId, rowId } = context;
            if (data.academia?.[parentId]?.[rowId]) {
                delete data.academia[parentId][rowId].certificate;
                data.academia[parentId][rowId].updatedAt = now;
            }
        }

        if (system === 'sistemaAscenso') {
            const { sectionId, parentId, rowId } = context;
            if (data.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId]) {
                delete data.sistemaAscenso[sectionId][parentId][rowId]
                    .certificate;
                data.sistemaAscenso[sectionId][parentId][rowId].updatedAt = now;
            }
        }

        saveAll(readStatus(), data);
    };

    const updateTimesCompleted = (value) => {
        if (system !== 'sistemaAscenso') return;

        const data = readData();
        const now = new Date().toISOString();
        const safe = Math.min(10, Math.max(0, value));
        const { sectionId, parentId, rowId } = context;

        ensurePath(data, ['sistemaAscenso', sectionId, parentId])[rowId] = {
            ...(data.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId] || {}),
            timesCompleted: safe,
            ...(safe > 0 && {
                completedDate:
                    data.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId]
                        ?.completedDate || new Date().toISOString(),
                status: 'completado',
            }),
            updatedAt: now,
        };

        const status = readStatus();
        ensurePath(status, ['sistemaAscenso', sectionId, parentId])[rowId] =
            safe > 0 ? 'completado' : 'no_iniciado';

        saveAll(status, data);

    };
    const requireCertificateDeletion = ({
        hasCertificate,
        nextStatus,
        onConfirm,
    }) => {
        if (!hasCertificate) {
            setStatus(nextStatus);
            return;
        }

        // Retornamos una función que el componente puede usar
        return () => {
            deleteCertificate();
            setStatus(nextStatus);
            onConfirm?.();
        };
    };

    return {
        setStatus,
        setCompletedDate,
        uploadCertificate,
        deleteCertificate,
        updateTimesCompleted,
        requireCertificateDeletion,
    };
}
