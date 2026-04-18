import { getDivisions } from 'src/services/division-service';

const getDivisionIdByBirthdate = (birthDate, divisions) => {
    if (!birthDate) return null;

    const today = new Date();
    const birth = new Date(birthDate);

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }

    if (age >= 5 && age <= 7) return divisions.find(d => d.name.includes('Navegantes'))?.id;
    if (age >= 8 && age <= 10) return divisions.find(d => d.name.includes('Pioneros'))?.id;
    if (age >= 11 && age <= 13) return divisions.find(d => d.name.includes('Seguidores'))?.id;
    if (age >= 14 && age <= 17) return divisions.find(d => d.name.includes('Exploradores'))?.id;
    if (age >= 18) return divisions.find(d => d.name.includes('Liderazgo'))?.id;

    return null;
};

export async function POST(req) {
    try {
        const body = await req.json();
        const divisions = await getDivisions();
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
                    idDivision: getDivisionIdByBirthdate(body.fechaNacimiento, divisions),
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