"""Eski locale dosyalarindaki eksik key'leri en.json'dan doldur"""
import json, os

LOCALES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "src", "i18n", "locales")

with open(os.path.join(LOCALES_DIR, "en.json"), "r", encoding="utf-8") as f:
    en = json.load(f)

files = sorted([f for f in os.listdir(LOCALES_DIR) if f.endswith('.json') and f != 'en.json'])
updated = 0

for fname in files:
    filepath = os.path.join(LOCALES_DIR, fname)
    with open(filepath, "r", encoding="utf-8") as f:
        locale = json.load(f)

    added = 0
    for section, keys in en.items():
        if section not in locale:
            locale[section] = keys
            added += len(keys) if isinstance(keys, dict) else 1
        elif isinstance(keys, dict):
            for key, val in keys.items():
                if key not in locale[section]:
                    locale[section][key] = val
                    added += 1

    if added > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(locale, f, ensure_ascii=False, indent=2)
        print(f"[OK] {fname}: {added} key eklendi")
        updated += 1
    else:
        print(f"[--] {fname}: tam")

print(f"\nToplam {updated} dosya guncellendi")
