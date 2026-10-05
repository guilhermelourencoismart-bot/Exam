"""Content incorporation requires explicit visual audits; filenames are not identity."""
import hashlib
import json
from pathlib import Path
import re


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def incorporate(catalog, raw, root, check=False):
    manifest = json.loads((root / 'scripts/source-audits.json').read_text())
    assert manifest['schemaVersion'] == 1
    pdfs = list((root / 'public/sources').rglob('*.pdf'))
    by_hash = {digest(p): p for p in pdfs}
    docs = {d['arquivo']: d for d in catalog['documents']}
    resolved = {}
    for d in docs.values():
        if d['sha256'] in by_hash:
            resolved[d['arquivo']] = (d['sha256'], by_hash[d['sha256']])
    for link in manifest['documentLinks']:
        assert link['document'] in docs and link['sha256'] in by_hash
        assert link['identityReviewed'] is True and link['versionReviewed'] is True
        assert len(link['evidence'].strip()) >= 20, 'Documentar identificação por conteúdo e versão'
        resolved[link['document']] = (link['sha256'], by_hash[link['sha256']])
    for name, d in docs.items():
        d['available'] = name in resolved
        d['url'] = '/api/sources/' + resolved[name][0] if d['available'] else None
        if d['available']:
            d['runtimeSha256'] = resolved[name][0]
            # Stable content-addressed storage: renaming received files must not
            # break old attempt snapshots, links or backup validation.
            sha, source_path = resolved[name]
            canonical = root / 'public/sources/originals' / (sha + '.pdf')
            if check or canonical.exists():
                assert canonical.exists() and digest(canonical) == sha
            else:
                canonical.parent.mkdir(parents=True, exist_ok=True)
                canonical.write_bytes(source_path.read_bytes())
    versions = [r['decoded'] for r in raw['versoes']]
    reviewed_versions = set()
    for review in manifest.get('versionAudits', []):
        signature = (review['document'], review['number'], review['questionId'])
        assert signature not in reviewed_versions
        assert any((v['arquivo'], v['questao_original'], v['id_canonico']) == signature for v in versions)
        assert review['document'] in resolved and review['sha256'] == resolved[review['document']][0]
        assert review['identityChecked'] is True and review['alternativesChecked'] is True
        assert len(review['note'].strip()) >= 20
        reviewed_versions.add(signature)
    by_id = {q['id']: q for q in catalog['questions']}
    decoded = {r['decoded']['id']: r['decoded'] for r in raw['questoes']}
    for q in by_id.values():
        d = decoded[q['id']]
        q['partition'] = d['particao']
        q['reservedForEvaluation'] = d['particao'] == 'teste'
        q['source']['available'] = q['source']['document'] in resolved
        if q['source']['available']:
            q['blockers'][0] = 'PDF recebido; completude, versão e elementos compartilhados ainda não conferidos'
    audited_ids = set()
    rendered = {}
    for audit in manifest['questionAudits']:
        qid = audit['questionId']
        assert qid in by_id and qid not in audited_ids
        audited_ids.add(qid)
        source = audit['sourceDocument']
        assert source in resolved
        source_sha, _ = resolved[source]
        assert audit['sourceSha256'] == source_sha
        assert any(v['id_canonico'] == qid and v['arquivo'] == source and
                   v['questao_original'] == audit['sourceNumber'] for v in versions), 'Versão/número não correspondem ao mapa'
        assert audit['versionChecked'] is True
        assert isinstance(audit['complete'], bool) and isinstance(audit['sharedContentChecked'], bool)
        assert len(audit['note'].strip()) >= 20 and audit['reviewedBy'].strip()
        assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', audit['reviewedAt'])
        assert audit['parts'], 'É necessário preservar o conteúdo visual'
        revision = hashlib.sha256(json.dumps(audit, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        media = []
        # PyMuPDF is needed only when there are actual incorporated source audits.
        import fitz
        for i, part in enumerate(audit['parts']):
            name = part['document']
            assert name == source, 'Os recortes e textos compartilhados devem pertencer à mesma versão do caderno'
            assert name in resolved
            sha, path = resolved[name]
            assert part['sha256'] == sha
            crop = part['crop']
            assert len(crop) == 4 and 0 <= crop[0] < crop[2] <= 1 and 0 <= crop[1] < crop[3] <= 1
            # A shared page has one immutable image, even when used by many
            # questions. Audit revisions still identify individual answer pairs.
            render_id = hashlib.sha256(json.dumps({'sha256':sha,'page':part['page'],
                'crop':crop,'renderer':'PyMuPDF-1.26.6-180dpi'},sort_keys=True).encode()).hexdigest()
            output = root / 'public/sources/rendered' / f'{render_id}.png'
            if render_id not in rendered:
                with fitz.open(path) as pdf:
                    assert 1 <= part['page'] <= len(pdf)
                    page = pdf[part['page']-1]
                    w, h = page.rect.width, page.rect.height
                    image = page.get_pixmap(matrix=fitz.Matrix(2.5,2.5),
                        clip=fitz.Rect(crop[0]*w,crop[1]*h,crop[2]*w,crop[3]*h),alpha=False).tobytes('png')
                if check:
                    assert output.read_bytes() == image, 'Recorte gerado está ausente ou alterado'
                else:
                    output.parent.mkdir(parents=True,exist_ok=True)
                    output.write_bytes(image)
                rendered[render_id] = True
            media.append({'imageUrl':'/'+output.relative_to(root/'public').as_posix(),
                          'pdfUrl':'/api/sources/'+sha,
                          'document':name,'sha256':sha,'page':part['page'],'crop':crop,'role':part['role']})
        key = audit.get('key')
        if key:
            assert key['document'] in resolved
            key_sha, path = resolved[key['document']]
            assert key['sha256'] == key_sha and key['appliesToSha256'] == source_sha
            assert key['answer'] in 'ABCDE' and len(key['answer']) == 1
            assert key['alternativesChecked'] is True and key['number'] == audit['sourceNumber']
            assert len(audit.get('keyPairingEvidence','').strip()) >= 20, 'Documentar pareamento, código, versão e alternativas'
            with fitz.open(path) as pdf:
                assert 1 <= key['page'] <= len(pdf)
            key = {**key, 'pdfUrl':'/api/sources/'+key_sha}
        q = by_id[qid]
        q['audit'] = {k:audit[k] for k in ('complete','versionChecked','sharedContentChecked','sourceDocument',
                     'sourceSha256','sourceNumber','reviewedAt','reviewedBy','note')}
        q['audit'].update({'revision':revision,'media':media,'key':key})
        q['readyForTraining'] = bool(audit['complete'] and audit['sharedContentChecked'] and key)
        q['blockers'] = ([] if q['readyForTraining'] else
                        [audit.get('blockedReason', 'Questão completa, mas sem gabarito seguramente pareado; sem correção automática')] if audit['complete'] and audit['sharedContentChecked'] else
                        ['Conferência de completude ou conteúdo compartilhado pendente'])
        q['sharedContentStatus'] = 'Conferido no fac-símile' if audit['sharedContentChecked'] else 'Não validado'
    catalog['stats']['missingDocuments'] = sum(not d['available'] for d in docs.values())
    catalog['stats']['ready'] = sum(q['readyForTraining'] for q in by_id.values())
    if 'versionsNeedingReview' in catalog['stats']:
        catalog['stats']['versionsNeedingReview'] = sum(v['status'] == 'conferência visual necessária' and
            (v['arquivo'], v['questao_original'], v['id_canonico']) not in reviewed_versions for v in versions)
    for exam in catalog['exams']:
        exam['readyCount'] = sum(q['readyForTraining'] for q in by_id.values() if q['examId'] == exam['id'])
    return catalog
