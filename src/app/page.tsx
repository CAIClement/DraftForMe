import Link from "next/link";
import type { CSSProperties } from "react";

// Typed routes workaround: Next.js requires branded Route types at compile time;
// UrlObject form bypasses this until `next dev` regenerates .next/types/routes.d.ts.
const DRAFT_HREF = { pathname: "/draft" } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = "safe" | "balanced" | "sharp";

interface Rec {
  name: string;
  archetype: string;
  risk: RiskLevel;
  riskLabel: string;
  tags: string[];
  why: string;
}

interface ChampEntry {
  name: string;
  archetype: string;
  lane: string;
  placeholder?: boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STEPS = [
  { n: "01", title: "Choisissez votre rôle", desc: "Top, jungle, mid, ADC ou support. C'est le point de départ.", role: "top" },
  { n: "02", title: "Ajoutez les ennemis pickés", desc: "Au fur et à mesure de la draft. Pas besoin d'avoir tout.", role: "mid" },
  { n: "03", title: "On analyse la draft", desc: "Matchups, scaling, dégâts, sources de pression, comp adverse.", role: "jungle" },
  { n: "04", title: "Recevez 3 picks adaptés", desc: "Avec un niveau de risque et deux phrases d'explication.", role: "adc" },
];

const FEATURES = [
  { title: "Counterpick par rôle", desc: "Pour chaque ennemi déjà pické, on sait ce qui passe — et ce qui galère.", icon: "bolt" },
  { title: "Conseils contextuels", desc: "Adapté à la phase de jeu, à la comp de votre équipe et à votre niveau.", icon: "spark" },
  { title: "Picks safe ou risqués", desc: "Trois propositions classées : la fiable, l'équilibrée, la pointue.", icon: "shield" },
  { title: "Explications pédagogiques", desc: "Pourquoi ce pick fonctionne, en deux phrases. Pas de jargon inutile.", icon: "scroll" },
];

const AUDIENCE = [
  "Vous jouez 5 games par semaine en Normal ou Bronze/Silver.",
  "Vous hésitez à chaque pick et ça vous fait perdre du temps.",
  "Vous voulez progresser sans tuto YouTube de 30 minutes.",
  "Vous savez pas qui counter qui — et c'est complètement normal.",
];

const DEMO_ENEMY: ChampEntry[] = [
  { name: "Yasuo", archetype: "fighter", lane: "top" },
  { name: "Lee Sin", archetype: "assassin", lane: "jungle" },
  { name: "Zed", archetype: "assassin", lane: "mid" },
  { name: "Caitlyn", archetype: "marksman", lane: "adc" },
  { name: "Lulu", archetype: "support", lane: "support" },
];

const DEMO_ALLY: ChampEntry[] = [
  { name: "Malphite", archetype: "tank", lane: "top" },
  { name: "Sejuani", archetype: "tank", lane: "jungle" },
  { name: "?", archetype: "mage", lane: "mid", placeholder: true },
  { name: "Jinx", archetype: "marksman", lane: "adc" },
  { name: "Thresh", archetype: "support", lane: "support" },
];

const DEMO_RECS: Rec[] = [
  {
    name: "Galio", archetype: "mage", risk: "safe", riskLabel: "Safe",
    tags: ["Counter Zed", "Roams", "Crowd control"],
    why: "E pour bloquer le dash, ult pour suivre la jungle. Reste safe en lane même sans CS parfait.",
  },
  {
    name: "Lissandra", archetype: "mage", risk: "balanced", riskLabel: "Équilibré",
    tags: ["Anti-dive", "Scaling", "Ult défensive"],
    why: "L'ultime ferme le combat sur Zed ou Lee Sin. Bonne entre Yasuo, mais demande de gérer les vagues.",
  },
  {
    name: "Diana", archetype: "assassin", risk: "sharp", riskLabel: "Plus pointu",
    tags: ["Punit Zed", "Tue ADC", "Skill ceiling moyen"],
    why: "Combo R sur Caitlyn ou Zed après le 6. Demande des bons engages, mais ça tranche la comp adverse.",
  },
];

const RISK_COLOR: Record<RiskLevel, string> = {
  safe: "#4cf2b4",
  balanced: "#6ce6ff",
  sharp: "#d8b264",
};

const ROLES = [
  { id: "top", label: "Toplane" },
  { id: "jungle", label: "Jungler" },
  { id: "mid", label: "Midlane" },
  { id: "adc", label: "ADC" },
  { id: "support", label: "Support" },
];

// ─── Design tokens (lumineux palette) ────────────────────────────────────────

const C = {
  bg0: "#070d1b",
  bg1: "#07101f",
  bg2: "#0a1830",
  bg3: "#112447",
  surface: "#0a1830",
  jade: "#4cf2b4",
  jadeSoft: "rgba(76,242,180,0.16)",
  cyan: "#6ce6ff",
  gold: "#d8b264",
  fg: "#e8eef9",
  fgMuted: "#98a6c2",
  fgFaint: "#5d6e8c",
  line: "rgba(120,180,220,0.10)",
  lineSoft: "rgba(120,180,220,0.06)",
  lineStrong: "rgba(120,180,220,0.18)",
  glow: "0 0 0 1px rgba(76,242,180,0.28), 0 0 50px -8px rgba(76,242,180,0.5)",
  glowStrong: "0 0 0 1px rgba(76,242,180,0.4), 0 0 80px -6px rgba(76,242,180,0.7)",
} as const;

// ─── SVG Components ───────────────────────────────────────────────────────────

function DFMMark({ size = 28, color = C.fg, tone = C.jade }: { size?: number; color?: string; tone?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2.5 L28 9.5 L28 22.5 L16 29.5 L4 22.5 L4 9.5 Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 8 L23 12 L23 20 L16 24 L9 20 L9 12 Z" stroke={tone} strokeWidth="1.2" fill="none" opacity="0.7" />
      <circle cx="16" cy="16" r="1.6" fill={tone} />
      <line x1="16" y1="3.5" x2="16" y2="6.5" stroke={tone} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="16" y1="25.5" x2="16" y2="28.5" stroke={tone} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DFMLogo({ size = 26, accent = C.jade }: { size?: number; accent?: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <DFMMark size={size} tone={accent} />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", color: C.fg }}>
        Draft<span style={{ color: accent }}>For</span>Me
      </span>
    </div>
  );
}

function RoleIcon({ role, size = 22 }: { role: string; size?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: "1.6",
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  if (role === "top") return (
    <svg {...p}>
      <path d="M4 4 L20 4 L20 20" />
      <path d="M4 4 L20 20" strokeDasharray="2 2" opacity="0.55" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
  if (role === "jungle") return (
    <svg {...p}>
      <path d="M12 3 L17 9 L14.5 9 L18 14 L14 14 L17 19 L7 19 L10 14 L6 14 L9.5 9 L7 9 Z" />
      <path d="M12 19 L12 21" />
    </svg>
  );
  if (role === "mid") return (
    <svg {...p}>
      <path d="M4 20 L20 4" />
      <path d="M4 4 L8 4 L8 8" />
      <path d="M20 20 L16 20 L16 16" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
  if (role === "adc") return (
    <svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2 L12 6 M12 18 L12 22 M2 12 L6 12 M18 12 L22 12" />
    </svg>
  );
  if (role === "support") return (
    <svg {...p}>
      <path d="M12 3 L20 6 L20 12 C20 17 16 20 12 21 C8 20 4 17 4 12 L4 6 Z" />
      <path d="M9 12 L11 14 L15 10" />
    </svg>
  );
  return null;
}

function ChampSilhouette({ archetype = "fighter", accent = C.jade, size = 80 }: {
  archetype?: string; accent?: string; size?: number;
}) {
  const w = size;
  const h = size * 1.25;
  const frame = (
    <path
      d={`M${w / 2} 2 L${w - 4} ${h * 0.25} L${w - 4} ${h * 0.75} L${w / 2} ${h - 2} L4 ${h * 0.75} L4 ${h * 0.25} Z`}
      stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" fill="rgba(15,27,48,0.65)"
    />
  );
  let body: React.ReactNode;
  if (archetype === "mage") body = (
    <g>
      <circle cx={w / 2} cy={h * 0.32} r={w * 0.13} fill="currentColor" opacity="0.85" />
      <path d={`M${w * 0.28} ${h * 0.55} L${w * 0.5} ${h * 0.40} L${w * 0.72} ${h * 0.55} L${w * 0.75} ${h * 0.85} L${w * 0.25} ${h * 0.85} Z`} fill="currentColor" opacity="0.85" />
      <circle cx={w * 0.78} cy={h * 0.30} r="3" fill={accent} />
      <circle cx={w * 0.78} cy={h * 0.30} r="6" stroke={accent} strokeWidth="1" fill="none" opacity="0.6" />
    </g>
  );
  else if (archetype === "assassin") body = (
    <g>
      <circle cx={w / 2} cy={h * 0.30} r={w * 0.11} fill="currentColor" opacity="0.85" />
      <path d={`M${w * 0.30} ${h * 0.50} L${w * 0.5} ${h * 0.42} L${w * 0.70} ${h * 0.50} L${w * 0.65} ${h * 0.85} L${w * 0.35} ${h * 0.85} Z`} fill="currentColor" opacity="0.85" />
      <path d={`M${w * 0.20} ${h * 0.78} L${w * 0.30} ${h * 0.62} L${w * 0.34} ${h * 0.66} L${w * 0.24} ${h * 0.82} Z`} fill={accent} />
    </g>
  );
  else if (archetype === "tank") body = (
    <g>
      <circle cx={w / 2} cy={h * 0.30} r={w * 0.13} fill="currentColor" opacity="0.85" />
      <path d={`M${w * 0.20} ${h * 0.55} L${w * 0.50} ${h * 0.42} L${w * 0.80} ${h * 0.55} L${w * 0.80} ${h * 0.85} L${w * 0.20} ${h * 0.85} Z`} fill="currentColor" opacity="0.85" />
      <path d={`M${w * 0.50} ${h * 0.55} L${w * 0.62} ${h * 0.58} L${w * 0.62} ${h * 0.70} L${w * 0.50} ${h * 0.76} L${w * 0.38} ${h * 0.70} L${w * 0.38} ${h * 0.58} Z`} stroke={accent} strokeWidth="1.4" fill="none" />
    </g>
  );
  else if (archetype === "marksman") body = (
    <g>
      <circle cx={w / 2} cy={h * 0.30} r={w * 0.10} fill="currentColor" opacity="0.85" />
      <path d={`M${w * 0.30} ${h * 0.50} L${w * 0.50} ${h * 0.42} L${w * 0.70} ${h * 0.50} L${w * 0.65} ${h * 0.85} L${w * 0.35} ${h * 0.85} Z`} fill="currentColor" opacity="0.85" />
      <path d={`M${w * 0.75} ${h * 0.45} Q${w * 0.92} ${h * 0.62} ${w * 0.75} ${h * 0.78}`} stroke={accent} strokeWidth="1.4" fill="none" />
      <line x1={w * 0.78} y1={h * 0.45} x2={w * 0.78} y2={h * 0.78} stroke={accent} strokeWidth="0.8" strokeDasharray="2 2" />
    </g>
  );
  else if (archetype === "support") body = (
    <g>
      <circle cx={w / 2} cy={h * 0.30} r={w * 0.12} fill="currentColor" opacity="0.85" />
      <path d={`M${w * 0.25} ${h * 0.55} L${w * 0.50} ${h * 0.42} L${w * 0.75} ${h * 0.55} L${w * 0.72} ${h * 0.85} L${w * 0.28} ${h * 0.85} Z`} fill="currentColor" opacity="0.85" />
      <circle cx={w * 0.78} cy={h * 0.62} r="6" stroke={accent} strokeWidth="1.4" fill="none" />
      <circle cx={w * 0.78} cy={h * 0.62} r="2.5" fill={accent} />
    </g>
  );
  else body = (
    <g>
      <circle cx={w / 2} cy={h * 0.30} r={w * 0.12} fill="currentColor" opacity="0.85" />
      <path d={`M${w * 0.25} ${h * 0.55} L${w * 0.50} ${h * 0.42} L${w * 0.75} ${h * 0.55} L${w * 0.72} ${h * 0.85} L${w * 0.28} ${h * 0.85} Z`} fill="currentColor" opacity="0.85" />
      <path d={`M${w * 0.20} ${h * 0.78} L${w * 0.28} ${h * 0.58}`} stroke={accent} strokeWidth="2" />
    </g>
  );
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ color: "rgba(180,210,240,0.5)" }}>
      {frame}
      {body}
    </svg>
  );
}

function HexGridSVG({ opacity = 0.10, glow = false, id = "default" }: { opacity?: number; glow?: boolean; id?: string }) {
  const patId = `hexpat-${id}`;
  const glowId = `hexglow-${id}`;
  return (
    <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, opacity }}>
      <defs>
        <pattern id={patId} x="0" y="0" width="56" height="64" patternUnits="userSpaceOnUse">
          <path d="M14 0 L42 0 L56 16 L56 48 L42 64 L14 64 L0 48 L0 16 Z" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
        {glow && (
          <radialGradient id={glowId} cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor={C.jade} stopOpacity="0.35" />
            <stop offset="60%" stopColor={C.jade} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patId})`} style={{ color: "currentColor" }} />
      {glow && <rect width="100%" height="100%" fill={`url(#${glowId})`} />}
    </svg>
  );
}

function RiftLanes({ width = 480, height = 480 }: { width?: number; height?: number }) {
  const turrets: [number, number][] = [[70,150],[150,70],[230,70],[70,240],[70,360],[150,410],[230,410],[410,320],[330,410],[330,70],[410,150],[240,240]];
  return (
    <svg width={width} height={height} viewBox="0 0 480 480" fill="none" style={{ display: "block" }}>
      <path d="M40 240 L240 40 L440 240 L240 440 Z" stroke={C.lineStrong} strokeWidth="1.2" fill="rgba(15,27,48,0.4)" />
      <path d="M40 240 L100 240 L100 300 L40 300 Z M40 300 L40 240" stroke={C.cyan} strokeWidth="1.2" fill="rgba(93,209,238,0.06)" />
      <circle cx="70" cy="270" r="14" fill={C.cyan} opacity="0.15" />
      <circle cx="70" cy="270" r="6" stroke={C.cyan} strokeWidth="1.2" fill="none" />
      <path d="M380 180 L440 180 L440 240 L380 240 Z" stroke="rgba(232,113,113,0.7)" strokeWidth="1.2" fill="rgba(232,113,113,0.06)" />
      <circle cx="410" cy="210" r="14" fill="rgba(232,113,113,0.18)" />
      <circle cx="410" cy="210" r="6" stroke="rgba(232,113,113,0.7)" strokeWidth="1.2" fill="none" />
      <path d="M70 240 L70 70 L240 70 L410 70 L410 210" stroke={C.jade} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      <path d="M70 300 L70 410 L240 410 L410 410 L410 240" stroke={C.jade} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      <path d="M100 270 L240 240 L380 210" stroke={C.jade} strokeWidth="1.6" fill="none" strokeDasharray="6 4" />
      <path d="M120 360 L360 120" stroke={C.cyan} strokeWidth="0.8" strokeDasharray="2 5" opacity="0.5" />
      {turrets.map(([x, y], i) => (
        <rect key={i} x={x - 3} y={y - 3} width="6" height="6" fill={C.fg} opacity="0.5" transform={`rotate(45 ${x} ${y})`} />
      ))}
      <text x="240" y="56" textAnchor="middle" fill={C.fgMuted} fontSize="10" fontFamily="var(--font-display)" letterSpacing="2">TOP</text>
      <text x="240" y="232" textAnchor="middle" fill={C.fgMuted} fontSize="10" fontFamily="var(--font-display)" letterSpacing="2">MID</text>
      <text x="240" y="430" textAnchor="middle" fill={C.fgMuted} fontSize="10" fontFamily="var(--font-display)" letterSpacing="2">BOT</text>
      <text x="180" y="320" textAnchor="middle" fill={C.fgFaint} fontSize="9" fontFamily="var(--font-display)" letterSpacing="2">JUNGLE</text>
    </svg>
  );
}

// ─── Icon set ─────────────────────────────────────────────────────────────────

function IconArrow({ style }: { style?: CSSProperties }) {
  return <svg viewBox="0 0 16 16" width="14" height="14" style={style}><path d="M3 8 L13 8 M9 4 L13 8 L9 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function FeatureIcon({ name, style }: { name: string; style?: CSSProperties }) {
  const p = { viewBox: "0 0 16 16", width: "14", height: "14", style, fill: "none" as const, stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "bolt") return <svg {...p}><path d="M9 1 L3 9 L7 9 L6 15 L13 7 L9 7 Z" /></svg>;
  if (name === "spark") return <svg {...p}><path d="M8 2 L8 6 M8 10 L8 14 M2 8 L6 8 M10 8 L14 8 M4 4 L6 6 M10 10 L12 12 M12 4 L10 6 M6 10 L4 12" /></svg>;
  if (name === "shield") return <svg {...p}><path d="M8 1 L13 3 L13 8 C13 11.5 10.5 13.5 8 14.5 C5.5 13.5 3 11.5 3 8 L3 3 Z" /></svg>;
  if (name === "scroll") return <svg {...p}><rect x="3" y="2" width="10" height="12" rx="1" /><path d="M5 6 L11 6 M5 9 L11 9 M5 12 L9 12" /></svg>;
  return null;
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: C.jade, marginBottom: 16 }}>
      {children}
    </div>
  );
}

function SiteHeader() {
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "22px 56px",
      borderBottom: `1px solid ${C.lineSoft}`,
      background: "rgba(7,13,27,0.5)",
      backdropFilter: "blur(8px)",
      position: "sticky", top: 0, zIndex: 50,
    }}>
      <DFMLogo />
      <nav style={{ display: "flex", gap: 28, fontSize: 13, color: C.fgMuted }}>
        <a href="#comment-ca-marche" style={{ color: "inherit", textDecoration: "none" }}>Comment ça marche</a>
        <a href="#fonctionnalites" style={{ color: "inherit", textDecoration: "none" }}>Fonctionnalités</a>
        <a href="#pour-qui" style={{ color: "inherit", textDecoration: "none" }}>Pour qui</a>
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{
          fontSize: 11, fontFamily: "var(--font-display)", letterSpacing: "0.14em",
          textTransform: "uppercase", color: C.fgFaint,
          padding: "5px 10px", border: `1px solid ${C.line}`, borderRadius: 999,
        }}>Patch 16.10</span>
        <Link href={DRAFT_HREF} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 10,
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13,
          background: C.jade, color: "#062013",
          boxShadow: C.glow, textDecoration: "none",
        }}>
          Tester une draft <IconArrow />
        </Link>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer style={{
      padding: "40px 56px 32px",
      borderTop: `1px solid ${C.lineSoft}`,
      color: C.fgFaint, fontSize: 12,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <DFMMark size={18} color={C.fgFaint} tone={C.jade} />
        <span>DraftForMe · Projet non affilié à Riot Games · 2026</span>
      </div>
      <div style={{ display: "flex", gap: 22 }}>
        <span style={{ cursor: "pointer" }}>Mentions légales</span>
        <span style={{ cursor: "pointer" }}>Vie privée</span>
        <span style={{ cursor: "pointer" }}>Contact</span>
      </div>
    </footer>
  );
}

// ─── Demo panel ───────────────────────────────────────────────────────────────

function TeamRow({ side, label, team }: { side: "enemy" | "ally"; label: string; team: ChampEntry[] }) {
  const sideColor = side === "enemy" ? "rgba(232,113,113,0.85)" : C.cyan;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.14em", textTransform: "uppercase", color: sideColor }}>{label}</span>
        <span style={{ fontSize: 10, color: C.fgFaint, fontFamily: "var(--font-mono)" }}>{side === "enemy" ? "ENEMY" : "BLUE SIDE"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {team.map((c) => {
          const isYou = c.lane === "mid" && !!c.placeholder;
          const accent = isYou ? C.jade : side === "enemy" ? "rgba(232,113,113,0.7)" : C.cyan;
          return (
            <div key={c.name + c.lane} style={{
              padding: 8,
              border: `1px solid ${isYou ? C.jade : C.line}`,
              borderRadius: 8,
              background: isYou ? C.jadeSoft : C.surface,
              textAlign: "center",
            }}>
              <div style={{ color: side === "enemy" ? "rgba(232,113,113,0.7)" : C.cyan }}>
                <ChampSilhouette archetype={c.archetype} size={50} accent={accent} />
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: isYou ? C.jade : C.fgMuted, fontFamily: "var(--font-display)", fontWeight: 500 }}>
                {c.name}
              </div>
              <div style={{ fontSize: 9, color: C.fgFaint, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {c.lane}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecCard({ rec, index }: { rec: Rec; index: number }) {
  const accent = RISK_COLOR[rec.risk];
  return (
    <div style={{
      display: "flex", gap: 14, padding: 14,
      border: `1px solid ${index === 1 ? C.jade : C.line}`,
      background: index === 1 ? "rgba(76,242,180,0.04)" : C.surface,
      borderRadius: 10, position: "relative",
    }}>
      {index === 1 && (
        <span style={{
          position: "absolute", top: -1, right: -1,
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
          background: C.jade, color: "#062013",
          padding: "3px 8px", borderRadius: "0 9px 0 6px", fontWeight: 600,
        }}>Top pick</span>
      )}
      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ color: accent }}>
          <ChampSilhouette archetype={rec.archetype} size={56} accent={accent} />
        </div>
        <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: accent }}>
          {rec.riskLabel}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 600, color: C.fg }}>{rec.name}</span>
          <span style={{ fontSize: 10, color: C.fgFaint, fontFamily: "var(--font-mono)" }}>#{index}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {rec.tags.map(t => (
            <span key={t} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 99, border: `1px solid ${C.lineStrong}`, color: C.fgMuted }}>
              {t}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: C.fgMuted, margin: 0 }}>{rec.why}</p>
      </div>
    </div>
  );
}

function DemoPanel() {
  return (
    <div style={{
      background: C.bg1, border: `1px solid ${C.lineStrong}`,
      borderRadius: 14, padding: 24,
      boxShadow: C.glow,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 18, marginBottom: 20, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DFMMark size={20} color={C.fgMuted} tone={C.jade} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: C.fgFaint, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            DRAFT · MIDLANE · BAN PHASE TERMINÉE
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {ROLES.map((r) => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 10px", fontSize: 11,
              border: `1px solid ${r.id === "mid" ? C.jade : C.line}`,
              background: r.id === "mid" ? C.jadeSoft : "transparent",
              color: r.id === "mid" ? C.jade : C.fgMuted,
              borderRadius: 7, fontFamily: "var(--font-display)", letterSpacing: "0.04em",
            }}>
              <RoleIcon role={r.id} size={14} /> {r.label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24 }}>
        <div>
          <TeamRow side="enemy" label="Équipe adverse" team={DEMO_ENEMY} />
          <div style={{ height: 16 }} />
          <TeamRow side="ally" label="Votre équipe" team={DEMO_ALLY} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <h4 style={{ fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 600, margin: 0, color: C.fg }}>
              Picks recommandés pour vous
            </h4>
            <span style={{ fontSize: 10, color: C.fgFaint, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase" }}>3 OPTIONS</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {DEMO_RECS.map((r, i) => <RecCard key={r.name} rec={r} index={i + 1} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const btnPrimary: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 10,
    padding: "18px 30px", borderRadius: 10,
    fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15,
    background: C.jade, color: "#062013",
    boxShadow: C.glow, textDecoration: "none",
  };
  const btnSecondary: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 10,
    padding: "18px 30px", borderRadius: 10,
    fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15,
    background: "transparent", color: C.fg,
    border: `1px solid ${C.lineStrong}`, textDecoration: "none",
  };

  return (
    <div style={{ background: C.bg1, color: C.fg, fontFamily: "var(--font-body)", minHeight: "100vh" }}>

      {/* ── Top status bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 56px",
        borderBottom: `1px solid ${C.line}`,
        background: C.bg0,
        fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em",
        color: C.fgFaint, textTransform: "uppercase",
      }}>
        <div style={{ display: "flex", gap: 22 }}>
          <span>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 99, background: C.jade, boxShadow: `0 0 10px ${C.jade}`, marginRight: 8, verticalAlign: "middle" }} />
            LIVE BETA
          </span>
          <span>v2026.05.17</span>
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          <span>FR · EU-WEST</span>
          <span>5 ROLES INDEXED</span>
          <span style={{ color: C.jade }}>OPERATIONAL</span>
        </div>
      </div>

      <SiteHeader />

      {/* ── Hero ── */}
      <section style={{ position: "relative", overflow: "hidden", padding: "90px 80px 110px", background: C.bg0 }}>
        <div style={{ color: "rgba(160,220,255,1)", position: "absolute", inset: 0 }}>
          <HexGridSVG opacity={0.18} glow id="hero" />
        </div>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(80% 60% at 50% 0%, rgba(76,242,180,0.18) 0%, transparent 60%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, transparent 0%, ${C.bg1} 95%)`, pointerEvents: "none" }} />

        {(["tl", "tr", "bl", "br"] as const).map((c) => (
          <span key={c} style={{
            position: "absolute", width: 42, height: 42, zIndex: 1,
            ...(c[0] === "t" ? { top: 24 } : { bottom: 24 }),
            ...(c[1] === "l" ? { left: 24 } : { right: 24 }),
            borderTop:    c[0] === "t" ? `1.5px solid ${C.jade}` : "none",
            borderBottom: c[0] === "b" ? `1.5px solid ${C.jade}` : "none",
            borderLeft:   c[1] === "l" ? `1.5px solid ${C.jade}` : "none",
            borderRight:  c[1] === "r" ? `1.5px solid ${C.jade}` : "none",
            boxShadow: C.glow,
          }} />
        ))}

        <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", textAlign: "center", paddingBottom: 60 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 12,
            padding: "8px 18px", borderRadius: 99,
            border: `1px solid ${C.jade}`,
            background: C.jadeSoft,
            marginBottom: 32,
            boxShadow: C.glow,
          }}>
            <DFMMark size={16} color={C.jade} tone={C.jade} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: "0.2em", fontWeight: 600, textTransform: "uppercase", color: C.jade }}>
              Draft coach · League of Legends
            </span>
          </div>

          <h1 style={{
            fontSize: 88, lineHeight: 1.0, letterSpacing: "-0.03em",
            fontWeight: 700, margin: "0 0 24px",
            fontFamily: "var(--font-display)",
          }}>
            Quel champion{" "}
            <em style={{ fontStyle: "normal", color: C.jade, position: "relative", display: "inline-block" }}>
              pick
              <svg style={{ position: "absolute", left: -6, right: -6, top: -6, bottom: -6, width: "calc(100% + 12px)", height: "calc(100% + 12px)", pointerEvents: "none" }} viewBox="0 0 100 60" preserveAspectRatio="none">
                <path d="M5 30 L95 30 M50 5 L50 55" stroke={C.jade} strokeWidth="0.5" opacity="0.5" />
                <circle cx="50" cy="30" r="22" fill="none" stroke={C.jade} strokeWidth="0.5" strokeDasharray="2 3" opacity="0.6" />
              </svg>
            </em>
            <br />dans cette draft ?
          </h1>

          <p style={{ fontSize: 20, lineHeight: 1.5, color: C.fgMuted, maxWidth: 640, margin: "0 auto 40px" }}>
            DraftForMe analyse la composition, le rôle joué et les risques de la partie — et vous propose{" "}
            <strong style={{ color: C.fg }}>trois picks adaptés</strong>, classés du plus safe au plus pointu.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 20 }}>
            <Link href={DRAFT_HREF} style={btnPrimary}>
              Tester une draft <IconArrow />
            </Link>
            <a href="#demo" style={btnSecondary}>Voir un exemple</a>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", color: C.fgFaint, textTransform: "uppercase" }}>
            Sans création de compte · Gratuit pendant la beta
          </div>
        </div>

        <div id="demo" style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
          <DemoPanel />
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section id="comment-ca-marche" style={{ padding: "96px 80px", borderTop: `1px solid ${C.lineSoft}` }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <Eyebrow>Comment ça marche</Eyebrow>
            <h2 style={{ fontSize: 48, lineHeight: 1.1, margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Du contexte. Trois picks. Une décision.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: C.fgMuted, maxWidth: 600, margin: "18px auto 0" }}>
              L'enchaînement complet, du moment où vous ouvrez l'outil jusqu'à votre pick verrouillé.
            </p>
          </div>

          <div style={{ position: "relative", padding: "40px 0" }}>
            <div style={{ position: "absolute", left: "8%", right: "8%", top: "50%", height: 1, background: `linear-gradient(90deg, transparent 0%, ${C.jade} 20%, ${C.jade} 80%, transparent 100%)`, opacity: 0.5 }} />
            <div style={{ position: "absolute", left: "8%", right: "8%", top: "50%", height: 1, background: C.jade, boxShadow: `0 0 8px ${C.jade}`, opacity: 0.4 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, position: "relative" }}>
              {STEPS.map((s, i) => (
                <div key={s.n} style={{ textAlign: "center" }}>
                  <div style={{ width: 88, height: 88, margin: "0 auto 20px", position: "relative" }}>
                    <svg viewBox="0 0 88 88" style={{ position: "absolute", inset: 0 }}>
                      <path d="M44 4 L78 22 L78 66 L44 84 L10 66 L10 22 Z" fill={C.bg2} stroke={C.jade} strokeWidth="1.4" />
                      <path d="M44 12 L70 26 L70 62 L44 76 L18 62 L18 26 Z" fill="none" stroke={C.jade} strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6" />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.jade }}>
                      <RoleIcon role={s.role} size={30} />
                    </div>
                    <span style={{
                      position: "absolute", top: -2, right: -2,
                      width: 24, height: 24, borderRadius: 99,
                      background: C.bg1, border: `1px solid ${C.jade}`, color: C.jade,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, fontFamily: "var(--font-display)",
                    }}>{i + 1}</span>
                  </div>
                  <h3 style={{ fontSize: 18, marginBottom: 10, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.01em" }}>{s.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.55, color: C.fgMuted, maxWidth: 240, margin: "0 auto" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ── */}
      <section id="fonctionnalites" style={{ padding: "96px 80px", borderTop: `1px solid ${C.lineSoft}`, background: C.bg0 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48 }}>
            <div>
              <Eyebrow>Fonctionnalités</Eyebrow>
              <h2 style={{ fontSize: 48, lineHeight: 1.1, maxWidth: 600, margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                Tout ce qu'il faut pour pick bien. Rien de plus.
              </h2>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: C.fgFaint, textTransform: "uppercase", padding: "10px 16px", border: `1px solid ${C.line}`, borderRadius: 99 }}>
              4 MODULES · COUNTERPICK CORE
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} style={{
                position: "relative", padding: "28px 24px",
                background: C.bg2, border: `1px solid ${C.lineStrong}`,
                borderRadius: 14, overflow: "hidden",
                minHeight: 280, display: "flex", flexDirection: "column",
              }}>
                <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, color: C.jade, opacity: 0.12 }}>
                  <svg viewBox="0 0 120 120"><path d="M60 5 L106 32 L106 88 L60 115 L14 88 L14 32 Z" stroke="currentColor" strokeWidth="1" fill="none" /></svg>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: C.jade, textTransform: "uppercase" }}>
                    MODULE_0{i + 1}
                  </span>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: C.jade, boxShadow: `0 0 8px ${C.jade}`, display: "inline-block" }} />
                </div>
                <div style={{
                  width: 54, height: 54, marginBottom: 22,
                  background: "rgba(76,242,180,0.12)", border: `1px solid ${C.jade}`,
                  borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  color: C.jade, boxShadow: "inset 0 0 12px rgba(76,242,180,0.2)",
                }}>
                  <FeatureIcon name={f.icon} style={{ transform: "scale(1.4)" }} />
                </div>
                <h3 style={{ fontSize: 19, marginBottom: 10, lineHeight: 1.25, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.01em" }}>{f.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: C.fgMuted, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ padding: 32, background: C.bg2, border: `1px solid ${C.lineStrong}`, borderRadius: 14, display: "flex", alignItems: "center", gap: 32 }}>
              <div style={{ color: C.fgMuted, flex: "0 0 auto" }}>
                <RiftLanes width={240} height={240} />
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: C.jade, textTransform: "uppercase", marginBottom: 14 }}>RIFT_MAP</div>
                <h3 style={{ fontSize: 22, marginBottom: 10, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.01em" }}>Conseils par lane, par phase, par contexte.</h3>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: C.fgMuted, margin: 0 }}>
                  Mid roam, jungle dive, bot scaling — chaque lane a ses propres signaux. DraftForMe les lit pour vous.
                </p>
              </div>
            </div>

            <div style={{ padding: 32, background: C.bg2, border: `1px solid ${C.lineStrong}`, borderRadius: 14 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: C.jade, textTransform: "uppercase", marginBottom: 14 }}>RISK_METER</div>
              <h3 style={{ fontSize: 22, marginBottom: 18, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.01em" }}>
                Trois niveaux de risque, jamais un seul "best pick".
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { lbl: "SAFE", desc: "Difficile à punir, marche partout", color: C.jade, pct: 85 },
                  { lbl: "ÉQUILIBRÉ", desc: "Bonne value si bien joué", color: C.cyan, pct: 65 },
                  { lbl: "PLUS POINTU", desc: "Tranche la comp adverse — risqué", color: C.gold, pct: 40 },
                ].map(r => (
                  <div key={r.lbl} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ flex: "0 0 100px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: r.color }}>{r.lbl}</span>
                    <div style={{ flex: 1, height: 6, background: C.bg3, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${r.pct}%`, height: "100%", background: r.color, boxShadow: `0 0 10px ${r.color}` }} />
                    </div>
                    <span style={{ flex: "0 0 auto", fontSize: 11, color: C.fgMuted }}>{r.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pour qui ── */}
      <section id="pour-qui" style={{ padding: "96px 80px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <Eyebrow>Pour qui c'est</Eyebrow>
            <h2 style={{ fontSize: 48, lineHeight: 1.1, maxWidth: 700, margin: "0 auto", fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Pas pour les pros.<br />Pour les joueurs qui veulent juste s'amuser.
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {AUDIENCE.map((a, i) => (
              <div key={i} style={{
                display: "flex", gap: 20, padding: "24px 28px",
                background: C.surface, border: `1px solid ${C.line}`,
                borderRadius: 14,
              }}>
                <div style={{
                  flex: "0 0 auto", width: 48, height: 48, borderRadius: 12,
                  background: C.jadeSoft, border: `1px solid ${C.jade}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: C.jade, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14,
                }}>0{i + 1}</div>
                <p style={{ fontSize: 15, lineHeight: 1.55, alignSelf: "center", margin: 0 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ padding: "80px 80px 120px", background: C.bg0 }}>
        <div style={{
          maxWidth: 1180, margin: "0 auto",
          padding: "88px 64px",
          border: `1px solid ${C.jade}`,
          borderRadius: 20,
          background: `linear-gradient(180deg, rgba(76,242,180,0.04) 0%, ${C.surface} 100%)`,
          textAlign: "center",
          position: "relative", overflow: "hidden",
          boxShadow: C.glowStrong,
        }}>
          <div style={{ color: "rgba(160,220,255,1)", position: "absolute", inset: 0 }}>
            <HexGridSVG opacity={0.14} glow id="cta" />
          </div>
          <div style={{ position: "relative" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em",
              color: C.jade, textTransform: "uppercase",
              padding: "6px 14px", border: `1px solid ${C.jade}`, borderRadius: 99,
              marginBottom: 32,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: C.jade, boxShadow: `0 0 8px ${C.jade}`, display: "inline-block" }} />
              READY TO DRAFT
            </div>
            <h2 style={{ fontSize: 60, lineHeight: 1.05, marginBottom: 20, letterSpacing: "-0.025em", fontFamily: "var(--font-display)", fontWeight: 700 }}>
              Lancez une draft.<br />
              <span style={{ color: C.jade }}>Voyez si ça change votre game.</span>
            </h2>
            <p style={{ color: C.fgMuted, fontSize: 17, lineHeight: 1.55, maxWidth: 560, margin: "0 auto 36px" }}>
              30 secondes. Aucun compte. Si ça aide, vous revenez. Sinon, vous nous oubliez sans regret.
            </p>
            <Link href={DRAFT_HREF} style={{ ...btnPrimary, padding: "20px 36px", fontSize: 16 }}>
              Tester une draft <IconArrow />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
