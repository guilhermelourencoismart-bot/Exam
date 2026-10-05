"""Synthetic PDFs exercise incorporation. They do not approve real Insper content."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
import fitz
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from source_audit import incorporate

class SourceAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        (self.root/'scripts').mkdir();(self.root/'public/sources').mkdir(parents=True)
        self.source=self.root/'public/sources/nome-completamente-alterado.pdf'
        with fitz.open() as pdf:
            p=pdf.new_page(width=420,height=595);p.insert_text((25,30),'FIXTURE - TEXTO COMPARTILHADO')
            p.insert_text((25,55),'Dados para a questao 1. Formula y = 2x + 1.')
            p.draw_line((35,180),(180,90));p.draw_line((35,180),(35,80));p.draw_line((35,180),(190,180))
            p=pdf.new_page(width=420,height=595);p.insert_text((25,30),'QUESTAO 1 - Quanto e 2 + 2?')
            p.insert_text((25,70),'(A) 4\n(B) 5\n(C) 6\n(D) 7\n(E) 8')
            pdf.save(self.source)
        self.key=self.root/'public/sources/outra-denominacao.pdf'
        with fitz.open() as pdf:
            p=pdf.new_page(width=595,height=420);p.insert_text((25,30),'FIXTURE - GABARITO TESTE - VERSAO 1\n1 A');pdf.save(self.key)
        self.sha=hashlib.sha256(self.source.read_bytes()).hexdigest();self.key_sha=hashlib.sha256(self.key.read_bytes()).hexdigest()
        self.catalog={'documents':[{'arquivo':'caderno.pdf','sha256':self.sha,'available':False,'url':None},{'arquivo':'gabarito.pdf','sha256':self.key_sha,'available':False,'url':None}],
                      'questions':[{'id':'TEST-Q1','examId':'TEST','readyForTraining':False,'blockers':['PDF ausente'],'source':{'document':'caderno.pdf','available':False}}],
                      'stats':{'ready':0,'missingDocuments':2},'exams':[{'id':'TEST','readyCount':0}]}
        self.raw={'questoes':[{'decoded':{'id':'TEST-Q1','particao':'teste'}}],
                  'versoes':[{'decoded':{'id_canonico':'TEST-Q1','arquivo':'caderno.pdf','questao_original':1}}]}
        self.audit={'questionId':'TEST-Q1','sourceDocument':'caderno.pdf','sourceNumber':1,'sourceSha256':self.sha,
                    'complete':True,'versionChecked':True,'sharedContentChecked':True,'reviewedAt':'2026-10-05','reviewedBy':'Teste automatizado sintético',
                    'note':'Fixture sintética, não se refere a uma questão real.',
                    'parts':[{'document':'caderno.pdf','sha256':self.sha,'page':1,'crop':[0,0,1,1],'role':'Texto e gráfico compartilhados'},
                             {'document':'caderno.pdf','sha256':self.sha,'page':2,'crop':[0,0,1,1],'role':'Questão com alternativas'}],
                    'key':{'document':'gabarito.pdf','sha256':self.key_sha,'page':1,'number':1,'answer':'A','appliesToSha256':self.sha,'alternativesChecked':True},
                    'keyPairingEvidence':'Código TESTE e versão 1 conferidos nesta fixture; alternativas e número coincidem.'}
    def tearDown(self):self.temp.cleanup()
    def run_audit(self,audits,check=False):
        (self.root/'scripts/source-audits.json').write_text(json.dumps({'schemaVersion':1,'documentLinks':[],'questionAudits':audits}))
        return incorporate(copy.deepcopy(self.catalog),self.raw,self.root,check)
    def test_name_changes_do_not_change_identity_or_auto_approve(self):
        result=self.run_audit([]);self.assertEqual(result['stats']['missingDocuments'],0)
        self.assertFalse(result['questions'][0]['readyForTraining']);self.assertTrue(result['questions'][0]['reservedForEvaluation'])
    def test_shared_content_pages_graph_and_alternatives_are_preserved(self):
        result=self.run_audit([self.audit]);self.assertEqual(result['stats']['ready'],1)
        media=result['questions'][0]['audit']['media'];self.assertEqual([m['page'] for m in media],[1,2])
        for m in media:self.assertTrue((self.root/'public'/m['imageUrl'].lstrip('/')).read_bytes().startswith(b'\x89PNG'))
        self.assertEqual(self.run_audit([self.audit],check=True),result)
    def test_complete_without_key_never_allows_automatic_correction(self):
        audit=copy.deepcopy(self.audit);audit['key']=None;result=self.run_audit([audit])
        self.assertFalse(result['questions'][0]['readyForTraining']);self.assertIn('sem gabarito',result['questions'][0]['blockers'][0])
    def test_unchecked_alternatives_and_wrong_versions_are_rejected(self):
        for change in ('alternatives','sha','number'):
            audit=copy.deepcopy(self.audit)
            if change=='alternatives':audit['key']['alternativesChecked']=False
            elif change=='sha':audit['key']['appliesToSha256']='c'*64
            else:audit['sourceNumber']=2
            with self.assertRaises(AssertionError):self.run_audit([audit])

if __name__=='__main__':unittest.main()
