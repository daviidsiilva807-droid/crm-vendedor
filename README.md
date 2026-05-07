# controledesecao
controlar e melhorar a vida do vendedor.


O dashboard permite ativar e desativar vendedores por pagamento e a area de vendas mostra o tempo restante da assinatura e a comissao estimada por venda.

Na area administrativa, o usuario admin pode cadastrar, consultar login e senha e excluir vendedores.

Este projeto é 100% estático no frontend para publicação no GitHub Pages.
Login, sessão e cadastro de vendedores funcionam no navegador usando `localStorage`.

Login administrador padrão: `daviidsiilva807`

## Como publicar no GitHub Pages:
- envie os arquivos para um repositorio no GitHub
- em `Settings > Pages`, escolha a branch (geralmente `main`) e a pasta raiz (`/root`)
- aguarde o deploy e acesse a URL gerada pelo GitHub Pages

**Observação**: os dados salvos (usuarios, sessoes e rascunhos) ficam apenas no navegador/dispositivo de cada usuario.

## Agente de Marketing com ChatGPT (PROXY BACKEND)

O agente de marketing agora usa um proxy backend seguro para proteger sua chave da OpenAI API.

### Configuração Local (Desenvolvimento)

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Configure o arquivo `.env`**:
   ```bash
   cp .env.example .env
   ```
   
   Edite o `.env` e adicione sua chave da OpenAI:
   ```
   OPENAI_API_KEY=sk-proj-sua-chave-aqui
   OPENAI_MODEL=gpt-5.5
   PORT=3000
   ```

3. **Inicie o servidor proxy**:
   ```bash
   npm start
   ```
   
   O proxy estará disponível em `http://localhost:3000`

4. **Acesse o agente**:
   - Abra `http://localhost:5500/agent.html` (ou use Live Server do VS Code)
   - Faça login como admin (`daviidsiilva807`)
   - Marque "Usar ChatGPT na geração"
   - Gere o conteúdo normalmente

### Configuração em Produção

Para publicar em produção, você pode usar:

- **Vercel**: Crie um `api/openai-proxy.js` e implante gratuitamente
- **Cloudflare Workers**: Deploy sem servidor com proteção de API key
- **AWS Lambda + API Gateway**: Serverless com segurança de nível enterprise
- **Seu próprio servidor**: Use `npm start` em um VPS/servidor próprio

**Importante**: Sempre armazene `OPENAI_API_KEY` em variáveis de ambiente do servidor, nunca no código-fonte ou frontend.

### Como funciona

1. O frontend envia dados da campanha (SEM a chave de API) para `/api/openai-proxy`
2. O servidor Node.js injeta a chave da OpenAI (armazenada em `.env`)
3. O servidor faz o request autenticado para `api.openai.com`
4. A resposta é devolvida ao cliente
5. A chave nunca sai do servidor - fica protegida

### Troubleshooting

- **"Erro ao conectar ao proxy"**: Certifique-se de que o servidor está rodando (`npm start`)
- **"OPENAI_API_KEY não configurada"**: Verifique se `.env` tem a chave
- **CORS error**: O proxy inclui CORS, mas verifique a origem no servidor
- **Chave expirou**: Crie uma nova chave em https://platform.openai.com/account/api-keys
