from pathlib import Path
import re
s=Path('TESTVERSION.html').read_text(encoding='utf-8')
lines=s.splitlines()
terms=['Warncenter','Benachrichtigungscenter','notification','dashboard','Lager','warehouse','Aufgabe','task','Arbeitsfokus','card','kachel','rc971','rc979','rc980','sidebar','topbar']
for term in terms:
    print('\n===== TERM',term,'=====')
    hits=[]
    for i,line in enumerate(lines,1):
        if term.lower() in line.lower():
            hits.append(i)
    print('HITS',len(hits),hits[:40])
    for n in hits[:10]:
        a=max(1,n-3);b=min(len(lines),n+5)
        for no in range(a,b+1): print(f'{no:06d}: {lines[no-1][:1000]}')
        print('---')

print('\n===== STYLE IDS =====')
for m in re.finditer(r'<style(?:\s+id=["\']([^"\']+)["\'])?[^>]*>',s,re.I):
    ident=m.group(1) or '(none)'
    if ident!='(none)' or m.start()>s.rfind('<body'):
        print(ident,'AT',m.start())

print('\n===== LIKELY ACTIVE CLASS/ID TOKENS =====')
for pat in [r'id=["\']([^"\']*(?:warn|notif|dashboard|lager|warehouse|task|aufgabe|focus)[^"\']*)["\']',r'class=["\']([^"\']*(?:warn|notif|dashboard|lager|warehouse|task|aufgabe|focus)[^"\']*)["\']']:
    vals=[]
    for m in re.finditer(pat,s,re.I):
        v=m.group(1)
        if v not in vals: vals.append(v)
    for v in vals[:160]: print(v)
