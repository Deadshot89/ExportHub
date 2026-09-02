from pathlib import Path
import re

lines=Path('TESTVERSION.html').read_text(encoding='utf-8',errors='replace').splitlines()
func_re=re.compile(r'function\s+([A-Za-z_$][\w$]*)\s*\(')
GROUPS={
 'shipping':['gate41','versandkosten','shippingcost','freight','maut','ups','destinationcountry','recipientcountry','countrycode'],
 'pickup':['pickup','abholtag','actualpickupdate','plannedpickupdate','podfiles','pod vorhanden','abgeholt','collitotal','totalcolli'],
 'release':['releasecenter','release-center','release center','openchanges','pendingchanges','unpublished','nicht veröffentlicht','scrollintoview','scrollto','releasecheck','releasechange'],
 'admin':['funktionsadmin','functionadmin','ihkadmin','terminatesession','endsession','session','backup','audit','datenschutz']
}
for group,terms in GROUPS.items():
    hits=[]
    for i,line in enumerate(lines):
        if len(line)>40000: continue
        matched=[t for t in terms if t in line.lower()]
        if not matched: continue
        m=func_re.search(line)
        # Prefer active later runtime and actual functions, de-prioritize release-history prose.
        score=(5 if m else 0)+(3 if i>=14000 else 0)+len(matched)-(2 if i<1500 else 0)
        hits.append((score,i,line,matched,m.group(1) if m else '-'))
    hits.sort(key=lambda x:(-x[0],-x[1]))
    out=[f'RC960_{group.upper()}_FOCUS hit_count={len(hits)}']
    used=0
    for score,i,line,matched,fn in hits:
        if used>=100: break
        if i<1500 and not fn!='-': continue
        out.append(f'\nLINE {i+1} score={score} fn={fn} terms={",".join(matched)} len={len(line)}')
        out.append(line[:14000])
        used+=1
    Path(f'docs/superpowers/rc960-{group}-focus.txt').write_text('\n'.join(out),encoding='utf-8')
print('RC960_GROUP_FOCUS_WRITTEN')
