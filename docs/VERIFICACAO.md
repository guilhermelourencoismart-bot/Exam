# Verificação de Provas, Revisão e fontes · 0.4.2

## Diagnósticos OAuth 0.4.2

`npm test`: **76 testes passaram**; `npm run typecheck` passou. Treze testes novos verificam diagnósticos distintos para issuer, audience, expiração, idade máxima de 10 minutos, iat futuro, nbf futuro, tipo de iat, nonce divergente/inválido, assinatura versus seleção/formato do JWKS, campos obrigatórios, ausência de vazamento por propriedades/mensagens arbitrárias e propagação até a página de callback e o estado da conexão. Os testes usam tokens sintéticos assinados com RS256, chaves de teste e respostas oficiais simuladas; o callback HTTP em loopback é real. Nenhum teste usa uma conta pessoal. Credenciais não são salvas após a rejeição.

`npm run build` também passou. Testes de fontes e navegador das versões anteriores não foram repetidos para esta mudança no diagnóstico do servidor.

Assinatura, issuer da descoberta, audience do Client ID emitido, exp, iat, nonce da tentativa, algoritmos permitidos, tolerância de 10 segundos e limite adicional de 10 minutos permanecem ativos. Nenhum valor de claim, token, `kid`, mensagem bruta ou URL de autorização é encaminhado no diagnóstico. Não há confirmação de causa nem de login real corrigido. A próxima tentativa no Windows deve produzir o diagnóstico específico.

## Correção OAuth 0.4.1

Cinco testes novos exercitam arquivos temporários reais: criação de `urn:uuid:<UUIDv4>`, persistência em outra instância, migração de UUID puro (inclusive maiúsculas) sem mudar UUID/Client ID, preservação de URN existente sem regravar e o valor efetivamente retornado por `LocalOAuth.start()` na URL de autorização. Verificam ausência de `agent_name_hint` quando há Client ID emitido e presença somente no registro inicial. Arquivos sintéticos de credenciais e provas permanecem intactos; nenhum token real é usado. O teste de callback existente também confere a omissão do nome no login posterior ao registro. Autenticação pessoal e geração real continuam pendentes de nova tentativa na máquina do usuário.

Verificações da correção: `npm test` passou com **63 testes**, `npm run typecheck` e `npm run build` passaram. Os testes de fontes e navegador abaixo foram executados na 0.4.0; não foram repetidos para esta mudança restrita ao registro OAuth.

## Verificações anteriores da versão 0.4.0

Executadas em Linux, Node.js 24.19.0, npm 11.9.0, Chromium e PyMuPDF 1.26.6.

- `npm test`: **58 testes passaram**. Mantêm os testes do catálogo, auditorias, gabaritos, pausa, backup e concorrência; acrescentam percentual consolidado de provas de tamanhos diferentes, classificação por área/assunto, primeira exposição e primeira resposta, campos antigos ausentes, visitas/mudanças, composição comparável antes/depois da exclusão de repetições, filtros de data em Brasília, pesos explícitos, simulação, rankings, recorrência, prioridades, pedidos/composição, migração de IndexedDB versão 2 e backup versão 3 com metas, motivos, pesos e configurações. Importação conflitante de motivo não cria um erro sobre uma resposta correta existente.
- `npm run test:sources`: **7 testes passaram**. Três verificam os originais reais: os 18 hashes/paginação; as 240 letras relidas dos quatro PDFs de gabarito e os códigos/versões dos cadernos; todos os 400 números e alternativas A–E, páginas de texto compartilhado e continuação. Quatro continuam verificando falhas e renderização com PDFs sintéticos temporários.
- `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`: **25 testes passaram**, nenhum pulado. Navegação com exatamente Provas/Revisão; acervo e fontes no menu; consulta de conteúdo sem chave; marcações/backup; PDF renomeado; prova real com gráfico; chaves de aplicações distintas; reserva e terceiros; pedido inédito salvo sem geração fictícia; consolidação ponderada de resultados conhecidos e primeira resposta; metas/pesos restaurados; motivo de erro, simulação e lista de revisão; configuração, questão, resultado individual e revisão em desktop (1440 px) e celular (390 px), sem rolagem horizontal do documento; fluxo sintético completo com visitas/mudanças, pausa/reload, fechamento da aba e backup antigo.
- `npm run build`: compilação de produção e TypeScript passaram. Rotas locais de PDFs e IA usam Node; inclui OAuth, armazenamento protegido, geração e recepção/leitura de PDFs.
- `npm run typecheck` e `npm run data:check`: passaram. Catálogo e fac-símiles são regenerados e comparados byte a byte; o SQLite não foi alterado.

**Treino real testado sem interceptar conteúdo:** P2026A Q51, Q52, Q53 e Q54, da aplicação INSP2502/001. Q53 contém o gráfico de entalpia/catálise na página 16, exibido em PNG com mais de 1400 pixels de largura. O teste abre/amplia a imagem, acessa o PDF original e confere o vínculo da tentativa com a auditoria real. Marca B/A/D/branco, navega, marca revisão, pausa, espera, atualiza, recupera respostas/posição/tempo, retoma e finaliza. O resultado é **2 acertos, 1 erro, 1 branco, 50%**. Somente Q52 entra no caderno de erros. A soma dos tempos individuais corresponde ao total ativo. O backup é restaurado em outro perfil, conservando resultado e erro.

Outro fluxo responde E à questão 1 de duas aplicações: acerta P2026A Q01 (chave E, código 001) e erra P2026B Q01 (chave A, código 006). O resultado e a referência do gabarito são conferidos em cada caso. O recorte de Matemática da prova reservada P2026C passa de zero para 15 disponíveis somente com inclusão explícita; o simulado S2026A permanece bloqueado. Um pedido de cinco questões de Sistemas lineares informa duas disponíveis e três faltantes, sem completar com outro assunto.

Os testes sintéticos continuam exclusivos dos testes, carregados por interceptação de requisições. Não foram atribuídos ao catálogo real e não existe modo de demonstração que libere conteúdo. As três verificações de navegador com questões reais usam o catálogo e as páginas desta entrega.

**Situação real do conteúdo:** 18 originais identificados, todos os documentos do inventário disponíveis, 400 questões completas para consulta, 240 com correção automática. Permanecem 160 sem chave comprovada: 50 de 2019.2, 50 de 2020.1 e 60 do simulado identificado como maio. As 60 questões reservadas de P2026C estão aprovadas documentalmente, mas excluídas das listas por padrão. As 11 correspondências sinalizadas no banco foram conferidas; o sinal histórico permanece no arquivo bruto. A inspeção visual de páginas e a evidência de pareamento estão em `docs/FONTES.md` e nos manifestos de auditoria.

Login ChatGPT e geração por IA estão implementados, com verificações simuladas descritas abaixo; não há geração autenticada validada na máquina pessoal. Correção de redação continua pendente. Interrupção abrupta do navegador/sistema pode perder aproximadamente o último segundo não gravado; não são adicionadas horas de tempo fechado.

## Resultados conhecidos dos relatórios

Duas provas de Matemática usam os snapshots conferidos de questões reais, com respostas e tempos inseridos explicitamente pelo teste: uma tem 1 acerto e 1 branco (2 questões, 60 s cada); a outra tem 9 acertos e 1 erro (10 questões, 30 s cada). O consolidado é **10/12 = 83,3%**, 11 respondidas, 1 erro, 1 branco, 7 min ativos e 35 s/questão sobre 12 tempos. A média simples de 50% e 90% (70%) é rejeitada. Há 10 questões distintas e 2 ocorrências repetidas. O filtro de primeira resposta retorna 10/10; a primeira ocorrência em branco não é tratada como uma resposta A–E. O cenário do erro selecionado mostra 11/12 = 91,7%, sem modificar o resultado. A lista de revisão recém-criada fica fora do consolidado até ser finalizada.

Os snapshots do teste de relatórios conservam fontes reais, mas **essas respostas/tempos são dados conhecidos de teste**, não uma sessão pessoal observada. Nenhuma telemetria é acrescentada a esses snapshots antigos. A prova com gráfico é respondida efetivamente no navegador e exercita o relógio real.

Foram inspecionadas visualmente as capturas de configuração, prova com gráfico e tabela periódica, resultado individual e revisão consolidada em computador e celular. A ausência de uma área fica identificada como dados insuficientes, sem nota zero. Os fac-símiles permanecem integrais e podem ser ampliados. Gráficos e tabelas preservam denominadores e grupos comparáveis. A nota ponderada testada usa pesos pessoais, não pesos oficiais presumidos.

Uma prova completa também foi criada pela interface e exportada: 60 itens, exatamente 15 por área, fontes oficiais e tentativa pausada excluída da consolidação. Outro teste usa simulados completos A/B com 30/60 e 45/60 acertos conhecidos: **75/120 = 62,5%**, duas provas comparáveis e radar com as quatro áreas; a média das últimas comparáveis também é 62,5%.

O teste de composição após repetições usa duas provas de 60 itens com distribuição original idêntica, porém a segunda tem somente duas questões de Física novas. A composição dessas duas questões não é comparável à primeira prova completa; o histórico comparável fica indisponível em vez de produzir uma evolução enganosa.

## IA: o que foi realmente verificado

**Nenhuma chamada autenticada com a conta pessoal foi feita.** A rede desta máquina bloqueia os domínios oficiais com `Tunnel connection failed: 403 Forbidden`. A implementação segue o resumo das páginas SIWC fornecido pelo usuário; veja as fontes e o alcance da consulta em [IA.md](IA.md).

Os 25 novos testes unitários usam exclusivamente credenciais e respostas sintéticas. Verificam registro dinâmico e Client ID emitido, PKCE S256, host/state/nonce, callback HTTP verdadeiro em loopback com troca OAuth simulada, ausência de client secret, consentimento recusado e scopes insuficientes, assinatura real RS256 de ID tokens sintéticos e rejeição por issuer/audience/expiração/nonce/assinatura, renovação de token, origem/Host/sessão das rotas, SSE/UTF-8 e exigência de response.completed, limite e interrupção, algoritmo de sistemas lineares, backup 4 e versões conflitantes, proteção AES-GCM real em Linux e ausência de tokens em status/backup. A verificação do script DPAPI confere seu uso de CurrentUser e stdin; **não executou DPAPI em Windows**.

A geração em lote é testada com um provedor falso injetado somente nos testes: três sistemas, 60 questões com 15 por área, 12 lotes e 12 revisões, discordância de gabarito, cálculo independente, respostas repetidas, limite após um lote e retomada sem perder as cinco questões aceitas. O teste comprova que a resolução salva é a do revisor independente. Esses resultados não demonstram qualidade ou disponibilidade real do modelo. Não há modo falso de geração em produção.

Os três testes de navegador de IA são explicitamente denominados **SIMULADO** e interceptam somente as rotas de conexão/geração. Exercitam clicar Conectar, abertura da janela, primeiro teste, progresso, exibição dos três sistemas e alternativas, ausência de resolução no treino, respostas A/B/branco, pausa sem incremento de tempo, reload, retomada, relatório **1/3 = 33,3%, 1 erro, 1 branco**, resolução autoral, exportação/importação de backup 4 em outro perfil e criação de revisão a partir do erro. A importação não autoriza ChatGPT nem valida uma conexão. Foram conferidas telas de conexão e questão autoral em 1440 e 390 px, sem rolagem horizontal.

As verificações com PDFs, catálogo e relógio real do banco continuam como descritas acima; as métricas dos relatórios permanecem calculadas por código. Fontes, 240 liberações oficiais/terceiros, 160 bloqueios e reservas não mudaram.

Para concluir a validação real: instalar no Windows, autorizar o aplicativo com a conta Plus, executar **Testar 3 questões de sistemas lineares** e confirmar sua exibição. Isso também valida o DPAPI na máquina pessoal. O aplicativo só marca geração validada depois das respostas autenticadas concluídas e das questões exibidas; a suíte simulada não altera esse estado na instalação do usuário.
