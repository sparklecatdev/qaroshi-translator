#!/usr/bin/env python3
"""Create source and prebuilt static deployment ZIPs with file integrity metadata."""
from pathlib import Path
import hashlib,json,subprocess,sys,zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT.parent
OUT.mkdir(parents=True,exist_ok=True)
subprocess.run([sys.executable,str(ROOT/'scripts/build_site.py')],check=True,cwd=ROOT)
def paths(root,include):
    result=[]
    for p in root.rglob('*'):
        if not p.is_file() or any(a in p.parts for a in ('node_modules','__pycache__','.git')):continue
        if p.suffix in ('.log','.pyc') or p.name=='.DS_Store':continue
        rel=p.relative_to(root)
        if include(rel):result.append((rel,p))
    return sorted(result,key=lambda x:str(x[0]))
files=paths(ROOT,lambda r:r.parts[0]!='dist' and not r.name.endswith('.zip'))
manifest={'name':'qaroshi-translator','version':'0.1.0','lexicon':30001,'reference_examples':4383,'source':'sparklecatdev/qaroshi Standard 8.0 editioned lexicon + controlled corpus','files':{str(r):hashlib.sha256(p.read_bytes()).hexdigest() for r,p in files}}
(ROOT/'PROJECT_SHA256_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
files=paths(ROOT,lambda r:r.parts[0]!='dist' and not r.name.endswith('.zip'))
for basename,items in [('Qaroshi_Translator_Full_App.zip',files),('Qaroshi_Translator_Static_Deployment.zip',paths(ROOT/'dist',lambda r:True))]:
    target=OUT/basename
    with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=8) as z:
        for rel,p in items:
            info=zipfile.ZipInfo(str(rel),date_time=(2026,11,16,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16
            z.writestr(info,p.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=8)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert len(z.namelist())==len(items)
    print(target,'files',len(items),'bytes',target.stat().st_size,'sha256',hashlib.sha256(target.read_bytes()).hexdigest())
