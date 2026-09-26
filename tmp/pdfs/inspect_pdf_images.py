from pathlib import Path
from PIL import Image, ImageDraw
from pypdf import PdfReader

pdf = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\public\sistemaAscenso\2020-Sistema-de-Ascenso.pdf")
out = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\tmp\pdfs\embedded")
out.mkdir(parents=True, exist_ok=True)
images = PdfReader(pdf).pages[0].images
thumbs = []
for item in images:
    im = item.image.convert("RGBA")
    path = out / (item.name.rsplit(".", 1)[0] + ".png")
    im.save(path)
    thumb = im.copy()
    thumb.thumbnail((180, 120), Image.Resampling.LANCZOS)
    thumbs.append((item.name, thumb, im.size))

sheet = Image.new("RGBA", (1000, ((len(thumbs) + 4) // 5) * 160), "white")
draw = ImageDraw.Draw(sheet)
for i, (name, thumb, size) in enumerate(thumbs):
    x = (i % 5) * 200
    y = (i // 5) * 160
    sheet.alpha_composite(thumb, (x, y))
    draw.text((x, y + 122), f"{name} {size}", fill="black")
sheet.save(out / "contact.png")
