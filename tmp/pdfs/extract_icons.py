from pathlib import Path

from PIL import Image, ImageDraw


SOURCE = Path(r"C:\Users\rdpr1\AppData\Local\Temp\codex-clipboard-300d0b0e-225d-41fd-bd84-fd316ace09e9.png")
OUTPUT = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\output\icons-sistema-ascenso")
# Tight boxes around the six illustrated tiles; labels sit below y=142.
ICONS = {
    "aventuras-sobre-ruedas": (46, 21, 147, 131),
    "dia-de-campo": (210, 20, 311, 131),
    "artes": (375, 20, 476, 131),
    "ser-un-amigo": (537, 20, 638, 131),
    "juegos": (707, 20, 809, 131),
    "ayudando-a-la-comunidad": (869, 20, 971, 131),
}


def transparent_outer_background(crop: Image.Image) -> Image.Image:
    rgba = crop.convert("RGBA")
    scale = 4
    mask = Image.new("L", (rgba.width * scale, rgba.height * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (0, 0, mask.width - 1, mask.height - 1),
        radius=14 * scale,
        fill=255,
    )
    rgba.putalpha(mask.resize(rgba.size, Image.Resampling.LANCZOS))
    return rgba


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE)
    extracted = []
    for name, box in ICONS.items():
        icon = transparent_outer_background(source.crop(box))
        icon.save(OUTPUT / f"{name}.png", optimize=True)
        extracted.append((name, icon))

    preview = Image.new("RGBA", (720, 150), (245, 245, 245, 255))
    for index, (_, icon) in enumerate(extracted):
        thumb = icon.copy()
        thumb.thumbnail((100, 110), Image.Resampling.LANCZOS)
        x = 10 + index * 120 + (100 - thumb.width) // 2
        y = 10 + (110 - thumb.height) // 2
        preview.alpha_composite(thumb, (x, y))
    preview.save(OUTPUT / "vista-previa.png", optimize=True)


if __name__ == "__main__":
    main()
