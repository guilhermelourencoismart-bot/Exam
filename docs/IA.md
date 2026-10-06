# ChatGPT: implementação local · 0.4.1

A conexão e a geração estão implementadas. **Ainda não há uma chamada autenticada validada com a conta do usuário.** Os testes da OpenAI são simulados; as verificações criptográficas usam tokens sintéticos assinados. O aplicativo só registra geração validada após uma inferência autenticada concluída, revisão aceita, armazenamento da prova e exibição das questões no treino.

## Primeiro uso no Windows

1. Atualize seguindo o README, preservando backup, navegador, perfil e endereço `http://127.0.0.1:3000`.
2. Em **Provas**, mantenha **Inéditas por IA** e clique em **Conectar ChatGPT**.
3. Entre na sua conta Plus na janela **oficial da OpenAI** e autorize **Meu preparo Insper** a usar tokens do plano. Nenhuma credencial deve ser copiada ou colada no aplicativo/conversa.
4. Volte à aba do aplicativo. Quando aparecer **ChatGPT conectado**, clique em **Testar 3 questões de sistemas lineares**.
5. Aguarde gerar e revisar as três questões. Elas devem aparecer no treino com enunciado, sistema e alternativas A–E. Clique em **Iniciar ou retomar**, responda e finalize para ver relatório e resolução.
6. Volte a **Provas**. A geração autenticada exibida permite provas personalizadas e completas. A prova completa tem 60 questões, 15 por área.

Mantenha o terminal aberto durante a conexão e geração. Se o popup não abrir, use o link **Abrir autorização oficial do ChatGPT**. O consentimento expira depois de cinco minutos; clique novamente em Conectar se necessário. O registro do aplicativo é automático, sem exigir Client ID manual.

## Fontes do protocolo e alcance da consulta

- [Visão geral oficial para aplicativos locais/open-source](https://developers.openai.com/siwc/token-sharing-open-source).
- [Registro e autorização](https://developers.openai.com/siwc/token-sharing-open-source/sign-in).
- [Modelos e inferência direta](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).
- [Opção Codex app-server](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server), que **não é utilizada** nesta implementação.

As páginas em `developers.openai.com` retornaram `Tunnel connection failed: 403 Forbidden` pelo proxy da máquina de desenvolvimento, inclusive as duas páginas específicas acima. A mesma negativa ocorreu no teste de conectividade sem credenciais a `https://auth.openai.com/.well-known/openid-configuration` e `https://api.openai.com/v1/models`.

O usuário forneceu na conversa um resumo técnico da documentação oficial consultada em outro ambiente. A implementação segue esse resumo. Não alegamos ter acessado diretamente essas páginas nem ter exercitado os serviços de autenticação nesta rede. O código público do Codex também foi consultado durante a investigação, mas o caminho final usa OAuth e Responses diretamente, sem extrair sua autenticação ou usar variantes internas de tokens do app-server.

## Registro, consentimento e identidade

O servidor Node abre um callback HTTP em `127.0.0.1`, porta livre, caminho `/auth/callback`. Primeiro login usa `client_id=dynamic_agent_client`, `agent_name_hint=Meu preparo Insper` e um `ext_agent_host_id` estável por instalação no formato `urn:uuid:<UUIDv4>`. Novos `state`, `nonce` e `code_verifier` são gerados com aleatoriedade criptográfica; PKCE é S256. O callback confere Host, state, duplicações e o Client ID emitido. Logins seguintes usam o identificador emitido e omitem `agent_name_hint`, nunca usam o identificador do Codex.

Na 0.4.0, o identificador era enviado como UUID puro; o usuário observou `invalid_authorize_request`, parâmetro `ext_agent_host_id`, e forneceu a exigência de formato da documentação oficial acima. A 0.4.1 migra `installation.json` automaticamente antes de montar a URL: acrescenta `urn:uuid:` somente ao UUIDv4 puro, preserva seu conteúdo e Client ID, grava a mudança e mantém identificadores já formatados. Não toca em credenciais, provas, IndexedDB ou backups. Após atualizar e reiniciar o servidor, feche a janela antiga da OpenAI e clique em **Conectar ChatGPT** para uma nova URL; não reutilize a autorização que falhou. Não é necessário apagar arquivos nem desconectar para executar a migração.

Autorização: `https://auth.openai.com/api/accounts/authorize`. Scopes: `openid profile email offline_access resource.invoke chatgpt.tokens.use.direct`. Resource: `https://api.openai.com/v1`.

A troca do código ocorre somente no servidor por POST form-urlencoded a `https://auth.openai.com/api/accounts/oauth/token`, com `grant_type=authorization_code`, Client ID emitido, code, code_verifier, redirect_uri idêntico e resource. Não há client secret.

A identidade é conferida com `jose` e chaves JWKS obtidas por HTTPS dos metadados OpenID da OpenAI. Valida assinatura assimétrica, issuer, audience igual ao Client ID emitido, expiração, data de emissão, subject e nonce. Não há decodificação de JWT aceita como validação. As permissões `resource.invoke` e `chatgpt.tokens.use.direct` precisam estar concedidas. Consentimento recusado, identidade inválida, ausência de registro ou scope não geram conexão.

A renovação usa refresh_token com o mesmo Client ID e resource. Se a resposta de refresh omitir scope, conserva somente os scopes confirmados no consentimento anterior, conforme o comportamento padrão de OAuth; nunca amplia permissões. Falha de renovação mostra erro e pede reconexão. O nome do plano não é inferido quando o serviço não o informa.

## Inferência e revisão

O access token OAuth autorizado é usado como Bearer exclusivamente nos endpoints HTTPS oficiais `/v1/models` e `/v1/responses`. O servidor escolhe um modelo de texto da lista retornada para a autorização da conta. Não lê API keys, não usa endpoints `backend-api` do ChatGPT e não possui fallback pago.

Responses utiliza `store=false`, `stream=true` e JSON Schema estrito. O parser trata eventos SSE fragmentados, UTF-8, falhas, recusas e interrupções. Apenas `response.completed` com status completed confirma uma chamada; EOF, `[DONE]` sozinho ou delta de texto não confirmam geração.

Cada lote tem até cinco questões. Geração pede enunciado autossuficiente, cinco alternativas, resposta única, resolução e classificação canônica. Questões que dependem de elementos não incorporados são rejeitadas. Não há geração de imagens nesta etapa; os enunciados devem funcionar com texto e fórmulas legíveis. Os textos oficiais não são oferecidos ao modelo como substituição de conteúdo: o catálogo fornece a taxonomia dos assuntos, não as questões do treino gerado.

Outra chamada resolve as questões sem receber o gabarito nem a explicação anterior. Exige aprovação e concordância da alternativa. A resolução armazenada é a solução dessa revisão independente. O código confere campos, cotas, duplicações e classificação. Para sistemas lineares, aplica eliminação com pivoteamento e verifica solução única, alternativa correta e correspondência do texto de cada alternativa com o vetor. Equações e vetores são renderizados a partir dos mesmos dados conferidos. As três questões iniciais precisam passar por essa verificação algébrica.

Um lote recusado é refeito no máximo uma vez. Limite, timeout ou erro de autorização interrompem a geração sem substituir conteúdo. Lotes aprovados ficam guardados no servidor local e podem ser retomados, inclusive depois de reiniciar. A prova só abre quando a quantidade inteira tiver sido revisada. Questões autorais têm hash de conteúdo, revisão, modelos, datas e identificadores das duas chamadas. A resolução é identificada como autoral por IA; revisão por IA não equivale a resolução oficial nem garante que toda questão de outras áreas esteja livre de erro factual.

Os hashes detectam alterações/inconsistências do snapshot. Não são uma certificação criptográfica da autoria de um backup fornecido por terceiros. Importar questões autorais não concede autorização nem marca a conexão como validada.

## Armazenamento e segurança local

No Windows, a pasta privada é `%LOCALAPPDATA%\InsperPreparo`, fora do repositório. O arquivo de credenciais é cifrado por **DPAPI CurrentUser** usando Windows PowerShell sem perfil. Dados sensíveis chegam ao processo por stdin, nunca por argumento de comando. No Linux/macOS, usa AES-GCM e uma chave local com permissão 0600, em `~/InsperPreparo`; isso oferece proteção por permissões do usuário, não um keychain do sistema. Windows é o alvo do uso pessoal.

Tokens nunca entram em React, IndexedDB, logs, arquivos públicos ou backups. O Client ID e o identificador da instalação são metadados locais, não chaves secretas. Credenciais são renovadas no servidor. Desconectar remove o arquivo de credenciais; preserva registro, provas, histórico e fontes. Não apague nem compartilhe a pasta privada para atualizar o aplicativo. Copiar essa pasta entre usuários do Windows não transfere a capacidade de descriptografar DPAPI.

As rotas locais exigem Host loopback e origem HTTP correspondente. Mutações também exigem um nonce de sessão do aplicativo; esse nonce não é um token do ChatGPT. Respostas não são cacheadas. Corpos JSON têm limite e destinos externos são fixos em código. O aplicativo continua vinculado a `127.0.0.1` pelos comandos de instalação. Não há uso de credenciais do ambiente Codex.

O histórico segue em `insper-pessoal-v1`, versão 3 do IndexedDB. Questões autorais ficam no snapshot da tentativa. Backup 4 inclui alternativas, respostas, resoluções e metadados de revisão; backups antigos continuam aceitos. Credenciais e pedidos de geração ainda incompletos não entram no backup. Os lotes incompletos ficam na pasta privada do próprio computador.

## Erros e próxima validação

- **Autorização recusada/sem permissão**: reconecte pelo aplicativo e confira se o consentimento oferece uso do plano. Login no Codex não substitui esse consentimento.
- **Limite do plano**: aguarde a renovação informada pelo ChatGPT e depois use Retomar geração. Não aparece estatística de limite inventada.
- **Resposta incompleta/revisão recusada**: o lote não entra no treino. Retome ou ajuste o pedido.
- **Callback expirado**: Conectar ChatGPT novamente, com terminal aberto.
- **Falha de armazenamento protegido**: execute com o mesmo usuário do Windows e confira que Windows PowerShell está disponível; não copie credenciais para o projeto.
- **403 de rede**: verifique se o computador pode acessar `auth.openai.com` e `api.openai.com` por HTTPS. O erro do proxy observado aqui não demonstra bloqueio na conta ou no seu computador.

A próxima verificação depende do usuário: autenticar no computador pessoal e ver as três questões na tela. A execução do DPAPI em Windows e a aceitação real do registro, do modelo e da inferência não foram testadas neste Linux. Se houver erro, envie somente o texto da mensagem do aplicativo; não envie a URL completa do callback, tokens ou o arquivo de credenciais.
