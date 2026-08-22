import { useState, useMemo } from "react";
import ChapaViewer from "./ChapaViewer";
import {
  CONFIG_PADRAO_CORTE,
  normalizarPecasParaCorte,
  otimizarCorte,
} from "../engine/otimizador";

const fmtBRL = (v) =>
  "R$ " +
  Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function PlanoCorteView({ pieces, clientName, ambientDesc, onGoToQuote }) {
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("om_corte_config_v1");
      return saved ? JSON.parse(saved) : CONFIG_PADRAO_CORTE;
    } catch {
      return CONFIG_PADRAO_CORTE;
    }
  });

  const [selectedChapaIndex, setSelectedChapaIndex] = useState(0);
  const [showConfig, setShowConfig] = useState(false);

  const updateConfig = (field, val) => {
    const updated = { ...config, [field]: val };
    setConfig(updated);
    try {
      localStorage.setItem("om_corte_config_v1", JSON.stringify(updated));
    } catch {}
  };

  // Normaliza as peças do orçamento para o formato do plano de corte
  const pecasCorte = useMemo(() => {
    return normalizarPecasParaCorte(pieces || []);
  }, [pieces]);

  // Executa o motor 2D de corte
  const resultado = useMemo(() => {
    if (pecasCorte.length === 0) return null;
    return otimizarCorte(pecasCorte, config);
  }, [pecasCorte, config]);

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
        </div>
      )}

      {/* Caso sem peças */}
      {pecasCorte.length === 0 ? (
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
                    {["Cód", "Peça", "Largura (mm)", "Comprimento (mm)", "Qtd", "Área Unit (m²)", "Subtotal (m²)"].map(
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
