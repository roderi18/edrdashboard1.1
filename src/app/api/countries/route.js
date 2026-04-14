import { countries as countriesISO } from 'src/assets/data/countries';

export async function GET() {
    try {
        const res = await fetch(
            'https://systexploradores.somee.com/api/Paises/GetListPaises',
            { cache: 'no-store' }
        );


        const data = await res.json();
        const list = data?.Data || [];

        const formatted = list.map((c) => {
            const match = countriesISO.find(
                (x) => x.label.toLowerCase() === c.nombre.toLowerCase()
            );

            return {
                id: c.idPais,
                label: c.nombre,
                code: match?.code || '',
            };
        });

        return Response.json(formatted);
    } catch (error) {
        console.error('ROUTE ERROR:', error);
        return Response.json([], { status: 500 });
    }
}