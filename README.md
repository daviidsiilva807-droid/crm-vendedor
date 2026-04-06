# controledesecao
controlar e melhorar a vida do vendedor.

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
