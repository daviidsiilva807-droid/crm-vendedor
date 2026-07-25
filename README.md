# controledesecao

CRM do vendedor: metas, comissao, calendario de trabalho, clientes e marketing.

O frontend e 100% estatico e publicado no GitHub Pages. Login, sessao, cadastro
de vendedores e todos os dados do dia a dia funcionam no navegador com
`localStorage`.

Login administrador padrao: `daviidsiilva807`

## Telas

Menu lateral fixo (`app-shell.css` + `app-shell.js`) em todas as telas internas,
na identidade laranja/branco:

- `dashboard.html`: vendas do mes, comissao acumulada, vendas dos ultimos 3 dias,
  grafico de linha com meta e ritmo ideal, registro rapido de venda e frase do dia
- `calendario.html`: escala de trabalho, folgas, ferias, eventos e faltas
- `agent.html`: agente de marketing com IA (usa o proxy do `server.js`)
- `marketing.html`: gerador de mensagens prontas para WhatsApp/Instagram, sem IA
- `vendas.html`: lancamento de vendas por dia, meta estabelecida x meta pessoal,
  historico mensal e tabela de comissao
- `secao.html`, `vestuario.html`, `tenis.html`, `acessorios.html`: conferencia de secao
- `clientes.html`: clientes, reservas e avisos
- `admin.html`: painel restrito ao administrador

## Metas e comissao (`app-data.js`)

- meta estabelecida padrao: R$ 84.000,00
- meta pessoal padrao: R$ 96.000,00
- comissao pela tabela de faixas: 40 mil = 0,5%, 46 mil = 1%, 50 mil = 1,2%,
  56 mil = 1,5%, 64 mil = 2%, 72 mil = 2,25%, 80 mil = 2,5%, 88 mil = 2,6%,
  96 mil = 2,7%, 104 mil = 2,8%, 112 mil = 2,9%
- bonificacao de 0,6% sobre o faturamento ao atingir a meta estabelecida,
  somada ao percentual da faixa
- os valores podem ser alterados em `vendas.html` > aba `Configuracao de metas`

Planos de assinatura: 30 dias por R$ 20,00 e 90 dias por R$ 50,00. Na area
administrativa o admin cadastra, ativa, desativa e exclui vendedores.

## Como publicar no GitHub Pages

- envie os arquivos para o repositorio no GitHub
- em `Settings > Pages`, escolha a branch (`main`) e a pasta raiz (`/root`)
- aguarde o deploy e acesse a URL gerada

**Observacao**: os dados salvos (usuarios, sessoes, vendas, agenda e rascunhos)
ficam apenas no navegador de cada dispositivo.

## Agente de Marketing com ChatGPT (proxy backend)

O agente de marketing usa um proxy backend para proteger a chave da OpenAI.

1. Instale as dependencias: `npm install`
2. Copie o `.env.example` para `.env` e preencha:
   ```
   OPENAI_API_KEY=sk-proj-sua-chave-aqui
   OPENAI_MODEL=gpt-5.5
   PORT=3000
   ```
3. Inicie o proxy: `npm start` (fica em `http://localhost:3000`)
4. Abra `agent.html`, faca login como admin, marque "Usar ChatGPT na geracao"
   e gere o conteudo

Em producao o proxy pode ir para Vercel, Cloudflare Workers, AWS Lambda ou um
VPS. Guarde sempre a `OPENAI_API_KEY` em variavel de ambiente do servidor,
nunca no frontend.

Como funciona: o frontend envia os dados da campanha (sem a chave) para
`/api/openai-proxy`, o servidor injeta a chave e chama a `api.openai.com`, e a
resposta volta para o cliente. A chave nunca sai do servidor.

Problemas comuns:
- "Erro ao conectar ao proxy": o servidor nao esta rodando (`npm start`)
- "OPENAI_API_KEY nao configurada": falta a chave no `.env`
- Chave expirou: gere outra em https://platform.openai.com/account/api-keys

## Backend opcional de login centralizado (`server-auth.js`)

Alternativa para quem quiser a mesma base de logins em varios aparelhos, em vez
do login por navegador. Nao e usado pelo site publicado.

- `node server-auth.js` e abra `http://localhost:3000`
- sem credenciais AWS validas, ele grava em `data/state.json` (modo local);
  com credenciais reais, usa DynamoDB
- defina `ADMIN_LOGIN` e `ADMIN_SENHA` no `.env`; sem `ADMIN_SENHA`, o servidor
  gera uma senha aleatoria no primeiro uso e mostra no console
- requer `npm install aws-sdk`
- para usar esse modo, o frontend precisa da versao de `auth-db.js` que fala com
  a API, e `api/[...path].js` publica a mesma API na Vercel
