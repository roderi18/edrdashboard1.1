import { getDivisions } from 'src/services/division-service';

const getDivisionByBirthdate = (birthDate, divisions) => {
    if (!birthDate) return null;

    const today = new Date();
    const [year, month, day] = birthDate.split('T')[0].split('-');
    const birth = new Date(Number(year), Number(month) - 1, Number(day));

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }

    console.log('DEBUG EDAD 👉', {
        birthDate,
        parsedBirth: birth,
        today,
        age
    });

    const findByName = (keyword) =>
        divisions.find(d =>
            d.name.toLowerCase().includes(keyword.toLowerCase())
        );

    if (age >= 5 && age <= 7) return findByName('navegantes');
    if (age >= 8 && age <= 10) return findByName('pioneros');
    if (age >= 11 && age <= 13) return findByName('seguidores');
    if (age >= 14 && age <= 17) return findByName('exploradores');
    if (age >= 18) return findByName('liderazgo');

    return null;
};

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const birthdate = searchParams.get('birthdate');

        const divisions = await getDivisions();

        const division = getDivisionByBirthdate(birthdate, divisions);
        console.log('DIVISION CALCULADA 👉', division);

        return Response.json(division ?? { id: null, name: '' });

    } catch (error) {
        console.error('ERROR CALCULATE 👉', error);
        return Response.json({ id: null, name: '' });
    }
}