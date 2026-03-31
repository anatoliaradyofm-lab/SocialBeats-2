import sys
fp = 'C:/Users/user/Desktop/PROJE/MobilePreview.html'
with open(fp, 'r', encoding='utf-8') as f:
    c = f.read()
print(f"Loaded {len(c)} chars, {c.count(chr(10))} lines")
# Search for key patterns
for pat in ["width:'37%'", "MiniPlayer", "FullPlayerScreen", "settingPage", "type === 'story'", "type === 'playlist'"]:
    idx = c.find(pat)
    print(f"  {pat!r}: at {idx}" + (f", ctx: {c[max(0,idx-30):idx+60]!r}" if idx!=-1 else ""))
