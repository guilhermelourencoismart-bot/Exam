# Requisitos atuais · versão 0.4.0

A geração inédita por IA é o objetivo principal. Questões oficiais e simulados de terceiros permanecem uma alternativa secundária, identificada por origem. Um sorteio ou seleção do banco nunca será chamado de geração inédita.

A interface tem exatamente duas entradas principais:

- **Provas**: configurar prova → responder → relatório. Prova completa com 60 questões, 15 de Matemática, 15 de Português, 15 de Ciências Humanas e 15 de Ciências da Natureza. Personalizada com matérias, disciplinas, assuntos e quantidades; interpretação local de pedidos simples, com conferência da composição. Configurações, provas salvas e tentativas em andamento ficam nesta área.
- **Revisão**: todas as provas finalizadas por padrão; filtros de período, matéria, disciplina, assunto, origem e primeira resposta. Indicadores individuais e consolidados compartilham o mesmo código.

Fontes, consulta ao acervo, backup, metas, pesos e estado da IA ficam no menu **Mais**. Não há banco remoto nem alternativa paga de API. O aplicativo continua local, com Next.js/TypeScript e IndexedDB.

## Implementado

Cronômetro ativo total e por questão, pausa, recuperação após fechar/atualizar, gabaritos de versões conferidas, relatório por área/disciplina/assunto, radar, evolução por composições comparáveis, melhores resultados e média ponderada de até cinco tentativas comparáveis, análise de tempo, visitas/mudanças nas novas tentativas, caderno de erros com motivos pessoais, revisão dos erros selecionados, prioridades explicadas, metas, pesos pessoais e cenário explicitamente simulado.

As 400 questões e 18 PDFs originais são preservados: 240 têm correção automática comprovada, 60 delas reservadas e excluídas por padrão. Outras 160 são consultáveis sem correção automática. Nada foi liberado por falta de gabarito ou por semelhança de nome.

Registro dinâmico próprio, consentimento para uso dos tokens do ChatGPT, PKCE S256, state/nonce, verificação criptográfica do ID token e escopos, renovação e inferência direta em streaming. Botões Conectar ChatGPT e Gerar prova inédita operacionais; sem Codex app-server nem API key. Primeiro teste de três sistemas lineares, depois personalizadas e 60 questões em lotes de até cinco. Revisão independente por IA e conferência algébrica dos sistemas; integridade das alternativas, quantidades e taxonomia; sem substituição por banco.

Conteúdo autoral é preservado no snapshot da tentativa, com resolução e origem. Entra no treino, relatórios, comparações, filtros, caderno de erros e listas de revisão. Credenciais são exclusivas do servidor local e protegidas com DPAPI no Windows, fora do GitHub e do backup. Pedidos salvos continuam sendo configurações, não resultados. A interpretação de frases segue por código; a geração faz chamadas de IA.

## Ainda pendente

Validar uma chamada autenticada e as três questões exibidas com a conta pessoal do usuário, no Windows. Os testes desta entrega simulam as respostas da OpenAI; não demonstram aceitação real do registro, modelos ou limites da conta. A rede da máquina de desenvolvimento bloqueia os domínios oficiais com 403. Verificação real de DPAPI em Windows também é pendente.

Correção real de redação permanece pendente. Os relatórios exibem “não avaliada” quando não há correção; há estrutura para apresentar critérios e comentários recebidos com sua origem, sem inventar notas.

Média de turma, ranking externo, percentil e corte não são exibidos. Não há dados externos válidos nem implementação de importação dessas comparações nesta versão. Os rankings presentes comparam somente os seus próprios assuntos, matérias e disciplinas.

## Compatibilidade

O nome da base é `insper-pessoal-v1`. O upgrade para a versão 3 acrescenta configurações, preferências e motivos de erro; preserva tentativas e marcações das versões 1/2. Não reconstrói telemetria passada. Backup 4 acrescenta questões autorais e aceita backups 1/2/3; exporta formato 3 quando não há autorais. mantém gabaritos conferidos, histórico e registros existentes em importações repetidas. Não inclui PDFs ou credenciais.

As regras de cálculo e seus denominadores estão em [INDICADORES.md](INDICADORES.md). As fontes e bloqueios estão em [FONTES.md](FONTES.md).
