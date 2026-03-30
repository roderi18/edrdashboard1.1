export const getCountries = async () => {
    try {
        const res = await fetch('https://systexploradores.somee.com/api/Paises/GetListPaises');

        const text = await res.text();

        if (!text || text.startsWith('<')) return [];

        const data = JSON.parse(text);

        return (data.Data || data).map((c) => ({
            label: c.nombre,
            value: String(c.idPais || c.id),
        }));
    } catch (error) {
        console.error('Error cargando países:', error);
        return [];
    }
};