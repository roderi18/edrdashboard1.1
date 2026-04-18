export async function getDivisions() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Divisiones/GetAllDivisiones'
        );

        const text = await res.text();

        let parsed;

        try {
            parsed = JSON.parse(text);
        } catch {
            console.error('DIVISIONES NO JSON 👉', text);
            return [];
        }

        const rows = parsed?.Data || [];
        console.log('ROWS DIVISIONES 👉', rows);

        return rows.map((d) => ({
            id: d.idDivision,
            name: d.nombre,
        }));

    } catch (error) {
        console.error('Error cargando divisiones:', error);
        return [];
    }
}