export async function getDivisions() {
    try {
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

        const rows = parsed?.Data || [];

        return rows.map((d) => ({
            id: d.idDivision,
            name: d.nombre,
        }));

    } catch (error) {
        return [];
    }
}