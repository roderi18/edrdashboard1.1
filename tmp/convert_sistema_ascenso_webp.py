from io import BytesIO
from pathlib import Path

from PIL import Image


SOURCE = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\public\sistemaAscenso")
OUTPUT = SOURCE / "webp"
EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".gif"}
MAX_BYTES = 15_000
MAX_DIMENSION = 192


def excluded(path: Path) -> bool:
    relative = path.relative_to(SOURCE)
    return (
        any(part.lower() == "webp" for part in relative.parts[:-1])
        or "vista-previa" in path.stem.lower()
    )


def encode_under_limit(image: Image.Image) -> tuple[bytes, int, tuple[int, int]]:
    rgba = image.convert("RGBA")
    rgba.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

    dimensions = [192, 176, 160, 144, 128, 112, 96, 80, 64]
    qualities = [85, 82, 78, 74, 70, 66, 62, 58, 54, 50, 45, 40, 35, 30]
    current = rgba
    best: tuple[bytes, int, tuple[int, int]] | None = None

    for maximum in dimensions:
        if max(current.size) > maximum:
            resized = rgba.copy()
            resized.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
            current = resized
        for quality in qualities:
            stream = BytesIO()
            current.save(
                stream,
                "WEBP",
                quality=quality,
                method=6,
                exact=True,
            )
            payload = stream.getvalue()
            best = (payload, quality, current.size)
            if len(payload) <= MAX_BYTES:
                return best

    assert best is not None
    if len(best[0]) > MAX_BYTES:
        raise RuntimeError(f"Could not meet 15 KB limit; smallest result is {len(best[0])} bytes")
    return best


def main() -> None:
    files = sorted(
        path
        for path in SOURCE.rglob("*")
        if path.is_file() and path.suffix.lower() in EXTENSIONS and not excluded(path)
    )
    total_bytes = 0
    largest = (0, "")
    resized_count = 0

    for source in files:
        destination = OUTPUT / source.relative_to(SOURCE).with_suffix(".webp")
        destination.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as opened:
            original_size = opened.size
            payload, quality, final_size = encode_under_limit(opened)
        destination.write_bytes(payload)
        if max(original_size) > MAX_DIMENSION or final_size != original_size:
            resized_count += 1
        total_bytes += len(payload)
        if len(payload) > largest[0]:
            largest = (len(payload), str(destination.relative_to(OUTPUT)))

    print(f"converted={len(files)}")
    print(f"total_bytes={total_bytes}")
    print(f"largest_bytes={largest[0]}")
    print(f"largest_file={largest[1]}")
    print(f"resized={resized_count}")


if __name__ == "__main__":
    main()
