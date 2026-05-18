// landing-sobre.jsx — V1 Sobre · typography-led, minimal, single jade accent

const LandingSobre = ({ ctaText = 'Tester une draft' }) => {
  return (
    <div className="dfm" data-screen-label="V1 Sobre" data-palette="sobre" style={{minHeight:'100%'}}>
      <DFMHeader accent="var(--dfm-jade)" label="Beta privée" />

      {/* HERO */}
      <section style={{
        padding:'120px 80px 100px',
        position:'relative', overflow:'hidden',
      }}>
        <div style={{color:'rgba(120,170,210,1)'}}>
          <HexGridSVG opacity={0.06} />
        </div>

        <div style={{maxWidth:1180, margin:'0 auto', position:'relative', display:'grid', gridTemplateColumns:'1.15fr 1fr', gap:80, alignItems:'center'}}>
          <div>
            <div className="dfm-eyebrow" style={{marginBottom:22}}>
              <span style={{display:'inline-block', width:6, height:6, borderRadius:99, background:'var(--dfm-jade)', marginRight:10, verticalAlign:'middle'}} />
              Draft coach · League of Legends
            </div>
            <h1 style={{
              fontSize:64, lineHeight:1.05, letterSpacing:'-0.025em',
              fontWeight:600, marginBottom:24,
            }}>
              Sachez quoi pick.<br/>
              <span style={{color:'var(--dfm-jade)'}}>Évitez</span> les mauvais choix.
            </h1>
            <p style={{
              fontSize:18, lineHeight:1.55, color:'var(--dfm-fg-muted)',
              maxWidth:520, marginBottom:36,
            }}>
              DraftForMe vous aide à choisir un champion adapté à la draft, au rôle joué et aux risques de la partie. Pensé pour les joueurs qui veulent juste un conseil clair, pas un cours.
            </p>
            <div style={{display:'flex', gap:14, alignItems:'center', marginBottom:32}}>
              <button className="dfm-btn dfm-btn-primary">{ctaText} <Icon.arrow /></button>
              <button className="dfm-btn dfm-btn-secondary">Voir comment ça marche</button>
            </div>
            <div style={{display:'flex', gap:32, color:'var(--dfm-fg-faint)', fontSize:13}}>
              <span><Icon.check style={{verticalAlign:'-2px', color:'var(--dfm-jade)'}}/> 5 rôles couverts</span>
              <span><Icon.check style={{verticalAlign:'-2px', color:'var(--dfm-jade)'}}/> Conseils en français</span>
              <span><Icon.check style={{verticalAlign:'-2px', color:'var(--dfm-jade)'}}/> Sans installation</span>
            </div>
          </div>

          {/* Right column: a single contemplative composition */}
          <SobreHeroArt />
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section style={{padding:'var(--dfm-pad-section) 80px', borderTop:'1px solid var(--dfm-line-soft)'}}>
        <div style={{maxWidth:1180, margin:'0 auto'}}>
          <SectionHeader
            eyebrow="Comment ça marche"
            title="Quatre étapes. Une recommandation."
            sub="Vous donnez le contexte. DraftForMe répond avec des picks que vous pouvez justifier."
          />
          <div style={{marginTop:60, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:0, borderTop:'1px solid var(--dfm-line)', borderBottom:'1px solid var(--dfm-line)'}}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{
                padding:'32px 28px 36px',
                borderRight: i < STEPS.length - 1 ? '1px solid var(--dfm-line)' : 'none',
                position:'relative',
              }}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24}}>
                  <span style={{
                    fontFamily:'var(--dfm-font-display)', fontSize:13, fontWeight:600,
                    color:'var(--dfm-jade)', letterSpacing:'0.14em',
                  }}>{s.n}</span>
                  <span style={{color:'var(--dfm-fg-faint)'}}><RoleIcon role={s.role} size={20} /></span>
                </div>
                <h3 style={{fontSize:18, lineHeight:1.3, marginBottom:8}}>{s.title}</h3>
                <p style={{fontSize:14, lineHeight:1.55, color:'var(--dfm-fg-muted)'}}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section style={{padding:'var(--dfm-pad-section) 80px', background:'var(--dfm-bg-2)', borderTop:'1px solid var(--dfm-line-soft)'}}>
        <div style={{maxWidth:1180, margin:'0 auto'}}>
          <SectionHeader
            eyebrow="Aperçu de l'outil"
            title="Voilà ce que DraftForMe vous montre."
            sub="Un exemple : vous jouez midlane, la draft adverse est lock. Voici les 3 picks proposés."
          />
          <div style={{marginTop:60}}>
            <DemoPanel sobre />
          </div>
        </div>
      </section>

      {/* FONCTIONNALITÉS */}
      <section style={{padding:'var(--dfm-pad-section) 80px'}}>
        <div style={{maxWidth:1180, margin:'0 auto'}}>
          <SectionHeader
            eyebrow="Fonctionnalités"
            title="Pensé pour décider vite."
          />
          <div style={{marginTop:56, display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:'var(--dfm-line)'}}>
            {FEATURES.map((f) => {
              const IconC = Icon[f.icon];
              return (
                <div key={f.title} style={{background:'var(--dfm-bg-1)', padding:36}}>
                  <div style={{
                    width:40, height:40, borderRadius:10, marginBottom:20,
                    border:'1px solid var(--dfm-line-strong)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'var(--dfm-jade)',
                  }}><IconC /></div>
                  <h3 style={{fontSize:20, marginBottom:8}}>{f.title}</h3>
                  <p style={{fontSize:15, lineHeight:1.55, color:'var(--dfm-fg-muted)'}}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* POUR QUI */}
      <section style={{padding:'var(--dfm-pad-section) 80px', borderTop:'1px solid var(--dfm-line-soft)'}}>
        <div style={{maxWidth:1180, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1.2fr', gap:80, alignItems:'start'}}>
          <div>
            <div className="dfm-eyebrow" style={{marginBottom:18}}>Pour qui c'est</div>
            <h2 style={{fontSize:40, lineHeight:1.1, marginBottom:20}}>
              Si vous vous reconnaissez là-dedans, on est faits pour vous.
            </h2>
            <p style={{fontSize:16, lineHeight:1.6, color:'var(--dfm-fg-muted)', marginBottom:24}}>
              DraftForMe est pensé pour les joueurs qui veulent un coup de main rapide sur le pick — pas une encyclopédie. Pas besoin d'être Diamant pour s'en servir, ni de connaître 160 champions.
            </p>
            <button className="dfm-btn dfm-btn-secondary">En savoir plus</button>
          </div>
          <ul style={{listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:14}}>
            {AUDIENCE.map((a, i) => (
              <li key={i} style={{
                display:'flex', alignItems:'flex-start', gap:16,
                padding:'18px 22px',
                background:'var(--dfm-surface)',
                border:'1px solid var(--dfm-line)',
                borderRadius:10,
              }}>
                <span style={{
                  flex:'0 0 auto', marginTop:2,
                  width:22, height:22, borderRadius:99,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'var(--dfm-jade)', background:'var(--dfm-jade-soft)',
                }}><Icon.check /></span>
                <span style={{fontSize:15, lineHeight:1.5}}>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{padding:'80px 80px 100px'}}>
        <div style={{
          maxWidth:1180, margin:'0 auto',
          padding:'56px 64px',
          border:'1px solid var(--dfm-line-strong)',
          borderRadius:16,
          background:'var(--dfm-surface)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:40,
          position:'relative', overflow:'hidden',
        }}>
          <div style={{color:'rgba(120,170,210,1)'}}><HexGridSVG opacity={0.06} /></div>
          <div style={{position:'relative'}}>
            <h2 style={{fontSize:32, marginBottom:10}}>Prêt à drafter mieux ?</h2>
            <p style={{color:'var(--dfm-fg-muted)', fontSize:15, lineHeight:1.55, maxWidth:520}}>
              Aucune création de compte. Vous lancez une draft, vous voyez ce que ça donne. Si ça aide, vous revenez.
            </p>
          </div>
          <button className="dfm-btn dfm-btn-primary" style={{position:'relative', padding:'18px 28px', fontSize:15}}>{ctaText} <Icon.arrow /></button>
        </div>
      </section>

      <DFMFooter accent="var(--dfm-jade)" />
    </div>
  );
};

// ─── Sobre-specific subcomponents ────────────────────────────────────────
const SectionHeader = ({ eyebrow, title, sub }) => (
  <div style={{maxWidth:720}}>
    <div className="dfm-eyebrow" style={{marginBottom:14}}>{eyebrow}</div>
    <h2 style={{fontSize:36, lineHeight:1.15, marginBottom:sub?14:0}}>{title}</h2>
    {sub && <p style={{fontSize:16, lineHeight:1.6, color:'var(--dfm-fg-muted)'}}>{sub}</p>}
  </div>
);

const SobreHeroArt = () => (
  <div style={{
    position:'relative',
    aspectRatio: '1 / 1.05',
    border:'1px solid var(--dfm-line-strong)',
    borderRadius:16,
    background: 'linear-gradient(180deg, var(--dfm-bg-2) 0%, var(--dfm-bg-1) 100%)',
    padding:28,
    overflow:'hidden',
  }}>
    <div style={{color:'rgba(120,170,210,1)'}}><HexGridSVG opacity={0.10} /></div>

    {/* Corner brackets */}
    {['tl','tr','bl','br'].map((c) => (
      <span key={c} style={{
        position:'absolute', width:18, height:18,
        ...(c[0]==='t' ? {top:12} : {bottom:12}),
        ...(c[1]==='l' ? {left:12} : {right:12}),
        borderTop:    c[0]==='t' ? '1px solid var(--dfm-jade)' : 'none',
        borderBottom: c[0]==='b' ? '1px solid var(--dfm-jade)' : 'none',
        borderLeft:   c[1]==='l' ? '1px solid var(--dfm-jade)' : 'none',
        borderRight:  c[1]==='r' ? '1px solid var(--dfm-jade)' : 'none',
      }} />
    ))}

    <div style={{position:'absolute', top:24, left:24, display:'flex', alignItems:'center', gap:10}}>
      <span style={{
        fontFamily:'var(--dfm-font-mono)', fontSize:10,
        color:'var(--dfm-fg-faint)', letterSpacing:'0.15em', textTransform:'uppercase',
      }}>DRAFT · MID</span>
    </div>
    <div style={{position:'absolute', top:24, right:24, fontFamily:'var(--dfm-font-mono)', fontSize:10, color:'var(--dfm-fg-faint)'}}>
      03:42
    </div>

    {/* The composition: three recommendation cards stacked */}
    <div style={{position:'absolute', inset:'70px 28px 28px', display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:14}}>
      {DEMO.recs.map((r, i) => (
        <div key={r.name} style={{
          display:'flex', alignItems:'center', gap:16,
          padding:14,
          background:'rgba(15,27,48,0.85)',
          border:'1px solid var(--dfm-line)',
          borderRadius:12,
          transform: i === 0 ? 'translateX(-12px)' : i === 2 ? 'translateX(12px)' : 'none',
          boxShadow: i === 0 ? 'var(--dfm-glow)' : 'none',
        }}>
          <div style={{
            width:38, height:38, borderRadius:9,
            background:RISK_COLOR[r.risk],
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#062013', fontFamily:'var(--dfm-font-display)', fontWeight:700, fontSize:13,
          }}>{i+1}</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:4}}>
              <span style={{fontWeight:600, fontSize:14}}>{r.name}</span>
              <span style={{fontSize:10, color:RISK_COLOR[r.risk], fontFamily:'var(--dfm-font-mono)', letterSpacing:'0.1em', textTransform:'uppercase'}}>{r.riskLabel}</span>
            </div>
            <div style={{fontSize:11, color:'var(--dfm-fg-faint)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{r.tags.join(' · ')}</div>
          </div>
          <Icon.arrow style={{color:'var(--dfm-fg-faint)'}} />
        </div>
      ))}
    </div>
  </div>
);

// ─── Demo panel: full tool mock ──────────────────────────────────────────
const DemoPanel = ({ sobre = false }) => (
  <div style={{
    background:'var(--dfm-bg-1)',
    border:'1px solid var(--dfm-line-strong)',
    borderRadius:14,
    padding:24,
    boxShadow: sobre ? 'none' : 'var(--dfm-glow)',
    position:'relative',
    overflow:'hidden',
  }}>
    {/* HUD bar */}
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      paddingBottom:18, marginBottom:20,
      borderBottom:'1px solid var(--dfm-line)',
    }}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <DFMMark size={20} color="var(--dfm-fg-muted)" tone="var(--dfm-jade)" />
        <span style={{fontFamily:'var(--dfm-font-mono)', fontSize:11, color:'var(--dfm-fg-faint)', letterSpacing:'0.12em', textTransform:'uppercase'}}>
          DRAFT · MIDLANE · BAN PHASE TERMINÉE
        </span>
      </div>
      <div style={{display:'flex', gap:8}}>
        {ROLES.map((r) => (
          <button key={r.id} style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'6px 10px', fontSize:11,
            border:'1px solid', borderColor: r.id === 'mid' ? 'var(--dfm-jade)' : 'var(--dfm-line)',
            background: r.id === 'mid' ? 'var(--dfm-jade-soft)' : 'transparent',
            color: r.id === 'mid' ? 'var(--dfm-jade)' : 'var(--dfm-fg-muted)',
            borderRadius:7, cursor:'pointer', fontFamily:'var(--dfm-font-display)', letterSpacing:'0.04em',
          }}>
            <RoleIcon role={r.id} size={14} /> {r.label}
          </button>
        ))}
      </div>
    </div>

    <div style={{display:'grid', gridTemplateColumns:'1fr 1.2fr', gap:24}}>
      {/* Left: teams */}
      <div>
        <TeamRow side="enemy" label="Équipe adverse" team={DEMO.enemy} highlight="mid" />
        <div style={{height:16}} />
        <TeamRow side="ally" label="Votre équipe" team={DEMO.ally} highlight="mid" />
      </div>

      {/* Right: recommendations */}
      <div>
        <div style={{
          display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14,
        }}>
          <h4 style={{fontSize:14, fontFamily:'var(--dfm-font-display)', fontWeight:600}}>
            Picks recommandés pour vous
          </h4>
          <span style={{fontSize:10, color:'var(--dfm-fg-faint)', fontFamily:'var(--dfm-font-mono)', letterSpacing:'0.1em', textTransform:'uppercase'}}>3 OPTIONS</span>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {DEMO.recs.map((r, i) => <RecCard key={r.name} rec={r} index={i+1} />)}
        </div>
      </div>
    </div>
  </div>
);

const TeamRow = ({ side, label, team, highlight }) => (
  <div>
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      marginBottom:10,
    }}>
      <span style={{
        fontSize:10, fontFamily:'var(--dfm-font-mono)', letterSpacing:'0.14em', textTransform:'uppercase',
        color: side === 'enemy' ? 'rgba(232,113,113,0.85)' : 'var(--dfm-cyan)',
      }}>{label}</span>
      <span style={{fontSize:10, color:'var(--dfm-fg-faint)', fontFamily:'var(--dfm-font-mono)'}}>
        {side === 'enemy' ? 'ENEMY' : 'BLUE SIDE'}
      </span>
    </div>
    <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:8}}>
      {team.map((c) => {
        const isYou = c.lane === highlight && c.placeholder;
        return (
          <div key={c.name + c.lane} style={{
            padding:8,
            border:'1px solid', borderColor: isYou ? 'var(--dfm-jade)' : 'var(--dfm-line)',
            borderRadius:8,
            background: isYou ? 'var(--dfm-jade-soft)' : 'var(--dfm-surface)',
            textAlign:'center',
          }}>
            <div style={{color: side === 'enemy' ? 'rgba(232,113,113,0.7)' : 'var(--dfm-cyan)'}}>
              <ChampSilhouette archetype={c.archetype} size={50} frame="hex" accent={isYou ? 'var(--dfm-jade)' : (side==='enemy'?'rgba(232,113,113,0.7)':'var(--dfm-cyan)')} />
            </div>
            <div style={{
              marginTop:4, fontSize:10,
              color: isYou ? 'var(--dfm-jade)' : 'var(--dfm-fg-muted)',
              fontFamily:'var(--dfm-font-display)', fontWeight:500,
            }}>
              {c.name}
            </div>
            <div style={{fontSize:9, color:'var(--dfm-fg-faint)', fontFamily:'var(--dfm-font-mono)', letterSpacing:'0.08em', textTransform:'uppercase'}}>
              {c.lane}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const RecCard = ({ rec, index }) => (
  <div style={{
    display:'flex', gap:14,
    padding:14,
    border:'1px solid', borderColor: index === 1 ? 'var(--dfm-jade)' : 'var(--dfm-line)',
    background: index === 1 ? 'rgba(63,217,164,0.04)' : 'var(--dfm-surface)',
    borderRadius:10,
    position:'relative',
  }}>
    {index === 1 && (
      <span style={{
        position:'absolute', top:-1, right:-1,
        fontFamily:'var(--dfm-font-mono)', fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase',
        background:'var(--dfm-jade)', color:'#062013',
        padding:'3px 8px', borderRadius:'0 9px 0 6px', fontWeight:600,
      }}>Top pick</span>
    )}
    <div style={{
      flex:'0 0 auto', display:'flex', flexDirection:'column', alignItems:'center', gap:4,
    }}>
      <div style={{color: RISK_COLOR[rec.risk]}}>
        <ChampSilhouette archetype={rec.archetype} size={56} frame="hex" accent={RISK_COLOR[rec.risk]} />
      </div>
      <div style={{
        fontSize:9, fontFamily:'var(--dfm-font-mono)', letterSpacing:'0.1em', textTransform:'uppercase',
        color: RISK_COLOR[rec.risk],
      }}>{rec.riskLabel}</div>
    </div>
    <div style={{flex:1, minWidth:0}}>
      <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:6}}>
        <span style={{fontSize:16, fontFamily:'var(--dfm-font-display)', fontWeight:600}}>{rec.name}</span>
        <span style={{fontSize:10, color:'var(--dfm-fg-faint)', fontFamily:'var(--dfm-font-mono)'}}>#{index}</span>
      </div>
      <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:8}}>
        {rec.tags.map(t => (
          <span key={t} style={{
            fontSize:10, padding:'3px 8px', borderRadius:99,
            border:'1px solid var(--dfm-line-strong)',
            color:'var(--dfm-fg-muted)',
          }}>{t}</span>
        ))}
      </div>
      <p style={{fontSize:12, lineHeight:1.5, color:'var(--dfm-fg-muted)'}}>{rec.why}</p>
    </div>
  </div>
);

Object.assign(window, { LandingSobre, DemoPanel, SectionHeader, RecCard, TeamRow });
