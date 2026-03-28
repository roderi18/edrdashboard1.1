export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Secciones/GetAllSecciones'
        );

        const data = await res.json();

        return Response.json(data);
    } catch (error) {
        return Response.json({ error: 'Error fetching sectionals' }, { status: 500 });
    }
}