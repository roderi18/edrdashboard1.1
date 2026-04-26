import { getDivisions } from 'src/services/division-service';

const getDivisionIdByBirthdate = (birthDate, divisions) => {
    if (!birthDate) return null;

    const today = new Date();
    const [year, month, day] = birthDate.split('T')[0].split('-');
    const birth = new Date(Number(year), Number(month) - 1, Number(day));

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }

    const findByName = (keyword) =>
        divisions.find(d =>
            d.name.toLowerCase().trim().includes(keyword.toLowerCase())
        )?.id;

    if (age >= 5 && age <= 7) return findByName('navegantes');
    if (age >= 8 && age <= 10) return findByName('pioneros');
    if (age >= 11 && age <= 13) return findByName('seguidores');
    if (age >= 14 && age <= 17) return findByName('exploradores');
    if (age >= 18) return findByName('liderazgo');

    return null;
};

export async function POST(req) {
    try {
        const body = await req.json();
        const divisions = await getDivisions();
        let divisionId = getDivisionIdByBirthdate(body.fechaNacimiento, divisions);

        if (!divisionId) {
            console.log('⚠️ DIVISION NO ENCONTRADA, usando fallback');

            const fallback = divisions[0];
            divisionId = fallback ? Number(fallback.id) : null;
        }
        console.log('DIVISION DEBUG 👉', {
            fecha: body.fechaNacimiento,
            divisionId,
            divisions
        });
        const res = await fetch(
            'https://systexploradores.somee.com/api/Miembros/SetMiembros',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },

                body: JSON.stringify({
                    idMiembros: 0,
                    codigoMiembro: body.codigoMiembro,
                    nombres: body.nombres,
                    apellidos: body.apellidos,
                    genero: body.genero,
                    fechaNacimiento: body.fechaNacimiento,
                    idDestacamento: body.idDestacamento
                        ? Number(body.idDestacamento)
                        : null,
                    telefono: body.telefono,
                    direccion: body.direccion,
                    correo: body.correo,
                    idCargoLocal: body.idCargoLocal ?? null,
                    idCargoInstitucional: body.idCargoInstitucional ?? null,

                    idDivision: Number(divisionId) || 0,
                    instructorCertificadoCi: body.instructorCertificadoCi ?? null,
                    estatusVigenciaCi: body.estatusVigenciaCi ?? null,
                    fechaInicioCertificado: body.fechaInicioCertificado ?? null,
                    fechaFinCertificado: body.fechaFinCertificado ?? null,
                    estatusMiembro: body.estatusMiembro ?? 'activo',
                })
            }
        );

        const text = await res.text();
        console.log('STATUS SOMEE 👉', res.status);
        console.log('RAW SOMEE 👉', text);

        return new Response(text, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return Response.json(
            { error: 'Error creando miembro' },
            { status: 500 }
        );
    }
}
