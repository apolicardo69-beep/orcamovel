import { useState, useMemo } from "react";
import ChapaViewer from "./ChapaViewer";
import {
  CONFIG_PADRAO_CORTE,
  normalizarPecasParaCorte,
  otimizarCorte,
} from "../engine/otimizador";
import {
  DEFAULT_METODOS_CONSTRUTIVOS,
  explodirPecasConstrutivas,
  BANCO_TRILHOS_CORRER,
  BANCO_CORREDICAS,
} from "../engine/metodosConstrutivos";

const fmtBRL = (v) =>
  "R$ " +
  Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Pequeno formulário inline para o marceneiro inserir manualmente os painéis
// de uma peça cujo método construtivo não pôde ser detectado automaticamente.
function ManualPanelForm({ onAdd }) {
  const [f, setF] = useState({ nome: "", largura: "", altura: "", quantidade: 1 });
  const set = (field, val) => setF((p) => ({ ...p, [field]: val }));
  const submit = () => {
    if (!f.nome || !(parseFloat(f.largura) > 0) || !(parseFloat(f.altura) > 0)) return;
    onAdd({ nome: f.nome, largura: parseFloat(f.largura), altura: parseFloat(f.altura), quantidade: parseFloat(f.quantidade) || 1 });
    setF({ nome: "", largura: "", altura: "", quantidade: 1 });
  };
  const IS2 = { background: "#1c1510", border: "1px solid #332618", borderRadius: 6, color: "#f0e0c8", padding: "6px 8px", fontFamily: "'Barlow', sans-serif", fontSize: 12, outline: "none", width: "100%" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr 0.8fr 0.6fr auto", gap: 6, marginTop: 8, alignItems: "end" }}>
      <div>
        <span style={{ fontSize: 9, color: "#7a6040", textTransform: "uppercase" }}>Painel</span>
        <input value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Lateral esquerda" style={IS2} />
      </div>
      <div>
        <span style={{ fontSize: 9, color: "#7a6040", textTransform: "uppercase" }}>Larg (m)</span>
        <input type="number" step="0.01" value={f.largura} onChange={(e) => set("largura", e.target.value)} style={IS2} />
      </div>
      <div>
        <span style={{ fontSize: 9, color: "#7a6040", textTransform: "uppercase" }}>Alt (m)</span>
        <input type="number" step="0.01" value={f.altura} onChange={(e) => set("altura", e.target.value)} style={IS2} />
      </div>
      <div>
        <span style={{ fontSize: 9, color: "#7a6040", textTransform: "uppercase" }}>Qtd</span>
        <input type="number" min={1} value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} style={IS2} />
      </div>
      <button onClick={submit} style={{ background: "linear-gradient(135deg,#c8892a,#e8aa40)", border: "none", borderRadius: 6, color: "#0d0a07", padding: "7px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
        + Add
      </button>
    </div>
  );
}

export default function PlanoCorteView({ pieces, clientName, ambientDesc, onGoToQuote }) {
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("om_corte_config_v1");
      return saved ? JSON.parse(saved) : CONFIG_PADRAO_CORTE;
    } catch {
      return CONFIG_PADRAO_CORTE;
    }
  });

  const [metodosConfig, setMetodosConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("om_metodos_construtivos_v1");
      const parsed = saved ? JSON.parse(saved) : {};
      return { ...DEFAULT_METODOS_CONSTRUTIVOS, ...parsed };
    } catch {
      return DEFAULT_METODOS_CONSTRUTIVOS;
    }
  });

  const [manualPanels, setManualPanels] = useState(() => {
    try {
      const saved = localStorage.getItem("om_corte_manual_v1");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [selectedChapaIndex, setSelectedChapaIndex] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [showMetodos, setShowMetodos] = useState(false);

  const updateConfig = (field, val) => {
    const updated = { ...config, [field]: val };
    setConfig(updated);
    try {
      localStorage.setItem("om_corte_config_v1", JSON.stringify(updated));
    } catch {}
  };

  const updateMetodo = (categoria, field, val) => {
    const updated = { ...metodosConfig, [categoria]: { ...metodosConfig[categoria], [field]: val } };
    setMetodosConfig(updated);
    try {
      localStorage.setItem("om_metodos_construtivos_v1", JSON.stringify(updated));
    } catch {}
  };

  const persistManualPanels = (mp) => {
    setManualPanels(mp);
    try {
      localStorage.setItem("om_corte_manual_v1", JSON.stringify(mp));
    } catch {}
  };
  const addManualPanel = (pecaId, panel) => {
    const list = manualPanels[pecaId] || [];
    persistManualPanels({ ...manualPanels, [pecaId]: [...list, { ...panel, _mid: `${pecaId}_${list.length}_${panel.nome}` }] });
  };
  const removeManualPanel = (pecaId, mid) => {
    const list = (manualPanels[pecaId] || []).filter((p) => p._mid !== mid);
    persistManualPanels({ ...manualPanels, [pecaId]: list });
  };

  // Decompõe cada peça do orçamento nos painéis físicos reais de corte
  // (método construtivo por categoria) — em vez de tratar a linha do
  // orçamento (ex.: "corpo do armário m²") como se já fosse um retângulo.
  // A medida útil da chapa entra na decomposição para que painéis maiores que
  // a chapa sejam divididos em partes emendadas em vez de sumirem do plano.
  const chapaUtil = useMemo(() => ({
    util_largura_m: Math.max(0.1, ((config.chapa_largura_mm || 2750) - 2 * (config.margem_borda_mm || 0)) / 1000),
    util_altura_m: Math.max(0.1, ((config.chapa_altura_mm || 1830) - 2 * (config.margem_borda_mm || 0)) / 1000),
  }), [config.chapa_largura_mm, config.chapa_altura_mm, config.margem_borda_mm]);

  const explodir = useMemo(() => explodirPecasConstrutivas(pieces || [], metodosConfig, chapaUtil), [pieces, metodosConfig, chapaUtil]);

  // Painéis inseridos manualmente para peças cujo método construtivo não foi detectado.
  const paineisManuaisResolvidos = useMemo(() => {
    const out = [];
    explodir.manuais.forEach((m) => {
      (manualPanels[m.pecaId] || []).forEach((mp) => {
        const l = parseFloat(mp.largura) || 0;
        const a = parseFloat(mp.altura) || 0;
        if (l > 0 && a > 0) {
          out.push({
            id: `manual_${m.pecaId}_${mp._mid}`,
            _id: `manual_${m.pecaId}_${mp._mid}`,
            nome: mp.nome || m.nome,
            tipo: "m²",
            largura: l,
            altura: a,
            quantidade: parseFloat(mp.quantidade) || 1,
            unidade: "m",
          });
        }
      });
    });
    return out;
  }, [explodir.manuais, manualPanels]);

  // Peças manuais ainda SEM nenhum painel inserido (precisam de atenção do marceneiro).
  const manuaisPendentes = explodir.manuais.filter((m) => !(manualPanels[m.pecaId] || []).length);

  // Normaliza os painéis (automáticos + manuais resolvidos) para o formato do plano de corte
  const pecasCorte = useMemo(() => {
    return normalizarPecasParaCorte([...explodir.paraCorte, ...paineisManuaisResolvidos]);
  }, [explodir.paraCorte, paineisManuaisResolvidos]);

  const pecasInvalidas = pecasCorte.invalidas || [];

  // O motor de corte só roda quando todas as peças possuem unidade explícita e dimensões válidas.
  const resultado = useMemo(() => {
    if (pecasInvalidas.length > 0 || pecasCorte.length === 0) return null;
    return otimizarCorte(pecasCorte, config);
  }, [pecasCorte, pecasInvalidas.length, config]);

  const chapaAtual = resultado?.chapas?.[selectedChapaIndex] || resultado?.chapas?.[0];

  const IS = {
    background: "#1c1510",
    border: "1px solid #332618",
    borderRadius: 8,
    color: "#f0e0c8",
    padding: "8px 10px",
    fontFamily: "'Barlow', sans-serif",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  const NS = {
    ...IS,
    color: "#d4952e",
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
  };

  return (
    <div>
      {/* Header do Plano de Corte com Botões de Ação */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontFamily: "'Playfair Display'", fontSize: 24, fontWeight: 700 }}>
            🪚 Plano de Corte Otimizado
          </div>
          <div style={{ fontSize: 13, color: "#8a6a40", marginTop: 2 }}>
            {clientName ? `Cliente: ${clientName}` : "Projeto"} {ambientDesc ? `· ${ambientDesc}` : ""} · Algoritmo Guillotine 2D para Seccionadora
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowConfig((v) => !v)}
            style={{
              background: showConfig ? "rgba(200,137,42,.2)" : "#1c1510",
              border: `1px solid ${showConfig ? "#c8892a" : "#3a2618"}`,
              borderRadius: 8,
              color: "#c8892a",
              padding: "8px 14px",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ⚙️ Ajustar Chapa / Serra
          </button>

          {pecasCorte.length === 0 && (
            <button
              onClick={onGoToQuote}
              style={{
                background: "linear-gradient(135deg,#c8892a,#e8aa40)",
                border: "none",
                borderRadius: 8,
                color: "#0d0a07",
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📐 Adicionar Peças no Orçamento
            </button>
          )}
        </div>
      </div>

      {/* Painel de Configurações da Chapa e Serra */}
      {showConfig && (
        <div
          style={{
            background: "#18120a",
            border: "1px solid #c8892a",
            borderRadius: 12,
            padding: "16px 18px",
            marginBottom: 18,
          }}
        >
          <div style={{ fontFamily: "'Playfair Display'", fontSize: 16, color: "#c8892a", marginBottom: 12 }}>
            Configuração da Chapa e Corte
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>
                Largura da Chapa (mm)
              </label>
              <input
                type="number"
                value={config.chapa_largura_mm}
                onChange={(e) => updateConfig("chapa_largura_mm", Number(e.target.value))}
                style={NS}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>
                Altura da Chapa (mm)
              </label>
              <input
                type="number"
                value={config.chapa_altura_mm}
                onChange={(e) => updateConfig("chapa_altura_mm", Number(e.target.value))}
                style={NS}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>
                Espessura da Serra / Kerf (mm)
              </label>
              <input
                type="number"
                value={config.kerf_mm}
                onChange={(e) => updateConfig("kerf_mm", Number(e.target.value))}
                min={0}
                max={10}
                style={NS}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>
                Refilo das Bordas (mm)
              </label>
              <input
                type="number"
                value={config.margem_borda_mm}
                onChange={(e) => updateConfig("margem_borda_mm", Number(e.target.value))}
                min={0}
                max={30}
                style={NS}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>
                Preço por Chapa MDF (R$)
              </label>
              <input
                type="number"
                value={config.preco_chapa || ""}
                placeholder="Ex: 280.00"
                onChange={(e) => updateConfig("preco_chapa", parseFloat(e.target.value) || 0)}
                style={NS}
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, paddingTop: 10, borderTop: "1px solid #2a1c0e" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#c0b090", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={config.permitir_rotacao}
                onChange={(e) => updateConfig("permitir_rotacao", e.target.checked)}
                style={{ accentColor: "#c8892a", width: 16, height: 16 }}
              />
              Permitir rotação de peças (otimiza aproveitamento)
            </label>
          </div>

          {/* Métodos Construtivos por Categoria */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #2a1c0e" }}>
            <button
              onClick={() => setShowMetodos((v) => !v)}
              style={{ background: "none", border: "none", color: "#c8892a", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", gap: 6 }}
            >
              {showMetodos ? "▾" : "▸"} 🧩 Métodos Construtivos por Categoria (avançado)
            </button>
            <div style={{ fontSize: 11, color: "#6a5038", marginTop: 4, lineHeight: 1.5, maxWidth: 640 }}>
              Define como cada categoria do orçamento é decomposta em painéis físicos de corte. <strong style={{ color: "#c8892a" }}>A largura máxima do módulo é o ajuste mais importante:</strong> um armário de 3,63 m não é uma caixa única — ele vira vários módulos lado a lado, cada um com tampo, base, fundo e prateleiras próprios, e uma lateral entre cada dois. A quantidade de prateleiras acompanha a altura pelo passo configurado, e onde entra gaveteiro a prateleira é descontada (gaveta e prateleira ocupam o mesmo espaço). Portas e frentes de gaveta entram na lista de corte, mas não mexem no preço — o orçamento continua pelo m² do corpo. O sistema também lê o nome/observação de cada peça: "cabideiro duplo" e "maleiro" somam uma prateleira; "vão inferior" remove a base; "gaveta(s)" gera as caixas; "porta de correr"/"deslizante" troca o tipo de porta. Os valores de trilho/corrediça são ponto de partida — confira com a ficha técnica do kit que você usa.
            </div>
            {showMetodos && (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {Object.keys(metodosConfig).map((cat) => {
                  const m = metodosConfig[cat];
                  return (
                    <div key={cat} style={{ background: "#150f08", border: "1px solid #2a1c0e", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e0d0b0", marginBottom: 8 }}>{cat}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Espessura (mm)</label>
                          <input type="number" value={m.espessura_mm || ""} onChange={(e) => updateMetodo(cat, "espessura_mm", Number(e.target.value))} style={NS} />
                        </div>
                        {(m.estrategia === "corpo" || m.estrategia === "prateleira_linear") && (
                          <div>
                            <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Profundidade padrão (m)</label>
                            <input type="number" step="0.01" value={m.profundidade_padrao_m || ""} onChange={(e) => updateMetodo(cat, "profundidade_padrao_m", Number(e.target.value))} style={NS} />
                          </div>
                        )}
                        {m.estrategia === "painel_simples" && (
                          <>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Largura da ripa (m)</label>
                              <input type="number" step="0.01" value={m.ripa_largura_m ?? 0.05} onChange={(e) => updateMetodo(cat, "ripa_largura_m", Number(e.target.value))} style={NS} title="Usada em painel ripado / com frisos" />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Espaçamento da ripa (m)</label>
                              <input type="number" step="0.01" value={m.ripa_espacamento_m ?? 0.02} onChange={(e) => updateMetodo(cat, "ripa_espacamento_m", Number(e.target.value))} style={NS} />
                            </div>
                          </>
                        )}
                        {m.estrategia === "corpo" && (
                          <>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#c8892a", textTransform: "uppercase", marginBottom: 3 }}>Largura máx. do módulo (m)</label>
                              <input type="number" step="0.05" value={m.modulo_largura_max_m ?? 0.9} onChange={(e) => updateMetodo(cat, "modulo_largura_max_m", Number(e.target.value))} style={NS} title="Um móvel mais largo que isso é dividido em vários módulos, cada um com suas laterais, tampo, base, fundo e prateleiras" />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Prateleiras mínimas</label>
                              <input type="number" min={0} value={m.prateleiras_qtd ?? 0} onChange={(e) => updateMetodo(cat, "prateleiras_qtd", Number(e.target.value))} style={NS} title="Mínimo por módulo. Se a altura pedir mais, o passo abaixo manda." />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Passo entre prateleiras (m)</label>
                              <input type="number" step="0.05" value={m.prateleira_passo_m ?? 0.45} onChange={(e) => updateMetodo(cat, "prateleira_passo_m", Number(e.target.value))} style={NS} title="Espaço vertical entre prateleiras — define quantas cabem na altura do módulo" />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Altura padrão p/ item em ml (m)</label>
                              <input type="number" step="0.05" value={m.altura_padrao_m ?? 0.85} onChange={(e) => updateMetodo(cat, "altura_padrao_m", Number(e.target.value))} style={NS} title="Usada quando o item é cobrado por metro linear e o projeto não traz a altura" />
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-end" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#c0b090", cursor: "pointer" }}>
                                <input type="checkbox" checked={m.gerar_portas !== false} onChange={(e) => updateMetodo(cat, "gerar_portas", e.target.checked)} style={{ accentColor: "#c8892a" }} />
                                Cortar portas
                              </label>
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Fundo (espessura mm)</label>
                              <input type="number" value={m.fundo_espessura_mm || ""} disabled={!m.tem_fundo} onChange={(e) => updateMetodo(cat, "fundo_espessura_mm", Number(e.target.value))} style={{ ...NS, opacity: m.tem_fundo ? 1 : 0.4 }} />
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-end" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#c0b090", cursor: "pointer" }}>
                                <input type="checkbox" checked={!!m.tem_fundo} onChange={(e) => updateMetodo(cat, "tem_fundo", e.target.checked)} style={{ accentColor: "#c8892a" }} />
                                Tem fundo
                              </label>
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Tipo de fundo</label>
                              <select value={m.fundo_tipo || "encaixado"} disabled={!m.tem_fundo} onChange={(e) => updateMetodo(cat, "fundo_tipo", e.target.value)} style={{ ...IS, fontSize: 12, padding: "6px 8px", opacity: m.tem_fundo ? 1 : 0.4 }}>
                                <option value="encaixado">Encaixado</option>
                                <option value="rasgado">Rasgado (ranhura)</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Rodapé (mm)</label>
                              <input type="number" min={0} value={m.rodape_mm ?? 0} disabled={!m.tem_rodape} onChange={(e) => updateMetodo(cat, "rodape_mm", Number(e.target.value))} style={{ ...NS, opacity: m.tem_rodape ? 1 : 0.4 }} />
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-end" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#c0b090", cursor: "pointer" }}>
                                <input type="checkbox" checked={!!m.tem_rodape} onChange={(e) => updateMetodo(cat, "tem_rodape", e.target.checked)} style={{ accentColor: "#c8892a" }} />
                                Tem rodapé
                              </label>
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Gavetas (qtd padrão)</label>
                              <input type="number" min={0} value={m.gaveta_qtd_padrao ?? 0} onChange={(e) => updateMetodo(cat, "gaveta_qtd_padrao", Number(e.target.value))} style={NS} title="Usado quando a peça menciona 'gaveta(s)' sem dizer quantas" />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Altura da gaveta (m)</label>
                              <input type="number" step="0.01" value={m.gaveta_altura_padrao_m ?? ""} onChange={(e) => updateMetodo(cat, "gaveta_altura_padrao_m", Number(e.target.value))} style={NS} />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Corrediça da gaveta</label>
                              <select value={m.corredica_tipo || "telescopica"} onChange={(e) => updateMetodo(cat, "corredica_tipo", e.target.value)} style={{ ...IS, fontSize: 12, padding: "6px 8px" }}>
                                {Object.entries(BANCO_CORREDICAS).map(([k, v]) => (
                                  <option key={k} value={k}>{v.nome} (−{v.desconto_largura_mm}mm)</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ gridColumn: "1 / -1", marginTop: 4, paddingTop: 8, borderTop: "1px dashed #2a1c0e" }}>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Tipo de porta padrão da categoria</label>
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Tipo de porta</label>
                              <select value={m.tipo_porta || "giro"} onChange={(e) => updateMetodo(cat, "tipo_porta", e.target.value)} style={{ ...IS, fontSize: 12, padding: "6px 8px" }}>
                                <option value="giro">Giro (dobradiça)</option>
                                <option value="correr">Correr (trilho)</option>
                                <option value="nenhuma">Nenhuma (aberto/vitrine)</option>
                              </select>
                            </div>
                            {m.tipo_porta !== "correr" && (
                              <div>
                                <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Larg. máx. por porta (m)</label>
                                <input type="number" step="0.01" value={m.largura_max_porta_m ?? ""} onChange={(e) => updateMetodo(cat, "largura_max_porta_m", Number(e.target.value))} style={NS} title="Usado para estimar quantas portas o módulo tem (se o texto não disser)" />
                              </div>
                            )}
                            {m.tipo_porta === "correr" && (
                              <div>
                                <label style={{ display: "block", fontSize: 9, color: "#8a6a40", textTransform: "uppercase", marginBottom: 3 }}>Sistema de trilho</label>
                                <select value={m.trilho_sistema || "embutido"} onChange={(e) => updateMetodo(cat, "trilho_sistema", e.target.value)} style={{ ...IS, fontSize: 12, padding: "6px 8px" }}>
                                  {Object.entries(BANCO_TRILHOS_CORRER).map(([k, v]) => (
                                    <option key={k} value={k}>{v.nome}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Avisos e itens fora do plano automático */}
      {(explodir.avisos.length > 0 || explodir.excluidos.length > 0) && (
        <div style={{ marginBottom: 16, display: "grid", gap: 10 }}>
          {explodir.avisos.length > 0 && (
            <div style={{ background: "#1a1500", border: "1px solid #c8892a", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#e8aa40", marginBottom: 6 }}>ℹ️ Observações da decomposição automática</div>
              {explodir.avisos.map((a, i) => (
                <div key={i} style={{ fontSize: 11, color: "#a08040", marginBottom: 2 }}>
                  <strong style={{ color: "#c8892a" }}>{a.nome}:</strong> {a.aviso}
                </div>
              ))}
            </div>
          )}
          {explodir.excluidos.length > 0 && (
            <div style={{ background: "#150d0d", border: "1px solid #4a2020", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#c07070", marginBottom: 6 }}>🚫 Fora do plano de corte em madeira ({explodir.excluidos.length})</div>
              {explodir.excluidos.map((e, i) => (
                <div key={i} style={{ fontSize: 11, color: "#a08080", marginBottom: 2 }}>
                  <strong style={{ color: "#c09090" }}>{e.nome}:</strong> {e.motivo}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Painéis maiores que a chapa, divididos em partes emendadas */}
      {explodir.emendas.length > 0 && (
        <div style={{ background: "#151005", border: "1px solid #4a3a10", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e8aa40", marginBottom: 4 }}>
            🧩 Painéis emendados ({explodir.emendas.length}) — maiores que a chapa
          </div>
          <div style={{ fontSize: 11, color: "#a08040", marginBottom: 10, lineHeight: 1.5 }}>
            Estes painéis não cabem inteiros numa chapa de {config.chapa_largura_mm}×{config.chapa_altura_mm}mm, então foram divididos nas partes abaixo. Confira onde a emenda vai cair antes de cortar — em painel aparente a posição da emenda importa.
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {explodir.emendas.map((e, i) => (
              <div key={i} style={{ fontSize: 12, color: "#c0b090" }}>
                <strong style={{ color: "#e0d0b0" }}>{e.nome}</strong>{" "}
                {e.original_largura_m.toFixed(2)}×{e.original_altura_m.toFixed(2)}m →{" "}
                <strong style={{ color: "#e8aa40" }}>{e.partes} partes</strong> de {e.parte_largura_m.toFixed(2)}×{e.parte_altura_m.toFixed(2)}m
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Ferragens — dobradiças, trilhos de correr e corrediças */}
      {explodir.ferragens.length > 0 && (
        <div style={{ background: "#0f1218", border: "1px solid #1e2a3a", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6ab0e0", marginBottom: 4 }}>
            🔩 Lista de Ferragens ({explodir.ferragens.length} peça{explodir.ferragens.length > 1 ? "s" : ""})
          </div>
          <div style={{ fontSize: 11, color: "#7090a8", marginBottom: 10, lineHeight: 1.5 }}>
            Dobradiças, kits de trilho de correr e corrediças de gaveta, calculados a partir do tipo de porta/gaveta configurado (ou detectado no nome/observação da peça). São valores de partida — confira sempre com a ficha técnica da ferragem real antes de fechar o pedido.
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {explodir.ferragens.map((f, i) => (
              <div key={i} style={{ fontSize: 12, color: "#c0d0e0", lineHeight: 1.6 }}>
                <strong style={{ color: "#e0eaf5" }}>{f.nome}:</strong>{" "}
                {f.portas && (
                  <span style={{ marginRight: 12 }}>
                    {f.portas.qtd}× porta(s) de giro → <strong>{f.portas.dobradicas_total} dobradiças</strong> ({f.portas.dobradicas_por_porta}/porta)
                  </span>
                )}
                {f.trilho && (
                  <span style={{ marginRight: 12 }}>
                    {f.trilho.qtd_kits}× <strong>kit de trilho de correr</strong> ({f.trilho.nome})
                  </span>
                )}
                {f.gavetas && (
                  <span>
                    {f.gavetas.qtd}× gaveta(s) → <strong>{f.gavetas.pares_corredica} par(es) de corrediça</strong> {f.gavetas.nome}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peças pendentes de método construtivo manual */}
      {manuaisPendentes.length > 0 && (
        <div style={{ background: "#1a1500", border: "1px solid #c8892a", borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontFamily: "'Playfair Display'", fontSize: 17, color: "#e8aa40" }}>
              Peças que precisam de método construtivo manual ({manuaisPendentes.length})
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#a08040", marginBottom: 12, lineHeight: 1.5 }}>
            O sistema não conseguiu decompor estas peças automaticamente em painéis de corte. Informe os painéis manualmente abaixo (medidas já em metros) para que entrem no plano de corte.
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {manuaisPendentes.map((m) => (
              <div key={m.pecaId} style={{ background: "#150f08", border: "1px solid #3a2a10", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e0d0b0" }}>{m.nome}</div>
                <div style={{ fontSize: 11, color: "#8a6a40", marginTop: 2 }}>{m.motivo}</div>
                <ManualPanelForm onAdd={(panel) => addManualPanel(m.pecaId, panel)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peças já resolvidas manualmente (revisão) */}
      {explodir.manuais.length > manuaisPendentes.length && (
        <div style={{ background: "#0f150f", border: "1px solid #2a3a1e", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#8aca58", marginBottom: 10 }}>
            ✅ Peças com painéis inseridos manualmente ({explodir.manuais.length - manuaisPendentes.length})
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {explodir.manuais
              .filter((m) => (manualPanels[m.pecaId] || []).length > 0)
              .map((m) => (
                <div key={m.pecaId} style={{ fontSize: 12, color: "#c0b090" }}>
                  <strong style={{ color: "#e0d0b0" }}>{m.nome}</strong>
                  {(manualPanels[m.pecaId] || []).map((p) => (
                    <span key={p._mid} style={{ marginLeft: 8, background: "#1a2a14", border: "1px solid #2a4a1e", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#a0c080" }}>
                      {p.quantidade}× {p.nome} ({p.largura}×{p.altura}m)
                      <button onClick={() => removeManualPanel(m.pecaId, p._mid)} style={{ marginLeft: 6, background: "none", border: "none", color: "#8a5050", cursor: "pointer" }}>✕</button>
                    </span>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Peças que não couberam em nenhuma chapa (excedem o tamanho útil) */}
      {resultado?.pecas_nao_posicionadas?.length > 0 && (
        <div style={{ background: "#150d0d", border: "1px solid #6a2020", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e07070", marginBottom: 8 }}>
            🚫 Peças maiores que a chapa ({resultado.pecas_nao_posicionadas.length}) — não foram posicionadas
          </div>
          {resultado.pecas_nao_posicionadas.map((n, i) => (
            <div key={i} style={{ fontSize: 12, color: "#c09090" }}>{n.motivo}</div>
          ))}
        </div>
      )}

      {/* Caso sem peças */}
      {pieces?.length === 0 ? (
        <div
          style={{
            background: "#110e09",
            border: "1px solid #1e1409",
            borderRadius: 14,
            padding: "50px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 10 }}>📐</div>
          <div style={{ fontFamily: "'Playfair Display'", fontSize: 20, marginBottom: 6 }}>
            Nenhuma peça cadastrada para corte
          </div>
          <div style={{ fontSize: 13, color: "#6a5038", maxWidth: 460, margin: "0 auto 18px", lineHeight: 1.5 }}>
            Envie a foto ou PDF do projeto na aba <strong>Orçamento</strong> para que a IA extraia as peças, ou cadastre peças manualmente com largura e altura.
          </div>
          <button
            onClick={onGoToQuote}
            style={{
              background: "linear-gradient(135deg,#c8892a,#e8aa40)",
              border: "none",
              borderRadius: 8,
              color: "#0d0a07",
              padding: "11px 24px",
              fontFamily: "'Barlow Condensed'",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: ".08em",
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            Ir para a Aba Orçamento
          </button>
        </div>
      ) : (
        <>
          {/* Métricas Principais em Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div style={{ background: "#110e09", border: "1px solid #22170b", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }}>
                Total de Chapas MDF
              </div>
              <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 32, fontWeight: 700, color: "#e8aa40", marginTop: 2 }}>
                {resultado?.total_chapas || 0} <span style={{ fontSize: 14, color: "#7a6040", fontWeight: 400 }}>chapa(s)</span>
              </div>
              <div style={{ fontSize: 11, color: "#6a5038", marginTop: 2 }}>
                Dimensão: {config.chapa_largura_mm}×{config.chapa_altura_mm} mm
              </div>
            </div>

            <div style={{ background: "#110e09", border: "1px solid #22170b", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }}>
                Aproveitamento Médio
              </div>
              <div
                style={{
                  fontFamily: "'Barlow Condensed'",
                  fontSize: 32,
                  fontWeight: 700,
                  color: (resultado?.aproveitamento_medio_pct || 0) >= 80 ? "#4caf7d" : "#d4860a",
                  marginTop: 2,
                }}
              >
                {resultado?.aproveitamento_medio_pct || 0}%
              </div>
              <div style={{ fontSize: 11, color: "#6a5038", marginTop: 2 }}>
                Área útil: {resultado?.area_usada_m2} m² de {resultado?.area_total_m2} m²
              </div>
            </div>

            <div style={{ background: "#110e09", border: "1px solid #22170b", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }}>
                Sobras / Desperdício
              </div>
              <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 32, fontWeight: 700, color: "#c0b090", marginTop: 2 }}>
                {resultado?.area_desperdicada_m2 || 0} <span style={{ fontSize: 14, color: "#7a6040", fontWeight: 400 }}>m²</span>
              </div>
              <div style={{ fontSize: 11, color: "#6a5038", marginTop: 2 }}>
                {resultado?.total_pecas_posicionadas || 0} peças posicionadas
              </div>
            </div>

            {config.preco_chapa > 0 && (
              <div style={{ background: "#110e09", border: "1px solid #22170b", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#8a6a40", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }}>
                  Custo Estimado Chapas
                </div>
                <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 30, fontWeight: 700, color: "#90d060", marginTop: 2 }}>
                  {fmtBRL(resultado?.custo_estimado)}
                </div>
                <div style={{ fontSize: 11, color: "#6a5038", marginTop: 2 }}>
                  {resultado?.total_chapas} × {fmtBRL(config.preco_chapa)}
                </div>
              </div>
            )}
          </div>

          {/* Navegação entre Chapas e Visualizador Interativo */}
          <div
            style={{
              background: "#110e09",
              border: "1px solid #1e1409",
              borderRadius: 14,
              padding: "18px",
              marginBottom: 20,
            }}
          >
            {/* Seletor de Chapa (Abas de Chapa 1, 2, 3...) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {resultado?.chapas?.map((ch, idx) => {
                  const isSelected = (selectedChapaIndex || 0) === idx;
                  return (
                    <button
                      key={ch.indice}
                      onClick={() => setSelectedChapaIndex(idx)}
                      style={{
                        background: isSelected ? "linear-gradient(135deg,#c8892a,#e8aa40)" : "#1a140d",
                        border: `1px solid ${isSelected ? "#c8892a" : "#2e1e0e"}`,
                        borderRadius: 8,
                        color: isSelected ? "#0d0a07" : "#c0b090",
                        padding: "8px 16px",
                        fontFamily: "'Barlow Condensed'",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all .2s",
                      }}
                    >
                      Chapa {ch.indice} ({ch.aproveitamento_pct}%)
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: 12, color: "#8a7050", fontWeight: 600 }}>
                {chapaAtual?.pecas?.length || 0} peças nesta chapa
              </div>
            </div>

            {/* Componente SVG da Chapa */}
            {chapaAtual && <ChapaViewer chapa={chapaAtual} />}
          </div>

          {/* Lista de Peças e Dimensões Técnicas */}
          <div
            style={{
              background: "#110e09",
              border: "1px solid #1e1409",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #1a1006",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontFamily: "'Playfair Display'", fontSize: 18 }}>
                Lista Técnica de Corte das Peças ({pecasCorte.length})
              </span>
              <button
                onClick={() => window.print()}
                style={{
                  background: "rgba(200,137,42,.12)",
                  border: "1px solid rgba(200,137,42,.3)",
                  borderRadius: 6,
                  color: "#c8892a",
                  padding: "6px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                🖨️ Imprimir Mapa
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ background: "#150f07" }}>
                    {["Cód", "Peça", "Espessura", "Largura (mm)", "Comprimento (mm)", "Qtd", "Área Unit (m²)", "Subtotal (m²)"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "9px 12px",
                            textAlign: "left",
                            fontSize: 10,
                            color: "#8a6a40",
                            fontWeight: 700,
                            letterSpacing: ".08em",
                            textTransform: "uppercase",
                            borderBottom: "1px solid #1a1006",
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pecasCorte.map((p) => {
                    const areaUnit = ((p.largura_mm * p.comprimento_mm) / 1_000_000).toFixed(3);
                    const areaTotal = ((p.largura_mm * p.comprimento_mm * p.quantidade) / 1_000_000).toFixed(3);
                    return (
                      <tr key={p.id} className="hr" style={{ borderBottom: "1px solid #16100a" }}>
                        <td style={{ padding: "8px 12px" }}>
                          <span
                            style={{
                              background: p.cor || "#c8892a",
                              color: "#000",
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontFamily: "'Barlow Condensed', monospace",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {p.codigo}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", color: "#e0d0b0", fontWeight: 500, fontSize: 13 }}>
                          {p.nome}
                          {p._origem?.profundidade_assumida && (
                            <span title="Profundidade não estava no projeto — foi usado o valor padrão configurado. Confira antes de cortar." style={{ marginLeft: 6, fontSize: 10, color: "#e8aa40" }}>
                              ⚠ prof. assumida
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 12px", fontSize: 12, color: "#8a7050" }}>
                          {p._origem?.espessura_mm ? `${p._origem.espessura_mm}mm` : "—"}
                        </td>
                        <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed'", fontSize: 14, fontWeight: 700, color: "#d4952e" }}>
                          {p.largura_mm} mm
                        </td>
                        <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed'", fontSize: 14, fontWeight: 700, color: "#d4952e" }}>
                          {p.comprimento_mm} mm
                        </td>
                        <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed'", fontSize: 14, fontWeight: 600, color: "#f0e0c8" }}>
                          {p.quantidade} un
                        </td>
                        <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed'", fontSize: 13, color: "#a09080" }}>
                          {areaUnit} m²
                        </td>
                        <td style={{ padding: "8px 12px", fontFamily: "'Barlow Condensed'", fontSize: 14, fontWeight: 700, color: "#c8892a" }}>
                          {areaTotal} m²
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
