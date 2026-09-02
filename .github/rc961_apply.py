from pathlib import Path

path=Path('TESTVERSION.html')
s=path.read_text(encoding='utf-8')


def replace_once(old,new,label):
    global s
    count=s.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    s=s.replace(old,new,1)

replace_once(
    "var BUILD=Object.freeze({version:'RC960',cache:'960',loginReturn:'/TESTVERSION.html?v=960'});",
    "var BUILD=Object.freeze({version:'RC961',cache:'961',loginReturn:'/TESTVERSION.html?v=961'});",
    'canonical build'
)

replace_once(
    "const token=text(runtime.authToken),body=Object.assign({action:mode,mode:mode,sessionToken:token,environment:DATA_ENVIRONMENT},payload||{}),candidates=[API].concat(STATE_API_CANDIDATES.filter(function(endpoint){return endpoint!==API})),errors=[];\n for(let i=0;i<candidates.length;i++){\n  const endpoint=candidates[i],headers={'Content-Type':'application/json','Accept':'application/json','X-ExportHUB-Environment':DATA_ENVIRONMENT},attemptLimit=1;",
    "const token=text(runtime.authToken),body=Object.assign({action:mode,mode:mode,sessionToken:token,environment:DATA_ENVIRONMENT},payload||{}),candidates=[API].concat(STATE_API_CANDIDATES.filter(function(endpoint){return endpoint!==API})),errors=[],rc961ReadBudget=mode==='read'?Math.max(1,Number(requestOptions&&requestOptions.timeoutMs||25000)):0,rc961ReadDeadline=rc961ReadBudget?Date.now()+rc961ReadBudget:0;\n for(let i=0;i<candidates.length;i++){\n  if(mode==='read'&&rc961ReadDeadline&&Date.now()>=rc961ReadDeadline)break;\n  const endpoint=candidates[i],headers={'Content-Type':'application/json','Accept':'application/json','X-ExportHUB-Environment':DATA_ENVIRONMENT},attemptLimit=1;",
    'state read total deadline'
)

replace_once(
    "if(mode==='save'&&!opts.timeoutMs)opts.timeoutMs=50000;if(mode==='save'&&!opts.maxAttempts)opts.maxAttempts=1;if(mode==='read'&&!opts.timeoutMs)opts.timeoutMs=25000;if(mode==='read'&&!opts.maxAttempts)opts.maxAttempts=1;if(mode==='read'&&i>0)progress(Math.min(16,8+i*2),'Azure-Teamdaten werden über einen alternativen API-Weg geladen …');",
    "if(mode==='save'&&!opts.timeoutMs)opts.timeoutMs=50000;if(mode==='save'&&!opts.maxAttempts)opts.maxAttempts=1;if(mode==='read'&&!opts.timeoutMs)opts.timeoutMs=25000;if(mode==='read'&&rc961ReadDeadline){var rc961Remaining=Math.max(1,rc961ReadDeadline-Date.now());opts.timeoutMs=Math.max(1,Math.min(Number(opts.timeoutMs)||25000,rc961Remaining))}if(mode==='read'&&!opts.maxAttempts)opts.maxAttempts=1;if(mode==='read'&&i>0)progress(Math.min(16,8+i*2),'Azure-Teamdaten werden über einen alternativen API-Weg geladen …');",
    'state read remaining timeout'
)

path.write_text(s,encoding='utf-8')
print('RC961 startup total-timeout repair applied.')
