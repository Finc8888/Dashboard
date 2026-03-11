#!/usr/bin/env python3
"""
Парсит markdown-файл с цитатами и создаёт www/quotes.json.

Формат блока в исходном файле:
  > **«Текст цитаты»**
  > — Пояснение

Использование:
  python3 scripts/parse_quotes.py /path/to/quotes.md [output.json]
"""

import re
import json
import sys
import os


def parse_quotes(md_path: str) -> list[dict]:
    with open(md_path, encoding="utf-8") as f:
        text = f.read()

    # Собираем все блоки blockquote (непрерывные строки, начинающиеся с >)
    raw_blocks = re.findall(r"((?:^>[ \t]?.*\n?)+)", text, re.MULTILINE)

    quotes = []
    for block in raw_blocks:
        # Убираем ведущий > и пробел
        lines = [re.sub(r"^>[ \t]?", "", l) for l in block.strip().splitlines()]
        content = "\n".join(lines)

        # Первый **жирный** фрагмент — сама цитата
        bold_matches = re.findall(r"\*\*(.+?)\*\*", content, re.DOTALL)
        if not bold_matches:
            continue

        quote_text = bold_matches[0].strip().strip("«»").strip()
        if len(quote_text) < 5:
            continue

        # Строка с пояснением начинается с — или содержит второй **
        expl = ""
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("—") or stripped.startswith("\u2014"):
                expl = re.sub(r"^[—\u2014]\s*", "", stripped)
                break

        # Если пояснение длиннее цитаты — лучше не брать слишком длинное
        if len(expl) > 300:
            expl = expl[:297] + "…"

        quotes.append({"quote": quote_text, "explanation": expl})

    return quotes


def main():
    if len(sys.argv) < 2:
        print("Использование: parse_quotes.py <путь_к_файлу.md> [output.json]")
        sys.exit(1)

    md_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "www/quotes.json"

    if not os.path.exists(md_path):
        print(f"Ошибка: файл не найден — {md_path}")
        sys.exit(1)

    quotes = parse_quotes(md_path)

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(quotes, f, ensure_ascii=False, indent=2)

    print(f"Готово: {len(quotes)} цитат → {out_path}")


if __name__ == "__main__":
    main()
