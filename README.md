# 🏋️ Treinador Virtual — Dr. Força

Gerador de treinos de musculação **baseado em evidências**, com foco em **hipertrofia máxima** para **homens acima de 50 anos**, respeitando segurança articular e capacidade de recuperação.

A página é 100% estática (roda no GitHub Pages, como a ORATIO) e conversa **diretamente** com a API da Anthropic a partir do seu navegador — o "backend" é o agente **Dr. Força** (um doutor em Fisiologia do Exercício virtual), cujo comportamento está definido em [`dr-forca.js`](dr-forca.js) e é fundamentado em três artigos científicos (ver seção Base científica na própria página).

---

## ✨ O que ela faz

- **Formulário interativo**: dias por semana, tempo por sessão, aeróbico (sim/não), intensidade, experiência, equipamento, lesões/condições e observações.
- **Gera o plano em tempo real** (streaming), com tabelas por dia de treino, faixas de repetição, RIR/RPE, descanso, progressão e alternativas seguras.
- **Consulta a literatura** (PubMed/OpenEvidence via busca web) quando você relata uma lesão ou condição médica.
- **Histórico de planos** e **Diário de treino** salvos no seu navegador. O diário é reenviado ao Dr. Força para **ciclar exercícios e estímulos** e aplicar sobrecarga progressiva no próximo plano.

---

## 🔑 Pré-requisito: chave da API Anthropic

1. Acesse **https://console.anthropic.com/** → *Settings* → *API Keys* → **Create Key**.
2. Copie a chave (começa com `sk-ant-...`) e adicione créditos em *Billing* (o uso é pago por token; um plano completo custa poucos centavos de dólar).
3. Na página, abra **⚙️ Configuração** e cole a chave. Ela fica **apenas no seu navegador** (localStorage) — nunca é enviada a lugar nenhum além da própria API da Anthropic.

> ⚠️ **Segurança:** como a chave fica no navegador, use esta página só em um dispositivo seu. **Nunca** escreva a chave dentro dos arquivos do projeto (não faça commit dela). O código publicado não contém chave alguma.

---

## 🚀 Publicar no GitHub Pages (passo a passo)

### Opção A — pelo site do GitHub (sem instalar nada)

1. Crie uma conta em **https://github.com** (se ainda não tiver).
2. Clique em **New repository** (botão verde). Dê um nome, ex.: `treinador-virtual`. Deixe **Public** e clique em **Create repository**.
3. Na página do repositório vazio, clique em **uploading an existing file**.
4. Arraste **todos os arquivos desta pasta**:
   - `index.html`, `styles.css`, `app.js`, `dr-forca.js`, `README.md`
   - os 3 PDFs de referência (opcional, mas recomendado)
   - *(a pasta `.claude/` é só para pré-visualização local; pode ignorar)*
5. Clique em **Commit changes**.
6. Vá em **Settings** (aba do repositório) → menu lateral **Pages**.
7. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
8. Em **Branch**, selecione **main** e a pasta **/ (root)** → **Save**.
9. Aguarde ~1 minuto. O endereço aparece no topo da página Pages:
   **`https://SEU-USUARIO.github.io/treinador-virtual/`**
10. Abra esse link, cole sua chave em **⚙️ Configuração** e gere seu primeiro treino. ✅

### Opção B — pelo Git (linha de comando)

```bash
cd "C:\Users\Gustavo\OneDrive\Desktop\Treinador"
git init
git add index.html styles.css app.js dr-forca.js README.md *.pdf
git commit -m "Treinador Virtual — Dr. Força"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/treinador-virtual.git
git push -u origin main
```

Depois faça os passos **6 a 10** da Opção A para ativar o Pages.

---

## 💻 Testar localmente antes de publicar

A página usa módulos JavaScript (`import`), então **não** funciona abrindo o arquivo direto (`file://`). Sirva por HTTP:

```bash
cd "C:\Users\Gustavo\OneDrive\Desktop\Treinador"
python -m http.server 5555
```

Abra **http://localhost:5555** no navegador.

---

## 🧠 Personalizar o Dr. Força

Todo o "cérebro" do treinador está em **[`dr-forca.js`](dr-forca.js)** — persona, objetivos, base científica e formato de saída. Edite o texto à vontade (por exemplo, para mudar o tom, priorizar certos grupos musculares ou incluir novas diretrizes). Depois é só salvar e publicar de novo.

Para trocar o modelo padrão, custo ou velocidade, use o seletor **Modelo** em ⚙️ Configuração:
- **Claude Opus 4.8** — melhor qualidade (recomendado).
- **Claude Sonnet 5** — mais rápido e barato.
- **Claude Haiku 4.5** — o mais econômico.

---

## 📁 Estrutura do projeto

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura da página e formulário |
| `styles.css` | Estilo (padrão visual Claude: creme quente, acento terracota, serifada) |
| `app.js` | Lógica: chamada à API (streaming), renderização Markdown, histórico e diário |
| `dr-forca.js` | System prompt do agente Dr. Força (a "API") |
| `*.pdf` | Artigos científicos que fundamentam as prescrições |

---

## 🔒 Nota sobre arquitetura e privacidade

Este projeto usa o **acesso direto do navegador à API** da Anthropic (header `anthropic-dangerous-direct-browser-access: true`), o que dispensa servidor próprio — ideal para uma ferramenta pessoal no GitHub Pages. Como a chave fica exposta no seu navegador, **é destinado a uso pessoal**. Se um dia quiser compartilhar publicamente sem expor a chave, o caminho é colocar um pequeno proxy (ex.: Cloudflare Worker) entre a página e a API — posso te ajudar a montar isso quando precisar.

---

*Ferramenta de uso pessoal e educativo. Não substitui avaliação médica nem acompanhamento presencial de um profissional de Educação Física.*
