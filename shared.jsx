// shared.jsx — brand mark, role icons, champion silhouettes, content data
// All components exposed via window.* for cross-file babel scope.

// ─── Brand mark ───────────────────────────────────────────────────────────
const DFMMark = ({ size = 28, color = 'currentColor', tone = 'var(--dfm-jade)' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
    {/* hex outline */}
    <path d="M16 2.5 L28 9.5 L28 22.5 L16 29.5 L4 22.5 L4 9.5 Z"
          stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill="none" />
    {/* inner hex (smaller) */}
    <path d="M16 8 L23 12 L23 20 L16 24 L9 20 L9 12 Z"
          stroke={tone} strokeWidth="1.2" fill="none" opacity="0.7" />
    {/* crosshair */}
    <circle cx="16" cy="16" r="1.6" fill={tone} />
    <line x1="16" y1="3.5" x2="16" y2="6.5" stroke={tone} strokeWidth="1.4" strokeLinecap="round" />
    <line x1="16" y1="25.5" x2="16" y2="28.5" stroke={tone} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const DFMLogo = ({ size = 26, accent = 'var(--dfm-jade)' }) => (
  <div style={{display:'inline-flex', alignItems:'center', gap:10}}>
    <DFMMark size={size} color="var(--dfm-fg)" tone={accent} />
    <span style={{fontFamily:'var(--dfm-font-display)', fontWeight:700, fontSize:18, letterSpacing:'-0.01em'}}>
      Draft<span style={{color:accent}}>For</span>Me
    </span>
  </div>
);

// ─── Role icons (1.75-stroke outline, currentColor) ────────────────────────
const RoleIcon = ({ role, size = 22 }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (role) {
    case 'top':
      return (
        <svg {...props}>
          <path d="M4 4 L20 4 L20 20" />
          <path d="M4 4 L20 20" strokeDasharray="2 2" opacity="0.55" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'jungle':
      return (
        <svg {...props}>
          <path d="M12 3 L17 9 L14.5 9 L18 14 L14 14 L17 19 L7 19 L10 14 L6 14 L9.5 9 L7 9 Z" />
          <path d="M12 19 L12 21" />
        </svg>
      );
    case 'mid':
      return (
        <svg {...props}>
          <path d="M4 20 L20 4" />
          <path d="M4 4 L8 4 L8 8" />
          <path d="M20 20 L16 20 L16 16" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case 'adc':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2 L12 6 M12 18 L12 22 M2 12 L6 12 M18 12 L22 12" />
        </svg>
      );
    case 'support':
      return (
        <svg {...props}>
          <path d="M12 3 L20 6 L20 12 C20 17 16 20 12 21 C8 20 4 17 4 12 L4 6 Z" />
          <path d="M9 12 L11 14 L15 10" />
        </svg>
      );
    default: return null;
  }
};

const ROLES = [
  { id: 'top',     label: 'Toplane' },
  { id: 'jungle',  label: 'Jungler' },
  { id: 'mid',     label: 'Midlane' },
  { id: 'adc',     label: 'ADC'     },
  { id: 'support', label: 'Support' },
];

// ─── Stylized champion silhouettes (abstract — diamonds/hex frames) ────────
// Geometric, recognizable by archetype. Each is a 64×80 framed silhouette.
const ChampSilhouette = ({ archetype = 'fighter', accent = 'var(--dfm-jade)', frame = 'hex', size = 80 }) => {
  const w = size;
  const h = size * 1.25;
  const frameEl = frame === 'hex' ? (
    <path d={`M${w/2} 2 L${w-4} ${h*0.25} L${w-4} ${h*0.75} L${w/2} ${h-2} L4 ${h*0.75} L4 ${h*0.25} Z`}
          stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" fill="rgba(15,27,48,0.65)" />
  ) : (
    <rect x="3" y="3" width={w-6} height={h-6} rx="6" stroke="currentColor" strokeOpacity="0.35" fill="rgba(15,27,48,0.65)" />
  );
  // Each silhouette: head + shoulders + a signature glyph
  let body;
  switch (archetype) {
    case 'mage': body = (
      <g>
        <circle cx={w/2} cy={h*0.32} r={w*0.13} fill="currentColor" opacity="0.85" />
        <path d={`M${w*0.28} ${h*0.55} L${w*0.5} ${h*0.40} L${w*0.72} ${h*0.55} L${w*0.75} ${h*0.85} L${w*0.25} ${h*0.85} Z`} fill="currentColor" opacity="0.85" />
        {/* staff sparkle */}
        <circle cx={w*0.78} cy={h*0.30} r="3" fill={accent} />
        <circle cx={w*0.78} cy={h*0.30} r="6" stroke={accent} strokeWidth="1" fill="none" opacity="0.6" />
      </g>
    ); break;
    case 'assassin': body = (
      <g>
        <circle cx={w/2} cy={h*0.30} r={w*0.11} fill="currentColor" opacity="0.85" />
        <path d={`M${w*0.30} ${h*0.50} L${w*0.5} ${h*0.42} L${w*0.70} ${h*0.50} L${w*0.65} ${h*0.85} L${w*0.35} ${h*0.85} Z`} fill="currentColor" opacity="0.85" />
        {/* dagger */}
        <path d={`M${w*0.20} ${h*0.78} L${w*0.30} ${h*0.62} L${w*0.34} ${h*0.66} L${w*0.24} ${h*0.82} Z`} fill={accent} />
      </g>
    ); break;
    case 'tank': body = (
      <g>
        <circle cx={w/2} cy={h*0.30} r={w*0.13} fill="currentColor" opacity="0.85" />
        <path d={`M${w*0.20} ${h*0.55} L${w*0.50} ${h*0.42} L${w*0.80} ${h*0.55} L${w*0.80} ${h*0.85} L${w*0.20} ${h*0.85} Z`} fill="currentColor" opacity="0.85" />
        {/* shield */}
        <path d={`M${w*0.50} ${h*0.55} L${w*0.62} ${h*0.58} L${w*0.62} ${h*0.70} L${w*0.50} ${h*0.76} L${w*0.38} ${h*0.70} L${w*0.38} ${h*0.58} Z`} stroke={accent} strokeWidth="1.4" fill="none" />
      </g>
    ); break;
    case 'marksman': body = (
      <g>
        <circle cx={w/2} cy={h*0.30} r={w*0.10} fill="currentColor" opacity="0.85" />
        <path d={`M${w*0.30} ${h*0.50} L${w*0.50} ${h*0.42} L${w*0.70} ${h*0.50} L${w*0.65} ${h*0.85} L${w*0.35} ${h*0.85} Z`} fill="currentColor" opacity="0.85" />
        {/* bow */}
        <path d={`M${w*0.75} ${h*0.45} Q${w*0.92} ${h*0.62} ${w*0.75} ${h*0.78}`} stroke={accent} strokeWidth="1.4" fill="none" />
        <line x1={w*0.78} y1={h*0.45} x2={w*0.78} y2={h*0.78} stroke={accent} strokeWidth="0.8" strokeDasharray="2 2" />
      </g>
    ); break;
    case 'support': body = (
      <g>
        <circle cx={w/2} cy={h*0.30} r={w*0.12} fill="currentColor" opacity="0.85" />
        <path d={`M${w*0.25} ${h*0.55} L${w*0.50} ${h*0.42} L${w*0.75} ${h*0.55} L${w*0.72} ${h*0.85} L${w*0.28} ${h*0.85} Z`} fill="currentColor" opacity="0.85" />
        {/* lantern */}
        <circle cx={w*0.78} cy={h*0.62} r="6" stroke={accent} strokeWidth="1.4" fill="none" />
        <circle cx={w*0.78} cy={h*0.62} r="2.5" fill={accent} />
      </g>
    ); break;
    default: body = (
      <g>
        <circle cx={w/2} cy={h*0.30} r={w*0.12} fill="currentColor" opacity="0.85" />
        <path d={`M${w*0.25} ${h*0.55} L${w*0.50} ${h*0.42} L${w*0.75} ${h*0.55} L${w*0.72} ${h*0.85} L${w*0.28} ${h*0.85} Z`} fill="currentColor" opacity="0.85" />
        {/* sword */}
        <path d={`M${w*0.20} ${h*0.78} L${w*0.28} ${h*0.58}`} stroke={accent} strokeWidth="2" />
      </g>
    );
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{color:'rgba(180,210,240,0.5)'}}>
      {frameEl}
      {body}
    </svg>
  );
};

// ─── Hex grid background (used as decorative tile) ────────────────────────
const HexGridSVG = ({ opacity = 0.10, glow = false }) => (
  <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{position:'absolute', inset:0, opacity}}>
    <defs>
      <pattern id={`hexpat-${glow ? 'g' : 'n'}`} x="0" y="0" width="56" height="64" patternUnits="userSpaceOnUse">
        <path d="M14 0 L42 0 L56 16 L56 48 L42 64 L14 64 L0 48 L0 16 Z"
              fill="none" stroke="currentColor" strokeWidth="1" />
      </pattern>
      {glow && (
        <radialGradient id="hexglow" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="var(--dfm-jade)" stopOpacity="0.35" />
          <stop offset="60%" stopColor="var(--dfm-jade)" stopOpacity="0" />
        </radialGradient>
      )}
    </defs>
    <rect width="100%" height="100%" fill={`url(#hexpat-${glow ? 'g' : 'n'})`} style={{color:'currentColor'}} />
    {glow && <rect width="100%" height="100%" fill="url(#hexglow)" />}
  </svg>
);

// ─── Simplified Summoner's Rift lanes — three lanes + jungle (decorative) ─
const RiftLanes = ({ width = 480, height = 480, accent = 'var(--dfm-jade)' }) => (
  <svg width={width} height={height} viewBox="0 0 480 480" fill="none" style={{display:'block'}}>
    {/* outer diamond / map */}
    <path d="M40 240 L240 40 L440 240 L240 440 Z"
          stroke="var(--dfm-line-strong)" strokeWidth="1.2" fill="rgba(15,27,48,0.4)" />
    {/* base 1 (blue) */}
    <path d="M40 240 L100 240 L100 300 L40 300 Z M40 300 L40 240" stroke="var(--dfm-cyan)" strokeWidth="1.2" fill="rgba(93,209,238,0.06)" />
    <circle cx="70" cy="270" r="14" fill="var(--dfm-cyan)" opacity="0.15" />
    <circle cx="70" cy="270" r="6" stroke="var(--dfm-cyan)" strokeWidth="1.2" fill="none" />
    {/* base 2 (red) */}
    <path d="M380 180 L440 180 L440 240 L380 240 Z" stroke="rgba(232,113,113,0.7)" strokeWidth="1.2" fill="rgba(232,113,113,0.06)" />
    <circle cx="410" cy="210" r="14" fill="rgba(232,113,113,0.18)" />
    <circle cx="410" cy="210" r="6" stroke="rgba(232,113,113,0.7)" strokeWidth="1.2" fill="none" />

    {/* top lane */}
    <path d="M70 240 L70 70 L240 70 L410 70 L410 210"
          stroke={accent} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
    {/* bot lane */}
    <path d="M70 300 L70 410 L240 410 L410 410 L410 240"
          stroke={accent} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
    {/* mid lane */}
    <path d="M100 270 L240 240 L380 210"
          stroke={accent} strokeWidth="1.6" fill="none" strokeDasharray="6 4" />
    {/* river */}
    <path d="M120 360 L360 120" stroke="var(--dfm-cyan)" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.5" />

    {/* turret pips */}
    {[
      [70, 150],[150, 70],[230, 70],[70, 240],
      [70, 360],[150, 410],[230, 410],
      [410, 320],[330, 410],[330, 70],[410, 150],
      [240, 240]
    ].map(([x,y],i) => (
      <rect key={i} x={x-3} y={y-3} width="6" height="6" fill="var(--dfm-fg)" opacity="0.5" transform={`rotate(45 ${x} ${y})`} />
    ))}

    {/* role labels */}
    <text x="240" y="56" textAnchor="middle" fill="var(--dfm-fg-muted)" fontSize="10" fontFamily="var(--dfm-font-display)" letterSpacing="2">TOP</text>
    <text x="240" y="232" textAnchor="middle" fill="var(--dfm-fg-muted)" fontSize="10" fontFamily="var(--dfm-font-display)" letterSpacing="2">MID</text>
    <text x="240" y="430" textAnchor="middle" fill="var(--dfm-fg-muted)" fontSize="10" fontFamily="var(--dfm-font-display)" letterSpacing="2">BOT</text>
    <text x="180" y="320" textAnchor="middle" fill="var(--dfm-fg-faint)" fontSize="9" fontFamily="var(--dfm-font-display)" letterSpacing="2">JUNGLE</text>
  </svg>
);

// ─── Tiny utility icons used in chips ─────────────────────────────────────
const Icon = {
  check: (p) => (<svg viewBox="0 0 16 16" width="14" height="14" {...p}><path d="M3 8.5 L7 12 L13 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  cross: (p) => (<svg viewBox="0 0 16 16" width="14" height="14" {...p}><path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>),
  bolt:  (p) => (<svg viewBox="0 0 16 16" width="14" height="14" {...p}><path d="M9 1 L3 9 L7 9 L6 15 L13 7 L9 7 Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/></svg>),
  arrow: (p) => (<svg viewBox="0 0 16 16" width="14" height="14" {...p}><path d="M3 8 L13 8 M9 4 L13 8 L9 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  shield:(p) => (<svg viewBox="0 0 16 16" width="14" height="14" {...p}><path d="M8 1 L13 3 L13 8 C13 11.5 10.5 13.5 8 14.5 C5.5 13.5 3 11.5 3 8 L3 3 Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/></svg>),
  spark: (p) => (<svg viewBox="0 0 16 16" width="14" height="14" {...p}><path d="M8 2 L8 6 M8 10 L8 14 M2 8 L6 8 M10 8 L14 8 M4 4 L6 6 M10 10 L12 12 M12 4 L10 6 M6 10 L4 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>),
  scroll:(p) => (<svg viewBox="0 0 16 16" width="14" height="14" {...p}><rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5 6 L11 6 M5 9 L11 9 M5 12 L9 12" stroke="currentColor" strokeWidth="1.2"/></svg>),
};

// ─── Steps content ────────────────────────────────────────────────────────
const STEPS = [
  { n: '01', title: 'Choisissez votre rôle', desc: 'Top, jungle, mid, ADC ou support. C’est le point de départ.', role: 'top' },
  { n: '02', title: 'Ajoutez les ennemis pickés', desc: 'Au fur et à mesure de la draft. Pas besoin d’avoir tout.', role: 'mid' },
  { n: '03', title: 'On analyse la draft', desc: 'Matchups, scaling, dégâts, sources de pression, comp adverse.', role: 'jungle' },
  { n: '04', title: 'Recevez 3 picks adaptés', desc: 'Avec un niveau de risque et deux phrases d’explication.', role: 'adc' },
];

const FEATURES = [
  { title: 'Counterpick par rôle',     desc: 'Pour chaque ennemi déjà pické, on sait ce qui passe — et ce qui galère.', icon: 'bolt' },
  { title: 'Conseils contextuels',     desc: 'Adapté à la phase de jeu, à la comp de votre équipe et à votre niveau.',   icon: 'spark' },
  { title: 'Picks safe ou risqués',    desc: 'Trois propositions classées : la fiable, l’équilibrée, la pointue.',      icon: 'shield' },
  { title: 'Explications pédagogiques',desc: 'Pourquoi ce pick fonctionne, en deux phrases. Pas de jargon inutile.',     icon: 'scroll' },
];

const AUDIENCE = [
  'Vous jouez 5 games par semaine en Normal ou Bronze/Silver.',
  'Vous hésitez à chaque pick et ça vous fait perdre du temps.',
  'Vous voulez progresser sans tuto YouTube de 30 minutes.',
  'Vous savez pas qui counter qui — et c’est complètement normal.',
];

// ─── Demo data: enemy team + recommendations ──────────────────────────────
const DEMO = {
  role: 'mid',
  enemy: [
    { name: 'Yasuo',      archetype: 'fighter',  lane: 'top' },
    { name: 'Lee Sin',    archetype: 'assassin', lane: 'jungle' },
    { name: 'Zed',        archetype: 'assassin', lane: 'mid' },
    { name: 'Caitlyn',    archetype: 'marksman', lane: 'adc' },
    { name: 'Lulu',       archetype: 'support',  lane: 'support' },
  ],
  ally: [
    { name: 'Malphite',   archetype: 'tank',     lane: 'top' },
    { name: 'Sejuani',    archetype: 'tank',     lane: 'jungle' },
    { name: '?',          archetype: 'mage',     lane: 'mid', placeholder: true },
    { name: 'Jinx',       archetype: 'marksman', lane: 'adc' },
    { name: 'Thresh',     archetype: 'support',  lane: 'support' },
  ],
  recs: [
    {
      name: 'Galio', archetype: 'mage', risk: 'safe', riskLabel: 'Safe',
      tags: ['Counter Zed', 'Roams', 'Crowd control'],
      why: 'E pour bloquer le dash, ult pour suivre la jungle. Reste safe en lane même sans CS parfait.',
    },
    {
      name: 'Lissandra', archetype: 'mage', risk: 'balanced', riskLabel: 'Équilibré',
      tags: ['Anti-dive', 'Scaling', 'Ult défensive'],
      why: 'L’ultime ferme le combat sur Zed ou Lee Sin. Bonne entre Yasuo, mais demande de gérer les vagues.',
    },
    {
      name: 'Diana', archetype: 'assassin', risk: 'sharp', riskLabel: 'Plus pointu',
      tags: ['Punit Zed', 'Tue ADC', 'Skill ceiling moyen'],
      why: 'Combo R sur Caitlyn ou Zed après le 6. Demande des bons engages, mais ça tranche la comp adverse.',
    },
  ],
};

const RISK_COLOR = {
  safe:     'var(--dfm-jade)',
  balanced: 'var(--dfm-cyan)',
  sharp:    'var(--dfm-gold)',
};

// ─── Shared header / footer ───────────────────────────────────────────────
const DFMHeader = ({ accent, label = 'Beta privée' }) => (
  <header style={{
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'22px 56px',
    borderBottom:'1px solid var(--dfm-line-soft)',
    background:'rgba(7, 13, 27, 0.5)',
    backdropFilter:'blur(8px)',
  }}>
    <DFMLogo accent={accent} />
    <nav style={{display:'flex', gap:28, fontSize:13, color:'var(--dfm-fg-muted)'}}>
      <a>Comment ça marche</a>
      <a>Fonctionnalités</a>
      <a>Pour qui</a>
      <a>FAQ</a>
    </nav>
    <div style={{display:'flex', alignItems:'center', gap:14}}>
      <span style={{
        fontSize:11, fontFamily:'var(--dfm-font-display)', letterSpacing:'0.14em',
        textTransform:'uppercase', color:'var(--dfm-fg-faint)',
        padding:'5px 10px', border:'1px solid var(--dfm-line)', borderRadius:999,
      }}>{label}</span>
      <button className="dfm-btn dfm-btn-primary" style={{padding:'10px 16px', fontSize:13}}>
        Tester une draft <Icon.arrow />
      </button>
    </div>
  </header>
);

const DFMFooter = ({ accent }) => (
  <footer style={{
    padding:'40px 56px 32px',
    borderTop:'1px solid var(--dfm-line-soft)',
    color:'var(--dfm-fg-faint)',
    fontSize:12,
    display:'flex', alignItems:'center', justifyContent:'space-between',
  }}>
    <div style={{display:'flex', alignItems:'center', gap:14}}>
      <DFMMark size={18} color="var(--dfm-fg-faint)" tone={accent} />
      <span>DraftForMe · Projet non affilié à Riot Games · 2026</span>
    </div>
    <div style={{display:'flex', gap:22}}>
      <a>Mentions légales</a>
      <a>Vie privée</a>
      <a>Contact</a>
    </div>
  </footer>
);

// expose all to global so other babel scripts can use them
Object.assign(window, {
  DFMMark, DFMLogo, RoleIcon, ChampSilhouette, HexGridSVG, RiftLanes,
  Icon, STEPS, FEATURES, AUDIENCE, DEMO, RISK_COLOR, ROLES,
  DFMHeader, DFMFooter,
});
