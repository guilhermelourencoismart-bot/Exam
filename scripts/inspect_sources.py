"""Inspect received PDFs: exact hashes first, text similarity only as review candidates."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def tokens(s):
    return set(re.findall(r'\w{4,}', s.lower()))

def inspect(folder):
    conn = sqlite3.connect((ROOT/'sources/banco.sqlite').as_uri()+'?mode=ro',uri=True)
    docs = [json.loads(r[0]) for r in conn.execute('select dados_json from documentos')]
    questions = [json.loads(r[0]) for r in conn.execute('select dados_json from questoes')]
    groups = collections.defaultdict(list)
    for q in questions: groups[q['arquivo']].append(q)
    reports=[]
    for p in sorted(Path(folder).rglob('*.pdf')):
        sha=hashlib.sha256(p.read_bytes()).hexdigest()
        match=next((d for d in docs if d['sha256']==sha),None)
        text=subprocess.check_output(['pdftotext','-layout',str(p),'-'],text=True)
        candidates=[]
        if not match:
            available=tokens(text)
            for name,qs in groups.items():
                # Proposed content identities only. Never assign a key or approve a version.
                ratios=[len(tokens(q['enunciado_extraido']) & available)/max(1,len(tokens(q['enunciado_extraido']))) for q in qs]
                candidates.append({'document':name,'meanTokenCoverage':round(sum(ratios)/len(ratios),3)})
            candidates=sorted(candidates,key=lambda c:c['meanTokenCoverage'],reverse=True)[:3]
        reports.append({'file':str(p),'sha256':sha,'exactDocument':match['arquivo'] if match else None,
                        'pages':len(text.split('\f'))-int(not text.split('\f')[-1].strip()),
                        'contentCandidates':candidates,'status':'Recebido; revisão visual e gabarito ainda necessários',
                        'firstPageText':text.split('\f')[0][:4000]})
    return reports

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('folder',nargs='?',default=str(ROOT/'public/sources/originals'))
    args=parser.parse_args();print(json.dumps(inspect(args.folder),ensure_ascii=False,indent=2))
