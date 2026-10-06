# Meu preparo · Insper 2027.1 · versão 0.4.1

Aplicativo pessoal em Next.js e TypeScript, executado no seu computador. Mantém 400 registros do SQLite original, sem banco remoto e sem API paga.

Para baixar pelo GitHub, entre na sua conta, abra [o repositório na versão main](https://github.com/guilhermelourencoismart-bot/Exam/tree/main) e clique em **Code → Download ZIP**. O ZIP inclui o aplicativo e os PDFs; a pasta extraída se chama `Exam-main`.

**240 questões completas estão liberadas com gabarito da versão conferida:** 60 de cada uma das aplicações P2026A, P2026B, P2026C e do simulado ALFRED S2026B. Os 18 PDFs originais recebidos coincidem byte a byte com o inventário, independentemente dos nomes. Os 160 itens restantes têm páginas completas para consulta, mas continuam sem correção automática. Veja os motivos e o pareamento em [docs/FONTES.md](docs/FONTES.md).

As 60 questões P2026C permanecem **reservadas para avaliação** e excluídas por padrão. Há 180 disponíveis sem expor essa reserva, sendo 120 de seleção e 60 de terceiros. O filtro inicial usa seleção e oferece 120. Para incluir a prova reservada, marque explicitamente a opção no treino.

## Substituir a versão anterior sem perder seus dados

**Correção de conexão 0.4.1:** novas instalações enviam `ext_agent_host_id=urn:uuid:<UUIDv4>`. O UUID puro gravado pela 0.4.0 é migrado automaticamente ao iniciar uma conexão, preservando o UUID e o Client ID emitido. Logins com Client ID emitido omitem `agent_name_hint`. Não exclua `installation.json`, credenciais ou dados do navegador. Se recebeu `invalid_authorize_request` referente a `ext_agent_host_id`, atualize conforme abaixo, feche a janela antiga de autorização e clique em **Conectar ChatGPT** para abrir uma nova tentativa; a URL antiga não é corrigida pela atualização.

1. Na versão antiga, clique em **Exportar backup** (na versão 0.3, em **Mais → Dados e configurações**). Guarde o arquivo `insper-backup.json`.
2. No terminal antigo, pressione **Ctrl+C**. Feche todas as abas do aplicativo.
3. Renomeie a pasta antiga `Exam` para `Exam-anterior`. **Não a apague.**
4. Extraia o ZIP baixado. No download do GitHub, renomeie a pasta extraída `Exam-main` para `Exam`; no ZIP entregue diretamente, ela já se chama `Exam`. Node.js **24 LTS** continua sendo o requisito.
5. Abra um terminal nessa nova pasta. No Windows, abra `Exam` no Explorador, digite `cmd` na barra de endereço e pressione Enter. No macOS, abra o Terminal, digite `cd `, arraste a nova pasta `Exam` para a janela e pressione Enter.
6. Execute um comando por vez:

```sh
npm ci
npm run dev
```

7. Espere `Ready` e abra **http://127.0.0.1:3000**, no **mesmo navegador e perfil** da versão anterior. Mantenha o terminal aberto.
8. As marcações devem aparecer automaticamente: a base IndexedDB conserva o nome anterior e foi migrada sem excluir registros. Se não aparecerem, clique em **Importar backup** e selecione o backup salvo. A importação não apaga dados existentes.

Use exatamente o mesmo endereço e porta. `localhost`, `127.0.0.1`, outra porta, outro perfil e outro navegador têm bases separadas. Para encerrar: Ctrl+C. Para abrir outra vez: `npm run dev` na nova pasta.

A aplicação não exige Python para uso normal. Para IA, autorize seu ChatGPT pelo próprio aplicativo. Não precisa copiar tokens, cadastrar chave de API, contratar banco remoto ou hospedagem.

## Provas e Revisão

A entrada principal é **Provas**: configure → responda → consulte o relatório. **Revisão** reúne todas as provas finalizadas e o caderno de erros. Fontes, acervo, backup e configurações ficam em **Mais**.

**Inéditas por IA** é a opção principal. A versão 0.4.0 implementa o registro e consentimento próprios do aplicativo via **Sign in with ChatGPT**, inferência direta com OAuth, geração estruturada e revisão em lotes. Não utiliza login do Codex nem chave de API paga. A chamada real com sua conta ainda precisa ser validada no seu computador; os testes de IA executados aqui usam respostas simuladas.

Depois de atualizar:

1. Em **Provas → Inéditas por IA**, clique em **Conectar ChatGPT**.
2. Na janela oficial da OpenAI, entre na conta que tem Plus e autorize **Meu preparo Insper** a usar os tokens do plano. Se a janela não abrir, clique em **Abrir autorização oficial do ChatGPT**.
3. Quando aparecer **ChatGPT conectado**, clique em **Testar 3 questões de sistemas lineares**.
4. Espere gerar e revisar. As três questões abrirão automaticamente, com enunciado, equações e alternativas. Clique em **Iniciar ou retomar** para responder.
5. Depois dessa exibição, use **Gerar prova inédita** com as quantidades personalizadas ou **Prova completa** (60 questões, 15 por área). Pedidos simples, como “20 questões de português”, continuam configurando a composição antes da geração.

O registro acontece automaticamente no primeiro consentimento. Nenhum Client ID precisa ser copiado manualmente. A tela distingue conta autorizada de geração autenticada já exibida. Só conclui um lote depois de `response.completed`, valida o formato e revisa o gabarito em outra chamada. No teste inicial, o código também resolve o sistema e confere as alternativas. Uma prova abre apenas quando toda a quantidade foi aceita. Se houver limite ou interrupção, clique em **Retomar geração**; os lotes aceitos continuam salvos no computador. Os limites são os do ChatGPT e gerar/revisar consome essa capacidade. Nenhuma questão do banco é usada para completar a geração.

Credenciais ficam fora da pasta do aplicativo, em `%LOCALAPPDATA%\InsperPreparo`, cifradas com DPAPI do seu usuário do Windows. Elas não entram no navegador, GitHub ou backup. Não copie essa pasta para o GitHub nem a compartilhe. A implementação Windows usa Node.js e Windows PowerShell, sem WSL; a execução real do DPAPI e do login em Windows ainda depende do teste na sua máquina. Veja [IA e solução de erros](docs/IA.md).

Para treinar agora, escolha **Banco conferido**, configure a composição e clique em **Criar prova do banco**. As questões existentes são identificadas como oficiais ou de terceiros.

O relatório individual e o consolidado incluem áreas, disciplinas, assuntos, evolução comparável, tempos, motivos dos erros, prioridades explicadas, metas pessoais, pesos configurados e simulação. Veja [os requisitos atuais](docs/REQUISITOS.md) e [as regras dos indicadores](docs/INDICADORES.md).


Em **Provas → Banco conferido**, escolha origem, prova, matéria, disciplina, assunto e quantidade. A tela informa quantas questões estão efetivamente disponíveis e quantas faltam. Não acrescenta outro assunto para completar a quantidade.

Uma questão só entra na lista após revisão de completude, texto compartilhado, versão e alternativas, com gabarito pareado para aquela versão. As 60 questões com `particao=teste` foram preservadas e ficam fora das listas por padrão; incluí-las exige marcar a opção correspondente. Uma questão completa sem gabarito permanece consultável, sem correção automática.

O treino funciona com o conteúdo aprovado:

- **Criar prova do banco** salva a tentativa; **Iniciar ou retomar** começa o relógio.
- Uma questão por vez, com fac-símile de enunciado, alternativas, fórmulas e figuras. Clique na imagem para ampliar; há link para a página original.
- Selecione A–E, navegue pelos números e marque o que quer revisar. A resposta aparece imediatamente; “Salvando…” indica a gravação em andamento. Se a gravação falhar, o treino pausa e volta ao último estado salvo.
- **Pausar** para o tempo. Sair da tela, ocultar a aba, atualizar ou fechar deixa a tentativa pausada. Ao voltar, clique em **Iniciar ou retomar**.
- **Finalizar prova** pede uma confirmação e fecha as respostas. Mostra acertos, erros, brancos, percentual sobre todas as questões e tempo total/por questão.
- Erros respondidos vão para **Revisão → Caderno de erros**. Branco não é tratado como erro. Não são criadas justificativas nem resoluções supostamente oficiais.

O cronômetro usa tempo monotônico e salva checkpoints a cada segundo, além de respostas/navegação/pausa. Uma interrupção abrupta do navegador ou sistema pode perder até aproximadamente um segundo ainda não gravado; não é adicionado tempo fechado para compensar isso. O treino exige navegador atualizado com Web Locks (por exemplo Chrome ou Edge atuais) para evitar duas abas alterando a mesma tentativa.

## PDFs originais

Em **Mais → Fontes e acervo → Selecionar PDFs**, é possível receber arquivos locais, até 32 MB por PDF. O nome não define a identidade: o conteúdo é identificado por SHA-256. Se o PDF foi reexportado e o hash mudou, fica pendente de análise de texto, identificação de prova e versão. Nada é liberado por nome ou similaridade apenas.

Os 18 originais desta entrega já estão em `public/sources/originals`, separados do histórico pessoal, acompanhados de páginas renderizadas a 180 dpi. Não precisa enviá-los novamente nem executar extração para usar o aplicativo.

As páginas integrais podem mostrar questões vizinhas: responda somente ao número indicado na tentativa. Essa opção conserva gráficos, figuras, fórmulas, sublinhados e textos compartilhados; a tabela periódica original acompanha as questões de Química. Há ampliação e link para a página original.

Novas fontes importadas pelo aplicativo não liberam questões automaticamente. Precisam de revisão documental e visual. Para concluir o pareamento do simulado identificado como maio, envie um gabarito que identifique o código **SAINSPEROBJ022026**, ou evidência editorial que ligue o gabarito de abril ao caderno recebido. Também faltam gabaritos dos cadernos antigos de 2019.2 e 2020.1. Um arquivo importado apenas no computador pessoal não fica acessível ao ambiente desta conversa.

## Backup e atualização

O backup versão 4 inclui também enunciados, alternativas, gabaritos, resoluções e revisões das questões autorais. Quando não há conteúdo autoral, conserva o formato 3. Aceita backups versões 1, 2, 3 e 4. Mantém marcações, tentativas, respostas, tempos, telemetria existente, configurações, motivos de erro, metas e pesos pessoais. Registros de visitas e mudanças ausentes nas tentativas antigas permanecem indisponíveis. O caderno de erros é reconstruído a partir das tentativas finalizadas, sem estatísticas duplicadas.

Pause antes de exportar/importar. A importação é validada e atômica, sem alterações parciais. Tentativas existentes com o mesmo identificador são preservadas e a tela informa quantas foram mantidas. Um gabarito adulterado ou uma revisão de conteúdo incompatível é rejeitado; o backup não pode liberar conteúdo.

O backup **não inclui os PDFs**. Em atualizações futuras, preserve também `public/sources/originals`, `public/sources/rendered` e o catálogo/auditorias correspondentes às tentativas antigas. Guarde sempre a pasta anterior; um backup de tentativa requer a mesma versão de conteúdo conferido para restaurar. Ao substituir a versão anterior entregue nesta conversa, os PDFs verificados já vêm no novo ZIP. Preserve a pasta antiga e seu backup; se você importou outros PDFs locais, copie esses arquivos para a nova pasta sem substituir os arquivos desta entrega.

## Organização e verificações

`src/domain`: filtros, tentativa, cronômetro e correção puros. `src/storage`: IndexedDB e backup. `src/hooks`: sessão ativa e proteção entre abas. `src/components`: catálogo, fontes, treino, imagens, resultado e revisão. `src/server/ai`: OAuth, verificação de identidade, armazenamento protegido, inferência e geração. `src/app/api/ai`: rotas exclusivas do servidor local. `src/ai`: contratos públicos sem tokens. `src/server` e `src/app/api/sources`: recepção local de PDFs. `scripts`: extração/auditoria.

```sh
npm ci
npm test
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

Encerre outros servidores na porta 3000 antes de `test:e2e`. O teste inicia seu próprio servidor de produção. Pode usar um Chromium já instalado via `PLAYWRIGHT_CHROMIUM_PATH`.

Para reextrair conteúdo: Python 3.12+, `pdftotext` (Poppler), e `python3 -m pip install -r scripts/requirements.txt`. Depois: `npm run sources:inspect`, `npm run data:extract`, `npm run data:check`, `npm run test:sources`. A aprovação fica em `scripts/source-audits.json`; não preencha marcações de revisão sem conferir os PDFs reais. Os passos detalhados estão em [docs/FONTES.md](docs/FONTES.md).

Veja [a verificação e seus limites](docs/VERIFICACAO.md), [a auditoria do SQLite](docs/DADOS.md) e [o estado da IA](docs/IA.md). A geração foi implementada e testada com chamadas simuladas; sua validação autenticada depende do primeiro teste no computador pessoal. Correção de redação permanece para a próxima etapa.
