"""One-off: replace hand-rolled alpha inks with the derived muted token.

`rgb(var(--sfs-text-rgb) / 0.55)` measures ~6:1 over a dark galaxy and ~3.4:1
over a pale one — the SAME declaration, comfortable in the dark seven and below
AA in the light three. Blending toward black in gamma-encoded sRGB loses
luminance much faster than blending toward white gains it, so an alpha ladder
tuned by eye on a dark theme cannot also be right on a light one.

`--sfs-text-muted` is derived per galaxy against the surface it lands on, which
is the whole point of having it.

RULES
  * only `color:` and `-webkit-text-fill-color:` are touched — never a border, a
    caret, a fill or a shadow;
  * only alphas BELOW the threshold, because 0.72 and up already clear AA in
    both modes and are a real hierarchy step;
  * a page-local alias is repointed only when EVERY use of it is an ink; where
    one use is a border or a background the alias is left alone and the direct
    `color:` uses are rewritten instead.
"""
import os
import re

SEP = chr(92)
THRESHOLD = 0.72
MUTED = 'var(--sfs-text-muted, rgb(255 255 255 / 0.7))'

INK_PROPS = ('color', '-webkit-text-fill-color')

# The alpha form, e.g. rgb(var(--sfs-text-rgb, 232 234 255) / 0.5)
ALPHA = re.compile(
    r'rgb\(\s*var\(\s*--sfs-text-rgb[^)]*\)\s*/\s*(0?\.\d+)\s*\)')


def files():
    out = []
    for root in ('assets/css', 'components', 'views'):
        for dirpath, _, names in os.walk(root):
            for name in names:
                if name.endswith(('.css', '.vue')):
                    out.append(os.path.join(dirpath, name).replace(SEP, '/'))
    return out


direct = 0
aliases_done = []
aliases_left = []

for path in files():
    text = open(path, encoding='utf-8').read()
    lines = text.split('\n')

    # ---- pass 1: page-local aliases whose every use is an ink ----------------
    for i, line in enumerate(lines):
        m = re.match(r'\s*(--[a-z0-9-]+)\s*:\s*(.+?);', line)
        if not m:
            continue
        name, value = m.group(1), m.group(2)
        if name.startswith('--sfs-'):
            continue
        a = ALPHA.fullmatch(value.strip())
        if not a or float(a.group(1)) >= THRESHOLD:
            continue
        uses = [ln for ln in lines if f'var({name})' in ln or f'var( {name}' in ln]
        if not uses:
            continue
        ink_only = all(
            any(re.search(rf'(^|[;{{\s]){p}\s*:', u) for p in INK_PROPS)
            for u in uses)
        if ink_only:
            lines[i] = line.replace(value, MUTED)
            aliases_done.append(f'{path} {name} ({a.group(1)}, {len(uses)} uses)')
        else:
            aliases_left.append(f'{path} {name} ({a.group(1)}, {len(uses)} uses)')

    # ---- pass 2: direct ink declarations ------------------------------------
    for i, line in enumerate(lines):
        for prop in INK_PROPS:
            pat = re.compile(
                rf'({prop}\s*:\s*)rgb\(\s*var\(\s*--sfs-text-rgb[^)]*\)\s*/\s*(0?\.\d+)\s*\)')

            def sub(mm):
                global direct
                if float(mm.group(2)) >= THRESHOLD:
                    return mm.group(0)
                direct += 1
                return mm.group(1) + MUTED

            lines[i] = pat.sub(sub, lines[i])

    new = '\n'.join(lines)
    if new != text:
        open(path, 'w', encoding='utf-8', newline='\n').write(new)

print(f'{direct} direct ink declarations rewritten')
print(f'{len(aliases_done)} aliases repointed:')
for a in aliases_done:
    print('   ', a)
print(f'{len(aliases_left)} aliases left alone (used for more than ink):')
for a in aliases_left:
    print('   ', a)
