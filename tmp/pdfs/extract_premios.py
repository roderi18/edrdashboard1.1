from pathlib import Path
import shutil
import zipfile

import numpy as np
from PIL import Image, ImageDraw
from pypdf import PdfReader


PDF = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\public\sistemaAscenso\2020-Sistema-de-Ascenso.pdf")
OUTPUT = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\output\premios-sistema-ascenso")

# PDF embedded-image name, group folder, category folder, expected icon count.
CATEGORIES = [
    ("Im35.jp2", "pioneros", "premios-de-liderazgo-rojo", 6),
    ("Im4.png", "pioneros", "premios-de-destreza-azul-requeridos", 3),
    ("Im3.jp2", "pioneros", "premios-de-destreza-azul", 41),
    ("Im5.jp2", "pioneros", "premios-biblicos-naranja", 15),
    ("Im32.jp2", "seguidores-de-la-senda", "premios-de-liderazgo-amarillo", 6),
    ("Im7.jp2", "seguidores-de-la-senda", "premios-de-destreza-verde-requeridos", 3),
    ("Im6.jp2", "seguidores-de-la-senda", "premios-de-destreza-verde", 60),
    ("Im8.jp2", "seguidores-de-la-senda", "premios-biblicos-cafe", 15),
    ("Im9.jp2", "exploradores", "premios-de-destreza-platino", 81),
    ("Im10.jp2", "exploradores", "premios-biblicos-de-reto-espiritual", 6),
]


def runs(values: np.ndarray, minimum: int = 12) -> list[tuple[int, int]]:
    changes = np.diff(np.r_[False, values, False].astype(np.int8))
    starts = np.flatnonzero(changes == 1)
    ends = np.flatnonzero(changes == -1)
    return [(int(a), int(b)) for a, b in zip(starts, ends) if b - a >= minimum]


def extract_grid(image: Image.Image) -> list[Image.Image]:
    rgba = image.convert("RGBA")
    data = np.asarray(rgba)
    alpha = data[:, :, 3] > 0
    row_bands = runs(alpha.sum(axis=1) > 5)
    icons: list[Image.Image] = []
    for y0, y1 in row_bands:
        band = alpha[y0:y1]
        col_bands = runs(band.sum(axis=0) > 5)
        for x0, x1 in col_bands:
            pad = 2
            box = (max(0, x0 - pad), max(0, y0 - pad), min(rgba.width, x1 + pad), min(rgba.height, y1 + pad))
            tile = rgba.crop(box)
            icons.append(tile.crop(tile.getbbox()))
    return icons


def extract_cafe(image: Image.Image) -> list[Image.Image]:
    rgba = image.convert("RGBA")
    icons = []
    for centers, cy in (([191 + 226 * i for i in range(8)], 89), ([305 + 226 * i for i in range(7)], 233)):
        for cx in centers:
            tile = rgba.crop((cx - 80, cy - 80, cx + 80, cy + 80))
            original_alpha = tile.getchannel("A")
            circle = Image.new("L", tile.size, 0)
            ImageDraw.Draw(circle).ellipse((4, 4, 155, 155), fill=255)
            tile.putalpha(Image.fromarray(np.minimum(np.asarray(original_alpha), np.asarray(circle)).astype(np.uint8)))
            icons.append(tile.crop(tile.getbbox()))
    return icons


def preview(icons: list[Image.Image], title: str, path: Path) -> None:
    cols = min(10, max(1, len(icons)))
    rows = (len(icons) + cols - 1) // cols
    cell = 104
    header = 32
    sheet = Image.new("RGBA", (cols * cell, header + rows * cell), (245, 245, 245, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((10, 9), f"{title} ({len(icons)})", fill=(20, 20, 20, 255))
    for i, icon in enumerate(icons):
        thumb = icon.copy()
        thumb.thumbnail((88, 88), Image.Resampling.LANCZOS)
        x = (i % cols) * cell + (cell - thumb.width) // 2
        y = header + (i // cols) * cell + (cell - thumb.height) // 2
        sheet.alpha_composite(thumb, (x, y))
    sheet.save(path, optimize=True)


def save_category(images: list[Image.Image], group: str, category: str, expected: int) -> None:
    if len(images) != expected:
        raise RuntimeError(f"{group}/{category}: expected {expected}, found {len(images)}")
    folder = OUTPUT / group / category
    folder.mkdir(parents=True, exist_ok=True)
    for i, icon in enumerate(images, 1):
        icon.save(folder / f"{i:03d}.png", optimize=True)
    preview(images, category.replace("-", " ").title(), folder / "vista-previa.png")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    embedded = {item.name: item.image.convert("RGBA") for item in PdfReader(PDF).pages[0].images}

    for source, group, category, expected in CATEGORIES:
        extractor = extract_cafe if source == "Im8.jp2" else extract_grid
        save_category(extractor(embedded[source]), group, category, expected)

    # Im13 contains both Exploradores leadership (top row) and required platinum (bottom row).
    combined = extract_grid(embedded["Im13.jp2"])
    save_category(combined[:6], "exploradores", "premios-de-liderazgo-celeste", 6)
    save_category(combined[6:], "exploradores", "premios-de-destreza-platino-requeridos", 3)

    for group in ("pioneros", "seguidores-de-la-senda", "exploradores"):
        shutil.make_archive(str(OUTPUT / f"{group}-premios"), "zip", OUTPUT / group)
    with zipfile.ZipFile(OUTPUT / "todos-los-premios-organizados.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        for group in ("pioneros", "seguidores-de-la-senda", "exploradores"):
            for file in (OUTPUT / group).rglob("*.png"):
                archive.write(file, file.relative_to(OUTPUT))


if __name__ == "__main__":
    main()
