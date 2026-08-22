import { useState } from "react";

export default function ChapaViewer({ chapa }) {
  const [hoveredPiece, setHoveredPiece] = useState(null);

  if (!chapa) return null;

  // Dimensões do SVG interno
  const W = 800;
  const H = 530;
  const PAD = 20;
  const aW = W - PAD * 2;
  const aH = H - PAD * 2 - 24;

  const escX = aW / (chapa.largura_mm || 2750);
  const escY = aH / (chapa.altura_mm || 1830);
  const esc = Math.min(escX, escY);

  const cW = (chapa.largura_mm || 2750) * esc;
  const cH = (chapa.altura_mm || 1830) * esc;
  const oX = PAD + (aW - cW) / 2;
  const oY = PAD;

  const aprovCor =
    chapa.aproveitamento_pct >= 85
      ? "#4CAF7D"
      : chapa.aproveitamento_pct >= 70
      ? "#D4860A"
      : "#E05555";

  return (
    <div style={{ width: "100%", background: "#0d0d0c", borderRadius: 12, border: "1px solid #2a2015", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", userSelect: "none" }}
      >
        <defs>
          <pattern
            id={`hatch_${chapa.indice}`}
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="12" stroke="#262018" strokeWidth="3" />
          </pattern>
        </defs>

        {/* Fundo escuro */}
        <rect width={W} height={H} fill="#0d0a07" />

        {/* Chapa base com hachura nas sobras */}
        <rect
          x={oX}
          y={oY}
          width={cW}
          height={cH}
          fill="#14100b"
          stroke="#3e2d1a"
          strokeWidth="1.5"
          rx="3"
        />
        <rect
          x={oX}
          y={oY}
          width={cW}
          height={cH}
          fill={`url(#hatch_${chapa.indice})`}
          rx="3"
        />

        {/* Peças posicionadas */}
        {chapa.pecas?.map((pp, idx) => {
          const pL = pp.largura_pos || (pp.rotacionada ? pp.peca.comprimento_mm : pp.peca.largura_mm);
          const pC = pp.altura_pos || (pp.rotacionada ? pp.peca.largura_mm : pp.peca.comprimento_mm);
          const x = oX + pp.x * esc;
          const y = oY + pp.y * esc;
          const w = pL * esc;
          const h = pC * esc;

          const isHovered = hoveredPiece === `${pp.peca.id}_${pp.instancia}`;
          const cor = pp.peca.cor || "#c8892a";

          return (
            <g
              key={`${pp.peca.id}_${pp.instancia || idx}`}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredPiece(`${pp.peca.id}_${pp.instancia}`)}
              onMouseLeave={() => setHoveredPiece(null)}
            >
              {/* Retângulo da Peça */}
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={isHovered ? cor : cor + "33"}
                stroke={cor}
                strokeWidth={isHovered ? 2.5 : 1.2}
                rx="2"
                style={{ transition: "fill .15s, stroke-width .15s" }}
              />

              {/* Rótulo de Peça Grande */}
              {w > 65 && h > 34 && (
                <>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={Math.min(w - 4, 75)}
                    height={13}
                    fill={cor}
                    rx="2"
                  />
                  <text
                    x={x + 2 + Math.min(w - 4, 75) / 2}
                    y={y + 11.5}
                    textAnchor="middle"
                    fontFamily="'Barlow Condensed', monospace"
                    fontSize="8.5"
                    fill={isHovered ? "#000" : "#0d0a07"}
                    fontWeight="bold"
                  >
                    {pp.peca.codigo}
                  </text>

                  <text
                    x={x + w / 2}
                    y={y + h / 2 + 2}
                    textAnchor="middle"
                    fontFamily="'Barlow', sans-serif"
                    fontSize="9"
                    fill={isHovered ? "#fff" : cor}
                    fontWeight="600"
                  >
                    {pp.peca.nome?.length > Math.floor(w / 7)
                      ? pp.peca.nome.slice(0, Math.floor(w / 7) - 1) + "…"
                      : pp.peca.nome}
                  </text>

                  {h > 52 && (
                    <text
                      x={x + w / 2}
                      y={y + h / 2 + 14}
                      textAnchor="middle"
                      fontFamily="'Barlow Condensed', monospace"
                      fontSize="8"
                      fill={isHovered ? "#f0e0c8" : cor + "cc"}
                    >
                      {pp.peca.largura_mm}×{pp.peca.comprimento_mm}mm
                    </text>
                  )}
                </>
              )}

              {/* Rótulo para Peças Médias */}
              {w <= 65 && w > 28 && h > 18 && (
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 3}
                  textAnchor="middle"
                  fontFamily="'Barlow Condensed', monospace"
                  fontSize="8"
                  fill={isHovered ? "#fff" : cor}
                  fontWeight="bold"
                >
                  {pp.peca.codigo}
                </text>
              )}

              {/* Indicador de Rotação */}
              {pp.rotacionada && w > 20 && h > 12 && (
                <text
                  x={x + w - 3}
                  y={y + h - 2}
                  textAnchor="end"
                  fontFamily="monospace"
                  fontSize="9"
                  fill={isHovered ? "#fff" : cor + "aa"}
                >
                  ↻
                </text>
              )}
            </g>
          );
        })}

        {/* Borda Externa da Chapa */}
        <rect
          x={oX}
          y={oY}
          width={cW}
          height={cH}
          fill="none"
          stroke="#5a4025"
          strokeWidth="2"
          rx="3"
        />

        {/* Informações Técnicas no Rodapé do SVG */}
        <text
          x={oX + cW / 2}
          y={oY + cH + 15}
          textAnchor="middle"
          fontFamily="'Barlow Condensed', sans-serif"
          fontSize="11"
          fill="#8a7050"
          letterSpacing="0.05em"
        >
          {chapa.largura_mm} mm × {chapa.altura_mm} mm (MDF)
        </text>
        <text
          x={oX}
          y={H - 5}
          fontFamily="'Barlow', sans-serif"
          fontSize="11"
          fill="#c0b090"
          fontWeight="600"
        >
          Chapa {chapa.indice} · {chapa.pecas?.length || 0} peças cortadas
        </text>
        <text
          x={oX + cW}
          y={H - 5}
          textAnchor="end"
          fontFamily="'Barlow Condensed', sans-serif"
          fontSize="12"
          fill={aprovCor}
          fontWeight="bold"
        >
          {chapa.aproveitamento_pct}% aproveitamento
        </text>
      </svg>
    </div>
  );
}
