import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, fetchUpstreamText, invalidateUpstream } from 'src/utils/upstream-cache';

export async function GET() {
    try {
        const { text } = await fetchUpstreamText(
            UPSTREAM_KEYS.destacamentos,
            'https://systexploradores.somee.com/api/Destacamentos/GetAllDestacamentos'
        );

        if (!text || text.startsWith('<')) {
            return Response.json(
                { error: 'Respuesta inválida', raw: text },
                { status: 500 }
            );
        }

        const data = JSON.parse(text);

        return Response.json(normalizeApiResponse(data));
    } catch (error) {
        return Response.json(
            { error: 'Error obteniendo destacamentos' },
            { status: 500 }
        );
    }
}

const contarMiembrosDelDestacamento = async (id) => {
    try {
        const res = await fetch(
            `https://systexploradores.somee.com/api/Miembros/GetAllMiembroByDestacamento?id=${encodeURIComponent(id)}`,
            { cache: 'no-store', headers: { Accept: 'application/json' } }
        );

        if (!res.ok) return [];

        const json = await res.json();
        const filas = Array.isArray(json) ? json : (json?.data ?? json?.Data ?? []);

        return Array.isArray(filas) ? filas : [];
    } catch {
        // Si no se puede consultar, no se bloquea el borrado: que lo decida el
        // backend, como hasta ahora.
        return [];
    }
};

export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return Response.json({ error: 'id es requerido' }, { status: 400 });
        }

        // El backend borra el destacamento sin mirar quien depende de el: si
        // todavia tiene miembros, la restriccion de la base de datos lo tumba y
        // la respuesta que llega es un 500 con el cuerpo vacio, que no explica
        // nada. Se comprueba antes para poder decir lo que pasa de verdad.
        const miembros = await contarMiembrosDelDestacamento(id);

        if (miembros.length) {
            const nombres = miembros
                .slice(0, 5)
                .map((miembro) => `${miembro?.nombres ?? ''} ${miembro?.apellidos ?? ''}`.trim())
                .filter(Boolean)
                .join(', ');
            const resto = miembros.length > 5 ? ` y ${miembros.length - 5} más` : '';

            const detalle =
                miembros.length === 1
                    ? `Todavía tiene 1 miembro: ${nombres}.`
                    : `Todavía tiene ${miembros.length} miembros: ${nombres}${resto}.`;

            return Response.json(
                {
                    error: `Para eliminar un destacamento, primero hay que mover sus miembros a otro destacamento. ${detalle}`,
                    miembros: miembros.length,
                },
                { status: 409 }
            );
        }

        const res = await fetch(
            `https://systexploradores.somee.com/api/Destacamentos/DeleteDestacamento?id=${encodeURIComponent(id)}`,
            {
                method: 'DELETE',
                headers: { Accept: 'application/json, text/plain, */*' },
            }
        );

        invalidateUpstream(UPSTREAM_KEYS.destacamentos);

        const text = await res.text();
        let data = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { raw: text };
        }

        if (!res.ok) {
            // Un 500 sin cuerpo es el servidor tropezando con algo que sigue
            // apuntando al destacamento. Ya se descartaron los miembros, asi que
            // se dice lo que se sabe en vez de soltar el codigo pelado.
            const detalle =
                res.status >= 500 && !text
                    ? 'El servidor rechazó la eliminación, probablemente porque otros registros siguen enlazados al destacamento.'
                    : 'Error eliminando destacamento';

            return Response.json({ error: detalle, status: res.status, data }, { status: res.status });
        }

        return Response.json(normalizeApiResponse(data ?? { success: true }));
    } catch (error) {
        return Response.json(
            { error: error?.message || 'Error eliminando destacamento' },
            { status: 500 }
        );
    }
}
