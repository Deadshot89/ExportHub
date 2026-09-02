from pathlib import Path
import re

lines=Path('TESTVERSION.html').read_text(encoding='utf-8',errors='replace').splitlines()
names=['calcGate','syncCostFromShipment','shipmentRecipientCountry','activateQr','updateQr','registerPickup','unreleasedChanges','changeChecklistProgress','changePassRecord','releaseItemVersion','captureReleaseScroll','restoreReleaseScroll','preserveReleaseScroll','viewerPrint','viewerLoad','terminateSession','endSession','isGlobal','ihkAdmin']

def extract_function(name):
    pat=re.compile(r'function\s+'+re.escape(name)+r'\s*\(')
    for i,line in enumerate(lines):
        if len(line)>50000: continue
        if pat.search(line):
            return i,line
    return None

out=[]
for name in names:
    hit=extract_function(name)
    out.append('\n=== '+name+' ===')
    if hit:
        i,line=hit;out.append(f'LINE {i+1} len={len(line)}');out.append(line[:24000])
    else:
        # fallback literal hotspots, later runtime preferred
        hits=[]
        for i,line in enumerate(lines):
            if len(line)>50000: continue
            if name.lower() in line.lower(): hits.append((i,line))
        hits.sort(key=lambda x:-x[0])
        for i,line in hits[:8]:out.append(f'LINE {i+1} len={len(line)}\n{line[:12000]}')
Path('docs/superpowers/rc960-target-focus.txt').write_text('\n'.join(out),encoding='utf-8')
print('RC960_TARGET_FOCUS_WRITTEN')
