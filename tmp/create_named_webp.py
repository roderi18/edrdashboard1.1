from pathlib import Path
from io import BytesIO
import re
import shutil
import unicodedata

from PIL import Image


ROOT = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\public\sistemaAscenso")
SOURCE = ROOT
OUTPUT = ROOT / "webp-Named"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".gif", ".webp"}
MAX_BYTES = 15_000


def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return value


def image_files(folder: Path, recursive: bool = False) -> list[Path]:
    iterator = folder.rglob("*") if recursive else folder.glob("*")
    return sorted(
        path for path in iterator
        if path.is_file()
        and path.suffix.lower() in IMAGE_EXTENSIONS
        and "vista-previa" not in path.stem.lower()
        and "webp-named" not in {part.lower() for part in path.parts}
    )


def convert(source: Path, destination: Path) -> None:
    with Image.open(source) as opened:
        original = opened.convert("RGBA")
    original.thumbnail((192, 192), Image.Resampling.LANCZOS)
    for maximum in (192, 176, 160, 144, 128, 112, 96, 80, 64):
        image = original.copy()
        image.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
        for quality in (85, 82, 78, 74, 70, 66, 62, 58, 54, 50, 45, 40, 35, 30):
            stream = BytesIO()
            image.save(stream, "WEBP", quality=quality, method=6, exact=True)
            payload = stream.getvalue()
            if len(payload) <= MAX_BYTES:
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(payload)
                return
    raise RuntimeError(f"Could not compress below 15 KB: {source}")


BLUE = [
    "Artes", "Astronomía", "Lenguaje de señas básico", "Cestería", "Lectura de la Biblia", "Estudio de las aves", "Ajedrez",
    "Iglesia", "Colecciones", "Brújula", "Cocinando", "Dardos", "Conociendo la discapacidad", "Cuidado del perro",
    "Vida en familia", "Huella digital", "Fogata", "Pesca", "Pasatiempo", "Patinaje sobre hielo", "Patinaje en línea",
    "Estudio de los insectos", "Amarres", "Aplicando la ley", "Modelos y diseños", "Música", "Líderes nacionales", "Pintura",
    "Mascotas", "Trenes", "Lectura", "Cohetes", "Patinaje sobre ruedas", "Nudos y cuerdas", "Remo",
    "Seguridad", "Escultura", "Ciudadanos mayores", "Herramientas", "Clima", "La fauna",
]

GREEN = [
    "Académicos", "Conociendo la discapacidad avanzado", "Natación avanzada", "Radio aficionado", "Arquería", "Aviación", "Soltero", "Excursiones", "Béisbol",
    "Baloncesto", "Lectura de la Biblia", "Corneta", "Campismo", "Seguridad en el campamento", "Canoas", "Carpintería", "Misiones cristianas", "Servicio cristiano",
    "Historia de la iglesia", "Comunicaciones", "Computadoras", "Prevención del crimen", "Ciclismo", "Cocinando en ollas holandesas", "Preparación de las emergencias", "Energía", "Ciencias ambientales",
    "Historia de la familia", "Seguridad en caso de incendio", "Primeros auxilios RCP", "Fútbol", "Silvicultura", "Jardinería", "Caminatas", "Reparación en el hogar", "Seguridad en el hogar",
    "Equitación", "Servicio internacional", "Manualidades en cuero", "Salvavidas", "Estudio de la naturaleza", "Orientación con la brújula", "Fotografía", "Pionerismo", "Botánica",
    "Alfarería", "Refugios primitivos", "Trampas primitivas", "Public speaking", "Titiritero", "Estudio de los reptiles", "El arte de vender", "Patineta", "Deportes",
    "Filatelia", "Natación", "Tenis", "Transporte de vehículos pesados", "Tallado en madera", "Lucha libre",
]

PLATINUM_COLUMNS = [
    ["Arquería avanzada", "Carreras de aviación", "Dibujantes", "Navegación aérea", "Artes gráficas", "Mamíferos", "Plomería", "Buceo sin tanque de oxígeno", "Esquí acuático"],
    ["Excursionismo avanzado", "Historia de la aviación", "Economía", "Fisiología del vuelo", "Curtidos de cuero", "Albañilería", "Salud pública", "Tabla sobre nieve", "Peso y balance"],
    ["Control de tránsito aéreo", "Fundamentos meteorológicos para la aviación", "Electricidad", "Plan de vuelo", "Misiones domésticas - construcción", "Medicina", "Rappelling", "Conservación del suelo y agua", "Rafting"],
    ["Sistema del avión", "Aerodinámica básica", "Electrónica", "Preparación del vuelo", "Educación para la caza sin riesgo", "Metalurgia", "Escalada en roca", "Ciencia solar", "Sobrevivencia en la selva"],
    ["Rendimiento del avión", "Lectura de la Biblia", "Ingeniería", "Entrenamiento del piloto", "Introducción a la aviación", "Botes de motor", "Aeronaves con alas rotatorias", "Topografía", "Campamento de invierno"],
    ["Cría de animales", "Navegando en bote", "Administración de granjas y haciendas", "Pesca con mosca", "Periodismo", "Ciclismo de montaña", "Navegando", "Atletismo en pista", "Trabajo en madera"],
    ["Arquitectura", "Química", "Mecánica agrícola", "Idioma extranjero", "Navegando en kayak", "Vuelo sobre montañas", "Buceo con tanque de oxígeno", "Seguridad en el tráfico", "Misiones mundiales"],
    ["Energía atómica", "Cinematografía", "Reglamento del aire 1 OACI", "Geología", "Arquitectura paisajística", "Oceanografía", "Lenguaje de señas", "Medicina veterinaria", "Misiones mundiales - construcción"],
    ["Mecánica automotriz", "Odontología", "Reglamento del aire 2 OACI", "Golf", "Derecho", "Dramas y ceremonias", "Esquiando", "Instructor de seguridad en el agua", "Misiones juveniles"],
]
PLATINUM = [PLATINUM_COLUMNS[column][row] for row in range(9) for column in range(9)]


MAPPINGS = {
    "pioneros/premios-de-liderazgo-rojo": [f"Premio de liderazgo rojo {n}" for n in range(101, 107)],
    "pioneros/premios-de-destreza-azul-requeridos": ["Biblia", "Primeros auxilios", "Misiones mundiales"],
    "pioneros/premios-de-destreza-azul": BLUE,
    "pioneros/premios-biblicos-naranja": [f"Premio bíblico naranja {n:02d}" for n in range(1, 16)],
    "seguidores-de-la-senda/premios-de-liderazgo-amarillo": [f"Premio de liderazgo amarillo {n}" for n in range(201, 207)],
    "seguidores-de-la-senda/premios-de-destreza-verde-requeridos": ["Biblia", "Misiones mundiales", "Preparación física"],
    "seguidores-de-la-senda/premios-de-destreza-verde": GREEN,
    "seguidores-de-la-senda/premios-biblicos-cafe": [f"Premio bíblico café {n:02d}" for n in range(1, 16)],
    "exploradores/premios-de-liderazgo-celeste": [f"Premio de liderazgo celeste {n}" for n in range(301, 307)],
    "exploradores/premios-de-destreza-platino-requeridos": ["Presupuesto y finanzas", "Ciudadanía", "Verdades fundamentales"],
    "exploradores/premios-de-destreza-platino": PLATINUM,
    "exploradores/premios-biblicos-de-reto-espiritual": [f"Premio bíblico de reto espiritual {name}" for name in ["azul", "rojo", "verde", "bronce", "plata", "oro"]],
}


def copy_numbered(folder_name: str, names: list[str]) -> int:
    source_folder = SOURCE / folder_name
    files = image_files(source_folder)
    if len(files) != len(names):
        raise RuntimeError(f"{folder_name}: expected {len(names)} images, found {len(files)}")
    destination_folder = OUTPUT / folder_name
    destination_folder.mkdir(parents=True, exist_ok=True)
    for source, name in zip(files, names):
        convert(source, destination_folder / f"{slug(name)}.webp")
    return len(files)


def copy_named_tree(relative_folder: str) -> int:
    source_folder = SOURCE / relative_folder
    count = 0
    for source in image_files(source_folder, recursive=True):
        destination = (OUTPUT / source.relative_to(SOURCE)).with_suffix(".webp")
        destination.parent.mkdir(parents=True, exist_ok=True)
        convert(source, destination)
        count += 1
    return count


def rename_sendas(division: str) -> int:
    source_root = SOURCE / division / "sendas"
    count = 0
    for source in image_files(source_root, recursive=True):
        relative = source.relative_to(source_root)
        folder_slug = slug(relative.parent.name)
        level = slug(source.stem)
        destination = OUTPUT / division / "sendas" / relative.parent / f"{folder_slug}-{level}.webp"
        destination.parent.mkdir(parents=True, exist_ok=True)
        convert(source, destination)
        count += 1
    return count


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    total = 0

    # Navegantes recognition icons already carry their PDF names.
    total += copy_named_tree("navegantes/reconocimientoDeLogro")

    for folder, names in MAPPINGS.items():
        total += copy_numbered(folder, names)

    for division in ("navegantes", "pioneros", "seguidores-de-la-senda"):
        total += rename_sendas(division)

    explorer_sendas = SOURCE / "exploradores" / "sendas"
    explorer_output = OUTPUT / "exploradores" / "sendas"
    explorer_output.mkdir(parents=True, exist_ok=True)
    for index, source in enumerate(image_files(explorer_sendas), 1):
        convert(source, explorer_output / f"exploradores-e{index}.webp")
        total += 1

    print(f"named_files={total}")


if __name__ == "__main__":
    main()
