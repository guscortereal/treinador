// ============================================================================
//  Treinador Virtual — Dr. Força  ·  app.js
//  Chama a Messages API da Anthropic diretamente do navegador (uso pessoal).
// ============================================================================

import { SYSTEM_PROMPT } from "./dr-forca.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Capacidades por modelo (effort e adaptive thinking não existem em todos)
const MODELS = {
  "claude-opus-4-8":  { effort: true,  adaptive: true,  search: "web_search_20260209" },
  "claude-sonnet-5":  { effort: true,  adaptive: true,  search: "web_search_20260209" },
  "claude-haiku-4-5": { effort: false, adaptive: false, search: "web_search_20250305" },
};

const $  = (id) => document.getElementById(id);
const LS = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem("df." + k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem("df." + k, JSON.stringify(v)),
  raw: (k, d) => localStorage.getItem("df." + k) ?? d,
  put: (k, v) => localStorage.setItem("df." + k, v),
};

// ---------------------------------------------------------------------------
//  Estado / persistência de configuração
// ---------------------------------------------------------------------------
function loadSettings() {
  $("apiKey").value      = LS.raw("apiKey", "");
  $("model").value       = LS.raw("model", "claude-opus-4-8");
  $("useSearch").checked  = LS.get("useSearch", true);
  $("showThinking").checked = LS.get("showThinking", true);
  refreshKeyStatus();
}
function saveSettings() {
  LS.put("apiKey", $("apiKey").value.trim());
  LS.put("model", $("model").value);
  LS.set("useSearch", $("useSearch").checked);
  LS.set("showThinking", $("showThinking").checked);
  refreshKeyStatus();
}
function refreshKeyStatus() {
  const el = $("settingsStatus");
  const has = $("apiKey").value.trim().length > 10;
  el.textContent = has ? "chave configurada ✓" : "chave da API não configurada";
  el.classList.toggle("ok", has);
}
["apiKey", "model", "useSearch", "showThinking"].forEach((id) =>
  $(id).addEventListener("change", saveSettings));
$("apiKey").addEventListener("input", refreshKeyStatus);

// ---------------------------------------------------------------------------
//  Abas
// ---------------------------------------------------------------------------
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelector(`.panel[data-panel="${tab.dataset.tab}"]`).classList.add("is-active");
    if (tab.dataset.tab === "historico") renderPlans();
    if (tab.dataset.tab === "diario") { refreshFromPlan(); renderLogs(); }
  });
});

// ---------------------------------------------------------------------------
//  Renderizador Markdown mínimo (títulos, listas, tabelas GFM, negrito, etc.)
// ---------------------------------------------------------------------------
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  return s;
}
function cells(line) {
  let l = line.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|")) l = l.slice(0, -1);
  return l.split("|").map((c) => c.trim());
}
function renderMarkdown(md) {
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "";
  let i = 0;
  const listStack = []; // {type}
  const closeLists = (toDepth = 0) => {
    while (listStack.length > toDepth) html += listStack.pop().type === "ol" ? "</ol>" : "</ul>";
  };

  while (i < lines.length) {
    const line = lines[i];

    // Tabela GFM: linha com | seguida de separador |---|
    if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
      closeLists();
      const header = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim() !== "") { rows.push(cells(lines[i])); i++; }
      html += "<table><thead><tr>" + header.map((h) => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>";
      for (const r of rows) html += "<tr>" + header.map((_, k) => `<td>${inline(r[k] ?? "")}</td>`).join("") + "</tr>";
      html += "</tbody></table>";
      continue;
    }

    // Linha em branco
    if (line.trim() === "") { closeLists(); i++; continue; }

    // Título
    let m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) { closeLists(); const lv = m[1].length; html += `<h${lv}>${inline(m[2])}</h${lv}>`; i++; continue; }

    // Régua
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { closeLists(); html += "<hr>"; i++; continue; }

    // Citação
    if (/^\s*>\s?/.test(line)) {
      closeLists();
      let quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      html += `<blockquote>${inline(quote.join(" "))}</blockquote>`;
      continue;
    }

    // Lista (ordenada / não ordenada), com um nível de aninhamento por indentação
    m = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (m) {
      const depth = Math.min(1, Math.floor(m[1].length / 2)) + 1;
      const type = /\d/.test(m[2]) ? "ol" : "ul";
      while (listStack.length > depth) html += listStack.pop().type === "ol" ? "</ol>" : "</ul>";
      if (listStack.length < depth) { html += type === "ol" ? "<ol>" : "<ul>"; listStack.push({ type }); }
      else if (listStack.length && listStack[listStack.length - 1].type !== type) {
        html += listStack.pop().type === "ol" ? "</ol>" : "</ul>";
        html += type === "ol" ? "<ol>" : "<ul>"; listStack.push({ type });
      }
      html += `<li>${inline(m[3])}</li>`;
      i++; continue;
    }

    // Parágrafo (agrupa linhas consecutivas)
    closeLists();
    let para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6})\s|^\s*[-*]\s|^\s*\d+\.\s|^\s*>|\|/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    html += `<p>${inline(para.join(" "))}</p>`;
  }
  closeLists();
  return html;
}

// ---------------------------------------------------------------------------
//  Geração de treino (chamada streaming à API)
// ---------------------------------------------------------------------------
let controller = null;

function buildUserMessage() {
  const v = (id) => $(id).value.trim();
  const parts = [];
  parts.push("## Perfil do atleta");
  parts.push(`- Sexo: masculino`);
  parts.push(`- Idade: ${v("idade")} anos`);
  parts.push(`- Experiência: ${v("experiencia")}`);
  parts.push(`- Dias disponíveis por semana: ${v("dias")}`);
  parts.push(`- Tempo por sessão: ${v("tempo")}`);
  parts.push(`- Intensidade desejada: ${v("intensidade")}`);
  parts.push(`- Equipamento disponível: ${v("equipamento")}`);
  parts.push(`- Aeróbico: ${$("aerobico").checked ? "incluir orientação" : "não incluir"}`);
  parts.push(`- Lesões / condições médicas: ${v("limitacoes") || "nenhuma relatada"}`);
  if (v("observacoes")) parts.push(`- Observações: ${v("observacoes")}`);

  if ($("usarHistorico").checked) {
    const logs = LS.get("logs", []).slice(0, 6);
    if (logs.length) {
      parts.push("\n## Diário de treino recente (use para ciclar exercícios/estímulos e progredir a carga)");
      for (const l of logs) {
        parts.push(`### ${l.data || "s/data"} — ${l.treino || "sessão"}${l.rpe ? ` (RPE ${l.rpe})` : ""}`);
        if (Array.isArray(l.exercicios)) {
          for (const e of l.exercicios)
            parts.push(`- ${e.nome}: ${e.series || "?"}x${e.reps || "?"}${e.carga ? ` x ${e.carga}kg` : ""}${e.rir ? ` (RIR ${e.rir})` : ""}`);
        } else if (typeof l.exercicios === "string" && l.exercicios) {
          parts.push(l.exercicios);
        }
        if (l.aerobico?.fez)
          parts.push(`- Aeróbico: ${[l.aerobico.tipo, l.aerobico.duracao && l.aerobico.duracao + " min", l.aerobico.intensidade].filter(Boolean).join(", ")}`);
        if (l.obs) parts.push(`Obs.: ${l.obs}`);
      }
    }
    const plans = LS.get("plans", []);
    if (plans.length) {
      parts.push("\n## Último plano gerado (varie exercícios e ênfases em relação a ele)");
      parts.push(plans[0].text.slice(0, 1800));
    }
  }

  parts.push("\n## Tarefa");
  parts.push("Gere um plano de treino de musculação para HIPERTROFIA MÁXIMA, seguro para este perfil 50+, distribuído nos dias disponíveis e executável dentro do tempo por sessão. Siga rigorosamente o formato de saída definido no seu system prompt (parágrafo de lógica + tabelas por dia + progressão + alternativas/segurança). Se houver lesão/condição relatada, consulte a literatura antes de prescrever.");
  return parts.join("\n");
}

function setStatus(msg, kind = "") {
  const el = $("genStatus");
  el.hidden = false;
  el.className = "gen-status" + (kind ? " " + kind : "");
  el.innerHTML = kind === "error" ? esc(msg) : `<span class="spinner"></span><span>${esc(msg)}</span>`;
}

async function generate(e) {
  e.preventDefault();
  const key = $("apiKey").value.trim();
  if (!key) {
    $("settings").open = true;
    setStatus("Configure sua chave da API Anthropic para gerar treinos.", "error");
    return;
  }

  const model = $("model").value;
  const caps = MODELS[model] || MODELS["claude-opus-4-8"];
  let answer = "", thinking = "";
  const out = $("output"), reasoningBox = $("reasoningBox"), reasoningOut = $("reasoningOut");
  out.hidden = false; out.innerHTML = "";
  reasoningBox.hidden = true; reasoningOut.innerHTML = "";
  $("outputActions").hidden = true;
  $("genBtn").disabled = true; $("stopBtn").hidden = false;
  setStatus("Conectando ao Dr. Força...");

  // Render throttle
  let rafA = null, rafT = null;
  const renderAnswer = () => { rafA = null; out.innerHTML = renderMarkdown(answer); };
  const renderThink  = () => { rafT = null; reasoningOut.innerHTML = renderMarkdown(thinking); };
  const scheduleAnswer = () => { if (!rafA) rafA = requestAnimationFrame(renderAnswer); };
  const scheduleThink  = () => { reasoningBox.hidden = false; if (!rafT) rafT = requestAnimationFrame(renderThink); };

  // Corpo da requisição
  const body = {
    model,
    max_tokens: 16000,
    stream: true,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage() }],
  };
  if (caps.effort) body.output_config = { effort: "high" };
  if (caps.adaptive && $("showThinking").checked) body.thinking = { type: "adaptive", display: "summarized" };
  if ($("useSearch").checked) body.tools = [{ type: caps.search, name: "web_search", max_uses: 4 }];

  controller = new AbortController();
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try { const j = await res.json(); detail = j?.error?.message || detail; } catch {}
      if (res.status === 401) detail = "Chave da API inválida ou sem crédito. Verifique em console.anthropic.com.";
      throw new Error(detail);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stop = null;

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, idx); buffer = buffer.slice(idx + 2);
        const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let ev; try { ev = JSON.parse(payload); } catch { continue; }

        if (ev.type === "content_block_start") {
          const t = ev.content_block?.type;
          if (t === "server_tool_use" || t === "web_search_tool_result") setStatus("🔍 Consultando a literatura científica...");
        } else if (ev.type === "content_block_delta") {
          const d = ev.delta;
          if (d.type === "text_delta") { answer += d.text; setStatus("Escrevendo o plano de treino..."); scheduleAnswer(); }
          else if (d.type === "thinking_delta") { thinking += d.thinking; scheduleThink(); }
        } else if (ev.type === "message_delta") {
          if (ev.delta?.stop_reason) stop = ev.delta.stop_reason;
        } else if (ev.type === "error") {
          throw new Error(ev.error?.message || "Erro no streaming");
        }
      }
    }

    out.innerHTML = renderMarkdown(answer);
    if (thinking) reasoningOut.innerHTML = renderMarkdown(thinking);

    if (!answer.trim()) {
      setStatus(stop === "refusal"
        ? "O modelo não pôde responder a esta solicitação."
        : "Nenhum conteúdo retornado. Tente novamente.", "error");
    } else {
      $("genStatus").hidden = true;
      $("outputActions").hidden = false;
      $("output").dataset.text = answer;
    }
  } catch (err) {
    if (err.name === "AbortError") { setStatus("Geração interrompida.", "error"); }
    else { setStatus("Erro: " + err.message, "error"); }
  } finally {
    $("genBtn").disabled = false; $("stopBtn").hidden = true; controller = null;
  }
}

$("genForm").addEventListener("submit", generate);
$("stopBtn").addEventListener("click", () => controller?.abort());

// Copiar / salvar plano
$("copyPlanBtn").addEventListener("click", () => {
  navigator.clipboard.writeText($("output").dataset.text || "").then(() => {
    $("copyPlanBtn").textContent = "Copiado ✓";
    setTimeout(() => ($("copyPlanBtn").textContent = "Copiar"), 1500);
  });
});
$("savePlanBtn").addEventListener("click", () => {
  const text = $("output").dataset.text;
  if (!text) return;
  const plans = LS.get("plans", []);
  plans.unshift({
    id: Date.now(),
    when: new Date().toISOString(),
    params: {
      idade: $("idade").value, dias: $("dias").value, tempo: $("tempo").value,
      experiencia: $("experiencia").value, intensidade: $("intensidade").value,
      equipamento: $("equipamento").value,
    },
    text,
  });
  LS.set("plans", plans);
  $("savePlanBtn").textContent = "Salvo ✓";
  setTimeout(() => ($("savePlanBtn").textContent = "💾 Salvar no histórico"), 1500);
});

// ---------------------------------------------------------------------------
//  Histórico de planos
// ---------------------------------------------------------------------------
function renderPlans() {
  const plans = LS.get("plans", []);
  const list = $("plansList");
  $("plansEmpty").hidden = plans.length > 0;
  list.innerHTML = "";
  for (const p of plans) {
    const d = new Date(p.when);
    const el = document.createElement("div");
    el.className = "record";
    el.innerHTML = `
      <div class="record-head">
        <span class="record-title">Plano — ${p.params.dias} dias/sem · ${esc(p.params.experiencia)}</span>
        <span class="record-date">${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div class="record-meta">${esc(p.params.tempo)} · intensidade ${esc(p.params.intensidade)} · ${esc(p.params.equipamento)}</div>
      <details><summary>Ver plano</summary><div class="markdown" style="margin-top:10px">${renderMarkdown(p.text)}</div></details>
      <div class="record-actions">
        <button class="btn btn-ghost btn-sm" data-copy="${p.id}">Copiar</button>
        <button class="link-danger" data-del="${p.id}">Excluir</button>
      </div>`;
    list.appendChild(el);
  }
  list.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
    LS.set("plans", LS.get("plans", []).filter((x) => x.id != b.dataset.del)); renderPlans();
  }));
  list.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => {
    const p = LS.get("plans", []).find((x) => x.id == b.dataset.copy);
    if (p) navigator.clipboard.writeText(p.text);
    b.textContent = "Copiado ✓"; setTimeout(() => (b.textContent = "Copiar"), 1500);
  }));
}
$("exportPlansBtn").addEventListener("click", () => {
  download("planos-treino.json", JSON.stringify(LS.get("plans", []), null, 2), "application/json");
});

// ---------------------------------------------------------------------------
//  Diário de treino — tabela clicável
// ---------------------------------------------------------------------------

// Extrai os dias de treino (título + exercícios com metas de séries/reps) do
// texto Markdown de um plano salvo, para preencher a tabela automaticamente.
function parsePlanDays(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const days = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(.*)$/);
    if (!h) continue;
    // procura a próxima tabela antes do próximo título
    let j = i + 1;
    while (j < lines.length && !/\|/.test(lines[j]) && !/^#{1,6}\s/.test(lines[j])) j++;
    if (j >= lines.length || /^#{1,6}\s/.test(lines[j])) continue;
    if (!(j + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[j + 1]) && /-/.test(lines[j + 1]))) continue;
    const header = cells(lines[j]).map((c) => c.toLowerCase());
    const idxNome = header.findIndex((c) => c.includes("exerc"));
    if (idxNome < 0) continue; // ignora tabelas que não são de exercícios
    const idxSer = header.findIndex((c) => c.includes("sér") || c.includes("ser"));
    const idxRep = header.findIndex((c) => c.includes("rep"));
    const exs = [];
    let k = j + 2;
    while (k < lines.length && /\|/.test(lines[k]) && lines[k].trim() !== "") {
      const c = cells(lines[k]);
      const nome = (c[idxNome] || "").replace(/\*\*/g, "").trim();
      if (nome) exs.push({ nome, series: (idxSer >= 0 ? c[idxSer] : "") || "", reps: (idxRep >= 0 ? c[idxRep] : "") || "" });
      k++;
    }
    if (exs.length) days.push({ titulo: h[1].replace(/\*\*/g, "").trim(), exercicios: exs });
  }
  return days;
}

function addExRow(ex = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML =
    `<td class="col-nome"><input type="text" value="${escAttr(ex.nome)}" placeholder="Exercício" /></td>` +
    `<td class="col-num"><input type="text" value="${escAttr(ex.series)}" placeholder="3" /></td>` +
    `<td class="col-num"><input type="text" value="${escAttr(ex.reps)}" placeholder="10" /></td>` +
    `<td class="col-num"><input type="text" value="${escAttr(ex.carga)}" placeholder="—" inputmode="decimal" /></td>` +
    `<td class="col-num"><input type="text" value="${escAttr(ex.rir)}" placeholder="2" /></td>` +
    `<td><button type="button" class="row-del" title="Remover">×</button></td>`;
  tr.querySelector(".row-del").addEventListener("click", () => tr.remove());
  $("logExRows").appendChild(tr);
}

function seedRows(n = 3) {
  $("logExRows").innerHTML = "";
  for (let i = 0; i < n; i++) addExRow();
}

function resetLogForm() {
  $("logTreino").value = "";
  $("logRpe").value = "";
  $("logObs").value = "";
  $("logFromPlan").value = "";
  $("logAeroFez").checked = false;
  $("logAeroFields").hidden = true;
  $("logAeroDur").value = "";
  $("logData").value = today();
  seedRows();
}

// Preenche o seletor "a partir do plano" com os dias do último plano salvo
function refreshFromPlan() {
  const plans = LS.get("plans", []);
  const wrap = $("fromPlanWrap");
  const sel = $("logFromPlan");
  const days = plans.length ? parsePlanDays(plans[0].text) : [];
  if (!days.length) { wrap.hidden = true; sel._days = []; return; }
  wrap.hidden = false;
  sel.innerHTML = `<option value="">— escolher um dia do plano —</option>` +
    days.map((d, i) => `<option value="${i}">${esc(d.titulo)}</option>`).join("");
  sel._days = days;
}

$("logFromPlan").addEventListener("change", (e) => {
  const day = (e.target._days || [])[e.target.value];
  if (!day) return;
  $("logTreino").value = day.titulo;
  $("logExRows").innerHTML = "";
  day.exercicios.forEach((ex) => addExRow(ex));
});

$("addExBtn").addEventListener("click", () => addExRow());
$("logClearBtn").addEventListener("click", resetLogForm);
$("logAeroFez").addEventListener("change", () => {
  $("logAeroFields").hidden = !$("logAeroFez").checked;
});

$("logForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const exercicios = [...$("logExRows").querySelectorAll("tr")].map((tr) => {
    const inp = tr.querySelectorAll("input");
    return { nome: inp[0].value.trim(), series: inp[1].value.trim(), reps: inp[2].value.trim(), carga: inp[3].value.trim(), rir: inp[4].value.trim() };
  }).filter((x) => x.nome);

  const aeroFez = $("logAeroFez").checked;
  const aerobico = aeroFez
    ? { fez: true, tipo: $("logAeroTipo").value, duracao: $("logAeroDur").value.trim(), intensidade: $("logAeroInt").value }
    : null;

  if (!exercicios.length && !aeroFez && !$("logTreino").value.trim()) {
    alert("Adicione ao menos um exercício, um aeróbico ou o nome do treino.");
    return;
  }

  const rec = {
    id: Date.now(),
    data: $("logData").value,
    treino: $("logTreino").value.trim(),
    exercicios,
    aerobico,
    rpe: $("logRpe").value,
    obs: $("logObs").value.trim(),
  };
  const logs = LS.get("logs", []);
  logs.unshift(rec);
  logs.sort((a, b) => (b.data || "").localeCompare(a.data || "") || b.id - a.id);
  LS.set("logs", logs);
  resetLogForm();
  renderLogs();
});

function exTableHTML(exs) {
  if (!Array.isArray(exs) || !exs.length) return "";
  return `<table class="record-table"><thead><tr><th>Exercício</th><th>Séries</th><th>Reps</th><th>Carga</th><th>RIR</th></tr></thead><tbody>` +
    exs.map((e) => `<tr><td>${esc(e.nome)}</td><td>${esc(e.series || "—")}</td><td>${esc(e.reps || "—")}</td><td>${e.carga ? esc(e.carga) + " kg" : "—"}</td><td>${esc(e.rir || "—")}</td></tr>`).join("") +
    `</tbody></table>`;
}
function aeroLineHTML(a) {
  if (!a || !a.fez) return "";
  const bits = [a.tipo, a.duracao ? a.duracao + " min" : "", a.intensidade].filter(Boolean).join(" · ");
  return `<div class="record-meta">🏃 Aeróbico: ${esc(bits)}</div>`;
}

function renderLogs() {
  const logs = LS.get("logs", []);
  const list = $("logsList");
  $("logsEmpty").hidden = logs.length > 0;
  list.innerHTML = "";
  for (const l of logs) {
    const legacy = typeof l.exercicios === "string" ? l.exercicios : "";
    const el = document.createElement("div");
    el.className = "record";
    el.innerHTML = `
      <div class="record-head">
        <span class="record-title">${esc(l.treino || "Sessão")}</span>
        <span class="record-date">${l.data ? new Date(l.data + "T00:00").toLocaleDateString("pt-BR") : ""}${l.rpe ? " · RPE " + esc(l.rpe) : ""}</span>
      </div>
      ${exTableHTML(l.exercicios)}
      ${legacy ? `<div class="record-body">${esc(legacy)}</div>` : ""}
      ${aeroLineHTML(l.aerobico)}
      ${l.obs ? `<div class="record-meta" style="margin-top:8px">📝 ${esc(l.obs)}</div>` : ""}
      <div class="record-actions"><button class="link-danger" data-del="${l.id}">Excluir</button></div>`;
    list.appendChild(el);
  }
  list.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
    LS.set("logs", LS.get("logs", []).filter((x) => x.id != b.dataset.del)); renderLogs();
  }));
}

$("exportLogsBtn").addEventListener("click", () => {
  const logs = LS.get("logs", []);
  const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const rows = [["data", "treino", "exercicio", "series", "reps", "carga_kg", "rir", "rpe_sessao", "aerobico", "observacoes"].join(",")];
  for (const l of logs) {
    const aero = l.aerobico?.fez ? [l.aerobico.tipo, l.aerobico.duracao && l.aerobico.duracao + "min", l.aerobico.intensidade].filter(Boolean).join(" ") : "";
    const exs = Array.isArray(l.exercicios) ? l.exercicios : [];
    if (exs.length) {
      for (const e of exs) rows.push([q(l.data), q(l.treino), q(e.nome), q(e.series), q(e.reps), q(e.carga), q(e.rir), q(l.rpe), q(aero), q(l.obs)].join(","));
    } else {
      rows.push([q(l.data), q(l.treino), q(typeof l.exercicios === "string" ? l.exercicios : ""), "", "", "", "", q(l.rpe), q(aero), q(l.obs)].join(","));
    }
  }
  download("diario-treino.csv", "﻿" + rows.join("\n"), "text/csv");
});

// ---------------------------------------------------------------------------
//  Utilidades
// ---------------------------------------------------------------------------
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
//  Init
// ---------------------------------------------------------------------------
loadSettings();
$("logData").value = today();
seedRows();
refreshFromPlan();
