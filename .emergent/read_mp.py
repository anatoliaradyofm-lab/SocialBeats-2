import sys
lines = open('C:/Users/user/Desktop/PROJE/MobilePreview.html', encoding='utf-8').readlines()
print(f'Total lines: {len(lines)}')
for i, line in enumerate(lines[:20], 1):
    print(f'{i}: {line[:120].rstrip()}')
