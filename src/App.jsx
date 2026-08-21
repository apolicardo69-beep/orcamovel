import { useState, useRef } from "react";

// Nº de páginas de PDF a partir do qual avisamos o usuário (cada página vira 1 chamada de IA).
const LARGE_PDF_PAGE_THRESHOLD = 8;

const lsGet = (key, fb) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const lsSet = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
const fmtBRL = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DEFAULT_RULES = [
  { id: 1, category: "Armário/Guarda-roupa", label: "Corpo do armário completo (inclui portas MDF)", price: 1250, unit: "m²", note: "Altura × Largura. Preço JÁ INCLUI portas de correr em MDF. Padrão interno MDF Branco Texturizado. Corrediça RO45 Rometal." },
  { id: 2, category: "Armário/Guarda-roupa", label: "Adicional porta de correr com ESPELHO", price: 900, unit: "un", note: "Cobrar R$900 SOMENTE quando a porta for espelho. Porta MDF normal já está incluída no m²." },
  { id: 3, category: "Armário/Guarda-roupa", label: "Adicional canto arredondado", price: 15, unit: "%", note: "+15% sobre o valor total do módulo." },
  { id: 4, category: "Cozinha", label: "Corpo armário de cozinha", price: 1250, unit: "m²", note: "Mesmo método: altura × largura." },
  { id: 5, category: "Cozinha", label: "Gabinete de pia (cozinha)", price: 1250, unit: "ml", note: "Por metro linear de bancada/gabinete." },
  { id: 6, category: "Banheiro", label: "Gabinete de banheiro", price: 1250, unit: "ml", note: "Por metro linear." },
  { id: 7, category: "Painel", label: "Painel de parede liso", price: 650, unit: "m²", note: "Painel liso fixado em parede." },
  { id: 8, category: "Painel", label: "Painel ripado", price: 800, unit: "m²", note: "Painel com ripas decorativas." },
  { id: 9, category: "Prateleira", label: "Prateleira externa", price: 190, unit: "ml", note: "Por metro linear." },
  { id: 10, category: "TV/Sala", label: "Móvel apoio TV (rack/buffet)", price: 1850, unit: "ml", note: "Móvel abaixo do painel de TV, por metro linear." },
  { id: 11, category: "TV/Sala", label: "Aparador ou mesa de cabeceira simples", price: 650, unit: "un", note: "Peça simples." },
  { id: 12, category: "TV/Sala", label: "Aparador ou mesa de cabeceira complexo", price: 900, unit: "un", note: "Peça com mais detalhes/gaveteiros." },
  { id: 13, category: "Cristaleira/Vidro", label: "Cristaleira (corpo MDF)", price: 950, unit: "m²", note: "Por m² do módulo." },
  { id: 14, category: "Cristaleira/Vidro", label: "Prateleira de vidro normal", price: 259, unit: "m²", note: "Vidro temperado por m²." },
  { id: 15, category: "Cristaleira/Vidro", label: "Porta de vidro com perfil alumínio", price: 450, unit: "ml", note: "Por metro linear da porta." },
];

const DEFAULT_EXAMPLES = [
  {
    id: 1,
    label: "Guarda-roupa 2,21m × 2,63m — 3 portas correr (1 espelho)",
    ambiente: "Quarto",
    dimensoes: "L:2,21m A:2,63m P:0,56m",
    descricao: "Guarda-roupa MDF Gris. 3 portas de correr RO45 Rometal, sendo 1 porta espelho. Portas MDF já inclusas no m².",
    calculo: "Corpo (inclui 2 portas MDF): 2,21 × 2,63 × R$1.250 = R$7.265 | Adicional 1 porta espelho: 1 × R$900 = R$900 | Total: R$8.165",
    total: 8165,
  },
];

const CAT_COLORS = {
  "Armário/Guarda-roupa": "#c8892a", Cozinha: "#e87a40", Banheiro: "#5b9bd5",
  Painel: "#9a7ab8", Prateleira: "#7ab87a", "TV/Sala": "#c87aa0", "Cristaleira/Vidro": "#60c8c8",
};

const buildSystemPrompt = (rules, examples) => {
  const ruleLines = rules.map(r => `- ${r.label}: R$${r.price}/${r.unit}. ${r.note}`).join("\n");
  const exLines = examples.map(ex =>
    `EXEMPLO REAL: ${ex.label}\n  Ambiente: ${ex.ambiente} | Dimensões: ${ex.dimensoes}\n  Descrição: ${ex.descricao}\n  Cálculo: ${ex.calculo}\n  Total: R$${ex.total}`
  ).join("\n\n");
  return `Você é um agente especialista em orçamento de móveis planejados para marcenaria brasileira.

## REGRAS DE PRECIFICAÇÃO (seguir exatamente):
${ruleLines}

## PADRÕES:
- Acabamento interno padrão: MDF Branco Texturizado
- Portas de correr: corrediça telescópica sistema RO45 Rometal
- **REGRA CRÍTICA DE PORTAS:** O preço de R$1.250/m² do armário JÁ INCLUI as portas de correr em MDF. Cobrar R$900 SOMENTE por cada porta que for ESPELHO. Porta MDF normal = não cobra separado.
- Cantos arredondados: +15% sobre o valor do módulo como item separado
- Armários em geral: Altura × Largura = m², depois × preço/m²
- Portas espelho: cada porta espelho = R$900 unitário (SEPARADO do corpo)
- Gabinetes/racks/prateleiras: preço por metro linear
- Peças únicas (cabeceira, aparador): valor unitário

## REGRAS PARA FORMAS COMPOSTAS (MUITO IMPORTANTE):
- Painéis em L, U, C ou qualquer formato não-retangular devem ser divididos em MÚLTIPLAS peças retangulares
- Exemplo: Painel cabeceira em L (2,58m × 1,80m + ala lateral 0,61m × 1,80m) = DUAS peças separadas no JSON
- NUNCA some as dimensões de um L numa só medida — sempre desmembre em peças individuais
- Se o projeto mostrar vistas múltiplas (frontal, lateral, alta), leia TODAS as vistas para capturar todas as dimensões
- Quando identificar forma composta, adicione o campo "aviso": "Peça composta — verifique se todas as alas foram incluídas" na peça principal
- Painéis com recortes, nichos embutidos ou quinas: desmembrar em retângulos e listar individualmente

## EXEMPLOS REAIS DO CLIENTE:
${exLines}

## FORMATO DE RESPOSTA:
Retorne APENAS JSON válido sem markdown:
{"ambiente":"nome","descricao":"descrição","formasCompostas":["lista de peças em L/U/C detectadas para aviso"],"pecas":[{"id":1,"nome":"nome da peça","tipo":"m²|ml|unidade|%","largura":0.0,"altura":0.0,"quantidade":1,"precoUnitario":0,"subtotal":0,"observacao":"","aviso":""}],"totalBruto":0,"observacoes":""}

REGRAS DO JSON:
- subtotal = largura×altura×quantidade×precoUnitario (para m²) OU quantidade×precoUnitario (para unidade/ml)
- totalBruto = soma de todos os subtotais
- Extraia dimensões EXATAS das cotas visíveis no projeto — leia TODAS as vistas (frontal, lateral, alta, isometria)
- Identifique cada porta SEPARADAMENTE do corpo do armário
- Painéis em L/U/C: dividir em peças retangulares, preencher "formasCompostas" com os nomes para exibir aviso
- Campo "aviso" na peça: preencher quando houver dúvida nas dimensões ou forma composta detectada`;
};

export default function App() {
  const [tab, setTab] = useState("quote");
  const [rules, setRules] = useState(() => lsGet("om_rules_v1", DEFAULT_RULES));
  const [examples, setExamples] = useState(() => lsGet("om_examples_v1", DEFAULT_EXAMPLES));
  const [margin, setMargin] = useState(() => lsGet("om_margin_v1", 0));
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [formasCompostas, setFormasCompostas] = useState([]);
  const [pieces, setPieces] = useState([]);
  const [ambientDesc, setAmbientDesc] = useState("");
  const [clientName, setClientName] = useState("");
  const [history, setHistory] = useState(() => lsGet("om_history_v2", []));
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [savedBanner, setSavedBanner] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("om_apikey") || "");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ category: "Armário/Guarda-roupa", label: "", unit: "m²", price: "", note: "" });
  const [showAddExample, setShowAddExample] = useState(false);
  const [newExample, setNewExample] = useState({ label: "", ambiente: "", dimensoes: "", descricao: "", calculo: "", total: "" });
  const [analyzingProgress, setAnalyzingProgress] = useState(null); // { current, total }
  const fileInputId = "projeto-upload-input";

  const saveRules = (r) => { setRules(r); lsSet("om_rules_v1", r); };
  const saveExamples = (e) => { setExamples(e); lsSet("om_examples_v1", e); };
  const saveHistory = (h) => { setHistory(h); lsSet("om_history_v2", h); };

  const pdfToImages = async (arrayBuffer) => {
    if (!window.pdfjsLib) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      // scale 3.2: cada página agora vai sozinha numa chamada de IA (ver requestPageAnalysis),
      // então há folga de payload para priorizar nitidez das cotas em pranchas técnicas.
      const vp = page.getViewport({ scale: 3.2 });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      pages.push(canvas.toDataURL("image/jpeg", 0.92));
    }
    return pages;
  };

  const handleFile = (file) => {
    if (!file) return;
    setAnalysisError(null); setPieces([]);
    if (file.type === "application/pdf") {
      setUploadedFile({ name: file.name, isImg: false, isPdf: true, preview: null, pages: [], converting: true });
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const pages = await pdfToImages(e.target.result);
          setUploadedFile({ name: file.name, isImg: false, isPdf: true, preview: pages[0], pages, converting: false });
        } catch (err) {
          setAnalysisError("Erro ao converter PDF: " + err.message);
          setUploadedFile(null);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const b64 = e.target.result.split(",")[1];
        setUploadedFile({ b64, mediaType: file.type, name: file.name, isImg: true, isPdf: false, preview: e.target.result, pages: [] });
      };
      reader.readAsDataURL(file);
    }
  };

  // Extrai JSON mesmo que o modelo devolva texto em volta
  const extractJSON = (raw) => {
    const s = typeof raw === "string" ? raw : JSON.stringify(raw);
    // tenta bloco ```json ... ```
    const fenced = s.match(/```json\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1].trim());
    // tenta bloco ``` ... ```
    const fenced2 = s.match(/```([\s\S]*?)```/);
    if (fenced2) return JSON.parse(fenced2[1].trim());
    // tenta encontrar { ... } mais externo
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start !== -1 && end !== -1) return JSON.parse(s.slice(start, end + 1));
    throw new Error("Resposta não contém JSON válido.");
  };

  // Chama a IA para UMA imagem/página, com orçamento de tokens próprio.
  // Detecta resposta cortada (finish_reason "length") e refaz com mais tokens;
  // também tenta de novo em erros transitórios (429/5xx) e JSON malformado.
  const requestPageAnalysis = async (systemPrompt, imageDataUrl, instruction, pageLabel) => {
    let maxTokens = 4096;
    const MAX_ATTEMPTS = 4;
    let lastErr = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Se o usuário configurou uma chave pessoal (⚙️ API key), chamamos a OpenRouter
      // direto do navegador com ela. Sem chave pessoal, usamos a serverless function
      // (api/analyze.js, hospedada na Vercel), que injeta a chave do SERVIDOR sem nunca
      // expô-la no bundle do navegador — diferente da antiga VITE_OPENROUTER_API_KEY,
      // que ficava visível a qualquer visitante do site.
      const usePersonalKey = !!apiKey;
      const endpoint = usePersonalKey
        ? "https://openrouter.ai/api/v1/chat/completions"
        : "/api/analyze";
      const headers = usePersonalKey
        ? { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": window.location.origin, "X-Title": "OrcaMóvel" }
        : { "Content-Type": "application/json" };
      const body = usePersonalKey
        ? JSON.stringify({
            model: "anthropic/claude-sonnet-4-5",
            max_tokens: maxTokens,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: [
                { type: "image_url", image_url: { url: imageDataUrl } },
                { type: "text", text: instruction },
              ] },
            ],
          })
        : JSON.stringify({ systemPrompt, imageDataUrl, instruction, maxTokens });

      let resp;
      try {
        resp = await fetch(endpoint, { method: "POST", headers, body });
      } catch (netErr) {
        lastErr = new Error(`Falha de rede em ${pageLabel}: ${netErr.message}`);
        await new Promise(r => setTimeout(r, 700 * attempt));
        continue;
      }

      if (resp.status === 429 || resp.status >= 500) {
        const err = await resp.json().catch(() => ({}));
        lastErr = new Error(err?.error?.message || `Erro HTTP ${resp.status} em ${pageLabel}`);
        await new Promise(r => setTimeout(r, 900 * attempt));
        continue;
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (err?.error?.code === "NO_SERVER_KEY") {
          throw new Error("Nenhuma chave da OpenRouter configurada. Configure sua chave pessoal no ⚙️ acima, ou peça para quem administra o site configurar OPENROUTER_API_KEY na Vercel.");
        }
        throw new Error(err?.error?.message || `Erro HTTP ${resp.status} em ${pageLabel}`);
      }

      const data = await resp.json();
      const choice = data.choices?.[0];
      const raw = choice?.message?.content || "";
      const truncated = choice?.finish_reason === "length" || choice?.native_finish_reason === "length";

      if (truncated) {
        // Resposta cortada por limite de tokens: dobra o orçamento e tenta de novo
        // em vez de aceitar um JSON incompleto (causa raiz de "só lê poucas páginas").
        maxTokens = Math.min(maxTokens * 2, 8192);
        lastErr = new Error(`Resposta da IA cortada (limite de tokens) em ${pageLabel}`);
        continue;
      }

      try {
        return extractJSON(raw);
      } catch (parseErr) {
        lastErr = new Error(`JSON inválido da IA em ${pageLabel}: ${parseErr.message}`);
        continue;
      }
    }
    throw lastErr || new Error(`Falha ao analisar ${pageLabel} após ${MAX_ATTEMPTS} tentativas.`);
  };

  const analyzeProject = async () => {
    if (!uploadedFile) return;
    if (uploadedFile.converting) { setAnalysisError("Aguarde o PDF terminar de carregar..."); return; }
    // Nota: não bloqueamos mais por falta de chave pessoal — sem uma, a chamada cai na
    // function serverless, que pode ter uma chave do servidor configurada. Se não houver
    // nenhuma das duas, o erro específico (NO_SERVER_KEY) aparece após a tentativa.

    const systemPrompt = buildSystemPrompt(rules, examples);
    const images = uploadedFile.isPdf
      ? (uploadedFile.pages || [])
      : [`data:${uploadedFile.mediaType};base64,${uploadedFile.b64}`];
    const total = images.length;

    if (total === 0) {
      setAnalysisError("Nenhuma imagem para analisar.");
      return;
    }

    if (total > LARGE_PDF_PAGE_THRESHOLD) {
      const ok = window.confirm(
        `Este PDF tem ${total} páginas. A análise faz 1 chamada de IA por página (mais confiável, mas mais chamadas/custo) ` +
        `e pode levar alguns minutos. Deseja continuar?`
      );
      if (!ok) return;
    }

    setIsAnalyzing(true); setAnalysisError(null); setAnalyzingProgress(null);

    const allPieces = [];
    const allFormas = [];
    const ambientParts = [];
    const failedPages = [];
    let nextId = 1;

    // Analisa página por página (em vez de mandar tudo numa única chamada).
    // Isso dá a cada página seu próprio orçamento de tokens de resposta e evita
    // que um projeto de várias pranchas gere um JSON gigante que é truncado
    // antes de listar todas as peças.
    for (let i = 0; i < total; i++) {
      setAnalyzingProgress({ current: i + 1, total });
      const pageLabel = total > 1 ? `página ${i + 1}/${total}` : "o projeto";
      const instruction = total > 1
        ? `Esta é a página ${i + 1} de ${total} de um projeto de móveis planejados (pode ser uma vista frontal, lateral, corte, planta ou outro móvel do mesmo projeto). Analise APENAS o que está visível NESTA página e retorne SOMENTE o JSON conforme as instruções do sistema, listando as peças identificadas nela. Se esta página não mostrar nenhum móvel com cotas (ex: capa, memorial descritivo, texto), retorne "pecas":[].`
        : `Analise este projeto de móveis planejados e retorne SOMENTE o JSON conforme as instruções do sistema. Não escreva nenhum texto fora do JSON.`;

      try {
        const parsed = await requestPageAnalysis(systemPrompt, images[i], instruction, pageLabel);
        const pecas = (parsed.pecas || []).map(p => ({ ...p, _id: nextId++, _pagina: total > 1 ? i + 1 : undefined }));
        allPieces.push(...pecas);
        if (parsed.formasCompostas?.length) allFormas.push(...parsed.formasCompostas);
        const desc = parsed.descricao ? `${parsed.ambiente || ""} — ${parsed.descricao}` : parsed.ambiente;
        if (desc) ambientParts.push(desc);
      } catch (pageErr) {
        failedPages.push({ page: i + 1, error: pageErr.message });
      }
    }

    setAnalyzingProgress(null);
    setPieces(allPieces);
    setFormasCompostas([...new Set(allFormas)]);
    if (ambientParts.length) setAmbientDesc([...new Set(ambientParts)].join(" · "));

    if (failedPages.length > 0) {
      setAnalysisError(
        `${allPieces.length} peça(s) extraída(s) de ${total - failedPages.length}/${total} página(s) lidas com sucesso. ` +
        `Falha ao ler ${failedPages.map(f => `pág. ${f.page}`).join(", ")} (${failedPages[0].error}). ` +
        `Adicione manualmente as peças das páginas que falharam ou tente analisar novamente.`
      );
    } else if (allPieces.length === 0) {
      setAnalysisError("A IA não identificou nenhuma peça no projeto. Tente com imagens mais nítidas ou adicione as peças manualmente.");
    }

    setIsAnalyzing(false);
  };

  const generatePDF = async () => {
    if (!window.jspdf) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const q = calcQuote();
    const PW = 210; const mg = 15; const col = PW - mg * 2;
    let y = 20;
    const gold = [200, 137, 42]; const dark = [30, 20, 10]; const gr = [100, 90, 80];

    // Header dourado
    doc.setFillColor(...gold);
    doc.rect(0, 0, PW, 28, "F");
    doc.setTextColor(255,255,255);
    doc.setFontSize(20); doc.setFont("helvetica","bold");
    doc.text("OrcaMóvel", mg, 12);
    doc.setFontSize(8); doc.setFont("helvetica","normal");
    doc.text("AGENTE IA · MÓVEIS PLANEJADOS", mg, 18);
    doc.setFontSize(9);
    doc.text("ORÇAMENTO", PW-mg, 12, {align:"right"});
    doc.text(new Date().toLocaleDateString("pt-BR"), PW-mg, 18, {align:"right"});
    y = 38;

    // Bloco cliente
    doc.setFillColor(245,240,230);
    doc.rect(mg, y-5, col, 18, "F");
    doc.setTextColor(...dark);
    doc.setFontSize(9); doc.setFont("helvetica","bold");
    doc.text("CLIENTE", mg+4, y+1);
    doc.setFont("helvetica","normal");
    doc.text(clientName||"—", mg+4, y+7);
    doc.setFont("helvetica","bold");
    doc.text("AMBIENTE", mg+col/2, y+1);
    doc.setFont("helvetica","normal");
    doc.text(ambientDesc||"—", mg+col/2, y+7);
    y += 24;

    // Cabeçalho tabela
    doc.setFillColor(...gold);
    doc.rect(mg, y, col, 8, "F");
    doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont("helvetica","bold");
    doc.text("PEÇA", mg+2, y+5.5);
    doc.text("TIPO", mg+78, y+5.5);
    doc.text("DIM.", mg+96, y+5.5);
    doc.text("QTD", mg+118, y+5.5);
    doc.text("R$/UN", mg+130, y+5.5);
    doc.text("SUBTOTAL", PW-mg-2, y+5.5, {align:"right"});
    y += 10;

    // Linhas
    doc.setFont("helvetica","normal");
    q.lines.forEach((l,i) => {
      if (y > 260) { doc.addPage(); y = 20; }
      if (i%2===0) { doc.setFillColor(252,248,240); doc.rect(mg,y-1,col,8,"F"); }
      doc.setTextColor(...dark); doc.setFontSize(8);
      const nome = l.nome.length>38 ? l.nome.slice(0,35)+"..." : l.nome;
      doc.text(nome, mg+2, y+4.5);
      doc.text(l.tipo||"m²", mg+78, y+4.5);
      const dim = l.tipo==="m²" ? ((parseFloat(l.largura)||0).toFixed(2)+"x"+(parseFloat(l.altura)||0).toFixed(2)) : "—";
      doc.text(dim, mg+96, y+4.5);
      doc.text(String(l.quantidade||1), mg+120, y+4.5);
      doc.text("R$"+(l.precoUnitario||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}), mg+130, y+4.5);
      doc.setFont("helvetica","bold");
      doc.text("R$"+l.lineTotal.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}), PW-mg-2, y+4.5, {align:"right"});
      doc.setFont("helvetica","normal");
      y += 8;
    });

    y += 4;
    doc.setDrawColor(...gold); doc.setLineWidth(0.5);
    doc.line(mg, y, PW-mg, y);
    y += 8;

    // Totais
    const row = (lbl, val, bold=false) => {
      doc.setFont("helvetica", bold?"bold":"normal"); doc.setFontSize(9);
      doc.setTextColor(...gr); doc.text(lbl, PW-mg-60, y);
      doc.setTextColor(...dark);
      doc.text("R$"+val.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}), PW-mg-2, y, {align:"right"});
      y += 7;
    };
    row("Subtotal materiais", q.subtotal);
    if (q.marginVal>0) row("Margem ("+margin+"%)", q.marginVal);

    y += 2;
    doc.setFillColor(...gold);
    doc.rect(PW-mg-82, y-5, 82, 13, "F");
    doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(11);
    doc.text("TOTAL", PW-mg-80, y+3.5);
    doc.setFontSize(12);
    doc.text("R$"+q.total.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}), PW-mg-2, y+3.5, {align:"right"});

    // Rodapé
    doc.setFontSize(7); doc.setTextColor(...gr); doc.setFont("helvetica","normal");
    doc.text("Orçamento estimado por IA. Valores sujeitos a confirmação após visita técnica.", mg, 288);

    const fn = (clientName||"orcamento").replace(/\s+/g,"_").toLowerCase();
    doc.save("orcamovel_"+fn+"_"+new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")+".pdf");
  };

  const calcLine = (p) => {
    const qty = parseFloat(p.quantidade) || 1;
    const sub = parseFloat(p.subtotal);
    if (sub) return sub;
    const price = parseFloat(p.precoUnitario) || 0;
    const area = (p.tipo === "m²") ? (parseFloat(p.largura) || 0) * (parseFloat(p.altura) || 0) : 1;
    return area * qty * price;
  };

  const calcQuote = () => {
    let subtotal = 0;
    const lines = pieces.map(p => { const lt = calcLine(p); subtotal += lt; return { ...p, lineTotal: lt }; });
    const marginVal = subtotal * (margin / 100);
    return { lines, subtotal, marginVal, total: subtotal + marginVal };
  };

  const addPiece = () => setPieces(prev => [...prev, { _id: Date.now(), nome: "Nova Peça", tipo: "m²", largura: 1, altura: 1, quantidade: 1, precoUnitario: 1250, subtotal: 0, observacao: "" }]);
  const updPiece = (id, field, val) => setPieces(prev => prev.map(p => {
    if (p._id !== id) return p;
    const up = { ...p, [field]: val };
    if (["largura","altura","quantidade","precoUnitario","tipo"].includes(field)) {
      const qty = parseFloat(field==="quantidade"?val:up.quantidade)||1;
      const price = parseFloat(field==="precoUnitario"?val:up.precoUnitario)||0;
      const tipo = field==="tipo"?val:up.tipo;
      const area = tipo==="m²"?(parseFloat(field==="largura"?val:up.largura)||0)*(parseFloat(field==="altura"?val:up.altura)||0):1;
      up.subtotal = area * qty * price;
    }
    return up;
  }));
  const delPiece = (id) => setPieces(prev => prev.filter(p => p._id !== id));

  const saveQuote = () => {
    const q = calcQuote();
    saveHistory([{ id: Date.now(), date: new Date().toLocaleDateString("pt-BR"), client: clientName||"Cliente", notes: ambientDesc, pieces: [...pieces], total: q.total, margin }, ...history]);
    setSavedBanner(true); setTimeout(() => setSavedBanner(false), 2500);
  };

  const quote = calcQuote();
  const catGroups = [...new Set(rules.map(r => r.category))];
  const IS = { background:"#1c1510", border:"1px solid #332618", borderRadius:7, color:"#f0e0c8", padding:"8px 12px", fontFamily:"'Barlow',sans-serif", fontSize:13, outline:"none", width:"100%" };
  const NS = { ...IS, color:"#d4952e", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 };

  return (
    <div style={{ fontFamily:"'Barlow',sans-serif", background:"#0d0a07", minHeight:"100vh", color:"#f0e0c8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#110e09}::-webkit-scrollbar-thumb{background:#3a2a1a;border-radius:3px}
        input,select,textarea{font-family:'Barlow',sans-serif!important}
        input:focus,select:focus{border-color:#c8892a!important;box-shadow:0 0 0 2px rgba(200,137,42,.15)!important}
        .hb:hover{opacity:.82;transform:translateY(-1px)} .hr:hover{background:rgba(255,255,255,.02)!important}
        .tab:hover{color:#c8892a!important} .dropzone.drag{border-color:#c8892a!important;background:rgba(200,137,42,.04)!important}
        .hcard:hover{border-color:#5a4030!important}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}} .ban{animation:fadeIn .3s ease}
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite;display:inline-block}
      `}</style>

      <header style={{ background:"linear-gradient(135deg,#18110a,#221609)", borderBottom:"1px solid #2e1f0e", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, background:"linear-gradient(135deg,#c8892a,#e8aa40)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🪵</div>
          <div>
            <div style={{ fontFamily:"'Playfair Display'", fontSize:21, fontWeight:700 }}>OrcaMóvel</div>
            <div style={{ fontSize:10, color:"#6a5030", letterSpacing:".12em", textTransform:"uppercase" }}>Agente IA · Móveis Planejados</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ position:"relative" }}>
            <button onClick={() => setShowKeyInput(v=>!v)} style={{ background:apiKey?"rgba(100,200,80,.1)":"rgba(200,137,42,.08)", border:`1px solid ${apiKey?"rgba(100,200,80,.25)":"rgba(200,137,42,.2)"}`, borderRadius:7, color:apiKey?"#80c860":"#c8892a", padding:"7px 13px", fontSize:12, cursor:"pointer", fontWeight:600 }}>
              ⚙️ {apiKey?"API ✓ (pessoal)":"API key"}
            </button>
            {showKeyInput && (
              <div style={{ position:"absolute", right:0, top:"110%", background:"#1c1510", border:"1px solid #3a2618", borderRadius:10, padding:16, zIndex:100, minWidth:300, boxShadow:"0 8px 32px rgba(0,0,0,.6)" }}>
                <div style={{ fontSize:12, color:"#7a6040", marginBottom:6 }}>Chave OpenRouter pessoal (opcional, sk-or-...):</div>
                <input type="password" value={apiKey} placeholder="sk-or-..." onChange={e=>{ setApiKey(e.target.value); localStorage.setItem("om_apikey",e.target.value); }} style={{ ...IS, fontFamily:"monospace", fontSize:12, marginBottom:8 }} />
                <div style={{ fontSize:11, color:"#4a3828", marginBottom:6 }}>Obtenha em <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color:"#c8892a" }}>openrouter.ai/keys</a></div>
                <div style={{ fontSize:11, color:"#5a4830", lineHeight:1.5 }}>Se você deixar em branco, a análise usa a chave configurada no servidor (variável <code>OPENROUTER_API_KEY</code> na Vercel), se houver uma.</div>
                <button onClick={()=>setShowKeyInput(false)} style={{ marginTop:10, background:"rgba(200,137,42,.15)", border:"1px solid rgba(200,137,42,.3)", borderRadius:6, color:"#c8892a", padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:600 }}>Fechar</button>
              </div>
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:"#6a5030", textTransform:"uppercase", letterSpacing:".08em" }}>Margem</span>
            <input type="number" value={margin} onChange={e=>{ setMargin(Number(e.target.value)); lsSet("om_margin_v1",Number(e.target.value)); }} min={0} max={200} style={{ width:58, background:"#1c1510", border:"1px solid #3a2a1a", borderRadius:7, color:"#d4952e", padding:"5px 8px", fontSize:15, fontFamily:"'Barlow Condensed'", fontWeight:700, textAlign:"center" }} />
            <span style={{ fontSize:13, color:"#7a5a30" }}>%</span>
          </div>
        </div>
      </header>

      <nav style={{ background:"#110e09", borderBottom:"1px solid #1a1006", padding:"0 24px", display:"flex" }}>
        {[{id:"quote",icon:"📐",label:"Orçamento"},{id:"training",icon:"🧠",label:"Treinamento"},{id:"history",icon:"📋",label:"Histórico"}].map(t=>(
          <button key={t.id} className="tab" onClick={()=>setTab(t.id)} style={{ border:"none", background:"transparent", cursor:"pointer", padding:"12px 18px", fontFamily:"'Barlow'", fontWeight:500, fontSize:13, color:tab===t.id?"#c8892a":"#5a4a38", borderBottom:tab===t.id?"2px solid #c8892a":"2px solid transparent", transition:"all .2s" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      {savedBanner && <div className="ban" style={{ position:"fixed", top:18, left:"50%", transform:"translateX(-50%)", background:"#1e3a14", border:"1px solid #4a8a28", borderRadius:10, padding:"11px 22px", color:"#8aca58", fontWeight:600, fontSize:14, zIndex:999, boxShadow:"0 8px 24px rgba(0,0,0,.5)" }}>✅ Orçamento salvo!</div>}

      <main style={{ maxWidth:1120, margin:"0 auto", padding:"22px 24px" }}>

        {tab==="quote" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:20 }}>
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                <div>
                  <label style={{ display:"block", fontSize:10, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:5 }}>Cliente</label>
                  <input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Nome do cliente..." style={IS} />
                </div>
                <div>
                  <label style={{ display:"block", fontSize:10, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:5 }}>Ambiente</label>
                  <input value={ambientDesc} onChange={e=>setAmbientDesc(e.target.value)} placeholder="Ex: Quarto — Guarda-roupa casal" style={IS} />
                </div>
              </div>

              <div className={`dropzone${isDragging?" drag":""}`} onDrop={e=>{e.preventDefault();setIsDragging(false);handleFile(e.dataTransfer.files[0]);}} onDragOver={e=>{e.preventDefault();setIsDragging(true);}} onDragLeave={()=>setIsDragging(false)}
                style={{ border:"2px dashed #3a2810", borderRadius:14, padding:"20px", textAlign:"center", marginBottom:12, background:"#0f0c08", minHeight:150, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, transition:"all .2s" }}>
                {uploadedFile?.converting ? (
                  <>
                    <div className="spin" style={{ fontSize:32 }}>⚙️</div>
                    <div style={{ color:"#c8892a", fontSize:13, fontWeight:600 }}>Convertendo PDF...</div>
                    <div style={{ fontSize:11, color:"#4a3828" }}>{uploadedFile.name}</div>
                  </>
                ) : uploadedFile?.preview ? (
                  <>
                    <img src={uploadedFile.preview} alt="projeto" style={{ maxHeight:190, maxWidth:"100%", borderRadius:10, objectFit:"contain", border:"1px solid #2e1f0e" }} />
                    {uploadedFile.isPdf && uploadedFile.pages?.length > 1 && (
                      <div style={{ fontSize:11, color:"#c8892a" }}>📄 {uploadedFile.pages.length} páginas convertidas ✓</div>
                    )}
                    {uploadedFile.isPdf && uploadedFile.pages?.length > LARGE_PDF_PAGE_THRESHOLD && (
                      <div style={{ fontSize:11, color:"#e8aa40", maxWidth:280 }}>⚠️ PDF grande — a análise fará {uploadedFile.pages.length} chamadas de IA (uma por página) e pode demorar mais.</div>
                    )}
                    <div style={{ display:"flex", gap:8 }}>
                      <label htmlFor={fileInputId} className="hb" style={{ background:"rgba(200,137,42,.12)", border:"1px solid rgba(200,137,42,.3)", borderRadius:7, color:"#c8892a", padding:"7px 16px", fontSize:12, fontWeight:600, cursor:"pointer", display:"inline-block" }}>🔄 Trocar</label>
                      <button className="hb" onClick={()=>{setUploadedFile(null);setPieces([]);setAnalysisError(null);}} style={{ background:"rgba(180,50,50,.1)", border:"1px solid rgba(180,50,50,.2)", borderRadius:7, color:"#a05050", padding:"7px 12px", fontSize:12, cursor:"pointer" }}>✕</button>
                    </div>
                  </>
                ) : uploadedFile ? (
                  <>
                    <div style={{ fontSize:38 }}>📄</div>
                    <div style={{ color:"#c8892a", fontSize:13, fontWeight:600 }}>{uploadedFile.name}</div>
                    <button onClick={()=>{setUploadedFile(null);setPieces([]);}} style={{ background:"rgba(180,50,50,.1)", border:"1px solid rgba(180,50,50,.2)", borderRadius:7, color:"#a05050", padding:"6px 12px", fontSize:12, cursor:"pointer" }}>✕ Remover</button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:40 }}>🏠</div>
                    <div style={{ fontFamily:"'Playfair Display'", fontSize:17, color:"#6a5030", marginBottom:2 }}>Envie o projeto aqui</div>
                    <div style={{ fontSize:12, color:"#3a2818" }}>Arraste foto, croqui ou PDF — ou clique no botão</div>
                    <label htmlFor={fileInputId} className="hb" style={{ background:"linear-gradient(135deg,#c8892a,#e8aa40)", border:"none", borderRadius:9, color:"#0d0a07", padding:"11px 26px", fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:14, letterSpacing:".1em", cursor:"pointer", textTransform:"uppercase", boxShadow:"0 4px 16px rgba(200,137,42,.3)", display:"inline-block" }}>📁 Escolher Arquivo</label>
                    <div style={{ fontSize:11, color:"#2e1e0e" }}>JPG · PNG · PDF</div>
                  </>
                )}
                <input id={fileInputId} type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])} />
              </div>

              {uploadedFile && (
                <button className="hb" onClick={analyzeProject} disabled={isAnalyzing} style={{ width:"100%", padding:"12px", background:isAnalyzing?"#1a1610":"linear-gradient(135deg,#c8892a,#e8aa40)", border:"none", borderRadius:10, color:isAnalyzing?"#5a4a30":"#0d0a07", fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:14, letterSpacing:".1em", cursor:isAnalyzing?"not-allowed":"pointer", marginBottom:14, textTransform:"uppercase", transition:"all .2s" }}>
                  {isAnalyzing?<><span className="spin">⚙️</span> {analyzingProgress?`Analisando página ${analyzingProgress.current}/${analyzingProgress.total}…`:"Analisando com IA…"}</>:"🤖 Analisar com IA"}
                </button>
              )}

              {analysisError && <div style={{ background:"#1e1010", border:"1px solid #5a2020", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:13, color:"#c06060" }}>{analysisError}</div>}

              {formasCompostas.length > 0 && (
                <div style={{ background:"#1a1500", border:"1px solid #c8892a", borderRadius:10, padding:"12px 16px", marginBottom:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:18 }}>⚠️</span>
                    <span style={{ color:"#e8aa40", fontWeight:700, fontSize:13 }}>Formas compostas detectadas — confira as alas!</span>
                  </div>
                  <div style={{ fontSize:12, color:"#a08040", marginBottom:8, lineHeight:1.6 }}>
                    O agente identificou peças em formato <strong style={{ color:"#c8892a" }}>L, U ou C</strong> e as dividiu em partes retangulares. Verifique se todas as alas foram capturadas corretamente:
                  </div>
                  {formasCompostas.map((fc, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:"#c8892a", flexShrink:0 }} />
                      <span style={{ fontSize:12, color:"#d0a050" }}>{fc}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:10, fontSize:11, color:"#6a5020", borderTop:"1px solid #3a2a10", paddingTop:8 }}>
                    💡 Se alguma ala estiver faltando, clique em <strong>+ Manual</strong> para adicionar a peça manualmente.
                  </div>
                </div>
              )}

              <div style={{ background:"#110e09", border:"1px solid #1e1409", borderRadius:12, overflow:"hidden" }}>
                <div style={{ padding:"11px 16px", borderBottom:"1px solid #1a1006", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontFamily:"'Playfair Display'", fontSize:16 }}>Peças <span style={{ fontSize:12, color:"#4a3828", fontFamily:"'Barlow'" }}>({pieces.length})</span></span>
                  <button onClick={addPiece} style={{ background:"rgba(200,137,42,.12)", border:"1px solid rgba(200,137,42,.25)", borderRadius:6, color:"#c8892a", padding:"5px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}>+ Manual</button>
                </div>
                {pieces.length===0 ? (
                  <div style={{ padding:"32px", textAlign:"center", color:"#3a2818", fontSize:13 }}>Envie o projeto e analise com IA, ou adicione peças manualmente</div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr style={{ background:"#150f07" }}>
                          {["Peça","Tipo","Larg","Alt","Qtd","R$/un","Subtotal",""].map(h=>(
                            <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:9, color:"#5a4030", fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", borderBottom:"1px solid #1a1006" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pieces.map(p=>(
                          <tr key={p._id} className="hr" style={{ borderBottom:"1px solid #16100a" }}>
                            <td style={{ padding:"6px 10px" }}><div>
                              <input value={p.nome} onChange={e=>updPiece(p._id,"nome",e.target.value)} style={{ background:"transparent", border:"none", color:"#e0d0b0", fontFamily:"'Barlow'", fontSize:12, width:"100%", outline:"none" }} />
                              {p.aviso && <div style={{ fontSize:10, color:"#c8892a", marginTop:1 }}>⚠️ {p.aviso}</div>}
                              {p._pagina && <div style={{ fontSize:9, color:"#4a3828", marginTop:1 }}>pág. {p._pagina}</div>}
                            </div></td>
                            <td style={{ padding:"6px 4px" }}>
                              <select value={p.tipo||"m²"} onChange={e=>updPiece(p._id,"tipo",e.target.value)} style={{ ...IS, fontSize:11, padding:"4px 5px", width:72 }}>
                                {["m²","ml","unidade","%"].map(t=><option key={t}>{t}</option>)}
                              </select>
                            </td>
                            <td style={{ padding:"6px 4px" }}><input type="number" value={p.largura||""} onChange={e=>updPiece(p._id,"largura",e.target.value)} step="0.01" style={{ ...NS, width:56, padding:"4px 5px", fontSize:12 }} /></td>
                            <td style={{ padding:"6px 4px" }}><input type="number" value={p.altura||""} onChange={e=>updPiece(p._id,"altura",e.target.value)} step="0.01" style={{ ...NS, width:56, padding:"4px 5px", fontSize:12 }} /></td>
                            <td style={{ padding:"6px 4px" }}><input type="number" value={p.quantidade} onChange={e=>updPiece(p._id,"quantidade",e.target.value)} min={1} style={{ ...NS, width:42, padding:"4px 5px", fontSize:12, color:"#f0e0c8" }} /></td>
                            <td style={{ padding:"6px 4px" }}><input type="number" value={p.precoUnitario||""} onChange={e=>updPiece(p._id,"precoUnitario",e.target.value)} style={{ ...NS, width:70, padding:"4px 5px", fontSize:12 }} /></td>
                            <td style={{ padding:"6px 10px", fontFamily:"'Barlow Condensed'", fontSize:13, fontWeight:700, color:"#c8892a", whiteSpace:"nowrap" }}>{fmtBRL(calcLine(p))}</td>
                            <td style={{ padding:"6px 6px" }}><button onClick={()=>delPiece(p._id)} style={{ background:"none", border:"none", color:"#5a2a2a", cursor:"pointer", fontSize:14 }}>✕</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div style={{ background:"#110e09", border:"1px solid #1e1409", borderRadius:14, padding:"18px", position:"sticky", top:18 }}>
                <div style={{ fontFamily:"'Playfair Display'", fontSize:19, marginBottom:16 }}>Resumo</div>
                {quote.lines.length===0 ? (
                  <div style={{ color:"#3a2818", fontSize:13, textAlign:"center", padding:"20px 0" }}>Adicione peças para calcular</div>
                ) : (
                  <>
                    <div style={{ maxHeight:280, overflowY:"auto", marginBottom:12 }}>
                      {quote.lines.map(l=>(
                        <div key={l._id} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #16100a" }}>
                          <div>
                            <div style={{ fontSize:12, color:"#d0c0a0" }}>{l.quantidade}× {l.nome}</div>
                            <div style={{ fontSize:10, color:"#4a3828", marginTop:1 }}>{l.tipo==="m²"?`${(parseFloat(l.largura)||0).toFixed(2)}×${(parseFloat(l.altura)||0).toFixed(2)}m²`:l.tipo} · {fmtBRL(l.precoUnitario||0)}</div>
                          </div>
                          <div style={{ fontFamily:"'Barlow Condensed'", fontSize:13, fontWeight:600, color:"#c8892a", paddingLeft:8, whiteSpace:"nowrap" }}>{fmtBRL(l.lineTotal)}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop:"1px solid #2a1c0a", paddingTop:12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ fontSize:12, color:"#6a5030" }}>Subtotal</span>
                        <span style={{ fontFamily:"'Barlow Condensed'", fontSize:13, color:"#c0b090" }}>{fmtBRL(quote.subtotal)}</span>
                      </div>
                      {margin>0 && <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                        <span style={{ fontSize:12, color:"#6a5030" }}>Margem ({margin}%)</span>
                        <span style={{ fontFamily:"'Barlow Condensed'", fontSize:13, color:"#c0b090" }}>{fmtBRL(quote.marginVal)}</span>
                      </div>}
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(200,137,42,.08)", border:"1px solid rgba(200,137,42,.2)", borderRadius:10, padding:"12px 14px" }}>
                        <span style={{ fontFamily:"'Playfair Display'", fontSize:16 }}>Total</span>
                        <span style={{ fontFamily:"'Playfair Display'", fontSize:22, color:"#e8aa40" }}>{fmtBRL(quote.total)}</span>
                      </div>
                    </div>
                    <button className="hb" onClick={saveQuote} style={{ width:"100%", marginTop:12, padding:"11px", background:"linear-gradient(135deg,#1e4a10,#2e6a18)", border:"none", borderRadius:9, color:"#90d060", fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:13, letterSpacing:".08em", cursor:"pointer", textTransform:"uppercase", transition:"all .2s" }}>💾 Salvar Orçamento</button>
                    <button className="hb" onClick={generatePDF} style={{ width:"100%", marginTop:6, padding:"11px", background:"linear-gradient(135deg,#1a2a4a,#2a4a8a)", border:"none", borderRadius:9, color:"#80b0f0", fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:13, letterSpacing:".08em", cursor:"pointer", textTransform:"uppercase", transition:"all .2s" }}>📄 Gerar PDF</button>
                    <button className="hb" onClick={()=>{setPieces([]);setUploadedFile(null);setClientName("");setAmbientDesc("");setAnalysisError(null);setFormasCompostas([]);}} style={{ width:"100%", marginTop:6, padding:"9px", background:"transparent", border:"1px solid #2a1c0a", borderRadius:9, color:"#5a4030", fontSize:12, cursor:"pointer" }}>🔄 Novo Projeto</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {tab==="training" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
              <div>
                <div style={{ fontFamily:"'Playfair Display'", fontSize:26, marginBottom:4 }}>🧠 Treinamento do Agente</div>
                <div style={{ fontSize:13, color:"#6a5030", maxWidth:520 }}>As <strong style={{ color:"#c8892a" }}>Regras de Preço</strong> e <strong style={{ color:"#c8892a" }}>Exemplos Reais</strong> são injetados automaticamente no prompt de cada análise.</div>
              </div>
              <div style={{ background:"rgba(200,137,42,.06)", border:"1px solid rgba(200,137,42,.15)", borderRadius:10, padding:"12px 16px", fontSize:12, color:"#7a6040", textAlign:"right" }}>
                <div style={{ fontFamily:"'Barlow Condensed'", fontSize:22, color:"#c8892a", fontWeight:700 }}>{rules.length}</div><div>regras ativas</div>
                <div style={{ fontFamily:"'Barlow Condensed'", fontSize:22, color:"#c8892a", fontWeight:700, marginTop:6 }}>{examples.length}</div><div>exemplos</div>
              </div>
            </div>

            <div style={{ marginBottom:28 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontFamily:"'Playfair Display'", fontSize:20 }}>📋 Tabela de Preços por Tipo</div>
                <button className="hb" onClick={()=>setShowAddRule(v=>!v)} style={{ background:"linear-gradient(135deg,#c8892a,#e8aa40)", border:"none", borderRadius:8, color:"#0d0a07", padding:"8px 18px", fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:12, letterSpacing:".08em", cursor:"pointer", textTransform:"uppercase" }}>+ Nova Regra</button>
              </div>

              {showAddRule && (
                <div style={{ background:"#18120a", border:"1px solid #c8892a", borderRadius:12, padding:"16px 18px", marginBottom:16 }}>
                  <div style={{ fontFamily:"'Playfair Display'", fontSize:15, color:"#c8892a", marginBottom:12 }}>Cadastrar Regra de Preço</div>
                  <div style={{ display:"grid", gridTemplateColumns:"160px 1fr 70px 100px auto", gap:8, alignItems:"end", marginBottom:8 }}>
                    <div><label style={{ display:"block", fontSize:9, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>Categoria</label><input value={newRule.category} onChange={e=>setNewRule(p=>({...p,category:e.target.value}))} style={IS} /></div>
                    <div><label style={{ display:"block", fontSize:9, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>Descrição</label><input value={newRule.label} onChange={e=>setNewRule(p=>({...p,label:e.target.value}))} placeholder="Ex: Porta de correr espelho" style={IS} /></div>
                    <div><label style={{ display:"block", fontSize:9, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>Unid.</label>
                      <select value={newRule.unit} onChange={e=>setNewRule(p=>({...p,unit:e.target.value}))} style={IS}>{["m²","ml","un","%","diária"].map(u=><option key={u}>{u}</option>)}</select>
                    </div>
                    <div><label style={{ display:"block", fontSize:9, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>Preço</label><input type="number" value={newRule.price} onChange={e=>setNewRule(p=>({...p,price:e.target.value}))} style={{ ...NS, textAlign:"left" }} /></div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>{ if(!newRule.label||!newRule.price)return; saveRules([...rules,{...newRule,id:Date.now(),price:parseFloat(newRule.price)}]); setNewRule({category:"Armário/Guarda-roupa",label:"",unit:"m²",price:"",note:""}); setShowAddRule(false); }} style={{ background:"linear-gradient(135deg,#c8892a,#e8aa40)", border:"none", borderRadius:7, color:"#0d0a07", padding:"8px 14px", fontFamily:"'Barlow Condensed'", fontWeight:700, cursor:"pointer" }}>✓</button>
                      <button onClick={()=>setShowAddRule(false)} style={{ background:"#1e1610", border:"1px solid #2e1f0e", borderRadius:7, color:"#5a4838", padding:"8px 10px", cursor:"pointer" }}>✕</button>
                    </div>
                  </div>
                  <input value={newRule.note} onChange={e=>setNewRule(p=>({...p,note:e.target.value}))} placeholder="Observação / instrução para o agente..." style={IS} />
                </div>
              )}

              {catGroups.map(cat=>{
                const catRules = rules.filter(r=>r.category===cat);
                if(!catRules.length) return null;
                const color = CAT_COLORS[cat]||"#8a7a6a";
                return (
                  <div key={cat} style={{ marginBottom:16 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:color }} />
                      <span style={{ fontFamily:"'Barlow Condensed'", fontSize:11, fontWeight:700, letterSpacing:".12em", textTransform:"uppercase", color }}>{cat}</span>
                    </div>
                    <div style={{ background:"#110e09", border:"1px solid #1a1006", borderRadius:10, overflow:"hidden" }}>
                      {catRules.map((r,i)=>(
                        <div key={r.id} className="hr" style={{ display:"flex", alignItems:"center", padding:"10px 16px", borderBottom:i<catRules.length-1?"1px solid #16100a":"none", gap:10 }}>
                          {editingRule===r.id ? (
                            <>
                              <input defaultValue={r.label} id={`rl-${r.id}`} style={{ ...IS, flex:1 }} />
                              <input type="number" defaultValue={r.price} id={`rp-${r.id}`} style={{ ...NS, width:90 }} />
                              <button onClick={()=>{ const l=document.getElementById(`rl-${r.id}`).value; const p=parseFloat(document.getElementById(`rp-${r.id}`).value); saveRules(rules.map(x=>x.id===r.id?{...x,label:l,price:p}:x)); setEditingRule(null); }} style={{ background:"rgba(200,137,42,.15)", border:"1px solid rgba(200,137,42,.3)", borderRadius:6, color:"#c8892a", padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:600 }}>✓</button>
                              <button onClick={()=>setEditingRule(null)} style={{ background:"none", border:"none", color:"#5a4838", cursor:"pointer" }}>✕</button>
                            </>
                          ) : (
                            <>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:13, color:"#d0c0a0" }}>{r.label}</div>
                                {r.note && <div style={{ fontSize:11, color:"#5a4030", marginTop:2 }}>{r.note}</div>}
                              </div>
                              <span style={{ fontSize:10, color:"#4a3828", marginRight:4 }}>/{r.unit}</span>
                              <span style={{ fontFamily:"'Barlow Condensed'", fontSize:16, fontWeight:700, color, minWidth:80, textAlign:"right" }}>{fmtBRL(r.price)}</span>
                              <button onClick={()=>setEditingRule(r.id)} style={{ background:"none", border:"none", color:"#4a3828", cursor:"pointer", marginLeft:8, fontSize:14 }}>✏️</button>
                              <button onClick={()=>saveRules(rules.filter(x=>x.id!==r.id))} style={{ background:"none", border:"none", color:"#4a2020", cursor:"pointer", fontSize:14 }}>🗑️</button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div>
                  <div style={{ fontFamily:"'Playfair Display'", fontSize:20, marginBottom:2 }}>📸 Exemplos Reais (Few-shot)</div>
                  <div style={{ fontSize:12, color:"#5a4030" }}>Orçamentos seus que ensinam o agente o seu padrão de cálculo</div>
                </div>
                <button className="hb" onClick={()=>setShowAddExample(v=>!v)} style={{ background:"linear-gradient(135deg,#c8892a,#e8aa40)", border:"none", borderRadius:8, color:"#0d0a07", padding:"8px 18px", fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:12, letterSpacing:".08em", cursor:"pointer", textTransform:"uppercase" }}>+ Novo Exemplo</button>
              </div>

              {showAddExample && (
                <div style={{ background:"#18120a", border:"1px solid #c8892a", borderRadius:12, padding:"16px 18px", marginBottom:16 }}>
                  <div style={{ fontFamily:"'Playfair Display'", fontSize:15, color:"#c8892a", marginBottom:12 }}>Adicionar Exemplo Real</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                    <div><label style={{ display:"block", fontSize:9, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>Título do exemplo</label><input value={newExample.label} onChange={e=>setNewExample(p=>({...p,label:e.target.value}))} placeholder="Ex: Guarda-roupa casal 2,40m" style={IS} /></div>
                    <div><label style={{ display:"block", fontSize:9, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>Ambiente</label><input value={newExample.ambiente} onChange={e=>setNewExample(p=>({...p,ambiente:e.target.value}))} placeholder="Ex: Quarto" style={IS} /></div>
                    <div><label style={{ display:"block", fontSize:9, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>Dimensões</label><input value={newExample.dimensoes} onChange={e=>setNewExample(p=>({...p,dimensoes:e.target.value}))} placeholder="L:2,21m A:2,63m P:0,56m" style={IS} /></div>
                    <div><label style={{ display:"block", fontSize:9, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>Total (R$)</label><input type="number" value={newExample.total} onChange={e=>setNewExample(p=>({...p,total:e.target.value}))} placeholder="9965" style={{ ...NS, textAlign:"left" }} /></div>
                  </div>
                  <div style={{ marginBottom:10 }}><label style={{ display:"block", fontSize:9, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>Descrição do móvel</label><input value={newExample.descricao} onChange={e=>setNewExample(p=>({...p,descricao:e.target.value}))} placeholder="Ex: 3 portas de correr sendo 1 espelho, MDF Gris, RO45 Rometal" style={IS} /></div>
                  <div style={{ marginBottom:12 }}><label style={{ display:"block", fontSize:9, color:"#7a6040", textTransform:"uppercase", letterSpacing:".1em", marginBottom:4 }}>Cálculo detalhado</label><input value={newExample.calculo} onChange={e=>setNewExample(p=>({...p,calculo:e.target.value}))} placeholder="Ex: Corpo: 2,21×2,63×R$1.250=R$7.265 | Portas: 3×R$900=R$2.700" style={IS} /></div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>{ if(!newExample.label)return; saveExamples([...examples,{...newExample,id:Date.now(),total:parseFloat(newExample.total)||0}]); setNewExample({label:"",ambiente:"",dimensoes:"",descricao:"",calculo:"",total:""}); setShowAddExample(false); }} style={{ background:"linear-gradient(135deg,#c8892a,#e8aa40)", border:"none", borderRadius:7, color:"#0d0a07", padding:"9px 20px", fontFamily:"'Barlow Condensed'", fontWeight:700, cursor:"pointer" }}>Salvar Exemplo</button>
                    <button onClick={()=>setShowAddExample(false)} style={{ background:"#1e1610", border:"1px solid #2e1f0e", borderRadius:7, color:"#5a4838", padding:"9px 14px", cursor:"pointer" }}>✕</button>
                  </div>
                </div>
              )}

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:12 }}>
                {examples.map(ex=>(
                  <div key={ex.id} style={{ background:"#110e09", border:"1px solid #1e1409", borderRadius:12, padding:"16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div style={{ fontFamily:"'Playfair Display'", fontSize:15, color:"#d0c0a0", flex:1, marginRight:8 }}>{ex.label}</div>
                      <button onClick={()=>saveExamples(examples.filter(e=>e.id!==ex.id))} style={{ background:"none", border:"none", color:"#4a2020", cursor:"pointer", fontSize:14 }}>🗑️</button>
                    </div>
                    <div style={{ fontSize:12, color:"#5a4030", marginBottom:6 }}>📍 {ex.ambiente} · {ex.dimensoes}</div>
                    {ex.descricao && <div style={{ fontSize:12, color:"#7a6040", marginBottom:8, lineHeight:1.5 }}>{ex.descricao}</div>}
                    {ex.calculo && <div style={{ background:"#0f0c07", border:"1px solid #2a1c0a", borderRadius:8, padding:"8px 12px", fontSize:11, color:"#8a7050", fontFamily:"monospace", lineHeight:1.6 }}>{ex.calculo}</div>}
                    <div style={{ display:"flex", justifyContent:"flex-end", marginTop:10 }}>
                      <span style={{ fontFamily:"'Playfair Display'", fontSize:18, color:"#e8aa40" }}>{fmtBRL(ex.total)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop:16, padding:"12px 16px", background:"#0f0c07", border:"1px solid #2a1c0a", borderRadius:10, fontSize:12, color:"#5a4030", lineHeight:1.7 }}>
                💡 <strong style={{ color:"#7a6040" }}>Como treinar:</strong> Adicione 1 exemplo por tipo de móvel (guarda-roupa, cozinha, closet, painel TV...). Quanto mais exemplos com o cálculo detalhado, mais o agente aprende o seu padrão.
              </div>
            </div>
          </div>
        )}

        {tab==="history" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontFamily:"'Playfair Display'", fontSize:26 }}>Histórico <span style={{ fontSize:14, color:"#5a4838", fontFamily:"'Barlow'", fontWeight:400 }}>({history.length})</span></div>
              {history.length>0 && <button onClick={()=>{ if(confirm("Apagar todo o histórico?")) saveHistory([]); }} style={{ background:"rgba(180,50,50,.1)", border:"1px solid rgba(180,50,50,.2)", borderRadius:7, color:"#a05050", padding:"7px 14px", fontSize:12, cursor:"pointer" }}>🗑️ Limpar</button>}
            </div>
            {history.length===0 ? (
              <div style={{ textAlign:"center", padding:60, color:"#3a2818", fontFamily:"'Playfair Display'", fontSize:15 }}>Nenhum orçamento salvo ainda.</div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
                {history.map(q=>(
                  <div key={q.id} className="hcard" onClick={()=>setExpandedHistory(expandedHistory===q.id?null:q.id)} style={{ background:"#110e09", border:`1px solid ${expandedHistory===q.id?"#c8892a":"#1e1409"}`, borderRadius:12, padding:16, cursor:"pointer", transition:"border-color .2s" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <div style={{ fontFamily:"'Playfair Display'", fontSize:16 }}>{q.client}</div>
                      <div style={{ fontSize:11, color:"#5a4838" }}>{q.date}</div>
                    </div>
                    {q.notes && <div style={{ fontSize:11, color:"#6a5030", marginBottom:10 }}>{q.notes}</div>}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:11, color:"#4a3828" }}>{q.pieces?.length||0} peças</span>
                      <span style={{ fontFamily:"'Playfair Display'", fontSize:18, color:"#e8aa40" }}>{fmtBRL(q.total)}</span>
                    </div>
                    {expandedHistory===q.id && q.pieces?.length>0 && (
                      <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #1a1006" }}>
                        {q.pieces.map((p,i)=>(
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <span style={{ fontSize:11, color:"#9a8a70" }}>{p.quantidade}× {p.nome}</span>
                            <span style={{ fontSize:11, color:"#c8892a", fontFamily:"'Barlow Condensed'", fontWeight:600 }}>{fmtBRL(calcLine(p))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
