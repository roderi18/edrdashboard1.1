export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Miembros/GetAllMiembros'
        );

        const data = await res.json();

        return Response.json(data);
    } catch (error) {
        return Response.json({ error: 'Error fetching members' }, { status: 500 });
    }
}