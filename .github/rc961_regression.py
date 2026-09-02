from pathlib import Path

s=Path('TESTVERSION.html').read_text(encoding='utf-8')
checks={
    'RC961 build': "var BUILD=Object.freeze({version:'RC961',cache:'961',loginReturn:'/TESTVERSION.html?v=961'});" in s,
    'read budget exists': "rc961ReadBudget=mode==='read'?" in s,
    'read deadline exists': 'rc961ReadDeadline=rc961ReadBudget?Date.now()+rc961ReadBudget:0' in s,
    'fallback loop stops at total deadline': "if(mode==='read'&&rc961ReadDeadline&&Date.now()>=rc961ReadDeadline)break;" in s,
    'fallback timeout uses remaining budget': 'rc961Remaining=Math.max(1,rc961ReadDeadline-Date.now())' in s,
    'first TESTSERVICE read remains 14s': "loadState({timeoutMs:14000,maxAttempts:1})" in s,
    'single retry remains 24s': "loadState({timeoutMs:24000,maxAttempts:1})" in s,
    'RC960 shipment lock hardening preserved': 'Sendungssperre wird vor dem Speichern erneut geprüft …' in s,
    'RC950 busy print preserved': "busy.withBusy('Druck wird vorbereitet …'" in s,
}
failed=[name for name,ok in checks.items() if not ok]
for name,ok in checks.items():
    print(('PASS' if ok else 'FAIL')+': '+name)
if failed:
    raise SystemExit('RC961 regression failed: '+', '.join(failed))
print('RC961 static regression PASS')
