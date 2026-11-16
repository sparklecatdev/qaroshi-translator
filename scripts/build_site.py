#!/usr/bin/env python3
"""Build standalone GitHub Pages-ready static site; no npm dependencies."""
from pathlib import Path
import shutil,json
ROOT=Path(__file__).resolve().parents[1];source=ROOT/'public';dist=ROOT/'dist'
if dist.exists():shutil.rmtree(dist)
shutil.copytree(source,dist)
(dist/'src').mkdir(parents=True,exist_ok=True)
shutil.copy2(ROOT/'src/engine.mjs',dist/'src/engine.mjs')
assert json.loads((dist/'data/meta.json').read_text())['lexical_count']==30001
(dist/'.nojekyll').write_text('')
print('Built',dist,'total',sum(p.stat().st_size for p in dist.rglob('*') if p.is_file()),'bytes')
