# IA e assinatura ChatGPT Plus

Nesta etapa não há integração de IA, login, chave de API, chamada de geração nem alternativa paga. `src/ai/status.ts` é apenas o estado desativado.

Consulta realizada em 05/10/2026 aos arquivos oficiais do projeto open-source **OpenAI Codex**:

- [README oficial](https://github.com/openai/codex/blob/main/README.md): a seção “Using Codex with your ChatGPT plan” recomenda “Sign in with ChatGPT” e lista Plus, Pro, Business, Edu e Enterprise. A autenticação com API key é um caminho distinto.
- [Documentação de autenticação no repositório](https://github.com/openai/codex/blob/main/docs/authentication.md): encaminha para [Codex Authentication](https://developers.openai.com/codex/auth).
- [App-server oficial](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md): descreve o servidor e seu protocolo, inclusive estado da conta e autenticação.
- [Protocolo oficial de conta](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/v2/account.rs): `LoginAccountParams.Chatgpt`, serializado como `type: "chatgpt"`, tem resposta com `loginId` e `authUrl` para abrir o fluxo OAuth no navegador. Existe também o caminho de device code. A variante de fornecimento direto de tokens `ChatgptAuthTokens` está explicitamente marcada **FOR OPENAI INTERNAL USE ONLY - DO NOT USE** e não será usada.

Os arquivos oficiais acima foram obtidos por HTTPS de `raw.githubusercontent.com`. O acesso direto a `developers.openai.com` retornou bloqueio 403 pelo proxy deste ambiente. Portanto, a consulta documental confirmou login e uso de plano no Codex, mas não validou funcionalmente o login da conta pessoal nem acesso a inferência a partir deste aplicativo.

O caminho a investigar na etapa de IA é uma ponte **local** entre o backend Node e o **Codex app-server**, usando o fluxo gerenciado de login com ChatGPT, sujeito aos limites e às capacidades do plano. A evidência consultada não autoriza tratar a assinatura como uma chave para qualquer API de modelos, nem como OAuth genérico para um site. Construir o aplicativo no Codex não autentica o aplicativo.

Antes de implementar a ponte: rever a documentação oficial vigente e fixar uma versão compatível do Codex; verificar se o uso pretendido de geração educacional é suportado; testar o fluxo de login e uma chamada real com a conta do usuário; restringir a ponte à máquina local; manter credenciais fora do IndexedDB, dos backups e dos arquivos públicos. Não implementar API paga como fallback. Sem validação bem-sucedida, a IA deve continuar desativada.

Nenhum token foi lido ou copiado, e nenhuma autenticação do ambiente Codex foi reutilizada no aplicativo.
