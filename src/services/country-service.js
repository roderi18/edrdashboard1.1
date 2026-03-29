export const getCountries = async () => {
    try {
        const res = await fetch('https://systexploradores.somee.com/api/Paises/GetListPaises');
        const data = await res.json();

        return data.map((c) => ({
            label: c.nombre,
            value: c.id,
        }));
    } catch (error) {
        console.error('Error cargando países:', error);
        return [];
    }
};