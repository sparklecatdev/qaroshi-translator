#!/usr/bin/env python3
"""Build a loss-aware, compact Qaroshi dataset from the owner's source releases.

Optional --release-zip and --standard8-zip may point at local archives; all
output includes provenance and exact SHA-256 for each source member.
"""
from __future__ import annotations
import argparse,csv,gzip,hashlib,io,json,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'public/data'

def read_csv(z,member):
    return list(csv.DictReader(io.StringIO(z.read(member).decode('utf8'))))

def write(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')

def make(release,standard):
    OUTPUT.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(release) as archive,zipfile.ZipFile(standard) as edition:
        dictionary=list(csv.DictReader(io.StringIO(gzip.decompress(edition.read('data/standard_8/dictionary_enriched_30001.csv.gz')).decode('utf8'))))
        corpus=read_csv(archive,'Qaroshi/corpus/parallel_sentences.csv')
        frames=read_csv(edition,'data/standard_8/verb_audit_400.csv')
        resonances=json.loads(archive.read('Qaroshi/data/resonances.json'))
        phen=json.loads(archive.read('Qaroshi/data/phoneme_inventory.json'))
        manual=json.loads(archive.read('Qaroshi/data/semantics/valency_frames.json'))
        assert len(dictionary)==30001 and len({d['qaroshi'] for d in dictionary})==30001
        assert len(corpus)==4383 and len(resonances)==16 and len(phen)==26 and len(manual)==25 and len(frames)==400
        # Even the 30,001st word is an adopted Standard 8 function word. Never
        # silently include rejected proposed forms from other releases.
        assert dictionary[-1]['id']=='Q8D001' and dictionary[-1]['qaroshi']=='nëgëra'
        lex=[{k:r[k] for k in ('id','qaroshi','english','pos','domain','ipa','sound_out','current_lexical_sense_constraint','individually_reviewed_senses','semantic_boundary_notes','verb_role_license','compound_ambiguity_status')} for r in dictionary]
        examples=[{k:r[k] for k in ('id','qaroshi','english','ipa','domain','pattern')} for r in corpus]
        condensed=[{k:r.get(k,'') for k in ('lemma','decision','required_roles','licensed_optional_roles','passive_or_causative_authority','general_frame_review','exact_documented_object_root','example_source_id')} for r in frames]
        by_lemma={r['lemma']:r for r in frames}
        for m in manual:
            audit=by_lemma[m['lemma']]
            m['required_roles']=[v.strip() for v in audit['required_roles'].split('|') if v.strip()]
            m['licensed_optional_roles']=[v.strip() for v in audit['licensed_optional_roles'].split('|') if v.strip()]
            m['passive_or_causative_authority']=audit['passive_or_causative_authority']
        write(OUTPUT/'lexicon.json',lex)
        write(OUTPUT/'examples.json',examples)
        write(OUTPUT/'frames.json',{'audited':condensed,'reviewed':manual})
        write(OUTPUT/'resonances.json',resonances)
        write(OUTPUT/'phonemes.json',phen)
        sources={
            'lexicon':hashlib.sha256(edition.read('data/standard_8/dictionary_enriched_30001.csv.gz')).hexdigest(),
            'examples':hashlib.sha256(archive.read('Qaroshi/corpus/parallel_sentences.csv')).hexdigest(),
            'frames':hashlib.sha256(edition.read('data/standard_8/verb_audit_400.csv')).hexdigest(),
            'resonances':hashlib.sha256(archive.read('Qaroshi/data/resonances.json')).hexdigest(),
            'phonemes':hashlib.sha256(archive.read('Qaroshi/data/phoneme_inventory.json')).hexdigest(),
        }
        meta={'name':'Qaroshi Translator','standard':'Unified Standard 8.0 / 8.1 amendment, 8.3 editorial candidate separate',
            'source_repo':'https://github.com/sparklecatdev/qaroshi','lexical_count':len(lex),
            'examples_count':len(examples),'reviewed_frames':len(manual),'audited_frames':len(frames),
            'resonances':len(resonances),'phonemes':len(phen),'source_sha256':sources,
            'warning':'Controlled/editorial reference. Rule-based output is a provisional interpretation, not fluent human translation.'}
        write(OUTPUT/'meta.json',meta)
        print(f'Built {len(lex):,} words, {len(examples):,} examples, {len(frames)} verb rows.')
        for p in OUTPUT.glob('*.json'):print(p.relative_to(ROOT),p.stat().st_size)

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--release-zip',type=Path,required=True)
    p.add_argument('--standard8-zip',type=Path,required=True)
    a=p.parse_args()
    make(a.release_zip,a.standard8_zip)
