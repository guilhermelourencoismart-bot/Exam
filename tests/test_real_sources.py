"""Checks against the supplied PDF bytes, independent of synthetic fixtures."""
import hashlib
import json
from pathlib import Path
import re
import unittest
import fitz

ROOT=Path(__file__).resolve().parents[1]

class RealSourcesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog=json.loads((ROOT/'public/data/catalog.json').read_text())
        cls.received=json.loads((ROOT/'scripts/received-sources.json').read_text())
        cls.manifest=json.loads((ROOT/'scripts/source-audits.json').read_text())
        cls.docs={d['arquivo']:d for d in cls.catalog['documents']}
        cls.questions={q['id']:q for q in cls.catalog['questions']}
    def pdf(self,sha):return fitz.open(ROOT/'public/sources/originals'/f'{sha}.pdf')
    def test_all_eighteen_originals_match_inventory_by_bytes(self):
        self.assertEqual(len(self.received),18)
        for r in self.received:
            data=(ROOT/'public/sources/originals'/f'{r["sha256"]}.pdf').read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(),self.docs[r['document']]['sha256'])
            with self.pdf(r['sha256']) as pdf:self.assertEqual(len(pdf),self.docs[r['document']]['paginas'])
        self.assertTrue(all(d['available'] for d in self.catalog['documents']))
    def test_each_of_240_keys_is_read_from_its_original_and_code(self):
        identities={'P2026A':('INSP2502','001'),'P2026B':('INSP2502','006'),
                    'P2026C':('INSP2504','001'),'S2026B':('S5INSPER2026-2S','')}
        counted=0
        for eid,(code,version) in identities.items():
            qs=[q for q in self.questions.values() if q['examId']==eid]
            with self.pdf(qs[0]['audit']['sourceSha256']) as p:
                self.assertIn(code,' '.join(page.get_text() for page in p))
                if version:self.assertRegex(p[0].get_text(),version+r'\.\s*prova objetiva')
            with self.pdf(qs[0]['audit']['key']['sha256']) as p:text=p[0].get_text()
            self.assertIn(code,text)
            if version:self.assertRegex(text,version+r'\.\s*PROVA OBJETIVA')
            pairs=re.findall(r'\b(\d{1,2})\s*-\s*([ABCDE])\b',text)
            self.assertEqual(len(pairs),60);answers={int(n):a for n,a in pairs}
            self.assertEqual(set(answers),set(range(1,61)))
            for q in qs:
                self.assertTrue(q['readyForTraining'])
                self.assertEqual(q['audit']['key']['answer'],answers[q['audit']['sourceNumber']])
                self.assertEqual(q['audit']['key']['appliesToSha256'],q['audit']['sourceSha256']);counted+=1
        self.assertEqual(counted,240)
        self.assertEqual(self.questions['P2026A-Q01']['audit']['key']['answer'],'E')
        self.assertEqual(self.questions['P2026B-Q01']['audit']['key']['answer'],'A')
        self.assertEqual(sum(q['readyForTraining'] and not q['reservedForEvaluation'] for q in self.questions.values()),180)
        for eid in ['P2019','P2020','S2026A']:
            for q in self.questions.values():
                if q['examId']==eid:self.assertIsNone(q['audit']['key']);self.assertFalse(q['readyForTraining'])
    def test_all_400_printed_questions_options_and_cross_page_content_are_preserved(self):
        counted=0
        for exam in self.catalog['exams']:
            with self.pdf(self.docs[exam['document']]['sha256']) as pdf:
                lines=[]
                for i,page in enumerate(pdf):
                    page_lines=[]
                    for block in page.get_text('dict')['blocks']:
                        for line in block.get('lines',[]):
                            text=''.join(s['text'] for s in line['spans']).strip()
                            x,y,_,_=line['bbox']
                            if 28<y<page.rect.height-32:page_lines.append((int(x>280),y,x,i+1,text))
                    lines.extend(sorted(page_lines))
                    text=' '.join(re.sub(r'[-\u00ad]\s+','',page.get_text()).split())
                    if i:
                        for m in re.finditer(r'questões\s+(?:de\s+)?(\d{1,2})\s+(?:a|e)\s+(\d{1,2})',text,re.I):
                            first,last=map(int,m.groups())
                            for n in range(first,last+1):
                                q=self.questions[f'{exam["id"]}-Q{n:02d}']
                                self.assertIn(i+1,[p['page'] for p in q['audit']['media']],q['id'])
                headings=[(i,int(m[1])) for i,line in enumerate(lines) if (m:=re.fullmatch(r'QUESTÃO\s+(\d+)',line[4]))]
                self.assertEqual([n for i,n in headings],list(range(1,exam['count']+1)))
                for j,(start,n) in enumerate(headings):
                    stop=headings[j+1][0] if j+1<len(headings) else len(lines)
                    options=[line for line in lines[start:stop] if re.match(r'^\([ABCDE]\)',line[4])]
                    self.assertEqual([line[4][1] for line in options],list('ABCDE'))
                    q=self.questions[f'{exam["id"]}-Q{n:02d}'];pages=[p['page'] for p in q['audit']['media']]
                    self.assertEqual(q['source']['page'],lines[start][3])
                    self.assertTrue(set(line[3] for line in options)<=set(pages))
                    self.assertTrue(all(p['crop']==[0,0,1,1] for p in q['audit']['media']))
                    counted+=1
        self.assertEqual(counted,400)

if __name__=='__main__':unittest.main()
