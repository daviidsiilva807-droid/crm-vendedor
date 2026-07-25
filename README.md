# controledesecao
controlar e melhorar a vida do vendedor.

Layout e navegacao (laranja/branco):
- menu lateral fixo em todas as telas internas (`app-shell.css` + `app-shell.js`)
- `dashboard.html`: vendas do mes, comissao acumulada, vendas dos ultimos 3 dias, grafico de linha com meta e frase motivacional
- `calendario.html`: escala de trabalho, folgas, ferias e eventos
- `marketing.html`: gerador de mensagens para WhatsApp/Instagram com sugestoes baseadas na meta
- `vendas.html`: lancamento de vendas e calculo separado da meta estabelecida e da meta pessoal
- `secao.html`: acesso a conferencia de vestuario, tenis e acessorios
- `clientes.html`: cadastro de clientes e reservas
- `admin.html`: painel restrito ao administrador

Metas e comissao (`app-data.js`):
- meta estabelecida padrao: R$ 84.000,00
- meta pessoal padrao: R$ 96.000,00
- comissao de 0,6% sobre o faturamento quando a meta e atingida
- os valores podem ser alterados em `vendas.html` > aba `Configuracao de metas`

Planos atuais:
- 30 dias por R$20,00
- 90 dias por R$50,00

O dashboard permite ativar e desativar vendedores por pagamento e a area de vendas mostra o tempo restante da assinatura e a comissao estimada por venda.

Na area administrativa, o usuario admin pode cadastrar, consultar login e senha e excluir vendedores.

Agora o cadastro de vendedores e o login ficam centralizados em um backend local (`server.js`), o que permite acessar a mesma base por outros aparelhos na mesma rede ou por uma publicacao externa.

Como executar:
- `node server.js`
- abra `http://localhost:3000` no navegador

Se quiser usar em outros dispositivos, o servidor precisa estar acessivel pela rede ou hospedado em um ambiente online.

Conexao com Vercel:
- a URL da API agora fica centralizada em `app-config.js`, na chave `API_URL`
- para producao (backend no Render), use o dominio publicado sem `/api` (ex.: `https://seu-backend.onrender.com`)
- ao abrir os HTML localmente (`file://`), o frontend usara `API_URL` como base e chamara `${API_URL}/api/...`

Deploy na Vercel (API + frontend):
- este projeto ja esta preparado para Vercel com a funcao `api/[...path].js`
- publique o repositorio no GitHub e importe na Vercel em `New Project`
- em `Settings > Environment Variables`, configure:
	- `AWS_REGION`
	- `AWS_ACCESS_KEY_ID`
	- `AWS_SECRET_ACCESS_KEY`
	- `AWS_ENDPOINT_URL` (somente se for usar LocalStack, nao recomendado em producao)
- faca o deploy e copie a URL final (ex.: `https://seu-projeto.vercel.app`)
- confirme no navegador: `https://seu-projeto.vercel.app/api/bootstrap`
- no `app-config.js`, ajuste `API_URL` para o dominio da API publicada

Rodar local continua igual:
- `node server.js`
- abra `http://localhost:3000`
