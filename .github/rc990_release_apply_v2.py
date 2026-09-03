from pathlib import Path

src_path=Path('.github/rc990_release_apply.py')
source=src_path.read_text(encoding='utf-8')
old='''old_build="var BUILD=Object.freeze({version:'RC980',cache:'980',loginReturn:'/TESTVERSION.html?v=980'});"
new_build="var BUILD=Object.freeze({version:'RC990',cache:'990',loginReturn:'/TESTVERSION.html?v=990'});"
assert s.count(old_build)==1, f'expected one RC980 BUILD, got {s.count(old_build)}'
s=s.replace(old_build,new_build,1)
'''
new='''build_re=re.compile(r"var\\s+BUILD\\s*=\\s*Object\\.freeze\\(\\{version:\\s*'RC980'\\s*,\\s*cache:\\s*'980'\\s*,\\s*loginReturn:\\s*'/TESTVERSION\\.html\\?v=980'\\s*\\}\\);",re.S)
matches=list(build_re.finditer(s))
assert len(matches)==1, f'expected one structural RC980 BUILD, got {len(matches)}'
s=build_re.sub("var BUILD=Object.freeze({version:'RC990',cache:'990',loginReturn:'/TESTVERSION.html?v=990'});",s,count=1)
'''
assert old in source, 'expected brittle BUILD block not found in apply script'
source=source.replace(old,new,1)
exec(compile(source,str(src_path),'exec'),{'__name__':'__main__','__file__':str(src_path)})
