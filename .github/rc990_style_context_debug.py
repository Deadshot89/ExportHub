from pathlib import Path
import re

html = Path('TESTVERSION.html').read_text(encoding='utf-8')
needle = 'exporthub-rc364-mobile-overflow-fix'
pos = html.find(needle)
print('legacy_pos=', pos)
if pos < 0:
    raise SystemExit('legacy marker not found')

before = html[max(0, pos-1800):pos]
after = html[pos:pos+2600]
print('--- CONTEXT BEFORE ---')
print(before)
print('--- CONTEXT AFTER ---')
print(after)

last_script_open = html.rfind('<script', 0, pos)
last_script_close = html.rfind('</script>', 0, pos)
print('last_script_open=', last_script_open, 'last_script_close=', last_script_close, 'inside_script=', last_script_open > last_script_close)
print('last_style_open=', html.rfind('<style', 0, pos), 'last_style_close=', html.rfind('</style>', 0, pos))

# Identify the exact enclosing script/style block if applicable.
if last_script_open > last_script_close:
    script_end = html.find('</script>', pos)
    block = html[last_script_open:script_end+9]
    print('enclosing_script_len=', len(block), 'script_end=', script_end)
    for token in ['printStow', 'insertAdjacentHTML', 'innerHTML', 'textContent', 'createElement("style")', "createElement('style')"]:
        print(token, block.find(token))

# Show all exact literal style tags carrying the id and their quote/backtick surroundings.
for m in re.finditer(r'<style[^>]*id=["\']exporthub-rc364-mobile-overflow-fix["\'][^>]*>', html, re.I):
    p=m.start()
    print('style_tag_at=', p, 'inside_script=', html.rfind('<script',0,p)>html.rfind('</script>',0,p))
    print(repr(html[max(0,p-220):p+420]))
