// decision-space.jsx — DraftForMe · Espace de décision
// Remplace la "liste de suggestions" par une vue comparable + détaillée.
//
// Exports (window.*):
//   DecisionDesktop   1400×1080   side-by-side: grille (3 picks) + détail
//   DecisionMobile     390×1480   stack: row de 3 cards + détail dessous

// ─── Data ─────────────────────────────────────────────────────────────────
const DECISION = {
  context: {
    role: 'mid',
    side: 'blue',
    phase: 'Pick 4 / 5',
    enemies: [
      { name: 'Yasuo',   archetype: 'fighter',  lane: 'top'     },
      { name: 'Lee Sin', archetype: 'assassin', lane: 'jungle'  },
      { name: 'Zed',     archetype: 'assassin', lane: 'mid'     },
      { name: 'Caitlyn', archetype: 'marksman', lane: 'adc'     },
      { name: 'Lulu',    archetype: 'support',  lane: 'support' },
    ],
    allies: [
      { name: 'Malphite', archetype: 'tank',     lane: 'top'     },
      { name: 'Sejuani',  archetype: 'tank',     lane: 'jungle'  },
      { name: '?',        archetype: 'mage',     lane: 'mid', placeholder: true },
      { name: 'Jinx',     archetype: 'marksman', lane: 'adc'     },
      { name: 'Thresh',   archetype: 'support',  lane: 'support' },
    ],
  },
  picks: [
    {
      rank: 1,
      name: 'Galio',
      archetype: 'mage',
      score: 87,
      posture: 'Counter',
      postureType: 'counter',
      shortReason: 'Bloque le dash de Zed, ult pour suivre Lee Sin.',
      criteria: { draftMatch: 92, meta: 71, comfort: 80, risk: 25 },
      verdict: 'Le pick le plus complet face à une compo AD avec deux dive threats.',
      reasons: [
        { title: 'E annule le R de Zed',  desc: 'Stun bouclier + W passif → tu rends la lane infumable à Zed.' },
        { title: 'R = anti-gank universel', desc: 'Tu protèges Jinx en bot ou Malphite top selon où Lee Sin plonge.' },
        { title: 'Tu joues le scaling',     desc: 'Push wave, farm, attends 6. Pas besoin de prouver quoi que ce soit en early.' },
      ],
      risks: [
        { label: 'Damage solo faible',   desc: 'Si Jinx meurt, tu fais zéro carry — tu existes par tes alliés.' },
        { label: 'Cooldown ult 200 s',   desc: 'Mal timer ton R = 3 minutes sans ton meilleur outil.' },
      ],
      alternatives: [
        { name: 'Malzahar',  archetype: 'mage', delta: -6, why: 'Encore plus safe en lane, ult cible Zed' },
        { name: 'Lissandra', archetype: 'mage', delta: -8, why: 'Engage proactif au lieu de réactif' },
      ],
      advanced: {
        winrate: '54.2 %', pickrate: '6.8 %', banrate: '2.1 %',
        sample: '8 412 games · Bronze→Gold · patch 16.10',
        breakdown: [
          { label: 'Matchup Zed',       value: '+18', tone: 'good' },
          { label: 'Matchup Yasuo',     value:  '+8', tone: 'good' },
          { label: 'Matchup Lulu',      value:  '−6', tone: 'bad'  },
          { label: 'Synergie Malphite', value: '+12', tone: 'good' },
          { label: 'Scaling 25 min',    value: '+10', tone: 'good' },
          { label: 'Solo carry',        value: '−14', tone: 'bad'  },
          { label: 'Team utility',      value: '+22', tone: 'good' },
        ],
      },
    },
    {
      rank: 2,
      name: 'Malzahar',
      archetype: 'mage',
      score: 81,
      posture: 'Safe',
      postureType: 'safe',
      shortReason: 'Lane impossible à perdre + ult pour locker Zed.',
      criteria: { draftMatch: 78, meta: 82, comfort: 60, risk: 15 },
      verdict: 'Zéro risque en lane. Le plafond est bas, mais le plancher est très haut.',
      reasons: [
        { title: 'Voidlings push tout seuls', desc: 'Tu joues passif, tu fais ton CS sans lever les yeux du minimap.' },
        { title: 'R suppression sur Zed',     desc: 'Le combo R silence + dégâts → tu sors Zed du teamfight.' },
        { title: 'Courbe d\'apprentissage plate', desc: 'Combo simple. Idéal si tu n\'as pas envie de pratiquer un mid.' },
      ],
      risks: [
        { label: 'Tu fais 0 carry solo',   desc: 'Si ta team est derrière, Malzahar ne renverse rien à lui seul.' },
        { label: 'QSS / Banshee = mort',   desc: 'Quand l\'adversaire build QSS, ton outil principal saute.' },
      ],
      alternatives: [
        { name: 'Galio',  archetype: 'mage', delta: +6, why: 'Plus d\'utility, pick plus complet' },
        { name: 'Anivia', archetype: 'mage', delta: -2, why: 'Plus de wave clear, scaling plus fort' },
      ],
      advanced: {
        winrate: '52.8 %', pickrate: '4.1 %', banrate: '3.4 %',
        sample: '5 209 games · Bronze→Gold · patch 16.10',
        breakdown: [
          { label: 'Matchup Zed',       value: '+22', tone: 'good' },
          { label: 'Matchup Yasuo',     value:  '+4', tone: 'good' },
          { label: 'Matchup Lulu',      value:  '+2', tone: 'good' },
          { label: 'Synergie Malphite', value:  '+6', tone: 'good' },
          { label: 'Scaling 25 min',    value:  '+4', tone: 'good' },
          { label: 'Solo carry',        value: '−18', tone: 'bad'  },
          { label: 'Team utility',      value:  '+8', tone: 'good' },
        ],
      },
    },
    {
      rank: 3,
      name: 'Diana',
      archetype: 'assassin',
      score: 74,
      posture: 'Risque élevé',
      postureType: 'risk',
      shortReason: 'Tu pop Caitlyn ou Zed après 6 — si tu engage juste.',
      criteria: { draftMatch: 68, meta: 86, comfort: 35, risk: 80 },
      verdict: 'High-skill, high-reward. Tu peux porter — ou inter ta lane sur un mauvais call.',
      reasons: [
        { title: 'R reset = double kill',     desc: 'Engage Caitlyn → reset Lulu. Plafond le plus haut de tes 3 picks.' },
        { title: 'Spike au 6 violent',        desc: 'Avant 6 c\'est dur. Après 6, un play toutes les 80 secondes.' },
        { title: 'Strong meta (patch 16.10)', desc: '53.4 % winrate global, top-tier en mid actuellement.' },
      ],
      risks: [
        { label: 'Confort à 35 %',          desc: 'Tu as 12 games sur Diana cette saison. Sous-pratiqué pour un assassin.' },
        { label: 'Zed lane misérable',      desc: 'Avant 6 tu perds du CS et probablement la lane. Faut tenir.' },
        { label: 'Lulu peek = mort assurée', desc: 'Si Lulu W son ADC pendant ton engage, tu meurs sans rien faire.' },
      ],
      alternatives: [
        { name: 'Akali', archetype: 'assassin', delta: -4, why: 'Même rôle, meilleur 1v1, moins de pick-on' },
        { name: 'Talon', archetype: 'assassin', delta: -6, why: 'Roam plus fort, lane plus facile' },
      ],
      advanced: {
        winrate: '53.4 %', pickrate: '8.9 %', banrate: '4.8 %',
        sample: '14 028 games · Bronze→Gold · patch 16.10',
        breakdown: [
          { label: 'Matchup Zed',       value:  '−4', tone: 'bad'  },
          { label: 'Matchup Yasuo',     value: '+10', tone: 'good' },
          { label: 'Matchup Lulu',      value: '−12', tone: 'bad'  },
          { label: 'Synergie Malphite', value:  '+8', tone: 'good' },
          { label: 'Scaling 25 min',    value:  '−2', tone: 'bad'  },
          { label: 'Solo carry',        value: '+24', tone: 'good' },
          { label: 'Team utility',      value:  '−6', tone: 'bad'  },
        ],
      },
    },
  ],
};

// ─── Posture (badge type) styling ─────────────────────────────────────────
const POSTURE = {
  safe:    { fg: 'var(--dfm-jade)',         bg: 'rgba(63,217,164,0.12)',  ring: 'rgba(63,217,164,0.35)' },
  counter: { fg: 'var(--dfm-cyan)',         bg: 'rgba(93,209,238,0.12)',  ring: 'rgba(93,209,238,0.35)' },
  meta:    { fg: '#a78bfa',                 bg: 'rgba(167,139,250,0.12)', ring: 'rgba(167,139,250,0.35)' },
  pocket:  { fg: 'var(--dfm-gold)',         bg: 'rgba(216,178,100,0.14)', ring: 'rgba(216,178,100,0.40)' },
  risk:    { fg: 'var(--dfm-danger)',       bg: 'rgba(232,113,113,0.12)', ring: 'rgba(232,113,113,0.40)' },
};

// ─── Small primitives ─────────────────────────────────────────────────────
const PostureBadge = ({ type, label, size = 'md' }) => {
  const p = POSTURE[type];
  const pad = size === 'sm' ? '3px 8px' : '4px 10px';
  const fs  = size === 'sm' ? 10 : 11;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding: pad, borderRadius: 999,
      background: p.bg, color: p.fg,
      border: `1px solid ${p.ring}`,
      fontFamily:'var(--dfm-font-display)', fontWeight:600,
      fontSize: fs, letterSpacing:'0.06em', textTransform:'uppercase',
      whiteSpace:'nowrap',
    }}>
      <span style={{width:5, height:5, borderRadius:'50%', background:p.fg, boxShadow:`0 0 6px ${p.fg}`}}/>
      {label}
    </span>
  );
};

// Mini horizontal criteria bar. `invert` = high value is BAD (used for risk).
const CriteriaBar = ({ label, value, invert = false }) => {
  // tone: green at safe end → amber → red
  let tone;
  const v = invert ? 100 - value : value;
  if (v >= 75) tone = 'var(--dfm-jade)';
  else if (v >= 50) tone = 'var(--dfm-cyan)';
  else if (v >= 30) tone = 'var(--dfm-gold)';
  else tone = 'var(--dfm-danger)';

  return (
    <div style={{display:'grid', gridTemplateColumns:'88px 1fr 32px', alignItems:'center', gap:10}}>
      <div style={{
        fontSize:11, color:'var(--dfm-fg-muted)',
        fontFamily:'var(--dfm-font-display)', letterSpacing:'0.04em',
      }}>{label}</div>
      <div style={{
        position:'relative', height:6, borderRadius:3,
        background:'rgba(120,170,210,0.08)', overflow:'hidden',
      }}>
        <div style={{
          position:'absolute', inset:0, width:`${value}%`,
          background: tone, opacity: 0.85,
          borderRadius:3, transition:'width .25s, background .15s',
        }}/>
        {/* tick at 70% — "good enough" reference */}
        <div style={{
          position:'absolute', top:-2, bottom:-2, left:'70%', width:1,
          background:'rgba(255,255,255,0.18)',
        }}/>
      </div>
      <div style={{
        fontSize:11, textAlign:'right', fontFamily:'var(--dfm-font-mono)',
        color:'var(--dfm-fg)', fontWeight:500,
      }}>{value}</div>
    </div>
  );
};

const ScoreDial = ({ score, size = 64 }) => {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const off = c - (pct / 100) * c;
  let tone;
  if (pct >= 85) tone = 'var(--dfm-jade)';
  else if (pct >= 70) tone = 'var(--dfm-cyan)';
  else tone = 'var(--dfm-gold)';

  return (
    <div style={{position:'relative', width:size, height:size}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r}
                stroke="rgba(120,170,210,0.10)" strokeWidth="3" fill="none" />
        <circle cx={size/2} cy={size/2} r={r}
                stroke={tone} strokeWidth="3" fill="none"
                strokeDasharray={c} strokeDashoffset={off}
                strokeLinecap="round" />
      </svg>
      <div style={{
        position:'absolute', inset:0,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        lineHeight:1,
      }}>
        <div style={{fontFamily:'var(--dfm-font-display)', fontSize: size*0.36, fontWeight:700}}>{score}</div>
        <div style={{fontSize:8, color:'var(--dfm-fg-faint)', letterSpacing:'0.16em', marginTop:2}}>/ 100</div>
      </div>
    </div>
  );
};

// Tiny pill listing one enemy/ally champ
const ChampPill = ({ champ, hostile = false, dim = false }) => (
  <div style={{
    display:'inline-flex', alignItems:'center', gap:8,
    padding:'4px 10px 4px 4px', borderRadius:999,
    background:'var(--dfm-bg-2)',
    border:`1px solid ${hostile ? 'rgba(232,113,113,0.25)' : 'var(--dfm-line)'}`,
    opacity: dim ? 0.5 : 1,
  }}>
    <div style={{
      width:22, height:22, borderRadius:'50%',
      background:'var(--dfm-bg-3)',
      display:'flex', alignItems:'center', justifyContent:'center',
      color: hostile ? 'rgba(232,113,113,0.85)' : 'var(--dfm-fg-muted)',
      fontFamily:'var(--dfm-font-display)', fontWeight:700, fontSize:10,
      border:`1px solid ${hostile ? 'rgba(232,113,113,0.2)' : 'var(--dfm-line)'}`,
    }}>{champ.placeholder ? '?' : champ.name.slice(0,1)}</div>
    <span style={{fontSize:12, color:'var(--dfm-fg)', fontWeight:500}}>{champ.name}</span>
    <span style={{fontSize:10, color:'var(--dfm-fg-faint)', textTransform:'uppercase', letterSpacing:'0.1em'}}>{champ.lane}</span>
  </div>
);

// ─── Pick card (the comparable atom) ──────────────────────────────────────
const PickCard = ({ pick, selected, onClick, compact = false }) => {
  const p = POSTURE[pick.postureType];
  return (
    <button
      onClick={onClick}
      style={{
        textAlign:'left', cursor:'pointer', width:'100%',
        display:'block', position:'relative',
        padding: compact ? 14 : 18,
        borderRadius: 14,
        background: selected ? 'var(--dfm-surface-alt)' : 'var(--dfm-surface)',
        border: `1px solid ${selected ? p.ring : 'var(--dfm-line)'}`,
        boxShadow: selected ? `0 0 0 1px ${p.ring}, 0 12px 40px -16px ${p.fg}` : 'none',
        transition:'border-color .15s, background .15s, box-shadow .2s',
        color:'inherit', font:'inherit',
        overflow:'hidden',
      }}
    >
      {/* selection bar */}
      {selected && (
        <span style={{
          position:'absolute', top:14, bottom:14, left:0, width:3,
          background: p.fg, borderRadius:'0 3px 3px 0',
          boxShadow:`0 0 12px ${p.fg}`,
        }}/>
      )}

      {/* header: rank · portrait · name + posture · score */}
      <div style={{display:'flex', alignItems:'center', gap:14, marginBottom: compact ? 12 : 16}}>
        <div style={{
          fontFamily:'var(--dfm-font-display)', fontSize: compact ? 28 : 36, fontWeight:700,
          color: selected ? p.fg : 'var(--dfm-fg-faint)',
          lineHeight:1, minWidth: compact ? 30 : 38,
        }}>
          {String(pick.rank).padStart(2,'0')}
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{
              width: compact ? 34 : 40, height: compact ? 34 : 40,
              borderRadius:8,
              background:'var(--dfm-bg-3)',
              border:'1px solid var(--dfm-line)',
              display:'flex', alignItems:'center', justifyContent:'center',
              color: p.fg, flexShrink:0,
            }}>
              <ChampSilhouette archetype={pick.archetype} accent={p.fg} frame="rect" size={compact ? 24 : 28}/>
            </div>
            <div style={{minWidth:0, flex:1}}>
              <div style={{
                fontFamily:'var(--dfm-font-display)', fontWeight:600,
                fontSize: compact ? 17 : 19, letterSpacing:'-0.01em',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>{pick.name}</div>
              <div style={{marginTop:4}}>
                <PostureBadge type={pick.postureType} label={pick.posture} size="sm"/>
              </div>
            </div>
          </div>
        </div>
        <ScoreDial score={pick.score} size={compact ? 52 : 60}/>
      </div>

      {/* criteria bars */}
      <div style={{display:'flex', flexDirection:'column', gap:7, marginBottom: compact ? 10 : 14}}>
        <CriteriaBar label="Draft ennemie" value={pick.criteria.draftMatch}/>
        <CriteriaBar label="Méta actuelle"  value={pick.criteria.meta}/>
        <CriteriaBar label="Confort joueur" value={pick.criteria.comfort}/>
        <CriteriaBar label="Risque" value={pick.criteria.risk} invert/>
      </div>

      {/* short reason */}
      <div style={{
        fontSize:12.5, lineHeight:1.55, color:'var(--dfm-fg-muted)',
        paddingTop:10, borderTop:'1px dashed var(--dfm-line)',
      }}>
        {pick.shortReason}
      </div>
    </button>
  );
};

// ─── Detail panel ─────────────────────────────────────────────────────────
const PanelEyebrow = ({ children, tone = 'var(--dfm-jade)' }) => (
  <div style={{
    fontFamily:'var(--dfm-font-display)', fontSize:10, fontWeight:600,
    letterSpacing:'0.18em', textTransform:'uppercase',
    color: tone, marginBottom:10,
  }}>{children}</div>
);

const RiskRow = ({ risk }) => (
  <div style={{
    display:'flex', gap:12, alignItems:'flex-start',
    padding:'12px 14px',
    background:'rgba(232,113,113,0.06)',
    border:'1px solid rgba(232,113,113,0.18)',
    borderRadius:10,
  }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{flexShrink:0, marginTop:1}}>
      <path d="M12 3 L22 20 L2 20 Z" stroke="var(--dfm-danger)" strokeWidth="1.6" strokeLinejoin="round" fill="rgba(232,113,113,0.10)"/>
      <line x1="12" y1="10" x2="12" y2="14" stroke="var(--dfm-danger)" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="12" cy="17" r="1" fill="var(--dfm-danger)"/>
    </svg>
    <div style={{flex:1, minWidth:0}}>
      <div style={{fontSize:13, fontWeight:600, color:'var(--dfm-fg)', marginBottom:3}}>{risk.label}</div>
      <div style={{fontSize:12.5, lineHeight:1.55, color:'var(--dfm-fg-muted)'}}>{risk.desc}</div>
    </div>
  </div>
);

const ReasonRow = ({ reason, index, accent }) => (
  <div style={{display:'flex', gap:14, alignItems:'flex-start'}}>
    <div style={{
      width:26, height:26, borderRadius:'50%',
      background:'var(--dfm-bg-3)', border:`1px solid ${accent}55`,
      display:'flex', alignItems:'center', justifyContent:'center',
      color: accent, fontFamily:'var(--dfm-font-display)', fontWeight:700, fontSize:12,
      flexShrink:0,
    }}>{index}</div>
    <div style={{flex:1}}>
      <div style={{fontSize:14, fontWeight:600, color:'var(--dfm-fg)', marginBottom:4}}>{reason.title}</div>
      <div style={{fontSize:13, lineHeight:1.55, color:'var(--dfm-fg-muted)'}}>{reason.desc}</div>
    </div>
  </div>
);

const AltCard = ({ alt }) => (
  <div style={{
    display:'flex', alignItems:'center', gap:12,
    padding:'12px 14px', borderRadius:10,
    background:'var(--dfm-bg-2)', border:'1px solid var(--dfm-line)',
  }}>
    <div style={{
      width:34, height:34, borderRadius:8,
      background:'var(--dfm-bg-3)', border:'1px solid var(--dfm-line)',
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'var(--dfm-fg-muted)',
    }}>
      <ChampSilhouette archetype={alt.archetype} accent="var(--dfm-fg-muted)" frame="rect" size={22}/>
    </div>
    <div style={{flex:1, minWidth:0}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <div style={{fontWeight:600, fontSize:13}}>{alt.name}</div>
        <div style={{
          fontSize:10, fontFamily:'var(--dfm-font-mono)',
          color: alt.delta > 0 ? 'var(--dfm-jade)' : 'var(--dfm-fg-faint)',
          padding:'2px 6px', borderRadius:4,
          background: alt.delta > 0 ? 'rgba(63,217,164,0.10)' : 'rgba(120,170,210,0.06)',
        }}>{alt.delta > 0 ? '+' : ''}{alt.delta} score</div>
      </div>
      <div style={{fontSize:11.5, color:'var(--dfm-fg-muted)', marginTop:2, lineHeight:1.5}}>{alt.why}</div>
    </div>
  </div>
);

const AdvancedAccordion = ({ pick, open, onToggle }) => (
  <div style={{
    borderTop:'1px solid var(--dfm-line)',
    paddingTop:18,
  }}>
    <button onClick={onToggle} style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      width:'100%', background:'transparent', border:'none',
      color:'var(--dfm-fg)', cursor:'pointer', padding:0,
      font:'inherit', textAlign:'left',
    }}>
      <div>
        <PanelEyebrow tone="var(--dfm-fg-faint)">Détails avancés</PanelEyebrow>
        <div style={{fontSize:14, color:'var(--dfm-fg-muted)'}}>
          Chiffres bruts, matchups détaillés, taille d'échantillon
        </div>
      </div>
      <div style={{
        width:32, height:32, borderRadius:'50%',
        background:'var(--dfm-bg-2)', border:'1px solid var(--dfm-line)',
        display:'flex', alignItems:'center', justifyContent:'center',
        transform: open ? 'rotate(180deg)' : 'rotate(0)',
        transition:'transform .2s',
      }}>
        <svg width="14" height="14" viewBox="0 0 16 16">
          <path d="M3 6 L8 11 L13 6" stroke="var(--dfm-fg-muted)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>

    {open && (
      <div style={{marginTop:20, display:'flex', flexDirection:'column', gap:18}}>
        {/* top stats row */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10,
        }}>
          {[
            { label:'Winrate', value: pick.advanced.winrate, tone:'var(--dfm-jade)' },
            { label:'Pickrate', value: pick.advanced.pickrate, tone:'var(--dfm-cyan)' },
            { label:'Banrate', value: pick.advanced.banrate, tone:'var(--dfm-gold)' },
          ].map((s) => (
            <div key={s.label} style={{
              padding:'12px 14px', borderRadius:10,
              background:'var(--dfm-bg-2)', border:'1px solid var(--dfm-line)',
            }}>
              <div style={{fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase',
                           color:'var(--dfm-fg-faint)', fontFamily:'var(--dfm-font-display)'}}>{s.label}</div>
              <div style={{fontSize:20, fontFamily:'var(--dfm-font-display)', fontWeight:600,
                           color:s.tone, marginTop:4}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* breakdown table */}
        <div>
          <div style={{
            fontSize:11, color:'var(--dfm-fg-faint)', marginBottom:10,
            fontFamily:'var(--dfm-font-display)', letterSpacing:'0.1em', textTransform:'uppercase',
          }}>Décomposition du score</div>
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr',
            background:'var(--dfm-bg-2)', borderRadius:10, border:'1px solid var(--dfm-line)',
            overflow:'hidden',
          }}>
            {pick.advanced.breakdown.map((b, i) => (
              <div key={b.label} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'10px 14px',
                borderRight: i % 2 === 0 ? '1px solid var(--dfm-line)' : 'none',
                borderBottom: i < pick.advanced.breakdown.length - 2 ? '1px solid var(--dfm-line)' : 'none',
              }}>
                <span style={{fontSize:12, color:'var(--dfm-fg-muted)'}}>{b.label}</span>
                <span style={{
                  fontFamily:'var(--dfm-font-mono)', fontSize:12, fontWeight:600,
                  color: b.tone === 'good' ? 'var(--dfm-jade)' : 'var(--dfm-danger)',
                }}>{b.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{fontSize:11, color:'var(--dfm-fg-faint)', fontStyle:'italic'}}>
          {pick.advanced.sample}
        </div>
      </div>
    )}
  </div>
);

const DetailPanel = ({ pick, advancedOpen, onToggleAdvanced }) => {
  const p = POSTURE[pick.postureType];
  return (
    <div style={{
      display:'flex', flexDirection:'column', gap:24,
    }}>
      {/* Verdict */}
      <div style={{
        padding:24, borderRadius:14,
        background:`linear-gradient(135deg, ${p.bg}, transparent 60%)`,
        border:`1px solid ${p.ring}`,
      }}>
        <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:14}}>
          <div style={{
            width:52, height:52, borderRadius:10,
            background:'var(--dfm-bg-3)', border:`1px solid ${p.ring}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            color: p.fg,
          }}>
            <ChampSilhouette archetype={pick.archetype} accent={p.fg} frame="rect" size={36}/>
          </div>
          <div style={{flex:1}}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
              <PanelEyebrow tone={p.fg}>Verdict · #{String(pick.rank).padStart(2,'0')}</PanelEyebrow>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              <h3 style={{fontSize:24, fontFamily:'var(--dfm-font-display)', fontWeight:600}}>{pick.name}</h3>
              <PostureBadge type={pick.postureType} label={pick.posture}/>
            </div>
          </div>
          <ScoreDial score={pick.score} size={72}/>
        </div>
        <p style={{
          fontSize:15.5, lineHeight:1.5, color:'var(--dfm-fg)',
          textWrap:'pretty',
        }}>{pick.verdict}</p>
      </div>

      {/* Reasons */}
      <div>
        <PanelEyebrow tone={p.fg}>3 raisons de pick</PanelEyebrow>
        <div style={{display:'flex', flexDirection:'column', gap:16, marginTop:12}}>
          {pick.reasons.map((r, i) => (
            <ReasonRow key={i} reason={r} index={i+1} accent={p.fg}/>
          ))}
        </div>
      </div>

      {/* Risks — always visible */}
      <div>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <PanelEyebrow tone="var(--dfm-danger)">Risques · toujours visibles</PanelEyebrow>
          <div style={{
            fontSize:10, fontFamily:'var(--dfm-font-mono)', color:'var(--dfm-fg-faint)',
            padding:'2px 8px', borderRadius:999, border:'1px solid var(--dfm-line)',
            marginBottom:10,
          }}>{pick.risks.length} pièges</div>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {pick.risks.map((r, i) => <RiskRow key={i} risk={r}/>)}
        </div>
      </div>

      {/* Alternatives */}
      <div>
        <PanelEyebrow tone="var(--dfm-fg-muted)">Alternatives proches</PanelEyebrow>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:8}}>
          {pick.alternatives.map((a, i) => <AltCard key={i} alt={a}/>)}
        </div>
      </div>

      {/* Advanced accordion */}
      <AdvancedAccordion pick={pick} open={advancedOpen} onToggle={onToggleAdvanced}/>
    </div>
  );
};

// ─── Context strip (enemy / ally) ─────────────────────────────────────────
const ContextStrip = ({ context, compact = false }) => (
  <div style={{
    padding: compact ? '14px 16px' : '18px 24px',
    borderRadius:14,
    background:'var(--dfm-surface)',
    border:'1px solid var(--dfm-line)',
    display:'flex', flexDirection: compact ? 'column' : 'row',
    alignItems: compact ? 'stretch' : 'center', gap: compact ? 12 : 24,
  }}>
    <div style={{display:'flex', alignItems:'center', gap:12}}>
      <div style={{
        width:42, height:42, borderRadius:10,
        background:'var(--dfm-bg-3)', border:'1px solid var(--dfm-line)',
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'var(--dfm-jade)',
      }}>
        <RoleIcon role={context.role} size={22}/>
      </div>
      <div>
        <div style={{fontSize:10, color:'var(--dfm-fg-faint)', letterSpacing:'0.16em', textTransform:'uppercase'}}>Ton rôle</div>
        <div style={{fontSize:14, fontWeight:600, fontFamily:'var(--dfm-font-display)'}}>Midlane · {context.phase}</div>
      </div>
    </div>

    {!compact && (
      <div style={{width:1, height:32, background:'var(--dfm-line)'}}/>
    )}

    <div style={{flex:1, display:'flex', flexDirection: compact ? 'column' : 'row', gap: compact ? 8 : 18, minWidth:0}}>
      <div style={{minWidth:0}}>
        <div style={{
          fontSize:10, color:'rgba(232,113,113,0.85)',
          letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6,
          fontFamily:'var(--dfm-font-display)',
        }}>Équipe adverse</div>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {context.enemies.map((e,i) => <ChampPill key={i} champ={e} hostile/>)}
        </div>
      </div>
      <div style={{minWidth:0}}>
        <div style={{
          fontSize:10, color:'var(--dfm-cyan)',
          letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6,
          fontFamily:'var(--dfm-font-display)',
        }}>Ton équipe</div>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {context.allies.map((a,i) => <ChampPill key={i} champ={a} dim={a.placeholder}/>)}
        </div>
      </div>
    </div>
  </div>
);

// ─── Desktop variant ──────────────────────────────────────────────────────
const DecisionDesktop = () => {
  const [selected, setSelected] = React.useState(0);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const pick = DECISION.picks[selected];

  // reset accordion when switching pick (you want a fresh look each time)
  React.useEffect(() => { setAdvancedOpen(false); }, [selected]);

  return (
    <div className="dfm dfm-hexbg" data-palette="profond" style={{
      minHeight:1080, padding:'32px 40px',
      display:'flex', flexDirection:'column', gap:24,
    }}>
      {/* Header strip */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div>
          <div className="dfm-eyebrow" style={{marginBottom:8}}>Espace de décision · ton pick mid</div>
          <h1 style={{fontSize:34, fontFamily:'var(--dfm-font-display)', fontWeight:600, letterSpacing:'-0.02em'}}>
            Trois picks. Compare. <span style={{color:'var(--dfm-jade)'}}>Décide.</span>
          </h1>
          <p style={{fontSize:14, color:'var(--dfm-fg-muted)', marginTop:6, maxWidth:540}}>
            Score, posture, draft adverse, méta et confort — sur la même grille. Le détail à droite te dit pourquoi, et surtout ce qui peut foirer.
          </p>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <button className="dfm-btn dfm-btn-secondary" style={{padding:'10px 14px', fontSize:12}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8 L13 8 M3 4 L13 4 M3 12 L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            Filtres
          </button>
          <button className="dfm-btn dfm-btn-secondary" style={{padding:'10px 14px', fontSize:12}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M8 3 L8 8 L11 10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Relancer l'analyse
          </button>
        </div>
      </div>

      {/* Context strip */}
      <ContextStrip context={DECISION.context}/>

      {/* Main: grid (3 picks) + detail panel */}
      <div style={{
        display:'grid', gridTemplateColumns:'minmax(380px, 38fr) minmax(0, 62fr)',
        gap:24, alignItems:'start',
      }}>
        {/* LEFT: decision grid */}
        <div style={{display:'flex', flexDirection:'column', gap:14, position:'sticky', top:24}}>
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0 4px',
          }}>
            <PanelEyebrow>Grille de décision</PanelEyebrow>
            <span style={{
              fontSize:10, fontFamily:'var(--dfm-font-mono)', color:'var(--dfm-fg-faint)',
              letterSpacing:'0.1em', textTransform:'uppercase',
            }}>3 / 142 testés</span>
          </div>
          {DECISION.picks.map((p, i) => (
            <PickCard
              key={p.name}
              pick={p}
              selected={i === selected}
              onClick={() => setSelected(i)}
            />
          ))}
          <div style={{
            fontSize:11.5, color:'var(--dfm-fg-faint)', lineHeight:1.55,
            padding:'10px 12px', borderRadius:8,
            background:'rgba(120,170,210,0.04)',
            border:'1px dashed var(--dfm-line)',
          }}>
            Le tick à 70 % sur chaque barre = seuil "assez bon". Au-dessus, c'est solide.
          </div>
        </div>

        {/* RIGHT: detail panel */}
        <div style={{
          background:'var(--dfm-surface)',
          border:'1px solid var(--dfm-line)',
          borderRadius:16, padding:28,
        }}>
          <DetailPanel
            pick={pick}
            advancedOpen={advancedOpen}
            onToggleAdvanced={() => setAdvancedOpen(o => !o)}
          />

          {/* Lock CTA */}
          <div style={{
            marginTop:24, paddingTop:24, borderTop:'1px solid var(--dfm-line)',
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:14,
          }}>
            <div style={{fontSize:12.5, color:'var(--dfm-fg-muted)', maxWidth:380}}>
              Tu peux toujours revenir sur la grille pour comparer. Rien n'est verrouillé tant que tu n'as pas lock dans le client.
            </div>
            <div style={{display:'flex', gap:10}}>
              <button className="dfm-btn dfm-btn-secondary" style={{padding:'12px 18px', fontSize:13}}>
                Voir tous les picks
              </button>
              <button className="dfm-btn dfm-btn-primary" style={{padding:'12px 22px', fontSize:13}}>
                Je pars sur {pick.name} <Icon.arrow/>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Mobile variant ───────────────────────────────────────────────────────
const DecisionMobile = () => {
  const [selected, setSelected] = React.useState(0);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const pick = DECISION.picks[selected];
  React.useEffect(() => { setAdvancedOpen(false); }, [selected]);

  return (
    <div className="dfm dfm-hexbg" data-palette="profond" style={{
      minHeight:1480, width:390, padding:'18px 16px 32px',
      display:'flex', flexDirection:'column', gap:18,
      margin:'0 auto',
    }}>
      {/* Compact header */}
      <div>
        <div className="dfm-eyebrow" style={{marginBottom:6, fontSize:10}}>Espace de décision</div>
        <h1 style={{
          fontSize:24, fontFamily:'var(--dfm-font-display)', fontWeight:600,
          letterSpacing:'-0.02em', lineHeight:1.15,
        }}>
          Compare. <span style={{color:'var(--dfm-jade)'}}>Décide.</span>
        </h1>
        <p style={{fontSize:12.5, color:'var(--dfm-fg-muted)', marginTop:6, lineHeight:1.5}}>
          3 picks, posture + score, et ce qui peut foirer.
        </p>
      </div>

      <ContextStrip context={DECISION.context} compact/>

      {/* 3 compact cards as selectable tab-strip */}
      <div>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:10,
        }}>
          <PanelEyebrow>Grille</PanelEyebrow>
          <span style={{
            fontSize:10, fontFamily:'var(--dfm-font-mono)', color:'var(--dfm-fg-faint)',
            letterSpacing:'0.1em', textTransform:'uppercase',
          }}>← Glisse →</span>
        </div>
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8,
        }}>
          {DECISION.picks.map((p, i) => (
            <MobilePickChip
              key={p.name}
              pick={p}
              selected={i === selected}
              onClick={() => setSelected(i)}
            />
          ))}
        </div>
      </div>

      {/* Detail panel (full mobile) */}
      <div style={{
        background:'var(--dfm-surface)',
        border:'1px solid var(--dfm-line)',
        borderRadius:14, padding:18,
      }}>
        <DetailPanel
          pick={pick}
          advancedOpen={advancedOpen}
          onToggleAdvanced={() => setAdvancedOpen(o => !o)}
        />
      </div>

      {/* Sticky-feeling CTA */}
      <div style={{
        position:'sticky', bottom:0,
        marginTop:'auto',
        padding:'12px 14px',
        background:'rgba(7,13,27,0.92)',
        backdropFilter:'blur(8px)',
        border:'1px solid var(--dfm-line)',
        borderRadius:14,
        display:'flex', gap:10, alignItems:'center',
      }}>
        <div style={{flex:1, fontSize:11.5, color:'var(--dfm-fg-muted)', lineHeight:1.4}}>
          Tu peux toujours changer d'avis avant le lock.
        </div>
        <button className="dfm-btn dfm-btn-primary" style={{padding:'10px 14px', fontSize:12}}>
          {pick.name} <Icon.arrow/>
        </button>
      </div>
    </div>
  );
};

// Mobile compact card — 3 stack into a row, square-ish
const MobilePickChip = ({ pick, selected, onClick }) => {
  const p = POSTURE[pick.postureType];
  return (
    <button onClick={onClick} style={{
      cursor:'pointer', textAlign:'left',
      padding:10, borderRadius:12,
      background: selected ? 'var(--dfm-surface-alt)' : 'var(--dfm-surface)',
      border:`1px solid ${selected ? p.ring : 'var(--dfm-line)'}`,
      boxShadow: selected ? `0 0 0 1px ${p.ring}, 0 8px 24px -12px ${p.fg}` : 'none',
      display:'flex', flexDirection:'column', gap:8,
      color:'inherit', font:'inherit', position:'relative',
      transition:'border-color .15s, background .15s, box-shadow .2s',
    }}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <span style={{
          fontFamily:'var(--dfm-font-display)', fontSize:18, fontWeight:700,
          color: selected ? p.fg : 'var(--dfm-fg-faint)',
        }}>{String(pick.rank).padStart(2,'0')}</span>
        <ScoreDial score={pick.score} size={36}/>
      </div>
      <div>
        <div style={{
          fontFamily:'var(--dfm-font-display)', fontWeight:600,
          fontSize:14, marginBottom:4,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        }}>{pick.name}</div>
        <PostureBadge type={pick.postureType} label={pick.posture} size="sm"/>
      </div>
      {/* one consolidated mini bar — risk vs match */}
      <div style={{display:'flex', flexDirection:'column', gap:3, marginTop:2}}>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:9, fontFamily:'var(--dfm-font-mono)', color:'var(--dfm-fg-faint)', letterSpacing:'0.06em', textTransform:'uppercase'}}>
          <span>Match {pick.criteria.draftMatch}</span>
          <span>Risk {pick.criteria.risk}</span>
        </div>
        <div style={{height:3, borderRadius:2, background:'rgba(120,170,210,0.08)', position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', inset:0, width:`${pick.criteria.draftMatch}%`, background:'var(--dfm-jade)', opacity:0.85, borderRadius:2}}/>
        </div>
        <div style={{height:3, borderRadius:2, background:'rgba(120,170,210,0.08)', position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', inset:0, width:`${pick.criteria.risk}%`, background: pick.criteria.risk > 60 ? 'var(--dfm-danger)' : 'var(--dfm-gold)', opacity:0.85, borderRadius:2}}/>
        </div>
      </div>
    </button>
  );
};

// ─── Expose ───────────────────────────────────────────────────────────────
Object.assign(window, {
  DecisionDesktop, DecisionMobile, DECISION,
  PickCard, DetailPanel, ContextStrip, PostureBadge, ScoreDial, CriteriaBar,
});
