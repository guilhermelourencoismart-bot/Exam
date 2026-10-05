# Auditoria e conteúdo utilizável

Fonte: `sources/banco.sqlite`, cópia byte a byte do anexo `BANCO_MESTRE_DE_QUESTOES(1).sqlite`. SHA-256: `e10394e195e1d829ce4d20bc3957f261caa753e4741939070fa0100a3a982fdc`.

O esquema foi inspecionado antes da conversão. Há cinco tabelas, todas com `dados_json`: `questoes` (400), `edital` (704), `documentos` (19), `versoes` (700), `distratores` (18). O SQLite é aberto em modo somente leitura pelo extrator. Não é um banco de histórico do aplicativo.

Saídas:

- `public/data/catalog.json`: catálogo normalizado, referências de fonte, situação de uso, provas, programa, inventário e afirmações tipadas do relatório.
- `public/data/source-archive.json`: todas as linhas SQL, strings `dados_json` originais, objetos decodificados, mapa de versões, análises de distratores e textos de ambos os PDFs por página. Permite auditoria sem descartar campos não usados pela interface.
- `public/sources/`: os dois PDFs iniciais e os 18 originais do ZIP intactos; os últimos estão em `originals/<sha256>.pdf`. O programático coincide **exatamente pelo SHA-256** com o documento 07 do inventário, embora tenha nome de arquivo diferente. O relatório é versão 1 de 24/09/2026, material analítico independente.

Resultado: 400 IDs canônicos únicos, 280 de seleção e 120 de simulados ALFRED; sete conjuntos. As provas de seleção são classificadas assim pelo corpus, com autenticidade externa não verificada. Os simulados não entram em uma estatística da banca. Não se contam as 700 versões como 700 itens distintos e não se transportam letras entre versões.

Há 240 respostas informadas e pareadas pelo identificador no banco, e 160 nulas. As 240 letras foram relidas nos quatro gabaritos originais correspondentes ao código do caderno, comparadas individualmente com o SQLite e aprovadas para essa versão. Não houve divergência nem alteração da base. O aplicativo não inventa nem completa as 160 nulas.

Os **18 PDFs** do ZIP coincidem por SHA-256 com os 18 documentos que faltavam: 13 cadernos/versões e cinco gabaritos. Há 154 questões com `visual=true` no arquivo bruto. As 11 correspondências sinalizadas no banco foram conferidas documental e visualmente; o arquivo bruto conserva o sinal histórico e a auditoria derivada registra a conferência. As versões antigas permutam alternativas: nenhuma letra foi transportada. A extração textual permanece apenas para busca, enquanto páginas integrais conferidas preservam os textos compartilhados e os elementos visuais das 400 questões.

**Utilizável agora:** consulta das 400 questões completas em fac-símile, filtros e treino com as 240 que têm gabarito comprovado. Dessas, 60 estão reservadas e exigem inclusão explícita. Os 160 itens sem chave permanecem somente para consulta. Preserva `bloco_extraido` sem tentar reconstruir fórmulas e alternativas por texto.

O relatório foi estruturado em observações, contagens/cálculos, estimativas não calibradas e hipóteses. Resumos têm trecho literal, versão e página. O texto completo por página e o PDF permitem consultar as partes não resumidas. Dificuldade e tempo não são dados de desempenho. Retorno pedagógico não é ganho real de acertos por hora. Frequência histórica não é probabilidade de cobrança em 2027.1.

Critérios de redação foram retirados do anexo, páginas 2–5, e rotulados “documentado”, separados das hipóteses do relatório. Não se criaram pesos, pontuação máxima ou rubrica ENEM. Resumos não substituem a íntegra, que preserva todas as causas de zero e demais observações.

O extrator verifica `integrity_check`, esquema, JSON, igualdade dos campos SQL/JSON, IDs únicos, letras válidas, documentos, limites de página, referências ao programa, pareamentos declarados, contagens de vínculos, versões e distratores. Cada citação estruturada é localizada na página citada após normalizar espaços. `--check` compara as saídas salvas com nova extração, byte a byte. Esses controles verificam consistência e rastreabilidade; não validam a resolução de uma questão nem a autenticidade externa de um PDF.

Próxima pendência de conteúdo: obter os gabaritos antigos e comprovar o vínculo da chave de abril com o caderno SAINSPEROBJ022026. Evolução e prioridade de estudos dependerão do histórico real; o índice pedagógico do relatório não é uma medida empírica de ganho de acertos.

## Segunda etapa

As partições originais foram acrescentadas ao catálogo: 220 `treino`, 120 `complementar`, 60 `teste`. O sinal de reserva não foi removido. A extração agora reconhece PDFs por conteúdo e aplica apenas auditorias explicitamente conferidas, gerando fac-símiles e chave de correção específica da versão. O arquivo bruto e o SQLite continuam intactos. O pacote atual contém 400 auditorias de questões, 11 conferências das correspondências antes sinalizadas, 18 recibos de originais e evidência de número/página/alternativas/pareamento. A situação atual e a rastreabilidade detalhada estão em `docs/FONTES.md`, `scripts/source-audits.json`, `scripts/source-review-evidence.json` e `scripts/received-sources.json`.
