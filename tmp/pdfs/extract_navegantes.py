from collections import deque
from pathlib import Path
import re
import unicodedata

from PIL import Image, ImageDraw, ImageFont


SOURCE = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\tmp\pdfs\embedded\Im2.png")
OUTPUT = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\output\iconos-navegantes")

NAMES_BY_COLUMN = [
    ["Aventuras sobre ruedas", "Misiones generales", "Cuerpo limpio", "Manualidad", "El gobierno", "Guardián de la ley", "La escuela", "Atando nudos"],
    ["Día de campo", "Historia de la familia", "Banderas", "Visitando lugares", "Ayudar al líder", "Historia", "En el aire", "Seguridad"],
    ["Artes", "Defensor de la palabra", "Folclor", "Clamor de gozo", "Títeres", "Exploradores en la comunidad", "Cuerpo fuerte", "Qué hay en la tele"],
    ["Ser un amigo", "Ayudando a la iglesia", "Historia de la iglesia", "Hacedor de la palabra", "Dios está trabajando", "Evangelización", "Escuela dominical bíblica", "Contándole a otros sobre Jesús"],
    ["Juegos", "Ayudar a un vecino", "Mapa", "Naturaleza", "El arca de Noé", "De paseo", "Deportes", "Cuidando el mundo de Dios"],
    ["Ayudando a la comunidad", "Cocinando", "Bombero", "Ayudando en el hogar", "Ayudando en el manejo de dinero", "Ayudando a la patrulla", "Evento deportivo", "Trabajo en equipo"],
]
BOTTOM = ["Electivo del líder - comunidad", "Electivo del líder - hogar", "Electivo del líder - ministerio"]


def slug(text: str) -> str:
    value = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def trim_transparency(tile: Image.Image) -> Image.Image:
    rgba = tile.convert("RGBA")
    return rgba.crop(rgba.getbbox())


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    extracted: list[tuple[str, Image.Image]] = []

    x_centers = [128, 351, 575, 795, 1028, 1251]
    y_centers = [105, 361, 618, 875, 1133, 1390, 1647, 1904]
    for col, names in enumerate(NAMES_BY_COLUMN):
        for row, name in enumerate(names):
            cx, cy = x_centers[col], y_centers[row]
            tile = source.crop((cx - 85, cy - 90, cx + 85, cy + 90))
            icon = trim_transparency(tile)
            icon.save(OUTPUT / f"{row + 1:02d}-{col + 1:02d}-{slug(name)}.png", optimize=True)
            extracted.append((name, icon))

    bottom_centers = [(401, 2160), (686, 2160), (957, 2160)]
    for index, (name, (cx, cy)) in enumerate(zip(BOTTOM, bottom_centers), 1):
        tile = source.crop((cx - 85, cy - 90, cx + 85, cy + 90))
        icon = trim_transparency(tile)
        icon.save(OUTPUT / f"09-{index:02d}-{slug(name)}.png", optimize=True)
        extracted.append((name, icon))

    # Compact visual QA sheet with all 51 transparent PNGs.
    cell_w, cell_h = 190, 180
    sheet = Image.new("RGBA", (cell_w * 6, cell_h * 9), (245, 245, 245, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (name, icon) in enumerate(extracted):
        if index < 48:
            col, row = index // 8, index % 8
        else:
            col, row = index - 46, 8
        thumb = icon.copy()
        thumb.thumbnail((125, 125), Image.Resampling.LANCZOS)
        x = col * cell_w + (cell_w - thumb.width) // 2
        y = row * cell_h + 5
        sheet.alpha_composite(thumb, (x, y))
        label = name if len(name) <= 26 else name[:25] + "…"
        box = draw.textbbox((0, 0), label)
        draw.text((col * cell_w + (cell_w - (box[2] - box[0])) // 2, row * cell_h + 137), label, fill=(25, 25, 25, 255))
    sheet.save(OUTPUT / "vista-previa-todos.png", optimize=True)


if __name__ == "__main__":
    main()
