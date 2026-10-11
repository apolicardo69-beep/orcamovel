import { useState, useMemo } from "react";
import { jsPDF } from "jspdf";

const fmtBRL = (v) =>
  "R$ " +
  Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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

const DEFAULT_FIXED_COSTS = [
  { id: 1, label: "Aluguel do galpão/oficina", value: 0 },
  { id: 2, label: "Energia elétrica", value: 0 },
  { id: 3, label: "Água", value: 0 },
  { id: 4, label: "Pró-labore", value: 0 },
  { id: 5, label: "Funcionários (salários + encargos)", value: 0 },
  { id: 6, label: "Internet / Telefone", value: 0 },
  { id: 7, label: "Contador", value: 0 },
  { id: 8, label: "Manutenção de máquinas", value: 0 },
  { id: 9, label: "Transporte / Combustível", value: 0 },
  { id: 10, label: "Impostos mensais (DAS/ISS)", value: 0 },
];

const ITEM_UNITS = ["m²", "ml", "un", "chapa", "kg", "litro", "par", "jogo", "metro"];

export default function OrcamentoManual() {
  // Dados do cliente
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [projectDesc, setProjectDesc] = useState("");

  // Custos fixos
  const [fixedCosts, setFixedCosts] = useState(() => lsGet("om_manual_fixed_v1", DEFAULT_FIXED_COSTS));
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [newFixedLabel, setNewFixedLabel] = useState("");
  const [projectsPerMonth, setProjectsPerMonth] = useState(() => lsGet("om_manual_projects_month", 4));

  // Itens de material
  const [items, setItems] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);

  // Margem
  const [profitMargin, setProfitMargin] = useState(() => lsGet("om_manual_margin", 30));

  // Extras
  const [installationCost, setInstallationCost] = useState(0);
  const [freightCost, setFreightCost] = useState(0);
  const [extraCosts, setExtraCosts] = useState([]);
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [newExtraLabel, setNewExtraLabel] = useState("");

  // Banners
  const [savedBanner, setSavedBanner] = useState(false);
  const [showFixedPanel, setShowFixedPanel] = useState(false);

  // History
  const [manualHistory, setManualHistory] = useState(() => lsGet("om_manual_history_v1", []));
  const [showHistory, setShowHistory] = useState(false);

  // Persistência
  const saveFixedCosts = (fc) => { setFixedCosts(fc); lsSet("om_manual_fixed_v1", fc); };
  const saveMargin = (m) => { setProfitMargin(m); lsSet("om_manual_margin", m); };
  const saveProjectsMonth = (p) => { setProjectsPerMonth(p); lsSet("om_manual_projects_month", p); };
  const saveManualHistory = (h) => { setManualHistory(h); lsSet("om_manual_history_v1", h); };

  // Cálculos
  const totalFixedCosts = useMemo(() => fixedCosts.reduce((acc, c) => acc + (parseFloat(c.value) || 0), 0), [fixedCosts]);
  const fixedCostPerProject = useMemo(() => projectsPerMonth > 0 ? totalFixedCosts / projectsPerMonth : 0, [totalFixedCosts, projectsPerMonth]);

  const totalMateriais = useMemo(() => {
    return items.reduce((acc, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      return acc + qty * price;
    }, 0);
  }, [items]);

  const totalExtras = useMemo(() => {
    const inst = parseFloat(installationCost) || 0;
    const frt = parseFloat(freightCost) || 0;
    const ext = extraCosts.reduce((acc, c) => acc + (parseFloat(c.value) || 0), 0);
    return inst + frt + ext;
  }, [installationCost, freightCost, extraCosts]);

  const custoTotal = totalMateriais + fixedCostPerProject + totalExtras;
  const valorMargem = custoTotal * (profitMargin / 100);
  const precoFinal = custoTotal + valorMargem;

  // Item actions
  const addItem = () => {
    setItems(prev => [...prev, {
      _id: Date.now(),
      name: "",
      description: "",
      unit: "m²",
      quantity: 1,
      unitPrice: 0,
    }]);
  };

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(item =>
      item._id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(item => item._id !== id));
  };

  const duplicateItem = (id) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i._id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], _id: Date.now() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  // Fixed cost actions
  const updateFixed = (id, value) => {
    saveFixedCosts(fixedCosts.map(c => c.id === id ? { ...c, value: value } : c));
  };

  const addFixedCost = () => {
    if (!newFixedLabel.trim()) return;
    const newId = Math.max(0, ...fixedCosts.map(c => c.id)) + 1;
    saveFixedCosts([...fixedCosts, { id: newId, label: newFixedLabel.trim(), value: 0 }]);
    setNewFixedLabel("");
    setShowAddFixed(false);
  };

  const removeFixed = (id) => {
    saveFixedCosts(fixedCosts.filter(c => c.id !== id));
  };

  // Extra cost actions
  const addExtraCost = () => {
    if (!newExtraLabel.trim()) return;
    setExtraCosts(prev => [...prev, { id: Date.now(), label: newExtraLabel.trim(), value: 0 }]);
    setNewExtraLabel("");
    setShowAddExtra(false);
  };

  const updateExtra = (id, value) => {
    setExtraCosts(prev => prev.map(c => c.id === id ? { ...c, value } : c));
  };

  const removeExtra = (id) => {
    setExtraCosts(prev => prev.filter(c => c.id !== id));
  };

  // Save to history
  const saveQuote = () => {
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString("pt-BR"),
      clientName,
      clientPhone,
      clientAddress,
      projectDesc,
      items: [...items],
      fixedCostPerProject,
      totalMateriais,
      totalExtras,
      installationCost,
      freightCost,
      extraCosts: [...extraCosts],
      profitMargin,
      custoTotal,
      precoFinal,
    };
    saveManualHistory([entry, ...manualHistory]);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  // Load from history
  const loadFromHistory = (entry) => {
    setClientName(entry.clientName || "");
    setClientPhone(entry.clientPhone || "");
    setClientAddress(entry.clientAddress || "");
    setProjectDesc(entry.projectDesc || "");
    setItems(entry.items || []);
    setInstallationCost(entry.installationCost || 0);
    setFreightCost(entry.freightCost || 0);
    setExtraCosts(entry.extraCosts || []);
    setProfitMargin(entry.profitMargin || 30);
    setShowHistory(false);
  };

  // Reset
  const resetAll = () => {
    if (!confirm("Deseja limpar todos os campos e começar um novo orçamento?")) return;
    setClientName(""); setClientPhone(""); setClientAddress(""); setProjectDesc("");
    setItems([]); setInstallationCost(0); setFreightCost(0); setExtraCosts([]);
  };

  // Geração do PDF
  const generatePDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PW = 210;
    const mg = 14;
    const col = PW - mg * 2;
    let y = 16;
    const gold = [200, 137, 42];
    const dark = [26, 20, 14];
    const bgLight = [248, 244, 238];

    const cleanTxt = (t) => {
      if (!t) return "";
      return String(t)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    };

    const fmtVal = (v) =>
      "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, " ");

    const checkPage = (need) => {
      if (y + need > 280) {
        doc.addPage();
        y = 16;
      }
    };

    // 1. Cabeçalho
    doc.setFillColor(...gold);
    doc.rect(0, 0, PW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("OrcaMovel", mg, 11);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("MARCENARIA DE ALTO PADRAO - ORCAMENTO MANUAL", mg, 17);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`ORCAMENTO N ${String(Date.now()).slice(-6)}`, PW - mg, 11, { align: "right" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Emissao: ${new Date().toLocaleDateString("pt-BR")} - Validade: 15 dias`, PW - mg, 17, { align: "right" });
    y = 32;

    // 2. Dados do Cliente
    doc.setFillColor(...bgLight);
    doc.rect(mg, y - 4, col, 22, "F");
    doc.setDrawColor(220, 205, 185);
    doc.rect(mg, y - 4, col, 22, "S");
    doc.setTextColor(...dark);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("CLIENTE:", mg + 4, y + 2);
    doc.setFont("helvetica", "normal");
    doc.text(cleanTxt(clientName) || "Cliente", mg + 22, y + 2);
    doc.setFont("helvetica", "bold");
    doc.text("TELEFONE:", mg + 4, y + 7);
    doc.setFont("helvetica", "normal");
    doc.text(cleanTxt(clientPhone) || "-", mg + 25, y + 7);
    doc.setFont("helvetica", "bold");
    doc.text("ENDERECO:", mg + 4, y + 12);
    doc.setFont("helvetica", "normal");
    doc.text(cleanTxt(clientAddress) || "-", mg + 27, y + 12);
    y += 26;

    if (projectDesc) {
      doc.setFont("helvetica", "bold");
      doc.text("DESCRICAO:", mg + 4, y);
      doc.setFont("helvetica", "normal");
      const descLines = doc.splitTextToSize(cleanTxt(projectDesc), col - 30);
      doc.text(descLines, mg + 28, y);
      y += descLines.length * 4 + 4;
    }

    // 3. Itens de Material
    if (items.length > 0) {
      y += 4;
      checkPage(20);
      doc.setFillColor(...gold);
      doc.rect(mg, y, col, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("ITEM", mg + 2, y + 5);
      doc.text("DESCRICAO", mg + 14, y + 5);
      doc.text("UN", mg + col * 0.55, y + 5);
      doc.text("QTD", mg + col * 0.63, y + 5);
      doc.text("UNIT.", mg + col * 0.73, y + 5);
      doc.text("SUBTOTAL", mg + col - 2, y + 5, { align: "right" });
      y += 10;

      items.forEach((item, idx) => {
        checkPage(8);
        const bgRow = idx % 2 === 0 ? [255, 255, 255] : [248, 244, 238];
        doc.setFillColor(...bgRow);
        doc.rect(mg, y - 3, col, 7, "F");
        doc.setTextColor(...dark);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");

        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unitPrice) || 0;
        const sub = qty * price;

        doc.text(String(idx + 1), mg + 4, y + 1);
        doc.text(cleanTxt(item.name || "Item").substring(0, 50), mg + 14, y + 1);
        doc.text(item.unit || "un", mg + col * 0.55, y + 1);
        doc.text(String(qty), mg + col * 0.63, y + 1);
        doc.text(fmtVal(price), mg + col * 0.73, y + 1);
        doc.setFont("helvetica", "bold");
        doc.text(fmtVal(sub), mg + col - 2, y + 1, { align: "right" });
        y += 7;
      });
      y += 3;
    }

    // 4. Resumo Financeiro
    checkPage(50);
    y += 4;
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(mg, y, mg + col, y);
    y += 6;

    const addSummaryLine = (label, value, bold = false) => {
      checkPage(8);
      doc.setTextColor(...dark);
      doc.setFontSize(9);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(cleanTxt(label), mg + 4, y);
      doc.text(fmtVal(value), mg + col - 4, y, { align: "right" });
      y += 6;
    };

    addSummaryLine("Total Materiais", totalMateriais);
    addSummaryLine("Custos Fixos Rateados (por projeto)", fixedCostPerProject);
    if (parseFloat(installationCost) > 0) addSummaryLine("Instalacao/Montagem", installationCost);
    if (parseFloat(freightCost) > 0) addSummaryLine("Frete/Transporte", freightCost);
    extraCosts.forEach(ec => {
      if (parseFloat(ec.value) > 0) addSummaryLine(ec.label, ec.value);
    });

    doc.setDrawColor(200, 200, 200);
    doc.line(mg + 4, y, mg + col - 4, y);
    y += 6;

    addSummaryLine("CUSTO TOTAL", custoTotal, true);
    addSummaryLine(`Margem de Lucro (${profitMargin}%)`, valorMargem);

    y += 2;
    doc.setFillColor(...gold);
    doc.rect(mg, y - 4, col, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("VALOR FINAL", mg + 4, y + 3);
    doc.text(fmtVal(precoFinal), mg + col - 4, y + 3, { align: "right" });
    y += 14;

    // 5. Rodapé
    checkPage(18);
    doc.setFontSize(7);
    doc.setTextColor(120, 110, 100);
    doc.setFont("helvetica", "normal");
    doc.text("Orcamento gerado pelo OrcaMovel - Sistema de Orcamentos para Marcenaria", PW / 2, 288, { align: "center" });

    doc.save(`orcamento_manual_${(clientName || "cliente").replace(/\s+/g, "_")}_${Date.now()}.pdf`);
  };

  // Input style
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
  const BTN = {
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    transition: "all .2s",
  };

  return (
    <div>
      {/* Banner de sucesso */}
      {savedBanner && (
        <div style={{
          position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)",
          background: "#1e3a14", border: "1px solid #4a8a28", borderRadius: 10,
          padding: "11px 22px", color: "#8aca58", fontWeight: 600, fontSize: 14,
          zIndex: 99999, boxShadow: "0 8px 24px rgba(0,0,0,.6)",
          animation: "fadeIn .3s ease",
        }}>
          ✅ Orçamento manual salvo no histórico!
        </div>
      )}

      {/* Header do módulo */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display'", fontSize: 24, marginBottom: 4 }}>
            ✏️ Orçamento Manual
          </div>
          <div style={{ fontSize: 13, color: "#7a6040", maxWidth: 520, lineHeight: 1.5 }}>
            Monte seu orçamento manualmente. Insira seus <strong style={{ color: "#c8892a" }}>custos fixos</strong>,
            adicione os <strong style={{ color: "#c8892a" }}>itens e materiais</strong>, defina a
            <strong style={{ color: "#c8892a" }}> margem de lucro</strong> e gere um PDF profissional.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ ...BTN, background: "rgba(200,137,42,.1)", border: "1px solid rgba(200,137,42,.2)", color: "#c8892a", padding: "8px 14px" }}
          >
            📋 Histórico ({manualHistory.length})
          </button>
          <button
            onClick={resetAll}
            style={{ ...BTN, background: "rgba(180,50,50,.1)", border: "1px solid rgba(180,50,50,.2)", color: "#c06060", padding: "8px 14px" }}
          >
            🔄 Novo
          </button>
        </div>
      </div>

      {/* Histórico Dropdown */}
      {showHistory && manualHistory.length > 0 && (
        <div style={{
          background: "#110e09", border: "1px solid #1e1409", borderRadius: 12,
          padding: 14, marginBottom: 16, maxHeight: 260, overflowY: "auto"
        }}>
          <div style={{ fontSize: 13, color: "#7a6040", marginBottom: 10 }}>Clique para carregar:</div>
          {manualHistory.map(h => (
            <div
              key={h.id}
              onClick={() => loadFromHistory(h)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#18120a", border: "1px solid #2e1f0e", borderRadius: 8,
                padding: "10px 12px", marginBottom: 6, cursor: "pointer",
                transition: "border-color .2s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#c8892a"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#2e1f0e"}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f0e0c8" }}>
                  {h.clientName || "Sem cliente"} — <span style={{ color: "#7a6040", fontWeight: 400 }}>{h.projectDesc?.substring(0, 40) || "Sem descrição"}</span>
                </div>
                <div style={{ fontSize: 11, color: "#5a4430", marginTop: 2 }}>{h.date} · {h.items?.length || 0} itens</div>
              </div>
              <div style={{ fontFamily: "'Playfair Display'", fontSize: 16, color: "#e8aa40", fontWeight: 700 }}>
                {fmtBRL(h.precoFinal)}
              </div>
            </div>
          ))}
          <button
            onClick={() => { if (confirm("Limpar todo o histórico de orçamentos manuais?")) saveManualHistory([]); }}
            style={{ ...BTN, background: "rgba(180,50,50,.08)", border: "1px solid rgba(180,50,50,.15)", color: "#c06060", padding: "6px 12px", fontSize: 11, marginTop: 4 }}
          >
            🗑️ Limpar histórico
          </button>
        </div>
      )}

      {/* Grid principal */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}
           className="layout-grid">

        {/* Coluna Esquerda */}
        <div style={{ minWidth: 0 }}>

          {/* Dados do cliente */}
          <div style={{
            background: "#110e09", border: "1px solid #1e1409", borderRadius: 12,
            padding: 16, marginBottom: 16
          }}>
            <div style={{ fontFamily: "'Playfair Display'", fontSize: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              👤 Dados do Cliente
            </div>
            <div className="client-inputs-grid">
              <div>
                <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 3 }}>Nome do cliente</label>
                <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome completo" style={IS} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 3 }}>Telefone</label>
                <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(00) 00000-0000" style={IS} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 3 }}>Endereço da obra</label>
                <input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Rua, nº, bairro" style={IS} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 3 }}>Descrição do projeto</label>
                <input value={projectDesc} onChange={e => setProjectDesc(e.target.value)} placeholder="Ex: Cozinha completa + closet" style={IS} />
              </div>
            </div>
          </div>

          {/* Custos Fixos Mensais */}
          <div style={{
            background: "#110e09", border: "1px solid #1e1409", borderRadius: 12,
            padding: 16, marginBottom: 16
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontFamily: "'Playfair Display'", fontSize: 16 }}>🏭 Custos Fixos Mensais</div>
                <span style={{
                  background: "rgba(200,137,42,.1)", border: "1px solid rgba(200,137,42,.2)",
                  borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#c8892a"
                }}>
                  {fmtBRL(totalFixedCosts)}/mês
                </span>
              </div>
              <button
                onClick={() => setShowFixedPanel(!showFixedPanel)}
                style={{ ...BTN, background: showFixedPanel ? "#c8892a" : "rgba(200,137,42,.1)", color: showFixedPanel ? "#0d0a07" : "#c8892a", padding: "6px 14px", border: showFixedPanel ? "none" : "1px solid rgba(200,137,42,.2)" }}
              >
                {showFixedPanel ? "✓ Ocultar" : "⚙️ Configurar"}
              </button>
            </div>

            {showFixedPanel && (
              <div style={{ animation: "fadeIn .3s ease" }}>
                <div style={{
                  background: "#18120a", border: "1px solid #2e1f0e", borderRadius: 10,
                  padding: 14, marginBottom: 12
                }}>
                  <div style={{ fontSize: 11, color: "#7a6040", marginBottom: 10 }}>
                    Preencha seus custos fixos mensais. Eles serão <strong style={{ color: "#c8892a" }}>rateados</strong> entre os projetos do mês.
                  </div>
                  {fixedCosts.map(cost => (
                    <div key={cost.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#d0c0a0", flex: 1, minWidth: 0 }}>{cost.label}</span>
                      <div style={{ position: "relative", width: 130 }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#7a6040", pointerEvents: "none" }}>R$</span>
                        <input
                          type="number"
                          value={cost.value || ""}
                          onChange={e => updateFixed(cost.id, e.target.value)}
                          placeholder="0,00"
                          style={{ ...NS, paddingLeft: 28, width: "100%", fontSize: 13 }}
                        />
                      </div>
                      <button
                        onClick={() => removeFixed(cost.id)}
                        style={{ background: "none", border: "none", color: "#804040", cursor: "pointer", fontSize: 14, padding: 4 }}
                        title="Remover"
                      >✕</button>
                    </div>
                  ))}

                  {/* Add new fixed cost */}
                  {showAddFixed ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <input
                        value={newFixedLabel}
                        onChange={e => setNewFixedLabel(e.target.value)}
                        placeholder="Nome do custo..."
                        style={{ ...IS, fontSize: 12, flex: 1 }}
                        onKeyDown={e => e.key === "Enter" && addFixedCost()}
                        autoFocus
                      />
                      <button onClick={addFixedCost} style={{ ...BTN, background: "#c8892a", color: "#0d0a07", padding: "6px 12px" }}>Adicionar</button>
                      <button onClick={() => { setShowAddFixed(false); setNewFixedLabel(""); }} style={{ ...BTN, background: "rgba(180,50,50,.1)", color: "#c06060", padding: "6px 10px" }}>✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddFixed(true)}
                      style={{ ...BTN, background: "rgba(200,137,42,.06)", border: "1px dashed rgba(200,137,42,.2)", color: "#c8892a", padding: "8px 14px", width: "100%", marginTop: 6 }}
                    >
                      + Adicionar custo fixo
                    </button>
                  )}
                </div>

                {/* Projetos por mês */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#18120a", border: "1px solid #2e1f0e", borderRadius: 10, padding: "10px 14px" }}>
                  <span style={{ fontSize: 12, color: "#d0c0a0", flex: 1 }}>Quantos projetos você faz por mês?</span>
                  <input
                    type="number"
                    min="1"
                    value={projectsPerMonth}
                    onChange={e => saveProjectsMonth(parseInt(e.target.value) || 1)}
                    style={{ ...NS, width: 70, textAlign: "center" }}
                  />
                </div>

                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "rgba(200,137,42,.06)", border: "1px solid rgba(200,137,42,.15)",
                  borderRadius: 8, padding: "10px 14px", marginTop: 10
                }}>
                  <span style={{ fontSize: 12, color: "#a08040" }}>
                    💡 Custo fixo rateado por projeto:
                  </span>
                  <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 16, color: "#e8aa40", fontWeight: 700 }}>
                    {fmtBRL(fixedCostPerProject)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Itens e Materiais */}
          <div style={{
            background: "#110e09", border: "1px solid #1e1409", borderRadius: 12,
            padding: 16, marginBottom: 16
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Playfair Display'", fontSize: 16 }}>📦 Itens e Materiais</div>
              <button
                onClick={addItem}
                style={{ ...BTN, background: "linear-gradient(135deg,#c8892a,#e8aa40)", color: "#0d0a07", padding: "8px 16px", fontSize: 14 }}
              >
                + Adicionar Item
              </button>
            </div>

            {items.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "40px 16px", color: "#4a3520",
                fontFamily: "'Playfair Display'", fontSize: 14,
                background: "rgba(200,137,42,.03)", border: "1px dashed rgba(200,137,42,.12)",
                borderRadius: 10
              }}>
                Nenhum item adicionado. Clique em <strong style={{ color: "#c8892a" }}>+ Adicionar Item</strong> para começar.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item, idx) => {
                  const sub = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
                  return (
                    <div
                      key={item._id}
                      style={{
                        background: "#18120a", border: "1px solid #2e1f0e", borderRadius: 10,
                        padding: 14, transition: "border-color .2s",
                      }}
                    >
                      {/* Header do item */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            background: "rgba(200,137,42,.15)", borderRadius: 6, width: 28, height: 28,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: 13, color: "#c8892a"
                          }}>
                            {idx + 1}
                          </span>
                          <input
                            value={item.name}
                            onChange={e => updateItem(item._id, "name", e.target.value)}
                            placeholder="Nome do item/material"
                            style={{ ...IS, border: "none", background: "transparent", fontSize: 14, fontWeight: 600, padding: "4px 0" }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => duplicateItem(item._id)}
                            title="Duplicar"
                            style={{ background: "none", border: "none", color: "#7a6040", cursor: "pointer", fontSize: 14, padding: 4 }}
                          >📋</button>
                          <button
                            onClick={() => removeItem(item._id)}
                            title="Remover"
                            style={{ background: "none", border: "none", color: "#804040", cursor: "pointer", fontSize: 14, padding: 4 }}
                          >🗑️</button>
                        </div>
                      </div>

                      {/* Campos do item */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 100px 120px", gap: 8, alignItems: "end" }}>
                        <div>
                          <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 3 }}>Descrição / Observação</label>
                          <input
                            value={item.description || ""}
                            onChange={e => updateItem(item._id, "description", e.target.value)}
                            placeholder="Detalhes opcionais..."
                            style={{ ...IS, fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 3 }}>Unidade</label>
                          <select
                            value={item.unit}
                            onChange={e => updateItem(item._id, "unit", e.target.value)}
                            style={{ ...IS, fontSize: 12 }}
                          >
                            {ITEM_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 3 }}>Quantidade</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={e => updateItem(item._id, "quantity", e.target.value)}
                            style={{ ...NS, fontSize: 14, textAlign: "center" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 3 }}>Valor unitário</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={e => updateItem(item._id, "unitPrice", e.target.value)}
                            style={{ ...NS, fontSize: 14, textAlign: "right" }}
                          />
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div style={{
                        display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8,
                        marginTop: 10, paddingTop: 8, borderTop: "1px solid #2e1f0e"
                      }}>
                        <span style={{ fontSize: 11, color: "#7a6040" }}>Subtotal:</span>
                        <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 16, color: "#e8aa40", fontWeight: 700 }}>
                          {fmtBRL(sub)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Botão adicionar mais */}
                <button
                  onClick={addItem}
                  style={{
                    ...BTN, background: "rgba(200,137,42,.04)", border: "1px dashed rgba(200,137,42,.15)",
                    color: "#c8892a", padding: "12px", fontSize: 13, width: "100%"
                  }}
                >
                  + Adicionar mais um item
                </button>
              </div>
            )}
          </div>

          {/* Custos Extras */}
          <div style={{
            background: "#110e09", border: "1px solid #1e1409", borderRadius: 12,
            padding: 16, marginBottom: 16
          }}>
            <div style={{ fontFamily: "'Playfair Display'", fontSize: 16, marginBottom: 12 }}>🚚 Custos Extras do Projeto</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 3 }}>Instalação / Montagem</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={installationCost || ""}
                  onChange={e => setInstallationCost(e.target.value)}
                  placeholder="0,00"
                  style={NS}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9, color: "#7a6040", textTransform: "uppercase", marginBottom: 3 }}>Frete / Transporte</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={freightCost || ""}
                  onChange={e => setFreightCost(e.target.value)}
                  placeholder="0,00"
                  style={NS}
                />
              </div>
            </div>

            {/* Extra costs list */}
            {extraCosts.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {extraCosts.map(ec => (
                  <div key={ec.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "#d0c0a0", flex: 1 }}>{ec.label}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ec.value || ""}
                      onChange={e => updateExtra(ec.id, e.target.value)}
                      placeholder="0,00"
                      style={{ ...NS, width: 130 }}
                    />
                    <button
                      onClick={() => removeExtra(ec.id)}
                      style={{ background: "none", border: "none", color: "#804040", cursor: "pointer", fontSize: 14, padding: 4 }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {showAddExtra ? (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <input
                  value={newExtraLabel}
                  onChange={e => setNewExtraLabel(e.target.value)}
                  placeholder="Nome do custo extra..."
                  style={{ ...IS, fontSize: 12, flex: 1 }}
                  onKeyDown={e => e.key === "Enter" && addExtraCost()}
                  autoFocus
                />
                <button onClick={addExtraCost} style={{ ...BTN, background: "#c8892a", color: "#0d0a07", padding: "6px 12px" }}>Adicionar</button>
                <button onClick={() => { setShowAddExtra(false); setNewExtraLabel(""); }} style={{ ...BTN, background: "rgba(180,50,50,.1)", color: "#c06060", padding: "6px 10px" }}>✕</button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddExtra(true)}
                style={{ ...BTN, background: "rgba(200,137,42,.04)", border: "1px dashed rgba(200,137,42,.12)", color: "#c8892a", padding: "8px 14px", width: "100%", marginTop: 10 }}
              >
                + Adicionar custo extra
              </button>
            )}
          </div>
        </div>

        {/* Coluna Direita: Resumo */}
        <div>
          <div style={{
            background: "#110e09", border: "1px solid #1e1409", borderRadius: 14,
            padding: 18, position: "sticky", top: 100
          }}>
            <div style={{ fontFamily: "'Playfair Display'", fontSize: 20, marginBottom: 16 }}>
              💰 Resumo Financeiro
            </div>

            {/* Composição do custo */}
            <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #22160a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#7a6040" }}>📦 Materiais ({items.length} itens)</span>
                <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, color: "#c0b090", fontWeight: 600 }}>{fmtBRL(totalMateriais)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#7a6040" }}>🏭 Custos fixos rateados</span>
                <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, color: "#c0b090", fontWeight: 600 }}>{fmtBRL(fixedCostPerProject)}</span>
              </div>
              {totalExtras > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#7a6040" }}>🚚 Custos extras</span>
                  <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, color: "#c0b090", fontWeight: 600 }}>{fmtBRL(totalExtras)}</span>
                </div>
              )}
            </div>

            {/* Custo total */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#d0c0a0", fontWeight: 600 }}>Custo Total</span>
              <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 16, color: "#e0c090", fontWeight: 700 }}>{fmtBRL(custoTotal)}</span>
            </div>

            {/* Margem de lucro */}
            <div style={{
              background: "#18120a", border: "1px solid #2e1f0e", borderRadius: 10,
              padding: 12, marginBottom: 14
            }}>
              <label style={{ display: "block", fontSize: 10, color: "#7a6040", textTransform: "uppercase", marginBottom: 6 }}>
                📈 Margem de Lucro
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="1"
                  value={profitMargin}
                  onChange={e => saveMargin(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: "#c8892a" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 2, width: 80 }}>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={profitMargin}
                    onChange={e => saveMargin(parseFloat(e.target.value) || 0)}
                    style={{ ...NS, width: 60, textAlign: "center", fontSize: 16, padding: "6px 4px" }}
                  />
                  <span style={{ fontSize: 16, color: "#c8892a", fontWeight: 700 }}>%</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "#6a5038" }}>Valor da margem:</span>
                <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 13, color: "#c8892a", fontWeight: 600 }}>{fmtBRL(valorMargem)}</span>
              </div>
            </div>

            {/* Preço Final */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "rgba(200,137,42,.09)", border: "1px solid rgba(200,137,42,.22)",
              borderRadius: 10, padding: "14px 16px", marginBottom: 14
            }}>
              <span style={{ fontFamily: "'Playfair Display'", fontSize: 18 }}>Preço Final</span>
              <span style={{ fontFamily: "'Playfair Display'", fontSize: 26, color: "#e8aa40", fontWeight: 700 }}>
                {fmtBRL(precoFinal)}
              </span>
            </div>

            {/* Custo por m² informativo */}
            {totalMateriais > 0 && items.some(i => i.unit === "m²") && (() => {
              const totalM2 = items.filter(i => i.unit === "m²").reduce((acc, i) => acc + (parseFloat(i.quantity) || 0), 0);
              if (totalM2 <= 0) return null;
              return (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "rgba(90,150,200,.05)", border: "1px solid rgba(90,150,200,.12)",
                  borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12
                }}>
                  <span style={{ color: "#7a9ab0" }}>Preço final / m²:</span>
                  <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, color: "#8ab8d8", fontWeight: 600 }}>
                    {fmtBRL(precoFinal / totalM2)}/m²
                  </span>
                </div>
              );
            })()}

            {/* Ações */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={saveQuote}
                disabled={items.length === 0}
                style={{
                  ...BTN, width: "100%", padding: "12px",
                  background: items.length === 0 ? "#2a2218" : "linear-gradient(135deg,#c8892a,#e8aa40)",
                  color: items.length === 0 ? "#5a4a38" : "#0d0a07",
                  fontSize: 15, cursor: items.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                💾 Salvar Orçamento
              </button>
              <button
                onClick={generatePDF}
                disabled={items.length === 0}
                style={{
                  ...BTN, width: "100%", padding: "12px",
                  background: items.length === 0 ? "transparent" : "rgba(200,137,42,.08)",
                  border: `1px solid ${items.length === 0 ? "#2a2218" : "rgba(200,137,42,.25)"}`,
                  color: items.length === 0 ? "#5a4a38" : "#c8892a",
                  fontSize: 15, cursor: items.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                📄 Gerar PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
