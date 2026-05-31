let divisionsCachePromise = null;

export async function getDivisions() {
    if (divisionsCachePromise) {
        return divisionsCachePromise;
    }

    try {
        divisionsCachePromise = (async () => {
            const isServer = typeof window === 'undefined';

            const url = isServer
                ? 'https://systexploradores.somee.com/api/Divisiones/GetAllDivisiones'
                : '/api/divisions';

            const res = await fetch(url);

            const text = await res.text();

            let parsed;

            try {
                parsed = JSON.parse(text);
            } catch {
                return [];
            }

            const rows = parsed?.data || parsed?.Data || [];

            return rows.map((d) => ({
                id: d.idDivision,
                name: d.nombre,
            }));
        })();

        return await divisionsCachePromise;
    } catch (error) {
        divisionsCachePromise = null;
        return [];
    }
}
