# Verificação da segunda etapa com fontes · 0.2.1

Executada na máquina atual: Linux, Node.js 24.19.0, npm 11.9.0, Chromium e PyMuPDF 1.26.6.

- `npm test`: **15 testes passaram**. Filtros, 240 auditorias com chave específica, preservação da base, migração de IndexedDB versão 1, respostas/tempos/posição, escrita concorrente, reserva, quantidade insuficiente, pausa, brancos separados e backup com rejeição de chave/tempo alterados.
- `npm run test:sources`: **7 testes passaram**. Três verificam os originais reais: os 18 hashes/paginação; as 240 letras relidas dos quatro PDFs de gabarito e os códigos/versões dos cadernos; todos os 400 números e alternativas A–E, páginas de texto compartilhado e continuação. Quatro continuam verificando falhas e renderização com PDFs sintéticos temporários.
- `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`: **14 testes passaram**, nenhum pulado. Catálogo real, filtros/celular, PDF renomeado servido byte a byte; treino real com gráfico, gabaritos de aplicações distintas, reserva e separação de terceiros; fluxos de pausa/recuperação/backup antigo e testes sintéticos de casos adicionais.
- `npm run build`: compilação de produção e TypeScript passaram. Rotas locais de recepção/leitura de PDFs usam Node.
- `npm run typecheck` e `npm run data:check`: passaram. Catálogo e fac-símiles são regenerados e comparados byte a byte; o SQLite não foi alterado.

**Treino real testado sem interceptar conteúdo:** P2026A Q51, Q52, Q53 e Q54, da aplicação INSP2502/001. Q53 contém o gráfico de entalpia/catálise na página 16, exibido em PNG com mais de 1400 pixels de largura. O teste abre/amplia a imagem, acessa o PDF original e confere o vínculo da tentativa com a auditoria real. Marca B/A/D/branco, navega, marca revisão, pausa, espera, atualiza, recupera respostas/posição/tempo, retoma e finaliza. O resultado é **2 acertos, 1 erro, 1 branco, 50%**. Somente Q52 entra no caderno de erros. A soma dos tempos individuais corresponde ao total ativo. O backup é restaurado em outro perfil, conservando resultado e erro.

Outro fluxo responde E à questão 1 de duas aplicações: acerta P2026A Q01 (chave E, código 001) e erra P2026B Q01 (chave A, código 006). O resultado e a referência do gabarito são conferidos em cada caso. A lista reservada P2026C passa de zero para 60 disponíveis somente com inclusão explícita; o simulado S2026A permanece bloqueado. Um pedido de cinco questões de Sistemas lineares informa duas disponíveis e três faltantes, sem completar com outro assunto.

Os testes sintéticos continuam exclusivos dos testes, carregados por interceptação de requisições. Não foram atribuídos ao catálogo real e não existe modo de demonstração que libere conteúdo. As três verificações de navegador com questões reais usam o catálogo e as páginas desta entrega.

**Situação real do conteúdo:** 18 originais identificados, todos os documentos do inventário disponíveis, 400 questões completas para consulta, 240 com correção automática. Permanecem 160 sem chave comprovada: 50 de 2019.2, 50 de 2020.1 e 60 do simulado identificado como maio. As 60 questões reservadas de P2026C estão aprovadas documentalmente, mas excluídas das listas por padrão. As 11 correspondências sinalizadas no banco foram conferidas; o sinal histórico permanece no arquivo bruto. A inspeção visual de páginas e a evidência de pareamento estão em `docs/FONTES.md` e nos manifestos de auditoria.

Login ChatGPT, geração por IA e correção de redação não foram implementados nem testados. O uso no computador pessoal do usuário não foi observado. Interrupção abrupta do navegador/sistema pode perder aproximadamente o último segundo não gravado; não são adicionadas horas de tempo fechado.
