export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Regiones/GetAllRegiones'
        );

        const data = await res.json();

        return Response.json(data);
    } catch (error) {
        return Response.json({ error: 'Error fetching regionals' }, { status: 500 });
    }
}