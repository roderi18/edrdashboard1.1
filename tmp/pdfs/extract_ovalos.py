from pathlib import Path
import shutil
import zipfile

from PIL import Image, ImageDraw
from pypdf import PdfReader


PDF = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\public\sistemaAscenso\2020-Sistema-de-Ascenso.pdf")
OUTPUT = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\output\ovalos-sendas")

# Each box is the oval itself, deliberately excluding arrows and drop shadows.
CONFIG = {
    "navegantes": {
        "source": "Im36.png",
        "paths": ["senda-del-nudo-ocho", "senda-del-nudo-cabeza-de-alondra", "senda-del-nudo-simple"],
        "small_x": [(18, 204), (260, 446), (501, 687), (741, 927)],
        "large_x": (988, 1238),
        "small_y": [(115, 348), (458, 691), (807, 1040)],
        "large_y": [(74, 390), (416, 732), (765, 1081)],
    },
    "pioneros": {
        "source": "Im33.png",
        "paths": ["senda-del-nudo-as-de-guia", "senda-del-nudo-vuelta-de-escota", "senda-del-nudo-cuadrado"],
        "small_x": [(54, 242), (296, 485), (539, 728), (783, 972)],
        "large_x": (1018, 1284),
        "small_y": [(76, 310), (423, 657), (770, 1004)],
        "large_y": [(35, 351), (382, 698), (729, 1045)],
    },
    "seguidores-de-la-senda": {
        "source": "Im34.png",
        "paths": ["senda-del-nudo-vuelta-de-pescador", "senda-del-nudo-vuelta-de-braza", "senda-del-nudo-ballestrinque"],
        "small_x": [(24, 209), (264, 450), (505, 690), (745, 931)],
        "large_x": (991, 1242),
        "small_y": [(76, 310), (423, 657), (770, 1004)],
        "large_y": [(35, 351), (382, 698), (729, 1045)],
    },
}


def oval_only(source: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    icon = source.crop(box).convert("RGBA")
    scale = 4
    mask = Image.new("L", (icon.width * scale, icon.height * scale), 0)
    ImageDraw.Draw(mask).ellipse(
        (3 * scale, 3 * scale, mask.width - 8 * scale, mask.height - 7 * scale),
        fill=255,
    )
    mask = mask.resize(icon.size, Image.Resampling.LANCZOS)
    original_alpha = icon.getchannel("A")
    # The geometric mask removes the attached arrow and shadow while preserving antialiasing.
    combined = Image.new("L", icon.size)
    combined.putdata([min(a, b) for a, b in zip(original_alpha.getdata(), mask.getdata())])
    icon.putalpha(combined)
    return icon


def make_preview(items: list[tuple[str, Image.Image]], path: Path) -> None:
    cell_w, cell_h = 220, 220
    rows = (len(items) + 4) // 5
    sheet = Image.new("RGBA", (cell_w * 5, cell_h * rows), (245, 245, 245, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (label, icon) in enumerate(items):
        thumb = icon.copy()
        thumb.thumbnail((180, 170), Image.Resampling.LANCZOS)
        x = (i % 5) * cell_w + (cell_w - thumb.width) // 2
        y = (i // 5) * cell_h + 5
        sheet.alpha_composite(thumb, (x, y))
        draw.text(((i % 5) * cell_w + 82, (i // 5) * cell_h + 184), label, fill=(20, 20, 20, 255))
    sheet.save(path, optimize=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    embedded = {item.name: item.image.convert("RGBA") for item in PdfReader(PDF).pages[0].images}

    for division, cfg in CONFIG.items():
        source = embedded[cfg["source"]]
        division_items = []
        for row, path_name in enumerate(cfg["paths"]):
            folder = OUTPUT / division / path_name
            folder.mkdir(parents=True, exist_ok=True)
            for level, (x0, x1) in enumerate(cfg["small_x"], 1):
                y0, y1 = cfg["small_y"][row]
                icon = oval_only(source, (x0, y0, x1, y1))
                icon.save(folder / f"nivel-{level}.png", optimize=True)
                division_items.append((f"Nivel {level}", icon))
            x0, x1 = cfg["large_x"]
            y0, y1 = cfg["large_y"][row]
            icon = oval_only(source, (x0, y0, x1, y1))
            icon.save(folder / "nivel-5.png", optimize=True)
            division_items.append(("Nivel 5", icon))
        make_preview(division_items, OUTPUT / division / "vista-previa.png")

    # Exploradores has three oval stages (E1-E3), not named knot paths.
    source = embedded["Im14.png"]
    folder = OUTPUT / "exploradores" / "niveles-exploradores"
    folder.mkdir(parents=True, exist_ok=True)
    boxes = [(324, 35, 566, 342), (633, 35, 875, 342), (942, 35, 1184, 342)]
    explorer_items = []
    for level, box in enumerate(boxes, 1):
        icon = oval_only(source, box)
        icon.save(folder / f"nivel-{level}-e{level}.png", optimize=True)
        explorer_items.append((f"E{level}", icon))
    make_preview(explorer_items, OUTPUT / "exploradores" / "vista-previa.png")

    for division in ("navegantes", "pioneros", "seguidores-de-la-senda", "exploradores"):
        shutil.make_archive(str(OUTPUT / f"{division}-ovalos"), "zip", OUTPUT / division)
    with zipfile.ZipFile(OUTPUT / "todos-los-ovalos-organizados.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        for division in ("navegantes", "pioneros", "seguidores-de-la-senda", "exploradores"):
            for file in (OUTPUT / division).rglob("*.png"):
                archive.write(file, file.relative_to(OUTPUT))


if __name__ == "__main__":
    main()
