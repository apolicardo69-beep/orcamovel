import { useState, useRef, useMemo } from "react";
import PlanoCorteView from "./components/PlanoCorteView";

// Limiar para alertar o usuário sobre PDFs com muitas páginas
const LARGE_PDF_PAGE_THRESHOLD = 5;

const lsGet = (key, fb) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
};
const lsSet = (key, v) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
};
const fmtBRL = (v) =>
  "R$ " +
  Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
  "Armário/Guarda-roupa": "#c8892a",
  Cozinha: "#e87a40",
  Banheiro: "#5b9bd5",
  Painel: "#9a7ab8",
  Prateleira: "#7ab87a",
  "TV/Sala": "#c87aa0",
  "Cristaleira/Vidro": "#60c8c8",
};

const buildSystemPrompt = (rules, examples) => {
  const ruleLines = rules.map((r) => `- ${r.label}: R$${r.price}/${r.unit}. ${r.note}`).join("\n");
  const exLines = examples
    .map(
      (ex) =>
        `EXEMPLO REAL: ${ex.label}\n  Ambiente: ${ex.ambiente} | Dimensões: ${ex.dimensoes}\n  Descrição: ${ex.descricao}\n  Cálculo: ${ex.calculo}\n  Total: R$${ex.total}`
    )
    .join("\n\n");

  return `Você é um agente especialista em orçamento de móveis planejados para marcenaria brasileira de alto padrão.

## REGRAS DE PRECIFICAÇÃO:
${ruleLines}

## PADRÕES E DIRETRIZES:
- **IDENTIFICAÇÃO DO PROJETO:** Se houver carimbo/selo técnico na prancha, extraia o nome do cliente, endereço da obra e arquiteto/empresa.
- **SEPARAÇÃO POR AMBIENTE:** Cada móvel/peça DEVE ter o campo "ambiente" preenchido com o nome exato do cômodo/ambiente onde ele será instalado (ex: "Sala de Estar", "Cozinha", "Suíte Master", "Dormitório 01", "Lavanderia", etc.).
- **REGRA DE PORTAS:** O preço de R$1.250/m² do armário JÁ INCLUI as portas de correr em MDF. Cobrar R$900 SOMENTE por cada porta adicional que for ESPELHO. Porta MDF normal não é cobrada separada.
- Armários em geral: Altura × Largura = m², depois × preço/m²
- Painéis em L, U, C: desmembrar em retângulos separados para o cálculo exato.
- Se a página/imagem não contiver cotas de marcenaria (capa, texto descritivo, render sem medidas), retorne "pecas": [].

## EXEMPLOS REAIS:
${exLines}

## FORMATO DE RETORNO OBRIGATÓRIO (JSON PURO):
{
  "cliente": "Nome do cliente (se visível no carimbo)",
  "endereco": "Endereço da obra (se visível)",
  "arquiteto": "Nome do arquiteto/empresa (se visível)",
  "ambiente": "Ambiente principal desta página",
  "descricao": "Resumo dos móveis identificados",
  "formasCompostas": ["Peças em L/U/C detectadas"],
  "pecas": [
    {
      "ambiente": "Nome do Ambiente (ex: Sala de Estar)",
      "nome": "Descrição da peça",
      "tipo": "m²",
      "largura": 2.20,
      "altura": 2.60,
      "quantidade": 1,
      "precoUnitario": 1250,
      "subtotal": 7150,
      "observacao": "",
      "aviso": ""
    }
  ],
  "totalBruto": 7150
}`;
};

export default function App() {
  const [tab, setTab] = useState("quote");
  const [rules, setRules] = useState(() => lsGet("om_rules_v1", DEFAULT_RULES));
  const [examples, setExamples] = useState(() => lsGet("om_examples_v1", DEFAULT_EXAMPLES));
  const [margin, setMargin] = useState(() => lsGet("om_margin_v1", 0));
  const [uploadedFile, setUploadedFile] = useState(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [formasCompostas, setFormasCompostas] = useState([]);
  const [pieces, setPieces] = useState([]);
  
  // Informações do Cliente & Proposta Comercial
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [architectName, setArchitectName] = useState("");
  const [ambientDesc, setAmbientDesc] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("50% de entrada no fechamento + 50% na conclusão da montagem");
  const [deliveryDeadline, setDeliveryDeadline] = useState("35 a 45 dias úteis após conferência técnica");
  const [showClientModal, setShowClientModal] = useState(false);
  const [filterAmbiente, setFilterAmbiente] = useState("todos");

  const [history, setHistory] = useState(() => lsGet("om_history_v2", []));
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [savedBanner, setSavedBanner] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("om_apikey") || "");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("om_model") || "anthropic/claude-3.5-sonnet");
  const [editingRule, setEditingRule] = useState(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ category: "Armário/Guarda-roupa", label: "", unit: "m²", price: "", note: "" });
  const [showAddExample, setShowAddExample] = useState(false);
  const [newExample, setNewExample] = useState({ label: "", ambiente: "", dimensoes: "", descricao: "", calculo: "", total: "" });
  const [analyzingProgress, setAnalyzingProgress] = useState(null);
  const [showConfirmAllModal, setShowConfirmAllModal] = useState(false);
  
  const abortControllerRef = useRef(null);
  const fileInputId = "projeto-upload-input";

  const saveRules = (r) => { setRules(r); lsSet("om_rules_v1", r); };
  const saveExamples = (e) => { setExamples(e); lsSet("om_examples_v1", e); };
  const saveHistory = (h) => { setHistory(h); lsSet("om_history_v2", h); };

  // Lista de Ambientes únicos nas peças
  const ambientesDisponiveis = useMemo(() => {
    const setAmb = new Set();
    pieces.forEach((p) => {
      if (p.ambiente && p.ambiente.trim()) setAmb.add(p.ambiente.trim());
    });
    return Array.from(setAmb);
  }, [pieces]);

  // Peças agrupadas por Ambiente
  const pecasPorAmbiente = useMemo(() => {
    const grupos = {};
    pieces.forEach((p) => {
      const amb = (p.ambiente && p.ambiente.trim()) ? p.ambiente.trim() : "Ambiente Geral";
      if (!grupos[amb]) grupos[amb] = [];
      grupos[amb].push(p);
    });
    return grupos;
  }, [pieces]);

  // Otimização de Imagem em Canvas
  const resizeImageToDataUrl = (img, maxDimension = 1600, quality = 0.82) => {
    let { width, height } = img;
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  };

  // Conversão de PDF Otimizada
  const pdfToImages = async (arrayBuffer) => {
    if (!window.pdfjsLib) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const maxDim = Math.max(unscaledViewport.width, unscaledViewport.height);
      const scale = Math.min(2.0, 1600 / maxDim);
      const vp = page.getViewport({ scale });
      
      const canvas = document.createElement("canvas");
      canvas.width = vp.width;
      canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      pages.push(canvas.toDataURL("image/jpeg", 0.82));
    }
    return pages;
  };

  const handleFile = (file) => {
    if (!file) return;
    setAnalysisError(null);
    setPieces([]);
    setSelectedPageIndex(0);

    if (file.type === "application/pdf") {
      setUploadedFile({ name: file.name, isImg: false, isPdf: true, preview: null, pages: [], converting: true });
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const pages = await pdfToImages(e.target.result);
          setUploadedFile({ name: file.name, isImg: false, isPdf: true, preview: pages[0], pages, converting: false });
        } catch (err) {
          setAnalysisError("Erro ao processar PDF: " + err.message);
          setUploadedFile(null);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const optimizedDataUrl = resizeImageToDataUrl(img, 1800, 0.85);
          setUploadedFile({
            name: file.name,
            isImg: true,
            isPdf: false,
            preview: optimizedDataUrl,
            dataUrl: optimizedDataUrl,
            pages: [optimizedDataUrl],
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Parser JSON Ultra-Resiliente
  const extractJSON = (raw) => {
    if (!raw) throw new Error("Resposta vazia da IA.");
    if (typeof raw === "object" && raw !== null) return raw;
    let s = String(raw).trim();

    const codeBlockMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      s = codeBlockMatch[1].trim();
    }

    const firstBrace = s.indexOf("{");
    const lastBrace = s.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      s = s.slice(firstBrace, lastBrace + 1);
    }

    try {
      return JSON.parse(s);
    } catch (e1) {
      let cleaned = s
        .replace(/,\s*([\}\]])/g, "$1")
        .replace(/\/\/[^\n\r]*/g, "")
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => (c === "\n" || c === "\r" || c === "\t" ? c : ""));

      try {
        return JSON.parse(cleaned);
      } catch (e2) {
        const pecasMatch = s.match(/"pecas"\s*:\s*(\[[^\]]*\])/);
        if (pecasMatch) {
          try {
            const pecas = JSON.parse(pecasMatch[1].replace(/,\s*([\]])/g, "$1"));
            return { pecas, ambiente: "Ambiente do Projeto", descricao: "" };
          } catch {}
        }
        throw new Error("Não foi possível extrair dados estruturados desta imagem.");
      }
    }
  };

  // Chamada de IA com Fallback Automático Multi-Modelo
  const requestPageAnalysis = async (systemPrompt, imageDataUrl, instruction, pageLabel, signal) => {
    let maxTokens = 4096;
    const requestedModel = selectedModel || "anthropic/claude-3.5-sonnet";
    const modelsToTry = [
      requestedModel,
      "anthropic/claude-3.5-sonnet",
      "google/gemini-2.0-flash-001",
      "openai/gpt-4o",
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let lastErr = null;

    for (const currentModel of modelsToTry) {
      if (signal?.aborted) throw new Error("Análise cancelada pelo usuário.");

      const usePersonalKey = !!apiKey;
      const endpoint = usePersonalKey
        ? "https://openrouter.ai/api/v1/chat/completions"
        : "/api/analyze";

      const headers = usePersonalKey
        ? {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": window.location.origin,
            "X-Title": "OrcaMóvel",
          }
        : { "Content-Type": "application/json" };

      const body = usePersonalKey
        ? JSON.stringify({
            model: currentModel,
            max_tokens: maxTokens,
            temperature: 0.1,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: imageDataUrl } },
                  { type: "text", text: instruction },
                ],
              },
            ],
          })
        : JSON.stringify({
            systemPrompt,
            imageDataUrl,
            instruction,
            maxTokens,
            model: currentModel,
          });

      try {
        const resp = await fetch(endpoint, { method: "POST", headers, body, signal });

        if (resp.status === 401 || resp.status === 403) {
          setShowKeyInput(true);
          throw new Error("Chave da OpenRouter inválida ou sem saldo. Verifique no menu de configurações.");
        }

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          const errMsg = data?.error?.message || `Erro HTTP ${resp.status}`;
          if (data?.error?.code === "NO_SERVER_KEY" || (!apiKey && resp.status === 400)) {
            setShowKeyInput(true);
            throw new Error("Cole sua chave OpenRouter no menu ⚙️ Configurar IA acima.");
          }
          lastErr = new Error(errMsg);
          continue;
        }

        const choice = data.choices?.[0];
        const raw = choice?.message?.content || "";
        if (!raw) {
          lastErr = new Error(`Resposta vazia do modelo ${currentModel}`);
          continue;
        }

        return extractJSON(raw);
      } catch (err) {
        if (err.name === "AbortError" || signal?.aborted) {
          throw new Error("Análise cancelada pelo usuário.");
        }
        if (err.message.includes("Chave") || err.message.includes("OpenRouter")) {
          throw err;
        }
        lastErr = err;
      }
    }
    throw lastErr || new Error(`Falha ao analisar ${pageLabel}. Tente com outro modelo ou verifique sua conexão.`);
  };

  const stopAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsAnalyzing(false);
      setAnalyzingProgress(null);
    }
  };

  const executeAnalysis = async (onlyCurrentPage) => {
    setShowConfirmAllModal(false);
    if (!uploadedFile) return;
    if (uploadedFile.converting) {
      setAnalysisError("Aguarde a conversão do PDF terminar...");
      return;
    }

    const systemPrompt = buildSystemPrompt(rules, examples);
    const allImages = uploadedFile.isPdf ? (uploadedFile.pages || []) : [uploadedFile.dataUrl || uploadedFile.preview];
    
    const imagesToAnalyze = onlyCurrentPage
      ? [{ img: allImages[selectedPageIndex], pageNum: selectedPageIndex + 1 }]
      : allImages.map((img, idx) => ({ img, pageNum: idx + 1 }));

    const total = imagesToAnalyze.length;
    if (total === 0) {
      setAnalysisError("Nenhuma página disponível para analisar.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalyzingProgress({ current: 1, total, pageNum: imagesToAnalyze[0].pageNum });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const newPieces = [...(onlyCurrentPage ? pieces.filter(p => p._pagina !== selectedPageIndex + 1) : [])];
    const allFormas = [...formasCompostas];
    const ambientParts = ambientDesc ? [ambientDesc] : [];
    const failedPages = [];
    let nextId = pieces.length > 0 ? Math.max(...pieces.map((p) => p._id || 0)) + 1 : 1;

    for (let i = 0; i < total; i++) {
      if (abortController.signal.aborted) break;

      const { img, pageNum } = imagesToAnalyze[i];
      setAnalyzingProgress({ current: i + 1, total, pageNum });

      const pageLabel = total > 1 ? `página ${pageNum}/${allImages.length}` : "o projeto";
      const instruction =
        total > 1
          ? `Esta é a página ${pageNum} de ${allImages.length} de um projeto de móveis planejados. Extraia móveis, cotas e medidas desta página. Identifique o ambiente específico de cada móvel no campo 'ambiente' (ex: 'Sala de Estar', 'Cozinha', 'Suíte', etc.). Se houver carimbo/selo com nome do cliente, endereço e arquiteto, extraia também. Retorne SOMENTE o JSON.`
          : `Analise este projeto técnico de móveis planejados. Extraia peças, cotas e separe por ambiente no campo 'ambiente'. Se houver carimbo, extraia nome do cliente, endereço e arquiteto. Retorne SOMENTE o JSON.`;

      try {
        const parsed = await requestPageAnalysis(systemPrompt, img, instruction, pageLabel, abortController.signal);
        
        // Auto-preenchimento das informações do cliente e projeto
        if (parsed.cliente && !clientName) setClientName(parsed.cliente);
        if (parsed.endereco && !clientAddress) setClientAddress(parsed.endereco);
        if (parsed.arquiteto && !architectName) setArchitectName(parsed.arquiteto);

        const pageAmbiente = parsed.ambiente || `Ambiente ${pageNum}`;

        if (parsed.pecas && Array.isArray(parsed.pecas)) {
          const formatted = parsed.pecas.map((p) => {
            const larg = parseFloat(p.largura) || 0;
            const alt = parseFloat(p.altura) || 0;
            const qtd = parseFloat(p.quantidade) || 1;
            const preco = parseFloat(p.precoUnitario) || (p.tipo === "ml" ? 1250 : 1250);
            const sub = p.tipo === "m²" ? larg * alt * qtd * preco : qtd * preco;
            return {
              ...p,
              _id: nextId++,
              _pagina: pageNum,
              ambiente: p.ambiente || pageAmbiente,
              largura: larg,
              altura: alt,
              quantidade: qtd,
              precoUnitario: preco,
              subtotal: sub || p.subtotal || 0,
            };
          });
          newPieces.push(...formatted);
        }
        if (parsed.formasCompostas?.length) allFormas.push(...parsed.formasCompostas);
        const desc = parsed.descricao ? `${parsed.ambiente || ""} — ${parsed.descricao}` : parsed.ambiente;
        if (desc) ambientParts.push(desc);
      } catch (pageErr) {
        if (abortController.signal.aborted) break;
        failedPages.push({ page: pageNum, error: pageErr.message });
      }
    }

    setAnalyzingProgress(null);
    setPieces(newPieces);
    setFormasCompostas([...new Set(allFormas)]);
    if (ambientParts.length && !ambientDesc) setAmbientDesc([...new Set(ambientParts)].join(" · "));

    if (failedPages.length > 0) {
      setAnalysisError(
        `${newPieces.length} peça(s) extraída(s). Houve falha na leitura de ${failedPages.length} página(s) (${failedPages[0].error}).`
      );
    } else if (newPieces.length === 0) {
      setAnalysisError("Nenhuma peça com cotas foi identificada nesta página. Mude para a página com o desenho do móvel cotado e tente novamente.");
    }

    setIsAnalyzing(false);
    abortControllerRef.current = null;
  };

  const handleStartAnalysis = (onlyCurrentPage) => {
    const total = uploadedFile?.isPdf ? (uploadedFile.pages?.length || 1) : 1;
    if (!onlyCurrentPage && total > LARGE_PDF_PAGE_THRESHOLD) {
      setShowConfirmAllModal(true);
      return;
    }
    executeAnalysis(onlyCurrentPage);
  };

  // Gerador de Proposta Comercial Profissional em PDF com Separação por Ambiente
  const generatePDF = async () => {
    if (!window.jspdf) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const q = calcQuote();
    const PW = 210;
    const PH = 297;
    const mg = 14;
    const col = PW - mg * 2;
    let y = 16;
    const gold = [200, 137, 42];
    const dark = [26, 20, 14];
    const gr = [110, 100, 90];
    const bgLight = [248, 244, 238];

    // 1. Cabeçalho de Luxo
    doc.setFillColor(...gold);
    doc.rect(0, 0, PW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("OrcaMóvel", mg, 11);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("MARCENARIA DE ALTO PADRÃO · PROPOSTA TÉCNICA COMERCIAL", mg, 17);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`PROPOSTA Nº ${String(Date.now()).slice(-6)}`, PW - mg, 11, { align: "right" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")} · Validade: 15 dias`, PW - mg, 17, { align: "right" });
    y = 32;

    // 2. Bloco do Cliente e Projeto
    doc.setFillColor(...bgLight);
    doc.rect(mg, y - 4, col, 22, "F");
    doc.setDrawColor(220, 205, 185);
    doc.rect(mg, y - 4, col, 22, "S");

    doc.setTextColor(...dark);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("CLIENTE:", mg + 4, y + 2);
    doc.setFont("helvetica", "normal");
    doc.text(clientName || "Cliente", mg + 22, y + 2);

    doc.setFont("helvetica", "bold");
    doc.text("ENDEREÇO:", mg + 4, y + 8);
    doc.setFont("helvetica", "normal");
    doc.text(clientAddress || "Conforme projeto aprovado", mg + 25, y + 8);

    if (architectName) {
      doc.setFont("helvetica", "bold");
      doc.text("ARQUITETO(A):", mg + 4, y + 14);
      doc.setFont("helvetica", "normal");
      doc.text(architectName, mg + 28, y + 14);
    } else {
      doc.setFont("helvetica", "bold");
      doc.text("AMBIENTES:", mg + 4, y + 14);
      doc.setFont("helvetica", "normal");
      doc.text(ambientDesc || "Projeto Geral", mg + 24, y + 14);
    }

    doc.setFont("helvetica", "bold");
    doc.text("TELEFONE:", mg + col / 2 + 10, y + 2);
    doc.setFont("helvetica", "normal");
    doc.text(clientPhone || "—", mg + col / 2 + 30, y + 2);

    doc.setFont("helvetica", "bold");
    doc.text("PRAZO:", mg + col / 2 + 10, y + 8);
    doc.setFont("helvetica", "normal");
    doc.text(deliveryDeadline, mg + col / 2 + 25, y + 8);

    y += 26;

    // 3. Tabela Agrupada por AMBIENTE
    const checkPageBreak = (neededHeight) => {
      if (y + neededHeight > PH - 35) {
        doc.addPage();
        y = 18;
      }
    };

    const ambientes = Object.keys(pecasPorAmbiente);

    ambientes.forEach((ambNome, ambIdx) => {
      const pecasDoAmbiente = pecasPorAmbiente[ambNome];
      const subtotalAmb = pecasDoAmbiente.reduce((acc, p) => acc + calcLine(p), 0);

      checkPageBreak(25);

      // Header do Ambiente
      doc.setFillColor(34, 26, 18);
      doc.rect(mg, y, col, 7.5, "F");
      doc.setTextColor(232, 170, 64);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text(`📍 AMBIENTE: ${ambNome.toUpperCase()}`, mg + 3, y + 5);
      doc.text(
        `Subtotal: ${fmtBRL(subtotalAmb)}`,
        PW - mg - 3,
        y + 5,
        { align: "right" }
      );
      y += 8.5;

      // Cabeçalho da tabela de itens
      doc.setFillColor(...gold);
      doc.rect(mg, y, col, 6.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text("ITEM / DESCRIÇÃO", mg + 2, y + 4.5);
      doc.text("TIPO", mg + 76, y + 4.5);
      doc.text("MEDIDAS (m)", mg + 94, y + 4.5);
      doc.text("QTD", mg + 116, y + 4.5);
      doc.text("VALOR UNIT.", mg + 128, y + 4.5);
      doc.text("SUBTOTAL", PW - mg - 2, y + 4.5, { align: "right" });
      y += 7.5;

      // Linhas do Ambiente
      pecasDoAmbiente.forEach((l, i) => {
        checkPageBreak(8);

        if (i % 2 === 0) {
          doc.setFillColor(252, 248, 242);
          doc.rect(mg, y - 1, col, 7, "F");
        }
        doc.setTextColor(...dark);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        const nome = l.nome.length > 40 ? l.nome.slice(0, 38) + "..." : l.nome;
        doc.text(nome, mg + 2, y + 4);
        doc.text(l.tipo || "m²", mg + 76, y + 4);
        const dim =
          l.tipo === "m²"
            ? (parseFloat(l.largura) || 0).toFixed(2) + " × " + (parseFloat(l.altura) || 0).toFixed(2)
            : "—";
        doc.text(dim, mg + 94, y + 4);
        doc.text(String(l.quantidade || 1), mg + 118, y + 4);
        doc.text(fmtBRL(l.precoUnitario || 0), mg + 128, y + 4);
        doc.setFont("helvetica", "bold");
        doc.text(fmtBRL(calcLine(l)), PW - mg - 2, y + 4, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += 7;
      });

      y += 4;
    });

    // 4. Totais e Fechamento Comercial
    checkPageBreak(50);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(mg, y, PW - mg, y);
    y += 6;

    const rowTotal = (lbl, val, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...gr);
      doc.text(lbl, PW - mg - 65, y);
      doc.setTextColor(...dark);
      doc.text(fmtBRL(val), PW - mg - 2, y, { align: "right" });
      y += 6;
    };

    rowTotal("Subtotal dos Ambientes", q.subtotal);
    if (q.marginVal > 0) rowTotal(`Margem Comercial (${margin}%)`, q.marginVal);

    y += 2;
    doc.setFillColor(...gold);
    doc.rect(PW - mg - 84, y - 4, 84, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TOTAL GERAL", PW - mg - 81, y + 3.5);
    doc.setFontSize(11);
    doc.text(fmtBRL(q.total), PW - mg - 2, y + 3.5, { align: "right" });
    y += 15;

    // 5. Termos Comerciais e Assinatura
    checkPageBreak(30);
    doc.setFillColor(...bgLight);
    doc.rect(mg, y - 2, col, 20, "F");
    doc.setTextColor(...dark);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("CONDIÇÕES COMERCIAIS & GARANTIA:", mg + 3, y + 3);
    doc.setFont("helvetica", "normal");
    doc.text(`• Pagamento: ${paymentTerms}`, mg + 3, y + 8);
    doc.text(`• Prazo de Entrega: ${deliveryDeadline}`, mg + 3, y + 12);
    doc.text("• Garantia: 05 anos contra defeitos de fabricação em MDF e ferragens.", mg + 3, y + 16);
    y += 28;

    // Linhas de Assinatura
    checkPageBreak(20);
    const signW = 75;
    doc.setDrawColor(160, 140, 120);
    doc.line(mg + 10, y, mg + 10 + signW, y);
    doc.line(PW - mg - signW - 10, y, PW - mg - 10, y);

    doc.setFontSize(7);
    doc.setTextColor(...gr);
    doc.text("CONTRATADA (Marcenaria)", mg + 10 + signW / 2, y + 4, { align: "center" });
    doc.text("DE ACORDO - CLIENTE", PW - mg - 10 - signW / 2, y + 4, { align: "center" });

    // Salvar arquivo
    const fn = (clientName || "orcamento_marcenaria").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    doc.save(`proposta_${fn}_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`);
  };

  const calcLine = (p) => {
    const qty = parseFloat(p.quantidade) || 1;
    const price = parseFloat(p.precoUnitario) || 0;
    const area = p.tipo === "m²" ? (parseFloat(p.largura) || 0) * (parseFloat(p.altura) || 0) : 1;
    return area * qty * price;
  };

  const calcQuote = () => {
    let subtotal = 0;
    const lines = pieces.map((p) => {
      const lt = calcLine(p);
      subtotal += lt;
      return { ...p, lineTotal: lt };
    });
    const marginVal = subtotal * (margin / 100);
    return { lines, subtotal, marginVal, total: subtotal + marginVal };
  };

  const addPiece = (ambDefault) =>
    setPieces((prev) => [
      ...prev,
      {
        _id: Date.now(),
        ambiente: ambDefault || (ambientesDisponiveis[0] || "Sala de Estar"),
        nome: "Nova Peça",
        tipo: "m²",
        largura: 1.0,
        altura: 1.0,
        quantidade: 1,
        precoUnitario: 1250,
        subtotal: 1250,
        observacao: "",
      },
    ]);

  const updPiece = (id, field, val) =>
    setPieces((prev) =>
      prev.map((p) => {
        if (p._id !== id) return p;
        const up = { ...p, [field]: val };
        if (["largura", "altura", "quantidade", "precoUnitario", "tipo"].includes(field)) {
          const qty = parseFloat(field === "quantidade" ? val : up.quantidade) || 1;
          const price = parseFloat(field === "precoUnitario" ? val : up.precoUnitario) || 0;
          const tipo = field === "tipo" ? val : up.tipo;
          const area =
            tipo === "m²"
              ? (parseFloat(field === "largura" ? val : up.largura) || 0) *
                (parseFloat(field === "altura" ? val : up.altura) || 0)
              : 1;
          up.subtotal = area * qty * price;
        }
        return up;
      })
    );

  const delPiece = (id) => setPieces((prev) => prev.filter((p) => p._id !== id));

  const saveQuote = () => {
    const q = calcQuote();
    saveHistory([
      {
        id: Date.now(),
        date: new Date().toLocaleDateString("pt-BR"),
        client: clientName || "Cliente",
        address: clientAddress,
        phone: clientPhone,
        notes: ambientDesc,
        pieces: [...pieces],
        total: q.total,
        margin,
      },
      ...history,
    ]);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const quote = calcQuote();
  const catGroups = [...new Set(rules.map((r) => r.category))];
  const IS = {
    background: "#1c1510",
    border: "1px solid #332618",
    borderRadius: 8,
    color: "#f0e0c8",
    padding: "10px 12px",
    fontFamily: "'Barlow', sans-serif",
    fontSize: 14,
    outline: "none",
    width: "100%",
  };
  const NS = { ...IS, color: "#d4952e", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 };

  return (
    <div style={{ fontFamily: "'Barlow', sans-serif", background: "#0d0a07", minHeight: "100vh", color: "#f0e0c8", overflowX: "hidden", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #110e09; }
        ::-webkit-scrollbar-thumb { background: #3a2a1a; border-radius: 2px; }
        input, select, textarea { font-family: 'Barlow', sans-serif !important; touch-action: manipulation; }
        input:focus, select:focus { border-color: #c8892a !important; box-shadow: 0 0 0 2px rgba(200,137,42,.2) !important; }
        .hb:active { transform: scale(0.97); }
        .tab:hover { color: #c8892a !important; }
        .dropzone.drag { border-color: #c8892a !important; background: rgba(200,137,42,.06) !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        .ban { animation: fadeIn .3s ease; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
        
        .layout-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 20px;
        }
        .header-wrap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          gap: 10px;
        }
        .client-inputs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin-bottom: 14px;
        }
        .desktop-table { display: block; }
        .mobile-card-list { display: none; }

        @media (max-width: 860px) {
          .layout-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .header-wrap {
            padding: 10px 14px !important;
          }
          .client-inputs-grid {
            grid-template-columns: 1fr !important;
          }
          .main-content {
            padding: 12px 10px !important;
          }
          .desktop-table { display: none !important; }
          .mobile-card-list { display: flex !important; flex-direction: column; gap: 10px; }
        }
      `}</style>

      {/* Top Header */}
      <header style={{ background: "linear-gradient(135deg,#18110a,#221609)", borderBottom: "1px solid #2e1f0e", position: "sticky", top: 0, zIndex: 90 }}>
        <div className="header-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#c8892a,#e8aa40)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 12px rgba(200,137,42,.3)" }}>
              🪵
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display'", fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>
                OrcaMóvel
              </div>
              <div style={{ fontSize: 9, color: "#8a6a40", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>
                IA & Corte 2D
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowKeyInput((v) => !v)}
                style={{
                  background: apiKey ? "rgba(100,200,80,.15)" : "rgba(200,137,42,.12)",
                  border: `1px solid ${apiKey ? "rgba(100,200,80,.35)" : "rgba(200,137,42,.3)"}`,
                  borderRadius: 8,
                  color: apiKey ? "#80c860" : "#c8892a",
                  padding: "7px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                ⚙️ {apiKey ? "IA Ativa ✓" : "Configurar IA"}
              </button>

              {showKeyInput && (
                <div
                  style={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "#1c1510",
                    border: "1px solid #c8892a",
                    borderRadius: 14,
                    padding: 20,
                    zIndex: 999,
                    width: "92%",
                    maxWidth: 380,
                    boxShadow: "0 16px 48px rgba(0,0,0,.85)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontFamily: "'Playfair Display'", fontSize: 17, color: "#e8aa40", fontWeight: 700 }}>
                      ⚙️ Configuração da IA
                    </div>
                    <button onClick={() => setShowKeyInput(false)} style={{ background: "none", border: "none", color: "#8a7050", fontSize: 18, cursor: "pointer" }}>✕</button>
                  </div>

                  <div style={{ fontSize: 12, color: "#c0b090", marginBottom: 6, fontWeight: 500 }}>
                    Chave OpenRouter (sk-or-...):
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    placeholder="sk-or-v1-..."
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      localStorage.setItem("om_apikey", e.target.value);
                    }}
                    style={{ ...IS, fontFamily: "monospace", fontSize: 12, marginBottom: 8 }}
                  />
                  <div style={{ fontSize: 11, color: "#7a6040", marginBottom: 12 }}>
                    Crie sua chave em{" "}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: "#c8892a", textDecoration: "underline" }}>
                      openrouter.ai/keys
                    </a>
                  </div>

                  <div style={{ borderTop: "1px solid #2a1c0e", paddingTop: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: "#c0b090", marginBottom: 6, fontWeight: 500 }}>
                      Modelo de IA para Leitura:
                    </div>
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        setSelectedModel(e.target.value);
                        localStorage.setItem("om_model", e.target.value);
                      }}
                      style={{ ...IS, fontSize: 13 }}
                    >
                      <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Padrão Recomendado)</option>
                      <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (Ultra Rápido)</option>
                      <option value="openai/gpt-4o">GPT-4o (OpenAI)</option>
                      <option value="anthropic/claude-3.7-sonnet">Claude 3.7 Sonnet</option>
                    </select>
                  </div>

                  <button
                    onClick={() => setShowKeyInput(false)}
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg,#c8892a,#e8aa40)",
                      border: "none",
                      borderRadius: 8,
                      color: "#0d0a07",
                      padding: "11px 14px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Salvar Configurações
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#150f09", padding: "4px 8px", borderRadius: 8, border: "1px solid #2e1f0e" }}>
              <span style={{ fontSize: 10, color: "#8a6a40", textTransform: "uppercase", fontWeight: 700 }}>
                %
              </span>
              <input
                type="number"
                value={margin}
                onChange={(e) => {
                  setMargin(Number(e.target.value));
                  lsSet("om_margin_v1", Number(e.target.value));
                }}
                min={0}
                max={200}
                style={{
                  width: 44,
                  background: "#1c1510",
                  border: "1px solid #3a2a1a",
                  borderRadius: 6,
                  color: "#d4952e",
                  padding: "3px 4px",
                  fontSize: 13,
                  fontFamily: "'Barlow Condensed'",
                  fontWeight: 700,
                  textAlign: "center",
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav style={{ background: "#110e09", borderBottom: "1px solid #1a1006", padding: "0 10px", display: "flex", overflowX: "auto" }}>
        {[
          { id: "quote", icon: "📐", label: "Orçamento" },
          { id: "corte", icon: "🪚", label: `Plano de Corte${pieces.length > 0 ? ` (${pieces.length})` : ""}` },
          { id: "training", icon: "🧠", label: "Treinar IA" },
          { id: "history", icon: "📋", label: "Histórico" },
        ].map((t) => (
          <button
            key={t.id}
            className="tab"
            onClick={() => setTab(t.id)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: "12px 14px",
              fontFamily: "'Barlow'",
              fontWeight: tab === t.id ? 600 : 500,
              fontSize: 13,
              color: tab === t.id ? "#c8892a" : "#6a5540",
              borderBottom: tab === t.id ? "2px solid #c8892a" : "2px solid transparent",
              transition: "all .2s",
              whiteSpace: "nowrap",
              flex: "1 0 auto",
              textAlign: "center",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      {/* Feedback Toast */}
      {savedBanner && (
        <div
          className="ban"
          style={{
            position: "fixed",
            top: 18,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1e3a14",
            border: "1px solid #4a8a28",
            borderRadius: 10,
            padding: "11px 22px",
            color: "#8aca58",
            fontWeight: 600,
            fontSize: 14,
            zIndex: 999,
            boxShadow: "0 8px 24px rgba(0,0,0,.6)",
          }}
        >
          ✅ Orçamento salvo com sucesso!
        </div>
      )}

      {/* Modal de Detalhes do Cliente para o PDF Profissional */}
      {showClientModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#1c1510",
              border: "1px solid #c8892a",
              borderRadius: 14,
              padding: 22,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 16px 48px rgba(0,0,0,.9)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Playfair Display'", fontSize: 18, color: "#e8aa40", fontWeight: 700 }}>
                📑 Dados da Proposta Comercial
              </div>
              <button onClick={() => setShowClientModal(false)} style={{ background: "none", border: "none", color: "#8a7050", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Nome do Cliente</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex: Dr. Roberto Guimarães" style={IS} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Endereço da Obra</label>
                <input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Ex: Av. Paulista, 1000 — Apto 142" style={IS} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Telefone / WhatsApp</label>
                  <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="(11) 99999-9999" style={IS} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Arquiteto(a)</label>
                  <input value={architectName} onChange={(e) => setArchitectName(e.target.value)} placeholder="Ex: Arq. Juliana Prado" style={IS} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Condições de Pagamento</label>
                <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} style={IS} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Prazo de Entrega</label>
                <input value={deliveryDeadline} onChange={(e) => setDeliveryDeadline(e.target.value)} style={IS} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  setShowClientModal(false);
                  generatePDF();
                }}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg,#c8892a,#e8aa40)",
                  border: "none",
                  borderRadius: 8,
                  color: "#0d0a07",
                  padding: "12px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                📄 Gerar PDF Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para PDF Grande */}
      {showConfirmAllModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#1c1510",
              border: "1px solid #c8892a",
              borderRadius: 14,
              padding: 22,
              maxWidth: 380,
              width: "100%",
              boxShadow: "0 16px 40px rgba(0,0,0,.9)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8, textAlign: "center" }}>📑</div>
            <div style={{ fontFamily: "'Playfair Display'", fontSize: 18, color: "#e8aa40", textAlign: "center", marginBottom: 8 }}>
              PDF com {uploadedFile?.pages?.length} Páginas
            </div>
            <div style={{ fontSize: 13, color: "#c0b090", lineHeight: 1.5, marginBottom: 16, textAlign: "center" }}>
              Deseja analisar todas as <strong>{uploadedFile?.pages?.length} páginas</strong> separando por ambiente, ou prefere analisar apenas a <strong>Página {selectedPageIndex + 1}</strong> atual?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => executeAnalysis(true)}
                style={{
                  background: "linear-gradient(135deg,#c8892a,#e8aa40)",
                  border: "none",
                  borderRadius: 8,
                  color: "#0d0a07",
                  padding: "12px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                Analisar Apenas Página {selectedPageIndex + 1}
              </button>
              <button
                onClick={() => executeAnalysis(false)}
                style={{
                  background: "rgba(200,137,42,.15)",
                  border: "1px solid rgba(200,137,42,.3)",
                  borderRadius: 8,
                  color: "#c8892a",
                  padding: "11px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Analisar Todas as {uploadedFile?.pages?.length} Páginas
              </button>
              <button
                onClick={() => setShowConfirmAllModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8a7050",
                  padding: "8px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="main-content" style={{ maxWidth: 1160, margin: "0 auto", padding: "16px 14px" }}>
        {/* Aba 1: Orçamento Comercial */}
        {tab === "quote" && (
          <div className="layout-grid">
            <div>
              {/* Bloco de Identificação com Endereço e Dados do Cliente */}
              <div className="client-inputs-grid">
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4, fontWeight: 600 }}>
                    Cliente
                  </label>
                  <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome do cliente..." style={IS} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4, fontWeight: 600 }}>
                    Endereço da Obra
                  </label>
                  <input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Endereço / Cidade..." style={IS} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4, fontWeight: 600 }}>
                    Ambientes Detectados
                  </label>
                  <input value={ambientDesc} onChange={(e) => setAmbientDesc(e.target.value)} placeholder="Ex: Sala, Cozinha, Suíte..." style={IS} />
                </div>
              </div>

              {/* Área de Upload / Preview */}
              <div
                className={`dropzone${isDragging ? " drag" : ""}`}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFile(e.dataTransfer.files[0]);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                style={{
                  border: "2px dashed #3a2810",
                  borderRadius: 14,
                  padding: "16px",
                  textAlign: "center",
                  marginBottom: 14,
                  background: "#0f0c08",
                  minHeight: 140,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 10,
                  transition: "all .2s",
                }}
              >
                {uploadedFile?.converting ? (
                  <>
                    <div className="spin" style={{ fontSize: 34 }}>⚙️</div>
                    <div style={{ color: "#c8892a", fontSize: 14, fontWeight: 600 }}>Convertendo páginas do PDF...</div>
                    <div style={{ fontSize: 11, color: "#6a5038" }}>{uploadedFile.name}</div>
                  </>
                ) : uploadedFile?.preview ? (
                  <>
                    <div style={{ position: "relative", maxWidth: "100%" }}>
                      <img
                        src={uploadedFile.isPdf && uploadedFile.pages?.length ? uploadedFile.pages[selectedPageIndex] : uploadedFile.preview}
                        alt="Projeto"
                        style={{
                          maxHeight: 240,
                          maxWidth: "100%",
                          borderRadius: 10,
                          objectFit: "contain",
                          border: "1px solid #2e1f0e",
                          background: "#000",
                        }}
                      />
                    </div>

                    {/* Navegador de Páginas Mobile com Toque Fácil */}
                    {uploadedFile.isPdf && uploadedFile.pages?.length > 1 && (
                      <div style={{ width: "100%", background: "#150f09", padding: "8px 12px", borderRadius: 10, border: "1px solid #2a1c0e" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <button
                            className="hb"
                            onClick={() => setSelectedPageIndex((i) => Math.max(0, i - 1))}
                            disabled={selectedPageIndex === 0}
                            style={{
                              background: selectedPageIndex === 0 ? "#14100b" : "linear-gradient(135deg,#c8892a,#e8aa40)",
                              border: "none",
                              color: selectedPageIndex === 0 ? "#4a3520" : "#0d0a07",
                              borderRadius: 7,
                              padding: "7px 14px",
                              cursor: selectedPageIndex === 0 ? "not-allowed" : "pointer",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            ◀ Anterior
                          </button>

                          <div style={{ fontSize: 13, color: "#e8aa40", fontWeight: 700 }}>
                            Página {selectedPageIndex + 1} de {uploadedFile.pages.length}
                          </div>

                          <button
                            className="hb"
                            onClick={() => setSelectedPageIndex((i) => Math.min(uploadedFile.pages.length - 1, i + 1))}
                            disabled={selectedPageIndex === uploadedFile.pages.length - 1}
                            style={{
                              background: selectedPageIndex === uploadedFile.pages.length - 1 ? "#14100b" : "linear-gradient(135deg,#c8892a,#e8aa40)",
                              border: "none",
                              color: selectedPageIndex === uploadedFile.pages.length - 1 ? "#4a3520" : "#0d0a07",
                              borderRadius: 7,
                              padding: "7px 14px",
                              cursor: selectedPageIndex === uploadedFile.pages.length - 1 ? "not-allowed" : "pointer",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            Próxima ▶
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <label htmlFor={fileInputId} className="hb" style={{ background: "rgba(200,137,42,.14)", border: "1px solid rgba(200,137,42,.35)", borderRadius: 8, color: "#c8892a", padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-block" }}>
                        🔄 Trocar Arquivo
                      </label>
                      <button className="hb" onClick={() => { setUploadedFile(null); setPieces([]); setAnalysisError(null); }} style={{ background: "rgba(180,50,50,.12)", border: "1px solid rgba(180,50,50,.25)", borderRadius: 8, color: "#b05050", padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>
                        ✕ Remover
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 36 }}>📐</div>
                    <div style={{ fontFamily: "'Playfair Display'", fontSize: 17, color: "#8a6a40" }}>
                      Envie a planta, corte ou PDF do projeto
                    </div>
                    <div style={{ fontSize: 12, color: "#4a3520" }}>Toque para escolher foto ou arquivo</div>
                    <label htmlFor={fileInputId} className="hb" style={{ background: "linear-gradient(135deg,#c8892a,#e8aa40)", border: "none", borderRadius: 9, color: "#0d0a07", padding: "12px 28px", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: 15, letterSpacing: ".08em", cursor: "pointer", textTransform: "uppercase", boxShadow: "0 4px 16px rgba(200,137,42,.3)", display: "inline-block", marginTop: 4 }}>
                      📁 Escolher Arquivo / Foto
                    </label>
                    <div style={{ fontSize: 11, color: "#3e2a18" }}>JPG · PNG · PDF com múltiplos ambientes</div>
                  </>
                )}
                <input id={fileInputId} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
              </div>

              {/* Botões de Ação da IA */}
              {uploadedFile && !uploadedFile.converting && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                  <button
                    className="hb"
                    onClick={() => handleStartAnalysis(true)}
                    disabled={isAnalyzing}
                    style={{
                      width: "100%",
                      padding: "14px",
                      background: isAnalyzing ? "#1a1610" : "linear-gradient(135deg,#c8892a,#e8aa40)",
                      border: "none",
                      borderRadius: 10,
                      color: isAnalyzing ? "#6a5540" : "#0d0a07",
                      fontFamily: "'Barlow Condensed'",
                      fontWeight: 700,
                      fontSize: 16,
                      letterSpacing: ".06em",
                      cursor: isAnalyzing ? "not-allowed" : "pointer",
                      textTransform: "uppercase",
                      boxShadow: isAnalyzing ? "none" : "0 4px 16px rgba(200,137,42,.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {isAnalyzing ? (
                      <>
                        <span className="spin">⚙️</span>{" "}
                        {analyzingProgress
                          ? `Analisando pág. ${analyzingProgress.pageNum} (${analyzingProgress.current}/${analyzingProgress.total})...`
                          : "Processando com IA..."}
                      </>
                    ) : (
                      `🤖 Analisar Esta Página (Pág. ${selectedPageIndex + 1})`
                    )}
                  </button>

                  {uploadedFile.isPdf && uploadedFile.pages?.length > 1 && !isAnalyzing && (
                    <button
                      className="hb"
                      onClick={() => handleStartAnalysis(false)}
                      style={{
                        width: "100%",
                        padding: "11px",
                        background: "rgba(200,137,42,.12)",
                        border: "1px solid rgba(200,137,42,.3)",
                        borderRadius: 9,
                        color: "#c8892a",
                        fontFamily: "'Barlow Condensed'",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: "pointer",
                        textTransform: "uppercase",
                      }}
                    >
                      📑 Analisar Projeto Inteiro ({uploadedFile.pages.length} páginas com separação de ambientes)
                    </button>
                  )}

                  {isAnalyzing && (
                    <button
                      onClick={stopAnalysis}
                      style={{
                        width: "100%",
                        padding: "11px",
                        background: "rgba(180,50,50,.18)",
                        border: "1px solid rgba(180,50,50,.35)",
                        borderRadius: 9,
                        color: "#d06060",
                        fontFamily: "'Barlow Condensed'",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: "pointer",
                        textTransform: "uppercase",
                      }}
                    >
                      ⏹ Parar Análise
                    </button>
                  )}
                </div>
              )}

              {/* Alerta de Erro */}
              {analysisError && (
                <div
                  style={{
                    background: "#221010",
                    border: "1px solid #6a2525",
                    borderRadius: 10,
                    padding: "14px 16px",
                    marginBottom: 14,
                    fontSize: 13,
                    color: "#d87070",
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⚠️ Informação:</span>
                  </div>
                  {analysisError}
                </div>
              )}

              {/* Aviso de Formas Compostas */}
              {formasCompostas.length > 0 && (
                <div style={{ background: "#1a1500", border: "1px solid #c8892a", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <span style={{ color: "#e8aa40", fontWeight: 700, fontSize: 13 }}>Formas compostas detectadas — confira as alas!</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#a08040", marginBottom: 8, lineHeight: 1.6 }}>
                    O agente identificou peças em formato <strong style={{ color: "#c8892a" }}>L, U ou C</strong> e as dividiu em partes retangulares:
                  </div>
                  {formasCompostas.map((fc, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#c8892a", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#d0a050" }}>{fc}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Seletor de Filtro de Ambiente */}
              {ambientesDisponiveis.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#8a6a40", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>
                    Filtrar por:
                  </span>
                  <button
                    onClick={() => setFilterAmbiente("todos")}
                    style={{
                      background: filterAmbiente === "todos" ? "#c8892a" : "#1a140e",
                      color: filterAmbiente === "todos" ? "#000" : "#c0b090",
                      border: `1px solid ${filterAmbiente === "todos" ? "#c8892a" : "#2e1e0e"}`,
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Todos ({pieces.length})
                  </button>
                  {ambientesDisponiveis.map((amb) => (
                    <button
                      key={amb}
                      onClick={() => setFilterAmbiente(amb)}
                      style={{
                        background: filterAmbiente === amb ? "#c8892a" : "#1a140e",
                        color: filterAmbiente === amb ? "#000" : "#c0b090",
                        border: `1px solid ${filterAmbiente === amb ? "#c8892a" : "#2e1e0e"}`,
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {amb} ({(pecasPorAmbiente[amb] || []).length})
                    </button>
                  ))}
                </div>
              )}

              {/* Lista de Peças Separadas por Ambiente */}
              {pieces.length === 0 ? (
                <div style={{ background: "#110e09", border: "1px solid #1e1409", borderRadius: 12, padding: "36px 20px", textAlign: "center", color: "#4a3520", fontSize: 13, marginBottom: 14 }}>
                  Envie o projeto e clique em Analisar com IA, ou adicione peças manualmente no botão abaixo.
                  <div style={{ marginTop: 14 }}>
                    <button
                      onClick={() => addPiece()}
                      style={{
                        background: "rgba(200,137,42,.15)",
                        border: "1px solid rgba(200,137,42,.3)",
                        borderRadius: 8,
                        color: "#c8892a",
                        padding: "8px 18px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      + Adicionar Peça Manual
                    </button>
                  </div>
                </div>
              ) : (
                Object.keys(pecasPorAmbiente)
                  .filter((amb) => filterAmbiente === "todos" || filterAmbiente === amb)
                  .map((ambNome) => {
                    const pecasAmbiente = pecasPorAmbiente[ambNome];
                    const subtotalAmbiente = pecasAmbiente.reduce((acc, p) => acc + calcLine(p), 0);

                    return (
                      <div
                        key={ambNome}
                        style={{
                          background: "#110e09",
                          border: "1px solid #24180c",
                          borderRadius: 12,
                          overflow: "hidden",
                          marginBottom: 16,
                        }}
                      >
                        {/* Header do Ambiente */}
                        <div
                          style={{
                            padding: "10px 14px",
                            background: "linear-gradient(90deg, #1e150c, #161009)",
                            borderBottom: "1px solid #2a1c0e",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 16 }}>📍</span>
                            <input
                              value={ambNome}
                              onChange={(e) => {
                                const novoNome = e.target.value;
                                setPieces((prev) =>
                                  prev.map((p) => (p.ambiente === ambNome ? { ...p, ambiente: novoNome } : p))
                                );
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#e8aa40",
                                fontFamily: "'Playfair Display'",
                                fontSize: 16,
                                fontWeight: 700,
                                outline: "none",
                                minWidth: 160,
                              }}
                            />
                            <span style={{ fontSize: 11, color: "#7a6040" }}>({pecasAmbiente.length} peças)</span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 16, fontWeight: 700, color: "#c8892a" }}>
                              {fmtBRL(subtotalAmbiente)}
                            </span>
                            <button
                              onClick={() => addPiece(ambNome)}
                              style={{
                                background: "rgba(200,137,42,.12)",
                                border: "1px solid rgba(200,137,42,.3)",
                                borderRadius: 6,
                                color: "#c8892a",
                                padding: "4px 8px",
                                fontSize: 11,
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              + Item
                            </button>
                          </div>
                        </div>

                        {/* Tabela Desktop */}
                        <div className="desktop-table" style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
                            <thead>
                              <tr style={{ background: "#150f07" }}>
                                {["Peça", "Tipo", "Larg (m)", "Alt (m)", "Qtd", "R$/un", "Subtotal", ""].map((h) => (
                                  <th
                                    key={h}
                                    style={{
                                      padding: "7px 10px",
                                      textAlign: "left",
                                      fontSize: 9,
                                      color: "#6a5038",
                                      fontWeight: 700,
                                      letterSpacing: ".1em",
                                      textTransform: "uppercase",
                                      borderBottom: "1px solid #1a1006",
                                    }}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {pecasAmbiente.map((p) => (
                                <tr key={p._id} className="hr" style={{ borderBottom: "1px solid #16100a" }}>
                                  <td style={{ padding: "6px 10px" }}>
                                    <div>
                                      <input
                                        value={p.nome}
                                        onChange={(e) => updPiece(p._id, "nome", e.target.value)}
                                        style={{ background: "transparent", border: "none", color: "#e0d0b0", fontFamily: "'Barlow'", fontSize: 12, width: "100%", outline: "none", fontWeight: 500 }}
                                      />
                                      {p.aviso && <div style={{ fontSize: 10, color: "#c8892a", marginTop: 1 }}>⚠️ {p.aviso}</div>}
                                      {p._pagina && <div style={{ fontSize: 9, color: "#5a4430", marginTop: 1 }}>pág. {p._pagina}</div>}
                                    </div>
                                  </td>
                                  <td style={{ padding: "6px 4px" }}>
                                    <select value={p.tipo || "m²"} onChange={(e) => updPiece(p._id, "tipo", e.target.value)} style={{ ...IS, fontSize: 11, padding: "4px 5px", width: 72 }}>
                                      {["m²", "ml", "unidade", "%"].map((t) => (
                                        <option key={t}>{t}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td style={{ padding: "6px 4px" }}>
                                    <input type="number" value={p.largura || ""} onChange={(e) => updPiece(p._id, "largura", e.target.value)} step="0.01" style={{ ...NS, width: 56, padding: "4px 5px", fontSize: 12 }} />
                                  </td>
                                  <td style={{ padding: "6px 4px" }}>
                                    <input type="number" value={p.altura || ""} onChange={(e) => updPiece(p._id, "altura", e.target.value)} step="0.01" style={{ ...NS, width: 56, padding: "4px 5px", fontSize: 12 }} />
                                  </td>
                                  <td style={{ padding: "6px 4px" }}>
                                    <input type="number" value={p.quantidade} onChange={(e) => updPiece(p._id, "quantidade", e.target.value)} min={1} style={{ ...NS, width: 44, padding: "4px 5px", fontSize: 12, color: "#f0e0c8" }} />
                                  </td>
                                  <td style={{ padding: "6px 4px" }}>
                                    <input type="number" value={p.precoUnitario || ""} onChange={(e) => updPiece(p._id, "precoUnitario", e.target.value)} style={{ ...NS, width: 72, padding: "4px 5px", fontSize: 12 }} />
                                  </td>
                                  <td style={{ padding: "6px 10px", fontFamily: "'Barlow Condensed'", fontSize: 13, fontWeight: 700, color: "#c8892a", whiteSpace: "nowrap" }}>
                                    {fmtBRL(calcLine(p))}
                                  </td>
                                  <td style={{ padding: "6px 6px" }}>
                                    <button onClick={() => delPiece(p._id)} style={{ background: "none", border: "none", color: "#6a3030", cursor: "pointer", fontSize: 14 }}>
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Lista Mobile em Cards */}
                        <div className="mobile-card-list" style={{ padding: "10px" }}>
                          {pecasAmbiente.map((p, idx) => (
                            <div
                              key={p._id}
                              style={{
                                background: "#16110a",
                                border: "1px solid #2a1c0e",
                                borderRadius: 10,
                                padding: 12,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                                  <span style={{ background: "#c8892a", color: "#000", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                                    P{String(idx + 1).padStart(2, "0")}
                                  </span>
                                  <input
                                    value={p.nome}
                                    onChange={(e) => updPiece(p._id, "nome", e.target.value)}
                                    style={{ ...IS, padding: "5px 8px", fontSize: 13, fontWeight: 600 }}
                                  />
                                </div>
                                <button onClick={() => delPiece(p._id)} style={{ background: "none", border: "none", color: "#8a4040", cursor: "pointer", fontSize: 16, paddingLeft: 8 }}>
                                  ✕
                                </button>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                                <div>
                                  <span style={{ fontSize: 9, color: "#7a6040", textTransform: "uppercase", display: "block" }}>Larg (m)</span>
                                  <input type="number" value={p.largura || ""} onChange={(e) => updPiece(p._id, "largura", e.target.value)} step="0.01" style={{ ...NS, padding: "5px 6px", fontSize: 13 }} />
                                </div>
                                <div>
                                  <span style={{ fontSize: 9, color: "#7a6040", textTransform: "uppercase", display: "block" }}>Alt (m)</span>
                                  <input type="number" value={p.altura || ""} onChange={(e) => updPiece(p._id, "altura", e.target.value)} step="0.01" style={{ ...NS, padding: "5px 6px", fontSize: 13 }} />
                                </div>
                                <div>
                                  <span style={{ fontSize: 9, color: "#7a6040", textTransform: "uppercase", display: "block" }}>Qtd</span>
                                  <input type="number" value={p.quantidade} onChange={(e) => updPiece(p._id, "quantidade", e.target.value)} min={1} style={{ ...NS, padding: "5px 6px", fontSize: 13 }} />
                                </div>
                              </div>

                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #22160a", paddingTop: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <select value={p.tipo || "m²"} onChange={(e) => updPiece(p._id, "tipo", e.target.value)} style={{ ...IS, width: 68, padding: "4px 6px", fontSize: 11 }}>
                                    {["m²", "ml", "unidade", "%"].map((t) => (
                                      <option key={t}>{t}</option>
                                    ))}
                                  </select>
                                  <span style={{ fontSize: 11, color: "#7a6040" }}>{fmtBRL(p.precoUnitario || 0)}</span>
                                </div>
                                <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 16, fontWeight: 700, color: "#e8aa40" }}>
                                  {fmtBRL(calcLine(p))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Coluna Direita: Resumo com Totais por Ambiente */}
            <div>
              <div style={{ background: "#110e09", border: "1px solid #1e1409", borderRadius: 14, padding: "18px" }}>
                <div style={{ fontFamily: "'Playfair Display'", fontSize: 20, marginBottom: 12 }}>Resumo por Ambiente</div>
                {quote.lines.length === 0 ? (
                  <div style={{ color: "#4a3520", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                    Adicione ou extraia peças para visualizar o cálculo total
                  </div>
                ) : (
                  <>
                    {/* Lista de Ambientes com Subtotais */}
                    <div style={{ marginBottom: 14, borderBottom: "1px solid #22160a", paddingBottom: 10 }}>
                      {Object.keys(pecasPorAmbiente).map((ambNome) => {
                        const pecasAmb = pecasPorAmbiente[ambNome];
                        const subAmb = pecasAmb.reduce((acc, p) => acc + calcLine(p), 0);
                        const pct = quote.subtotal > 0 ? Math.round((subAmb / quote.subtotal) * 100) : 0;
                        return (
                          <div key={ambNome} style={{ padding: "6px 0", borderBottom: "1px solid #161009" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12, color: "#d0c0a0", fontWeight: 600 }}>📍 {ambNome}</span>
                              <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, color: "#e8aa40", fontWeight: 700 }}>
                                {fmtBRL(subAmb)}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6a5038", marginTop: 2 }}>
                              <span>{pecasAmb.length} itens</span>
                              <span>{pct}% do projeto</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#7a6040" }}>Subtotal materiais</span>
                        <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, color: "#c0b090", fontWeight: 600 }}>{fmtBRL(quote.subtotal)}</span>
                      </div>
                      {margin > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontSize: 12, color: "#7a6040" }}>Margem ({margin}%)</span>
                          <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, color: "#c0b090", fontWeight: 600 }}>{fmtBRL(quote.marginVal)}</span>
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "rgba(200,137,42,.09)",
                          border: "1px solid rgba(200,137,42,.22)",
                          borderRadius: 10,
                          padding: "12px 14px",
                          marginTop: 8,
                        }}
                      >
                        <span style={{ fontFamily: "'Playfair Display'", fontSize: 16 }}>Total</span>
                        <span style={{ fontFamily: "'Playfair Display'", fontSize: 22, color: "#e8aa40", fontWeight: 700 }}>
                          {fmtBRL(quote.total)}
                        </span>
                      </div>
                    </div>

                    <button
                      className="hb"
                      onClick={() => setTab("corte")}
                      style={{
                        width: "100%",
                        marginTop: 12,
                        padding: "12px",
                        background: "linear-gradient(135deg,#c8892a,#e8aa40)",
                        border: "none",
                        borderRadius: 9,
                        color: "#0d0a07",
                        fontFamily: "'Barlow Condensed'",
                        fontWeight: 700,
                        fontSize: 15,
                        letterSpacing: ".06em",
                        cursor: "pointer",
                        textTransform: "uppercase",
                        transition: "all .2s",
                      }}
                    >
                      🪚 Gerar Plano de Corte 2D
                    </button>

                    <button
                      className="hb"
                      onClick={() => setShowClientModal(true)}
                      style={{
                        width: "100%",
                        marginTop: 8,
                        padding: "11px",
                        background: "linear-gradient(135deg,#1a2a4a,#2a4a8a)",
                        border: "none",
                        borderRadius: 9,
                        color: "#80b0f0",
                        fontFamily: "'Barlow Condensed'",
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: ".08em",
                        cursor: "pointer",
                        textTransform: "uppercase",
                        transition: "all .2s",
                      }}
                    >
                      📄 Gerar PDF Profissional
                    </button>

                    <button
                      className="hb"
                      onClick={saveQuote}
                      style={{
                        width: "100%",
                        marginTop: 8,
                        padding: "11px",
                        background: "linear-gradient(135deg,#1e4a10,#2e6a18)",
                        border: "none",
                        borderRadius: 9,
                        color: "#90d060",
                        fontFamily: "'Barlow Condensed'",
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: ".08em",
                        cursor: "pointer",
                        textTransform: "uppercase",
                        transition: "all .2s",
                      }}
                    >
                      💾 Salvar Orçamento
                    </button>

                    <button
                      className="hb"
                      onClick={() => {
                        setPieces([]);
                        setUploadedFile(null);
                        setClientName("");
                        setClientAddress("");
                        setClientPhone("");
                        setArchitectName("");
                        setAmbientDesc("");
                        setAnalysisError(null);
                        setFormasCompostas([]);
                      }}
                      style={{
                        width: "100%",
                        marginTop: 8,
                        padding: "9px",
                        background: "transparent",
                        border: "1px solid #2a1c0a",
                        borderRadius: 9,
                        color: "#6a5038",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      🔄 Novo Projeto
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Aba 2: Plano de Corte Otimizado (CorteSmart) */}
        {tab === "corte" && (
          <PlanoCorteView
            pieces={pieces}
            clientName={clientName}
            ambientDesc={ambientDesc}
            onGoToQuote={() => setTab("quote")}
          />
        )}

        {/* Aba 3: Treinamento */}
        {tab === "training" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display'", fontSize: 24, marginBottom: 4 }}>🧠 Treinamento do Agente</div>
                <div style={{ fontSize: 13, color: "#7a6040", maxWidth: 520, lineHeight: 1.5 }}>
                  As <strong style={{ color: "#c8892a" }}>Regras de Preço</strong> e <strong style={{ color: "#c8892a" }}>Exemplos Reais</strong> ensinam a IA o seu padrão de cálculo.
                </div>
              </div>
              <div style={{ background: "rgba(200,137,42,.06)", border: "1px solid rgba(200,137,42,.15)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#8a7050", textAlign: "right" }}>
                <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 20, color: "#c8892a", fontWeight: 700 }}>{rules.length}</div>
                <div>regras ativas</div>
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontFamily: "'Playfair Display'", fontSize: 18 }}>📋 Tabela de Preços</div>
                <button
                  className="hb"
                  onClick={() => setShowAddRule((v) => !v)}
                  style={{
                    background: "linear-gradient(135deg,#c8892a,#e8aa40)",
                    border: "none",
                    borderRadius: 8,
                    color: "#0d0a07",
                    padding: "7px 14px",
                    fontFamily: "'Barlow Condensed'",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  + Nova Regra
                </button>
              </div>

              {showAddRule && (
                <div style={{ background: "#18120a", border: "1px solid #c8892a", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Playfair Display'", fontSize: 15, color: "#c8892a", marginBottom: 10 }}>Cadastrar Regra de Preço</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 4 }}>Categoria</label>
                      <input value={newRule.category} onChange={(e) => setNewRule((p) => ({ ...p, category: e.target.value }))} style={IS} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 4 }}>Descrição</label>
                      <input value={newRule.label} onChange={(e) => setNewRule((p) => ({ ...p, label: e.target.value }))} placeholder="Ex: Porta espelho" style={IS} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 4 }}>Unid.</label>
                      <select value={newRule.unit} onChange={(e) => setNewRule((p) => ({ ...p, unit: e.target.value }))} style={IS}>
                        {["m²", "ml", "un", "%", "diária"].map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 4 }}>Preço (R$)</label>
                      <input type="number" value={newRule.price} onChange={(e) => setNewRule((p) => ({ ...p, price: e.target.value }))} style={{ ...NS, textAlign: "left" }} />
                    </div>
                  </div>
                  <input value={newRule.note} onChange={(e) => setNewRule((p) => ({ ...p, note: e.target.value }))} placeholder="Observação para o agente..." style={{ ...IS, marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => {
                        if (!newRule.label || !newRule.price) return;
                        saveRules([...rules, { ...newRule, id: Date.now(), price: parseFloat(newRule.price) }]);
                        setNewRule({ category: "Armário/Guarda-roupa", label: "", unit: "m²", price: "", note: "" });
                        setShowAddRule(false);
                      }}
                      style={{ background: "linear-gradient(135deg,#c8892a,#e8aa40)", border: "none", borderRadius: 7, color: "#0d0a07", padding: "8px 16px", fontFamily: "'Barlow Condensed'", fontWeight: 700, cursor: "pointer" }}
                    >
                      Salvar Regra
                    </button>
                    <button onClick={() => setShowAddRule(false)} style={{ background: "#1e1610", border: "1px solid #2e1f0e", borderRadius: 7, color: "#5a4838", padding: "8px 12px", cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {catGroups.map((cat) => {
                const catRules = rules.filter((r) => r.category === cat);
                if (!catRules.length) return null;
                const color = CAT_COLORS[cat] || "#8a7a6a";
                return (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                      <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color }}>
                        {cat}
                      </span>
                    </div>
                    <div style={{ background: "#110e09", border: "1px solid #1a1006", borderRadius: 10, overflow: "hidden" }}>
                      {catRules.map((r, i) => (
                        <div key={r.id} className="hr" style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: i < catRules.length - 1 ? "1px solid #16100a" : "none", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: "#d0c0a0" }}>{r.label}</div>
                            {r.note && <div style={{ fontSize: 10, color: "#6a5038", marginTop: 2 }}>{r.note}</div>}
                          </div>
                          <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, fontWeight: 700, color, minWidth: 70, textAlign: "right" }}>
                            {fmtBRL(r.price)}/{r.unit}
                          </span>
                          <button onClick={() => saveRules(rules.filter((x) => x.id !== r.id))} style={{ background: "none", border: "none", color: "#6a2525", cursor: "pointer", fontSize: 13, padding: "0 4px" }}>
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Aba 4: Histórico */}
        {tab === "history" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Playfair Display'", fontSize: 22 }}>
                Histórico <span style={{ fontSize: 13, color: "#6a5540", fontFamily: "'Barlow'", fontWeight: 400 }}>({history.length})</span>
              </div>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("Deseja apagar todo o histórico de orçamentos?")) saveHistory([]);
                  }}
                  style={{ background: "rgba(180,50,50,.12)", border: "1px solid rgba(180,50,50,.25)", borderRadius: 7, color: "#c06060", padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                >
                  🗑️ Limpar
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 16px", color: "#4a3520", fontFamily: "'Playfair Display'", fontSize: 15 }}>
                Nenhum orçamento salvo no histórico ainda.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {history.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => setExpandedHistory(expandedHistory === q.id ? null : q.id)}
                    style={{ background: "#110e09", border: `1px solid ${expandedHistory === q.id ? "#c8892a" : "#1e1409"}`, borderRadius: 12, padding: 14, cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontFamily: "'Playfair Display'", fontSize: 15, fontWeight: 700 }}>{q.client}</div>
                      <div style={{ fontSize: 11, color: "#6a5540" }}>{q.date}</div>
                    </div>
                    {q.address && <div style={{ fontSize: 11, color: "#7a6040", marginBottom: 4 }}>📍 {q.address}</div>}
                    {q.notes && <div style={{ fontSize: 11, color: "#7a6040", marginBottom: 8 }}>{q.notes}</div>}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#5a4430" }}>{q.pieces?.length || 0} peças</span>
                      <span style={{ fontFamily: "'Playfair Display'", fontSize: 17, color: "#e8aa40", fontWeight: 700 }}>{fmtBRL(q.total)}</span>
                    </div>
                    {expandedHistory === q.id && q.pieces?.length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1a1006" }}>
                        {q.pieces.map((p, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: "#9a8a70" }}>
                              {p.ambiente ? `[${p.ambiente}] ` : ""}{p.quantidade}× {p.nome}
                            </span>
                            <span style={{ fontSize: 11, color: "#c8892a", fontFamily: "'Barlow Condensed'", fontWeight: 600 }}>{fmtBRL(calcLine(p))}</span>
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
