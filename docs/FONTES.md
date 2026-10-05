# Incorporação dos originais · 0.2.1

Os 18 PDFs de `Insper-PDFs-originais.zip` foram extraídos e identificados pelo conteúdo. **Todos coincidem exatamente por SHA-256 com os documentos do SQLite**, embora nomes e numeração de arquivos tenham mudado. Há 13 cadernos/versões e cinco gabaritos. O programa já recebido completa os 19 documentos do inventário; o relatório independente continua separado. Nenhum PDF foi reexportado ou modificado.

Os arquivos ficam em `public/sources/originals/<sha256>.pdf` e são servidos por `/api/sources/<sha256>`. `scripts/received-sources.json` conserva a relação entre nome recebido, nome do inventário, hash e páginas. Renomear o arquivo recebido não altera identidade, versão nem chave.

## Liberação e bloqueios

| Conjunto canônico | Total | Com correção automática | Situação |
| --- | ---: | ---: | --- |
| P2026A · seleção 2026.1, aplicação A | 60 | 60 | INSP2502 / 001, gabarito 30.11.2025 |
| P2026B · seleção 2026.1, aplicação B | 60 | 60 | INSP2502 / 006, gabarito 21.12.2025 |
| P2026C · seleção 2026.2, aplicação C | 60 | 60 | INSP2504 / 001, gabarito 07.06.2026; reservada |
| S2026B · ALFRED setembro | 60 | 60 | S5INSPER2026-2S, gabarito 04–08.09.2026 |
| P2019 · seleção 2019.2, caderno 1 | 50 | 0 | Gabarito não fornecido |
| P2020 · seleção 2020.1, caderno 1 | 50 | 0 | Gabarito não fornecido |
| S2026A · ALFRED, identificado no banco como maio | 60 | 0 | Vínculo da chave de abril não comprovado |
| **Total** | **400** | **240** | **160 completas para consulta, sem correção automática** |

Os códigos foram conferidos nas capas/rodapés e nas chaves. As 240 letras foram extraídas das linhas numeradas dos quatro gabaritos pareados e comparadas individualmente com as letras do SQLite: nenhuma divergência. A chave de A não foi aplicada a B, apesar de ambas serem INSP2502: o código 001/006 distingue os cadernos, assim como a data nos gabaritos. A questão 1 de A usa E; a questão 1 de B usa A. Não foi resolvida uma questão para criar uma chave.

O quinto gabarito é uma grade marcada visualmente de **27/04 a 03/05/2026**, ALFRED, rotulada abril. O caderno recebido como maio traz **SAINSPEROBJ022026** e 1º semestre de 2026, sem identificação documental que ligue esse código à grade recebida. Sem essa comprovação, as 60 letras não são aplicadas. Para liberá-las, é necessário o gabarito identificado por esse código ou evidência editorial do vínculo. Não basta o nome do arquivo, a semelhança de layout ou resolver algumas questões.

As 60 questões de P2026C têm `particao=teste`. O sinal foi mantido e a inclusão no treino exige opção explícita. Há **180 liberadas sem expor a reserva**: 120 de seleção e 60 de terceiros. O filtro inicial de seleção oferece 120. Esses números distinguem prontidão documental de disponibilidade no filtro escolhido.

## Integridade e conferência visual

Foram inspecionadas as páginas dos sete cadernos canônicos: os formatos de 2019/2020, os cadernos Vunesp recentes e os dois layouts ALFRED. A conferência contemplou figuras, gráficos, tabelas, fórmulas, alternativas, unidades, sublinhados e textos compartilhados. A verificação textual independente localizou os 400 números impressos e suas alternativas A–E em ordem de leitura por coluna; os números e páginas coincidem com os registros canônicos.

A entrega exibe **páginas integrais a 180 dpi**, evitando perda por recorte ou reconstrução textual. Uma página pode mostrar questões vizinhas; a tela informa o número que deve ser respondido. Foram incluídas as páginas anteriores com textos/figuras compartilhados e as continuações. Exemplos:

- P2026A Q04–08: texto de Machado de Assis na página 3, questões na página 4.
- P2026C Q04–08: artigo na página 3 e questões na página 4; Q10 acompanha a tirinha da página 4.
- P2020 Q48: dados dos três dados na página 16, questão na página 17.
- S2026A Q32: imagem e início na página 11; alternativas continuam na página 12.
- P2026A Q53: gráfico de catálise da página 16, alternativas A–E e legenda íntegros.
- Questões de Química: classificação periódica do próprio caderno, quando fornecida, incluída como referência.

As imagens são compartilhadas por hash de documento/página/recorte/renderizador: 140 páginas renderizadas atendem às 400 questões sem duplicar arquivos de imagem. Há ampliação de 100–400% e link para a página do PDF original. O texto do banco permanece sem alteração e serve à busca, sem substituir o fac-símile.

As **11 correspondências sinalizadas** no banco foram conferidas: P2020 Q34/Q38 no caderno canônico e nas versões V2/V3/V4; Q23 em V4; P2026A Q54; P2026C Q40. Nas versões antigas, as alternativas são permutadas. Os PDFs alternativos ficam no inventário para consulta; não são uma segunda lista de treino nem recebem letras de outra versão. O arquivo bruto conserva os 11 sinais históricos, enquanto `versionAudits` documenta a conferência. As 700 ocorrências de versão não foram contadas como 700 questões distintas.

## Auditoria e reprodução

`scripts/source-audits.json` contém 400 auditorias explícitas e 11 conferências das correspondências sinalizadas. Cada auditoria identifica questão, documento, hash, número impresso, páginas, revisão de versão/completude/contexto e, quando comprovada, a chave específica. `scripts/source-review-evidence.json` registra páginas das alternativas, dependências compartilhadas e identidade dos quatro pareamentos. O SQLite e `source-archive.json` mantêm todos os campos originais.

`source_audit.py` valida os vínculos com o mapa de versões, hashes, páginas e chave aplicada ao hash do caderno. Renderiza os fac-símiles e atribui uma revisão imutável à auditoria de cada questão. `data:check` regenera e compara catálogo e imagens byte a byte. Um item completo sem chave é consultável, mas nunca entra em tentativa com correção.

Para reproduzir: Python 3.12+, Poppler (`pdftotext`) e `python3 -m pip install -r scripts/requirements.txt`; então `npm run data:extract`, `npm run data:check` e `npm run test:sources`. O usuário final não precisa de Python: o ZIP já contém PDFs, imagens e catálogo.

Novos PDFs recebidos pelo aplicativo continuam sujeitos a revisão. Receber ou reconhecer um PDF não cria aprovação. `inspect_sources.py` usa hash e propõe similaridade textual apenas como candidato à identificação; não aprova versões ou gabaritos por inferência.
