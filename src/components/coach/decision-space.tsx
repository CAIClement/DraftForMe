"use client";

import { useState } from "react";
import type { Recommendation } from "@/lib/recommendation/types";

// ─── Design tokens (lumineux palette — matches landing page) ──────────────────
const C = {
  bg0: "#070d1b",
  bg1: "#07101f",
  bg2: "#0a1830",
  bg3: "#112447",
  surface: "#0a1830",
  surfaceAlt: "#112447",
  jade: "#4cf2b4",
  jadeSoft: "rgba(76,242,180,0.16)",
  cyan: "#6ce6ff",
  gold: "#d8b264",
  danger: "#e87171",
  fg: "#e8eef9",
  fgMuted: "#98a6c2",
  fgFaint: "#5d6e8c",
  line: "rgba(120,180,220,0.10)",
  lineStrong: "rgba(120,180,220,0.18)",
  glow: "0 0 0 1px rgba(76,242,180,0.28), 0 0 50px -8px rgba(76,242,180,0.5)",
};

type PostureType = "safe" | "counter" | "meta" | "pocket" | "risk";

const POSTURE: Record<PostureType, { fg: string; bg: string; ring: string; label: string }> = {
  safe:    { fg: "#4cf2b4",  bg: "rgba(76,242,180,0.12)",   ring: "rgba(76,242,180,0.35)",  label: "Safe"         },
  counter: { fg: "#6ce6ff",  bg: "rgba(93,209,238,0.12)",   ring: "rgba(93,209,238,0.35)",  label: "Counter"      },
  meta:    { fg: "#a78bfa",  bg: "rgba(167,139,250,0.12)",  ring: "rgba(167,139,250,0.35)", label: "Méta"         },
  pocket:  { fg: "#d8b264",  bg: "rgba(216,178,100,0.14)",  ring: "rgba(216,178,100,0.40)", label: "Pocket pick"  },
  risk:    { fg: "#e87171",  bg: "rgba(232,113,113,0.12)",  ring: "rgba(232,113,113,0.40)", label: "Risque élevé" },
};

function derivePosture(rec: Recommendation, rank: number): PostureType {
  if (rec.counterScore >= 75) return "counter";
  if (rec.playerScore >= 75) return "safe";
  if (rec.metaScore >= 80) return "meta";
  if (rank === 3 && (rec.playerScore < 45 || rec.totalScore < 55)) return "risk";
  return "safe";
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function ChampionAvatar({
  name,
  imageUrl,
  size = 36,
  accent = C.jade
}: {
  name: string;
  imageUrl?: string;
  size?: number;
  accent?: string;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const showImage = imageUrl && !hasImageError;

  return (
    <span style={{
      width: size, height: size, borderRadius: Math.max(6, size * 0.18),
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", background: C.bg3, color: accent,
      border: `1px solid ${accent}55`,
      fontFamily: "var(--font-display)", fontWeight: 700,
      fontSize: Math.max(10, size * 0.28), lineHeight: 1,
      flexShrink: 0,
    }}>
      {showImage ? (
        <img
          src={imageUrl}
          alt={`Portrait de ${name}`}
          loading="lazy"
          onError={() => setHasImageError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

function PostureBadge({ type, size = "md" }: { type: PostureType; size?: "sm" | "md" }) {
  const p = POSTURE[type];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: size === "sm" ? "2px 7px" : "4px 10px",
      borderRadius: 999,
      background: p.bg, color: p.fg, border: `1px solid ${p.ring}`,
      fontFamily: "var(--font-display)", fontWeight: 600,
      fontSize: size === "sm" ? 10 : 11,
      letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: p.fg, boxShadow: `0 0 6px ${p.fg}`, display: "inline-block" }} />
      {p.label}
    </span>
  );
}

function ScoreDial({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const tone = pct >= 85 ? C.jade : pct >= 70 ? C.cyan : C.gold;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r}
                stroke="rgba(120,170,210,0.10)" strokeWidth="3" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r}
                stroke={tone} strokeWidth="3" fill="none"
                strokeDasharray={circ}
                strokeDashoffset={circ - (pct / 100) * circ}
                strokeLinecap="round" />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1,
      }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: size * 0.28, fontWeight: 700, color: C.fg }}>
          {score}
        </div>
        <div style={{ fontSize: 8, color: C.fgFaint, letterSpacing: "0.16em", marginTop: 1 }}>/ 100</div>
      </div>
    </div>
  );
}

function CriteriaBar({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const v = invert ? 100 - value : value;
  const tone = v >= 75 ? C.jade : v >= 50 ? C.cyan : v >= 30 ? C.gold : C.danger;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 28px", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 11, color: C.fgMuted, fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ position: "relative", height: 5, borderRadius: 3, background: "rgba(120,170,210,0.08)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, width: `${value}%`, background: tone, opacity: 0.85, borderRadius: 3 }} />
        <div style={{ position: "absolute", top: -2, bottom: -2, left: "70%", width: 1, background: "rgba(255,255,255,0.18)" }} />
      </div>
      <div style={{ fontSize: 11, textAlign: "right", fontFamily: "var(--font-mono)", color: C.fg, fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}

// ─── Pick card (left grid) ────────────────────────────────────────────────────

function PickCard({ rec, rank, selected, onClick }: {
  rec: Recommendation; rank: number; selected: boolean; onClick: () => void;
}) {
  const postureType = derivePosture(rec, rank);
  const p = POSTURE[postureType];
  const score = Math.round(rec.totalScore);
  const criteria = {
    draftMatch: Math.round(rec.counterScore),
    meta: Math.round(rec.metaScore),
    comfort: Math.round(rec.playerScore),
    risk: Math.round(100 - rec.playerScore * 0.5 - rec.counterScore * 0.5),
  };

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left", cursor: "pointer", width: "100%", display: "block",
        position: "relative", padding: 18, borderRadius: 14,
        background: selected ? C.surfaceAlt : C.surface,
        border: `1px solid ${selected ? p.ring : C.line}`,
        boxShadow: selected ? `0 0 0 1px ${p.ring}, 0 12px 40px -16px ${p.fg}` : "none",
        transition: "border-color .15s, background .15s, box-shadow .2s",
        color: "inherit", font: "inherit", overflow: "hidden",
      }}
    >
      {/* selection accent bar */}
      {selected && (
        <span style={{
          position: "absolute", top: 14, bottom: 14, left: 0, width: 3,
          background: p.fg, borderRadius: "0 3px 3px 0", boxShadow: `0 0 12px ${p.fg}`,
        }} />
      )}

      {/* header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700,
          color: selected ? p.fg : C.fgFaint, lineHeight: 1, minWidth: 38,
        }}>
          {String(rank).padStart(2, "0")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8, background: C.bg3,
              border: `1px solid ${C.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: p.fg, flexShrink: 0,
            }}>
              <ChampionAvatar name={rec.championName} imageUrl={rec.championImageUrl} size={40} accent={p.fg} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18,
                letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                color: C.fg,
              }}>
                {rec.championName}
              </div>
              <div style={{ marginTop: 4 }}>
                <PostureBadge type={postureType} size="sm" />
              </div>
            </div>
          </div>
        </div>
        <ScoreDial score={score} size={58} />
      </div>

      {/* criteria bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
        <CriteriaBar label="Draft ennemie" value={criteria.draftMatch} />
        <CriteriaBar label="Méta actuelle"  value={criteria.meta} />
        <CriteriaBar label="Confort joueur" value={criteria.comfort} />
        <CriteriaBar label="Risque"         value={criteria.risk} invert />
      </div>

      {/* short reason */}
      <div style={{
        fontSize: 12.5, lineHeight: 1.55, color: C.fgMuted,
        paddingTop: 10, borderTop: `1px dashed ${C.line}`,
      }}>
        {rec.explanation.summary}
      </div>
    </button>
  );
}

// ─── Detail panel (right side) ────────────────────────────────────────────────

function ReasonRow({ index, title, desc, accent }: { index: number; title: string; desc: string; accent: string }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: C.bg3, border: `1px solid ${accent}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: accent, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, flexShrink: 0,
      }}>
        {index}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.fg, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: C.fgMuted }}>{desc}</div>
      </div>
    </div>
  );
}

function RiskRow({ text }: { text: string }) {
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start",
      padding: "12px 14px",
      background: "rgba(232,113,113,0.06)", border: "1px solid rgba(232,113,113,0.18)", borderRadius: 10,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M12 3 L22 20 L2 20 Z" stroke={C.danger} strokeWidth="1.6" strokeLinejoin="round" fill="rgba(232,113,113,0.10)" />
        <line x1="12" y1="10" x2="12" y2="14" stroke={C.danger} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill={C.danger} />
      </svg>
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.55, color: C.fgMuted }}>{text}</div>
    </div>
  );
}

function DetailPanel({ rec, rank, advancedOpen, onToggleAdvanced }: {
  rec: Recommendation; rank: number; advancedOpen: boolean; onToggleAdvanced: () => void;
}) {
  const postureType = derivePosture(rec, rank);
  const p = POSTURE[postureType];
  const score = Math.round(rec.totalScore);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Verdict card */}
      <div style={{
        padding: 24, borderRadius: 14,
        background: `linear-gradient(135deg, ${p.bg}, transparent 60%)`,
        border: `1px solid ${p.ring}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 10, background: C.bg3,
            border: `1px solid ${p.ring}`,
            display: "flex", alignItems: "center", justifyContent: "center", color: p.fg,
          }}>
            <ChampionAvatar name={rec.championName} imageUrl={rec.championImageUrl} size={52} accent={p.fg} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.18em", textTransform: "uppercase", color: p.fg, marginBottom: 8,
            }}>
              Verdict · #{String(rank).padStart(2, "0")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ fontSize: 22, fontFamily: "var(--font-display)", fontWeight: 600, margin: 0, color: C.fg }}>
                {rec.championName}
              </h3>
              <PostureBadge type={postureType} />
            </div>
          </div>
          <ScoreDial score={score} size={70} />
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: C.fg, margin: 0 }}>
          {rec.explanation.summary}
        </p>
      </div>

      {/* Reasons */}
      {rec.explanation.factors.length > 0 && (
        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.18em", textTransform: "uppercase", color: p.fg, marginBottom: 14,
          }}>
            Pourquoi ce pick
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {rec.explanation.factors.map((f, i) => (
              <ReasonRow key={f.key} index={i + 1} title={f.label} desc={f.detail} accent={p.fg} />
            ))}
          </div>
        </div>
      )}

      {/* Risks — always visible */}
      {rec.explanation.warnings.length > 0 && (
        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.18em", textTransform: "uppercase", color: C.danger, marginBottom: 12,
          }}>
            Risques · toujours visibles
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rec.explanation.warnings.map((w, i) => <RiskRow key={i} text={w} />)}
          </div>
        </div>
      )}

      {/* Alternatives */}
      {rec.explanation.alternatives.length > 0 && (
        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.18em", textTransform: "uppercase", color: C.fgMuted, marginBottom: 10,
          }}>
            Alternatives proches
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {rec.explanation.alternatives.map((alt) => (
              <div key={alt.championId} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 10,
                background: C.bg2, border: `1px solid ${C.line}`,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 7, background: C.bg3,
                  border: `1px solid ${C.line}`,
                  display: "flex", alignItems: "center", justifyContent: "center", color: C.fgMuted,
                }}>
                  <ChampionAvatar
                    name={alt.championName}
                    imageUrl={alt.championImageUrl}
                    size={30}
                    accent={C.fgMuted}
                  />
                </div>
                <span style={{ fontWeight: 600, fontSize: 13, color: C.fg }}>{alt.championName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced accordion */}
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 18 }}>
        <button
          onClick={onToggleAdvanced}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", background: "transparent", border: "none",
            color: C.fg, cursor: "pointer", padding: 0, font: "inherit", textAlign: "left",
          }}
        >
          <div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.18em", textTransform: "uppercase", color: C.fgFaint, marginBottom: 6,
            }}>
              Détails avancés
            </div>
            <div style={{ fontSize: 13, color: C.fgMuted }}>Scores détaillés par facteur</div>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: C.bg2, border: `1px solid ${C.line}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: advancedOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform .2s",
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M3 6 L8 11 L13 6" stroke={C.fgMuted} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {advancedOpen && (
          <div style={{ marginTop: 18 }}>
            <div style={{
              background: C.bg2, borderRadius: 10, border: `1px solid ${C.line}`, overflow: "hidden",
            }}>
              {rec.explanation.factors.map((f, i) => (
                <div key={f.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px",
                  borderBottom: i < rec.explanation.factors.length - 1 ? `1px solid ${C.line}` : "none",
                }}>
                  <span style={{ fontSize: 12, color: C.fgMuted }}>{f.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: C.fgFaint, fontFamily: "var(--font-mono)" }}>
                      poids {f.weight}%
                    </span>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
                      color: f.score >= 60 ? C.jade : C.danger,
                    }}>
                      {f.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function DecisionSpace({ recommendations }: { recommendations: Recommendation[] }) {
  const [selected, setSelected] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function handleSelect(i: number) {
    setSelected(i);
    setAdvancedOpen(false);
  }

  const pick = recommendations[selected];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 600,
          letterSpacing: "0.18em", textTransform: "uppercase", color: C.jade, marginBottom: 10,
        }}>
          Espace de décision
        </div>
        <h2 style={{
          fontSize: 26, fontFamily: "var(--font-display)", fontWeight: 600,
          letterSpacing: "-0.02em", margin: "0 0 8px", color: C.fg,
        }}>
          Trois picks. Compare.{" "}
          <span style={{ color: C.jade }}>Décide.</span>
        </h2>
        <p style={{ fontSize: 13, color: C.fgMuted, margin: 0, lineHeight: 1.55 }}>
          Score, posture, draft adverse, méta et confort — sur la même grille.
          Le détail à droite te dit pourquoi, et surtout ce qui peut foirer.
        </p>
      </div>

      {/* Grid: picks (left) + detail (right) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 38fr) minmax(0, 62fr)",
        gap: 18, alignItems: "start",
      }}>

        {/* LEFT — pick cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.18em", textTransform: "uppercase", color: C.jade,
            }}>
              Grille de décision
            </div>
            <span style={{
              fontSize: 10, fontFamily: "var(--font-mono)", color: C.fgFaint,
              letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
              {recommendations.length} picks analysés
            </span>
          </div>

          {recommendations.map((rec, i) => (
            <PickCard
              key={rec.championId}
              rec={rec}
              rank={i + 1}
              selected={i === selected}
              onClick={() => handleSelect(i)}
            />
          ))}

          <div style={{
            fontSize: 11.5, color: C.fgFaint, lineHeight: 1.55,
            padding: "10px 12px", borderRadius: 8,
            background: "rgba(120,170,210,0.04)", border: `1px dashed ${C.line}`,
          }}>
            Le tick à 70 % sur chaque barre = seuil «&nbsp;assez bon&nbsp;». Au-dessus, c'est solide.
          </div>
        </div>

        {/* RIGHT — detail panel */}
        <div style={{
          background: C.surface, border: `1px solid ${C.line}`,
          borderRadius: 16, padding: 26,
        }}>
          {pick ? (
            <>
              <DetailPanel
                rec={pick}
                rank={selected + 1}
                advancedOpen={advancedOpen}
                onToggleAdvanced={() => setAdvancedOpen((o) => !o)}
              />

              {/* lock CTA */}
              <div style={{
                marginTop: 22, paddingTop: 22, borderTop: `1px solid ${C.line}`,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
              }}>
                <p style={{ fontSize: 12.5, color: C.fgMuted, margin: 0, maxWidth: 340, lineHeight: 1.5 }}>
                  Tu peux toujours revenir sur la grille pour comparer. Rien n'est verrouillé tant que tu n'as pas lock dans le client.
                </p>
                <button style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 20px", borderRadius: 10,
                  fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13,
                  background: C.jade, color: "#062013",
                  boxShadow: C.glow, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                }}>
                  Je pars sur {pick.championName}
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8 L13 8 M9 4 L13 8 L9 12" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: C.fgMuted, textAlign: "center", padding: "40px 0" }}>
              Sélectionne un pick dans la grille pour voir le détail.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
