from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path


BASE = Path(r"D:\documentos\Documentos Roderi\Exploradores\Memoria 2.0")
ROOT_NAMES = ("Exploradores", "Seguidores", "Pioneros")
OUTPUT = BASE / "Inventario de archivos - Exploradores, Seguidores y Pioneros.txt"


def files_for(root: Path):
    paths = []
    for current_dir, dir_names, file_names in os.walk(root):
        dir_names.sort(key=str.casefold)
        current = Path(current_dir)
        for file_name in sorted(file_names, key=str.casefold):
            paths.append((current / file_name).relative_to(BASE))
    return paths


def main():
    inventory = {}
    for name in ROOT_NAMES:
        root = BASE / name
        if not root.is_dir():
            raise FileNotFoundError(f"No existe la carpeta requerida: {root}")
        inventory[name] = files_for(root)

    total = sum(len(paths) for paths in inventory.values())
    lines = [
        "INVENTARIO DE ARCHIVOS",
        "Exploradores, Seguidores y Pioneros",
        f"Ubicación: {BASE}",
        f"Fecha: {datetime.now().strftime('%d/%m/%Y')}",
        f"Total: {total} archivos",
        "",
    ]

    for name in ROOT_NAMES:
        paths = inventory[name]
        lines.extend((f"===== {name.upper()} ({len(paths)} archivos) =====", ""))
        lines.extend(str(path) for path in paths)
        lines.append("")

    OUTPUT.write_text("\n".join(lines), encoding="utf-8-sig")
    print(OUTPUT)
    print(f"TOTAL={total}")


if __name__ == "__main__":
    main()
