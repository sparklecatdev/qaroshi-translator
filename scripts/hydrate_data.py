#!/usr/bin/env python3
"""Reassemble the pinned, full 30,001-entry Qaroshi snapshot without network access.

The Git repo stores compact deterministic chunks to avoid checking in multiple
copies of the expanded 10 MB dictionary. This script restores the exact data
shipped with v0.1 before tests and the GitHub Pages build.
"""
from __future__ import annotations
import hashlib, io, json, pathlib, tarfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'public' / 'data'
SNAP = ROOT / '.snapshot'
PARTS = sorted(SNAP.glob('part[0-9][0-9].bin'))
SHA256 = 'ab9fb534776599efc2aff430d3e832a3d23f5df82efa057a1a1d5c20b11f26ed'
EXPECTED = {'lexicon.json', 'examples.json', 'frames.json', 'resonances.json', 'phonemes.json', 'meta.json'}

def hydrate():
    if (DATA / 'meta.json').exists():
        try:
            meta = json.loads((DATA / 'meta.json').read_text(encoding='utf8'))
            if meta.get('lexical_count') == 30001 and meta.get('examples_count') == 4383 and all((DATA / name).is_file() for name in EXPECTED):
                print('Qaroshi data is already present.')
                return
        except (ValueError, OSError):
            pass
    if len(PARTS) != 7:
        raise RuntimeError('Incomplete offline data snapshot: expected 7 pinned parts')
    payload = b''.join(p.read_bytes() for p in PARTS)
    actual = hashlib.sha256(payload).hexdigest()
    if actual != SHA256:
        raise RuntimeError('Snapshot integrity failure: sha256 does not match pinned release')
    DATA.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
        members = archive.getmembers()
        names = {pathlib.PurePosixPath(m.name).name for m in members}
        if names != EXPECTED or len(members) != len(EXPECTED):
            raise RuntimeError('Unexpected files in pinned data snapshot')
        for member in members:
            name = pathlib.PurePosixPath(member.name)
            if not member.isfile() or len(name.parts) != 3 or name.parts[:2] != ('public', 'data') or name.name not in EXPECTED:
                raise RuntimeError('Unexpected or unsafe snapshot path')
            DATA.joinpath(name.name).write_bytes(archive.extractfile(member).read())
    meta = json.loads((DATA / 'meta.json').read_text(encoding='utf8'))
    assert meta['lexical_count'] == 30001 and meta['examples_count'] == 4383
    print('Restored complete Qaroshi dictionary and controlled parallel corpus.')

if __name__ == '__main__':
    hydrate()
