#!/usr/bin/env python3
"""
One-time fix script for MobilePreview.html
Run this from the PROJE directory:
  python .emergent/apply_fix.py

Or from anywhere:
  python "C:/Users/user/Desktop/PROJE/.emergent/apply_fix.py"

WHAT THIS DOES:
  Adds isLang:true to the Dil item in SETTING_PAGES.
  All other fixes (FIX 1-3, 5, 7, 8) are already implemented in the file.
  FIX 4 (functional toggles) is already implemented.
  FIX 6 (language modal) works via isDil check - this adds the explicit isLang:true.

NOTE: The file already works correctly without this change.
  The isDil = item.label === 'Dil' check at line 838 provides the same functionality.
"""

import os
import sys

fp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'MobilePreview.html')

if not os.path.exists(fp):
    print(f"ERROR: File not found: {fp}")
    sys.exit(1)

with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# FIX 6: Add isLang:true to Dil item
old = "{label:'Dil',val:'T\u00fcrk\u00e7e'}"
new = "{label:'Dil',val:'T\u00fcrk\u00e7e',isLang:true}"

if old not in content:
    if new in content:
        print("FIX 6: Already applied (isLang:true already present)")
    else:
        print(f"WARNING: Pattern not found: {old!r}")
        print("The file may have been modified. Skipping.")
    sys.exit(0)

content_new = content.replace(old, new, 1)
count = content.count(old)
print(f"FIX 6: Found {count} occurrence(s) of Dil item, replacing...")

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content_new)

print(f"SUCCESS: Updated {fp}")
print(f"Changed: {old!r}")
print(f"     to: {new!r}")
