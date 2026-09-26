from pathlib import Path

import numpy as np
from PIL import Image


SOURCE = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\public\sistemaAscenso\exploradores")
OUTPUT = SOURCE / "webp"
EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}


def main() -> None:
    candidates = [
        path
        for path in SOURCE.rglob("*")
        if path.is_file()
        and OUTPUT not in path.parents
        and path.suffix.lower() in EXTENSIONS
        and "vista-previa" not in path.stem.lower()
    ]

    source_bytes = 0
    output_bytes = 0
    for source in candidates:
        relative = source.relative_to(SOURCE).with_suffix(".webp")
        destination = OUTPUT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)

        with Image.open(source) as opened:
            original = opened.convert("RGBA")
            original.save(destination, "WEBP", lossless=True, method=6, exact=True)
            expected_size = original.size
            expected_pixels = np.asarray(original)

        with Image.open(destination) as converted:
            actual = converted.convert("RGBA")
            if actual.size != expected_size or not np.array_equal(np.asarray(actual), expected_pixels):
                raise RuntimeError(f"Lossless verification failed: {source}")

        source_bytes += source.stat().st_size
        output_bytes += destination.stat().st_size

    reduction = 0 if not source_bytes else (1 - output_bytes / source_bytes) * 100
    print(f"converted={len(candidates)}")
    print(f"source_bytes={source_bytes}")
    print(f"output_bytes={output_bytes}")
    print(f"reduction_percent={reduction:.2f}")


if __name__ == "__main__":
    main()
