from pathlib import Path
import re

s=Path('TESTVERSION.html').read_text(encoding='utf-8')
lines=s.splitlines()
terms=['rc205-planner-task','i218-task-name','rc896-task-name','rc628-task','index218Planner','task-groups','data-task','Warncenter','Benachrichtigungscenter','notification','dashboard','Lager','warehouse','Aufgabe','task','Arbeitsfokus','kachel','sidebar','topbar']
parts=[]
for term in terms:
    hits=[]
    for i,line in enumerate(lines,1):
        if term.lower() in line.lower(): hits.append(i)
    parts.append(f'===== {term} | hits={len(hits)} =====')
    limit=20 if term in {'rc205-planner-task','i218-task-name','rc896-task-name','rc628-task','index218Planner','task-groups','data-task'} else 8
    for n in hits[:limit]:
        a=max(1,n-4); b=min(len(lines),n+6)
        parts.extend(f'{no:06d}: {lines[no-1][:1200]}' for no in range(a,b+1))
        parts.append('---')

parts.append('===== UNIQUE IDS/CLASSES =====')
vals=[]
for pat in [r'id=["\']([^"\']*(?:warn|notif|dashboard|lager|warehouse|task|aufgabe|focus|work)[^"\']*)["\']',r'class=["\']([^"\']*(?:warn|notif|dashboard|lager|warehouse|task|aufgabe|focus|work)[^"\']*)["\']']:
    for m in re.finditer(pat,s,re.I):
        v=m.group(1).strip()
        if v and v not in vals: vals.append(v)
parts.extend(vals[:240])

parts.append('===== CSS SELECTOR EXCERPTS =====')
for m in re.finditer(r'([^{}<>]{0,260}(?:warn|notif|dashboard|lager|warehouse|task|aufgabe|focus|work)[^{}<>]{0,260})\{([^{}]{0,700})\}',s,re.I):
    block=(m.group(1).strip()+'{'+m.group(2).strip()+'}').replace('\n',' ')
    if '<script' in block.lower() or 'function ' in block.lower(): continue
    parts.append(block[:1200])
    if len(parts)>1000: break

Path('.github/rc990_design_audit_result.txt').write_text('\n'.join(parts),encoding='utf-8')
print('wrote rc990_design_audit_result.txt')
