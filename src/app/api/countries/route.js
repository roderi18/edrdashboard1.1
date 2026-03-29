export async function GET() {
    try {
        const res = await fetch('https://systexploradores.somee.com/api/Paises/GetListPaises');

        const data = await res.json();

        const list = data?.Data || [];

        const formatted = list.map((c) => ({
            label: c.nombre,
            value: c.idPais,
        }));

        return Response.json(formatted);
    } catch (error) {
        console.error('ROUTE ERROR:', error);
        return Response.json([], { status: 500 });
    }
}