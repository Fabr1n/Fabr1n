# Conectar músicas recentes do Spotify

O painel já está preparado para exibir até **três músicas distintas recentemente ouvidas**, com atualização a cada seis horas pelo GitHub Actions. As músicas ficarão visíveis no perfil público. Isso não é um player em tempo real.

## 1. Criar ou escolher um app Spotify

No [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), crie ou selecione seu aplicativo. Configure este Redirect URI exato:

```text
http://127.0.0.1:8888/callback
```

Consulte os [requisitos atuais do modo de desenvolvimento](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) do Spotify para sua conta.

## 2. Autorizar localmente

Com Node.js 20 ou mais recente instalado, na pasta deste repositório execute:

```bash
node scripts/authorize-spotify.mjs
```

Abra **http://127.0.0.1:8888**. Insira o Client ID e o Client Secret do seu app e continue para a tela oficial de autorização do Spotify.

O assistente solicita apenas **user-read-recently-played**. As credenciais ficam em memória e não são gravadas nem impressas no terminal.

## 3. Cadastrar os secrets

Após autorizar, o assistente mostra os três valores. Salve cada um como um **Repository secret** em [Settings → Secrets and variables → Actions](https://github.com/Fabr1n/Fabr1n/settings/secrets/actions):

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

Não publique esses valores no README, em commits, issues ou mensagens.

## 4. Atualizar o painel

Em [Profile metrics](https://github.com/Fabr1n/Fabr1n/actions/workflows/metrics.yml), clique em **Run workflow** na branch `main`.

Feche a página local e encerre o assistente com Ctrl+C. As próximas atualizações seguem o agendamento, sujeito a atrasos do GitHub Actions.

## Renovar ou remover

Se o Spotify revogar ou expirar a autorização, execute novamente o assistente e substitua o refresh token no GitHub. Para desligar a integração, remova os três secrets e execute o workflow; depois revogue o app nas configurações do Spotify.

## Referências

- [Spotify: Authorization Code Flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow)
- [Spotify: músicas recentemente ouvidas](https://developer.spotify.com/documentation/web-api/reference/get-recently-played)
- [Spotify: Redirect URIs](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
