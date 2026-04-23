# 🚀 Tutorial: Colocar o ROTA online

**Tempo estimado:** 45-90 minutos (se for sua primeira vez com essas ferramentas)

**O que você vai fazer:**
1. Criar o banco de dados no Supabase
2. Subir o código pro GitHub  
3. Publicar no Vercel
4. Testar o app online

**O que você vai precisar:**
- Computador com internet
- Seu email
- Paciência de 1h

**Dica geral:** não pule etapas. Cada passo depende do anterior.

---

## 🎯 PARTE 1: Banco de dados (Supabase)

### 1.1 Criar conta

1. Abra [https://supabase.com](https://supabase.com)
2. Clique em **"Start your project"** (botão verde grande)
3. Clique em **"Sign up"**
4. Você pode usar seu email ou GitHub. Recomendo **"Continue with GitHub"** se já tiver — é mais rápido.
   - Se escolher email, ele vai mandar um link de confirmação. Abra o email e confirme antes de continuar.

### 1.2 Criar o projeto

Depois de logar:

1. Clique em **"New project"**
2. Preencha:
   - **Name:** `rota-vendas` (ou qualquer nome)
   - **Database Password:** clica no botão **"Generate a password"** pra ele criar uma senha forte. **COPIE essa senha e salve num lugar seguro** (bloco de notas, email pra você mesmo, etc). Você não vai precisar dela agora, mas se perder não recupera.
   - **Region:** escolha **"South America (São Paulo)"** pra ficar mais rápido
   - **Pricing Plan:** **Free** (já vem selecionado)
3. Clique em **"Create new project"**
4. **Aguarde uns 2 minutos.** Ele vai mostrar uma tela com "Setting up your project...". É normal. Espere aparecer o dashboard.

### 1.3 Criar as tabelas

1. No menu esquerdo, clique no ícone **"SQL Editor"** (parece um terminal `>_`)
2. Clique em **"New query"** (canto superior direito)
3. **Abra o arquivo `supabase-setup.sql`** que eu te enviei
4. **Copie TODO o conteúdo** do arquivo
5. **Cole** no editor do Supabase
6. Clique no botão **"Run"** (canto inferior direito, ou aperte `Ctrl+Enter`)
7. Deve aparecer **"Success. No rows returned"** em verde

> **Se der erro:** apague tudo do editor, copie de novo o conteúdo do arquivo, e tente de novo. Se persistir, me avise o erro que você viu.

### 1.4 Importar seus 118 clientes iniciais

1. Ainda no SQL Editor, clique em **"New query"** outra vez
2. **Abra o arquivo `supabase-dados-iniciais.sql`**
3. **Copie todo o conteúdo** e cole no editor
4. Clique em **"Run"**
5. Deve aparecer **"Success. 118 rows affected"**

**Teste:** no menu esquerdo, clique em **"Table Editor"** → **"clientes"**. Você deve ver seus 118 clientes. 🎉

### 1.5 Pegar as chaves de acesso (IMPORTANTE)

Você vai precisar de 2 informações pra conectar o app ao banco:

1. No menu esquerdo, clique em **"Project Settings"** (ícone de engrenagem, embaixo)
2. Clique em **"API"** (submenu que abre)
3. Na tela que abrir, você vai ver:
   - **Project URL** → algo como `https://xxxxxxxxxxx.supabase.co` — **copie e guarde**
   - Role um pouco pra baixo até ver **"Project API keys"**
   - Pegue a chave **`anon` `public`** (é a primeira) — clique no ícone de copiar ao lado dela — **copie e guarde**

**⚠️ Guarde essas duas informações em um bloco de notas.** Vamos usar na PARTE 3.

---

## 📦 PARTE 2: Código no GitHub

### 2.1 Criar conta

1. Abra [https://github.com](https://github.com)
2. Clique em **"Sign up"** no canto superior direito
3. Preencha: email, senha, username (qualquer nome, ex: `seunome123`)
4. Passe na verificação "prove que não é robô"
5. Confirma o email (abre sua caixa de entrada, clica no link)

### 2.2 Criar o repositório

1. Logado no GitHub, clique no botão verde **"New"** (ou o `+` no canto superior direito → "New repository")
2. Preencha:
   - **Repository name:** `rota-vendas`
   - **Description:** `Plataforma de gestão de carteira` (opcional)
   - **Public** (já vem marcado) — deixa assim
   - **NÃO** marque "Add a README file"
3. Clique em **"Create repository"**

### 2.3 Subir os arquivos

Você vai ver uma tela com comandos. **IGNORE os comandos**, vamos fazer pelo navegador que é mais fácil.

1. Na página do repositório vazio, clique no link **"uploading an existing file"** (aparece no meio da tela)

   > Se não achou o link, role a página e procure por "upload an existing file" ou cole na URL do navegador: `https://github.com/SEU_USUARIO/rota-vendas/upload/main`

2. **Arraste todos os arquivos e pastas** que eu te enviei no zip (ou selecione um por um usando "choose your files"):
   - Pasta `src/` (com os 3 arquivos dentro)
   - `package.json`
   - `vite.config.js`
   - `index.html`
   - `.gitignore`
   - `.env.example`
   
   **NÃO suba:** `supabase-setup.sql` e `supabase-dados-iniciais.sql` (já usamos esses na PARTE 1, não precisam ir pro GitHub).

3. Role até embaixo, clique no botão verde **"Commit changes"**

4. Aguarde uns segundos. Você vai ver seus arquivos listados na página do repositório. ✅

---

## 🚀 PARTE 3: Publicar no Vercel

### 3.1 Criar conta

1. Abra [https://vercel.com](https://vercel.com)
2. Clique em **"Sign Up"**
3. Escolha **"Continue with GitHub"** — vai ser muito mais fácil pra conectar depois
4. Autorize o Vercel a acessar sua conta (clica em "Authorize Vercel")
5. Complete o perfil básico se pedir (nome, "for personal use" etc)

### 3.2 Importar o projeto

1. No dashboard do Vercel, clique em **"Add New..."** → **"Project"**
2. Ele vai listar seus repositórios do GitHub. Ache **`rota-vendas`** e clique em **"Import"**
   - Se não aparecer, clique em **"Adjust GitHub App Permissions"** e libere acesso ao repositório.

### 3.3 Configurar variáveis de ambiente (ISSO É CRUCIAL)

Na tela de configuração do projeto:

1. **Framework Preset:** deve vir `Vite` automaticamente. Se não, escolha manualmente.
2. **Build Command, Output Directory, Install Command:** deixa como está.
3. Abra a seção **"Environment Variables"** (tem uma setinha pra expandir)
4. Adicione **DUAS** variáveis (uma de cada vez):

   **Primeira:**
   - Name: `VITE_SUPABASE_URL`
   - Value: cole aqui a URL que você copiou na parte **1.5** (tipo `https://xxxxxxxxx.supabase.co`)
   - Clique em **"Add"**

   **Segunda:**
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: cole aqui a chave `anon public` que você copiou na parte **1.5**
   - Clique em **"Add"**

5. Clique no botão **"Deploy"**

### 3.4 Esperar o build

Vai levar 1-2 minutos. Você vai ver uma tela com fogos de artifício quando terminar. 🎉

Clique em **"Continue to Dashboard"** ou no botão **"Visit"** pra abrir o site.

---

## ✅ PARTE 4: Testar e usar

1. **Abra o link que o Vercel te deu.** Vai ser algo tipo `rota-vendas-xxxx.vercel.app`
2. Você deve ver a tela de loading "Carregando sua carteira..." e depois o dashboard com seus 118 clientes.
3. **Testa:**
   - Mude a categoria de um cliente de B pra A
   - Registre uma visita
   - Recarregue a página — os dados devem persistir ✨

### Instalar no celular como se fosse um app

**Android (Chrome):**
1. Abra o link do Vercel no Chrome do celular
2. No menu (3 pontinhos), toque em **"Instalar app"** ou **"Adicionar à tela inicial"**
3. Pronto, vira um ícone na tela inicial

**iPhone (Safari):**
1. Abra o link no Safari
2. Toque no botão compartilhar (quadrado com seta pra cima)
3. Role até **"Adicionar à Tela de Início"**
4. Confirma

Pronto, agora parece um app de verdade. Funciona offline pra consulta (os dados ficam em cache), mas pra editar precisa de internet.

---

## 🆘 Deu problema?

### "Failed to fetch" ou tela branca no Vercel
- Provavelmente você colocou a URL ou a chave errada. Volta no Vercel, Settings → Environment Variables, confere se copiou tudo certinho (sem espaços extras no início/fim).
- Depois de corrigir, clica em **"Deployments"** → no último deploy → 3 pontinhos → **"Redeploy"**.

### Supabase diz "permission denied"
- Você pode ter esquecido de rodar a parte do SQL que libera acesso (últimas linhas do `supabase-setup.sql`, que criam as políticas `acesso_publico`). Roda esse arquivo inteiro de novo.

### Cliques não salvam
- Verifica o indicador no canto inferior direito da tela. Se aparecer "Erro ao salvar", abre o console do navegador (F12 → Console) pra ver a mensagem completa e me mande.

### Perdi as chaves do Supabase
- Nada grave, elas continuam no Supabase. Vai em Project Settings → API e copia de novo.

---

## 💰 Custos

Tudo **grátis** no plano free de cada ferramenta:

| Serviço | Limite grátis | Seu uso estimado |
|---------|---------------|------------------|
| Vercel | 100 GB/mês de tráfego | Vai usar menos de 1 GB |
| Supabase | 500 MB de banco | Seus dados ocupam ~1 MB |
| GitHub | Ilimitado pra público | Tranquilo |

Se um dia você tiver 10.000 clientes e 1000 visitas por semana, ainda assim cabe no plano grátis.

---

## 📤 Exportar relatório pra seu chefe

Dentro do app:
1. Vai em **"Relatório"** no menu
2. Escolhe a semana/mês
3. Clica em **"Exportar"** — baixa um Excel bonitinho pra mandar pro seu chefe

Fluxo que você já fazia antes, agora automatizado.

---

Pronto! Me avisa quando estiver de pé ou se travar em algum passo. 🚀
