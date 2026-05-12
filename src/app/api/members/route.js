import { normalizeApiResponse } from 'src/utils/normalize-api-response';

export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Miembros/GetAllMiembros'
        );

        const data = await res.json();

        return Response.json(normalizeApiResponse(data));
    } catch {
        return Response.json({ error: 'Error fetching members' }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return Response.json({ error: 'id es requerido' }, { status: 400 });
        }

        const res = await fetch(
            `https://systexploradores.somee.com/api/Miembros/DeleteMiembro?id=${encodeURIComponent(id)}`,
            {
                method: 'DELETE',
                headers: { Accept: 'application/json, text/plain, */*' },
            }
        );
        const text = await res.text();
        let data = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { raw: text };
        }

        if (!res.ok) {
            return Response.json(
                { error: 'Error eliminando miembro', status: res.status, data },
                { status: res.status }
            );
        }

        return Response.json(normalizeApiResponse(data ?? { success: true }));
    } catch (error) {
        return Response.json(
            { error: error?.message || 'Error eliminando miembro' },
            { status: 500 }
        );
    }
}
