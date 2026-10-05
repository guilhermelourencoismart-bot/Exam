"""Read-only, deterministic conversion. Never repairs or invents source content."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TABLES = ('questoes', 'edital', 'documentos', 'versoes', 'distratores')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pdf_pages(path):
    text = subprocess.check_output(['pdftotext', '-layout', str(path), '-'], text=True)
    pages = text.split('\f')
    if not pages[-1].strip():
        pages.pop()
    assert len(pages) == 24, f'Número inesperado de páginas: {path.name}'
    return pages


def normalize(text):
    return re.sub(r'\s+', ' ', text).strip()


def extract(check=False):
    database = ROOT / 'sources/banco.sqlite'
    conn = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    assert conn.execute('pragma integrity_check').fetchone()[0] == 'ok'
    tables = {row['name'] for row in conn.execute("select name from sqlite_master where type='table'")}
    assert tables == set(TABLES), 'Esquema SQLite inesperado; revisar antes de converter'
    raw = {}
    for table in TABLES:
        raw[table] = []
        for row in conn.execute(f'SELECT * FROM {table} ORDER BY id'):
            record = dict(row)
            decoded = json.loads(record['dados_json'])
            assert isinstance(decoded, dict)
            raw[table].append({'row': record, 'decoded': decoded})
    source_hash = sha(database)
    syllabus = ROOT / 'public/sources/conteudo-programatico-2027-1.pdf'
    report = ROOT / 'public/sources/relatorio-v1.pdf'
    syllabus_hash = sha(syllabus)
    documents = []
    for record in raw['documentos']:
        d = record['decoded']
        assert record['row']['id'] == d['arquivo']
        available = d['sha256'] == syllabus_hash
        documents.append({**d, 'available': available,
                          'url': '/sources/conteudo-programatico-2027-1.pdf' if available else None})
    by_file = {d['arquivo']: d for d in documents}
    syllabus_ids = {r['row']['id'] for r in raw['edital']}
    questions = []
    for record in raw['questoes']:
        r, d = record['row'], record['decoded']
        for column, key in [('id','id'),('prova','prova'),('natureza','natureza'),
                            ('numero','numero'),('pagina','pagina'),('disciplina','disciplina'),
                            ('tema','tema'),('subtema','subtema'),('microcompetencia','microcompetencia'),
                            ('dificuldade_estimada','dificuldade_estimada'),
                            ('ano_aplicacao','ano_aplicacao'),('gabarito','resposta')]:
            assert r[column] == d.get(key), f'Conflito SQL/JSON: {r["id"]}/{column}'
        doc = by_file[d['arquivo']]
        assert 1 <= d['pagina'] <= doc['paginas']
        assert d['resposta'] in (None, 'A', 'B', 'C', 'D', 'E')
        assert d['natureza'] in ('selecao', 'simulado_ALFRED')
        assert set(d['edital_ids']) <= syllabus_ids
        assert d['enunciado_extraido'].strip() and d['bloco_extraido'].strip()
        key_file = d.get('gabarito_arquivo')
        if key_file:
            assert key_file in by_file
            assert by_file[key_file]['pareamento'] == d['prova']
        # The source explicitly describes ALL text as search extraction. Without
        # original-page inspection, even nonvisual items must remain consultation-only.
        blockers = ['PDF original da questão não fornecido',
                    'Extração textual e elementos compartilhados ainda não conferidos no original']
        if d['visual'] or d['grafico'] or d['tabela']:
            blockers.append('Imagem, gráfico ou tabela sinalizado no banco; conteúdo visual ausente')
        if d['resposta'] is None:
            blockers.append('Gabarito ausente ou pareamento não demonstrado')
        else:
            blockers.append('Gabarito informado no banco; PDF do gabarito não conferido nesta versão')
        questions.append({
            'id': d['id'], 'examId': d['prova'], 'number': d['numero'],
            'origin': 'official' if d['natureza'] == 'selecao' else 'third-party',
            'discipline': d['disciplina'], 'macrotheme': d['macrotema'],
            'topic': d['tema'], 'subtopic': d['subtema'], 'skill': d['microcompetencia'],
            'text': d['enunciado_extraido'], 'rawBlock': d['bloco_extraido'],
            'answer': d['resposta'], 'answerStatus': d['gabarito_status'],
            'answerDocument': key_file, 'visual': bool(d['visual']),
            'graph': bool(d['grafico']), 'table': bool(d['tabela']),
            'stimulus': d['tipo_estimulo'], 'textStatus': d['texto_status'],
            'source': {'document': d['arquivo'], 'page': d['pagina'], 'column': d['coluna'],
                       'sha256': doc['sha256'], 'databaseSha256': source_hash,
                       'version': 'documento identificado por SHA-256', 'available': doc['available']},
            'estimates': {'difficulty': d['dificuldade_estimada'],
                          'minutesMin': d['tempo_estimado_min'], 'minutesMax': d['tempo_estimado_max'],
                          'status': d['estatuto_classificacao']},
            'syllabusIds': d['edital_ids'], 'readyForTraining': False, 'blockers': blockers,
            'sharedContentStatus': 'Não validado; o bloco pode conter trechos de outras questões',
        })
    ids = {q['id'] for q in questions}
    assert len(ids) == len(questions)
    for record in raw['versoes']:
        d = record['decoded']
        assert d['id_canonico'] in ids and d['arquivo'] in by_file
        assert d['resposta_versao'] in (None,'A','B','C','D','E')
    for record in raw['distratores']:
        assert record['decoded']['questao'] in ids
    for record in raw['edital']:
        d = record['decoded']
        assert record['row']['id'] == d['id'] and 1 <= d['pagina'] <= 24
        assert set(d['questoes_oficiais'] + d['questoes_simulado']) <= ids
        assert d['n_oficial'] == len(d['questoes_oficiais'])
        assert d['n_simulado'] == len(d['questoes_simulado'])
    exam_names = {
        'P2019': 'Insper 2019.2 · Caderno 1', 'P2020': 'Insper 2020.1 · Caderno 1',
        'P2026A': 'Insper 2026.1 · Aplicação A', 'P2026B': 'Insper 2026.1 · Aplicação B',
        'P2026C': 'Insper 2026.2 · Aplicação C',
        'S2026A': 'ALFRED · Simulado maio de 2026', 'S2026B': 'ALFRED · Simulado setembro de 2026'}
    exams = []
    for eid in sorted({q['examId'] for q in questions}):
        group = [q for q in questions if q['examId'] == eid]
        d = next(r['decoded'] for r in raw['questoes'] if r['decoded']['prova'] == eid)
        assert len({q['number'] for q in group}) == len(group)
        exams.append({'id': eid, 'title': exam_names[eid], 'origin': group[0]['origin'],
                      'count': len(group), 'answers': sum(q['answer'] is not None for q in group),
                      'date': d['data_aplicacao'], 'dateStatus': 'Data exata não comprovada' if eid == 'S2026A'
                      else 'Intervalo 04–08/09/2026 no relatório' if eid == 'S2026B' else 'Informada no banco',
                      'document': d['arquivo'], 'readyCount': 0,
                      'authenticity': 'Classificação documental do corpus; autenticidade externa não verificada'})
    report_pages, syllabus_pages = pdf_pages(report), pdf_pages(syllabus)
    claims = json.loads((ROOT / 'scripts/knowledge.json').read_text())
    for claim in claims:
        pages = report_pages if claim['source'] == 'report' else syllabus_pages
        assert normalize(claim['quote']) in normalize(pages[claim['page'] - 1]), f'Citação não localizada: {claim["id"]}'
        claim['sourceUrl'] = '/sources/relatorio-v1.pdf' if claim['source'] == 'report' else '/sources/conteudo-programatico-2027-1.pdf'
        claim['sourceVersion'] = 'Versão 1 · 24/09/2026' if claim['source'] == 'report' else 'Anexo 2027.1 · SHA-256 preservado'
    stats = {'questions': len(questions), 'official': sum(q['origin'] == 'official' for q in questions),
             'thirdParty': sum(q['origin'] == 'third-party' for q in questions),
             'answers': sum(q['answer'] is not None for q in questions),
             'missingAnswers': sum(q['answer'] is None for q in questions),
             'visual': sum(q['visual'] for q in questions), 'ready': 0,
             'versions': len(raw['versoes']), 'versionsNeedingReview': sum(
                 r['decoded']['status'] == 'conferência visual necessária' for r in raw['versoes']),
             'syllabusItems': len(raw['edital']), 'missingDocuments': sum(not d['available'] for d in documents)}
    assert stats['questions'] == 400 and stats['official'] == 280 and stats['answers'] == 240
    catalog = {'schemaVersion': 1, 'databaseSha256': source_hash, 'stats': stats,
               'questions': questions, 'exams': exams, 'documents': documents, 'claims': claims,
               'syllabus': [r['decoded'] for r in raw['edital']],
               'sources': [{'name': 'BANCO_MESTRE_DE_QUESTOES(1).sqlite', 'sha256': source_hash},
                           {'name': 'Relatorio_Insper_2027_1-1.pdf', 'sha256': sha(report), 'pages': 24},
                           {'name': 'Anexo Conteúdos Programáticos Vestibular Insper 2027-1.pdf',
                            'sha256': syllabus_hash, 'pages': 24}]}
    archive = {'schemaVersion': 1, 'databaseSha256': source_hash, 'tables': raw,
               'reportPages': [{'page': i+1, 'text': s} for i,s in enumerate(report_pages)],
               'syllabusPages': [{'page': i+1, 'text': s} for i,s in enumerate(syllabus_pages)]}
    conn.close()
    from source_audit import incorporate
    catalog = incorporate(catalog, raw, ROOT, check=check)
    return {'catalog.json': catalog, 'source-archive.json': archive}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outputs = extract(check=args.check)
    for name, content in outputs.items():
        path = ROOT / 'public/data' / name
        serialized = json.dumps(content, ensure_ascii=False, indent=2) + '\n'
        if args.check:
            assert path.read_text() == serialized, f'{name} está desatualizado; executar data:extract'
        else:
            path.write_text(serialized)
    print(json.dumps(outputs['catalog.json']['stats'], ensure_ascii=False, indent=2))
    print('OK: integridade SQLite, SQL/JSON, referências, páginas, citações e saídas determinísticas')
