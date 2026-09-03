from pathlib import Path
import re

s=Path('TESTVERSION.html').read_text(encoding='utf-8')
lines=s.splitlines()
terms=['Warncenter','Benachrichtigungscenter','notification','dashboard','Lager','warehouse','Aufgabe','task','Arbeitsfokus','kachel','sidebar','topbar']
parts=[]
for term in terms:
    hits=[]
    for i,line in enumerate(lines,1):
        if term.lower() in line.lower(): hits.append(i)
    parts.append(f'===== {term} | hits={len(hits)} =====')
    for n in hits[:8]:
        a=max(1,n-2); b=min(len(lines),n+3)
        parts.extend(f'{no:06d}: {lines[no-1][:700]}' for no in range(a,b+1))
        parts.append('---')

parts.append('===== UNIQUE IDS/CLASSES =====')
vals=[]
for pat in [r'id=["\']([^"\']*(?:warn|notif|dashboard|lager|warehouse|task|aufgabe|focus|work)[^"\']*)["\']',r'class=["\']([^"\']*(?:warn|notif|dashboard|lager|warehouse|task|aufgabe|focus|work)[^"\']*)["\']']:
    for m in re.finditer(pat,s,re.I):
        v=m.group(1).strip()
        if v and v not in vals: vals.append(v)
parts.extend(vals[:200])

parts.append('===== CSS SELECTOR EXCERPTS =====')
# Capture compact rules with likely relevant selectors, not JS strings.
for m in re.finditer(r'([^{}<>]{0,260}(?:warn|notif|dashboard|lager|warehouse|task|aufgabe|focus|work)[^{}<>]{0,260})\{([^{}]{0,700})\}',s,re.I):
    block=(m.group(1).strip()+'{'+m.group(2).strip()+'}').replace('\n',' ')
    if '<script' in block.lower() or 'function ' in block.lower(): continue
    parts.append(block[:1000])
    if len(parts)>650: break

Path('.github/rc990_design_audit_result.txt').write_text('\n'.join(parts),encoding='utf-8')
print('wrote rc990_design_audit_result.txt')
