// landing-hybride.jsx — V2 Hybride · HUD modéré, lane map, plus de rythme

const LandingHybride = ({ ctaText = 'Tester une draft' }) => {
  return (
    <div className="dfm" data-screen-label="V2 Hybride" data-palette="profond" style={{minHeight:'100%'}}>
      <DFMHeader accent="var(--dfm-jade)" label="Beta · 2026" />

      {/* HERO */}
      <section style={{
        position:'relative', overflow:'hidden',
        padding:'100px 80px 110px',
      }}>
        <div style={{color:'rgba(140,200,240,1)', position:'absolute', inset:0}}>
          <HexGridSVG opacity={0.12} glow />
        </div>
        {/* subtle vignette */}
        <div style={{position:'absolute', inset:0, background:'radial-gradient(60% 90% at 50% 0%, transparent 0%, var(--dfm-bg-1) 90%)', pointerEvents:'none'}} />

        <div style={{maxWidth:1200, margin:'0 auto', position:'relative', display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center'}}>
          <div>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:10,
              padding:'6px 14px', borderRadius:99,
              border:'1px solid var(--dfm-line-strong)',
              background:'rgba(63,217,164,0.06)',
              marginBottom:24,
            }}>
              <span style={{display:'inline-block', width:6, height:6, borderRadius:99, background:'var(--dfm-jade)', boxShadow:'0 0 10px var(--dfm-jade)'}} />
              <span className="dfm-eyebrow" style={{fontSize:10}}>Draft coach · League of Legends</span>
            </div>
            <h1 style={{
              fontSize:62, lineHeight:1.05, letterSpacing:'-0.025em',
              fontWeight:600, marginBottom:22,
            }}>
              Sachez quoi pick,<br/>
              sans <span style={{color:'var(--dfm-jade)', position:'relative'}}>
                prise de tête.
                <svg style={{position:'absolute', left:0, bottom:-6, width:'100%', height:8}} viewBox="0 0 220 8" preserveAspectRatio="none">
                  <path d="M2 4 Q 60 0 110 4 T 218 4" stroke="var(--dfm-jade)" strokeWidth="1.6" fill="none" opacity="0.6"/>
                </svg>
              </span>
            </h1>
            <p style={{
              fontSize:18, lineHeight:1.55, color:'var(--dfm-fg-muted)',
              maxWidth:500, marginBottom:32,
            }}>
              On vous aide à choisir un champion adapté à la draft, au rôle joué et aux risques de la partie. Trois picks, classés du plus safe au plus pointu.
            </p>
            <div style={{display:'flex', gap:14, alignItems:'center', marginBottom:36}}>
              <button className="dfm-btn dfm-btn-primary">{ctaText} <Icon.arrow /></button>
              <button className="dfm-btn dfm-btn-secondary">Comment ça marche</button>
            </div>

            {/* Stat strip */}
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(3, 1fr)',
              border:'1px solid var(--dfm-line)', borderRadius:12,
              overflow:'hidden',
            }}>
              {[
                { v: '5 rôles', l: 'Top · Jungle · Mid · ADC · Support' },
                { v: '< 5 sec', l: 'Pour avoir 3 picks proposés' },
                { v: 'FR', l: 'Tout en français, terms LoL gardés' },
              ].map((s, i) => (
                <div key={i} style={{
                  padding:'16px 18px',
                  borderRight: i < 2 ? '1px solid var(--dfm-line)' : 'none',
                  background:'rgba(15,27,48,0.5)',
                }}>
                  <div style={{
                    fontFamily:'var(--dfm-font-display)', fontSize:20, fontWeight:600, color:'var(--dfm-fg)',
                    marginBottom:4,
                  }}>{s.v}</div>
                  <div style={{fontSize:11, color:'var(--dfm-fg-faint)', lineHeight:1.4}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: hero composition — tool preview floating */}
          <HybrideHeroArt />
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section style={{padding:'var(--dfm-pad-section) 80px', borderTop:'1px solid var(--dfm-line-soft)', background:'var(--dfm-bg-2)'}}>
        <div style={{maxWidth:1200, margin:'0 auto'}}>
          <SectionHeader
            eyebrow="Comment ça marche"
            title="Quatre étapes. Une recommandation que vous comprenez."
            sub="Vous donnez le contexte, on retourne trois picks adaptés. Pas de magie, juste des matchups bien lus."
          />
          <div style={{marginTop:64, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:20}}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{
                position:'relative',
                padding:'28px 24px',
                background:'var(--dfm-surface)',
                border:'1px solid var(--dfm-line)',
                borderRadius:14,
                overflow:'hidden',
              }}>
                {/* corner bracket accent */}
                <span style={{position:'absolute', top:8, right:8, color:'var(--dfm-jade)', opacity:0.5}}>
                  <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2 L10 2 L10 10" stroke="currentColor" strokeWidth="1" fill="none"/></svg>
                </span>

                <div style={{
                  width:48, height:48, marginBottom:20,
                  border:'1px solid var(--dfm-line-strong)',
                  borderRadius:10,
                  background:'var(--dfm-jade-soft)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'var(--dfm-jade)',
                }}>
                  <RoleIcon role={s.role} size={22} />
                </div>

                <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:10}}>
                  <span style={{
                    fontFamily:'var(--dfm-font-mono)', fontSize:11, color:'var(--dfm-jade)',
                    letterSpacing:'0.16em',
                  }}>STEP_{s.n}</span>
                </div>
                <h3 style={{fontSize:18, marginBottom:8, lineHeight:1.3}}>{s.title}</h3>
                <p style={{fontSize:14, lineHeight:1.55, color:'var(--dfm-fg-muted)'}}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section style={{padding:'var(--dfm-pad-section) 80px'}}>
        <div style={{maxWidth:1200, margin:'0 auto'}}>
          <SectionHeader
            eyebrow="Aperçu de l'outil"
            title="Un exemple concret en midlane."
            sub="L'adversaire a lock Zed mid, Lee Sin jungle, Yasuo top. Voici ce que DraftForMe propose."
          />
          <div style={{marginTop:56}}>
            <DemoPanel />
          </div>
        </div>
      </section>

      {/* FONCTIONNALITÉS — avec map de la Faille à gauche */}
      <section style={{padding:'var(--dfm-pad-section) 80px', borderTop:'1px solid var(--dfm-line-soft)', background:'var(--dfm-bg-2)'}}>
        <div style={{maxWidth:1200, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1.3fr', gap:56, alignItems:'start'}}>
          <div style={{position:'sticky', top:24}}>
            <SectionHeader
              eyebrow="Fonctionnalités"
              title="Pensé pour décider vite."
              sub="Tout est calibré pour répondre à une seule question : quel champion choisir maintenant ?"
            />
            <div style={{marginTop:32, padding:24, border:'1px solid var(--dfm-line)', borderRadius:14, background:'var(--dfm-surface)'}}>
              <div style={{display:'flex', justifyContent:'center', color:'var(--dfm-fg-muted)'}}>
                <RiftLanes width={340} height={340} />
              </div>
              <div style={{
                marginTop:14, paddingTop:14,
                borderTop:'1px solid var(--dfm-line)',
                display:'flex', alignItems:'center', justifyContent:'space-between',
                fontSize:11, fontFamily:'var(--dfm-font-mono)', color:'var(--dfm-fg-faint)',
                letterSpacing:'0.1em',
              }}>
                <span>RIFT_MAP · v2026.05</span>
                <span style={{color:'var(--dfm-jade)'}}>5 LANES</span>
              </div>
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
            {FEATURES.map((f, i) => {
              const IconC = Icon[f.icon];
              return (
                <div key={f.title} style={{
                  padding:24,
                  background:'var(--dfm-surface)',
                  border:'1px solid var(--dfm-line)',
                  borderRadius:14,
                  position:'relative',
                  overflow:'hidden',
                }}>
                  <div style={{
                    position:'absolute', top:0, right:0, padding:'6px 10px',
                    fontFamily:'var(--dfm-font-mono)', fontSize:9, letterSpacing:'0.12em',
                    color:'var(--dfm-fg-faint)', textTransform:'uppercase',
                    borderLeft:'1px solid var(--dfm-line)', borderBottom:'1px solid var(--dfm-line)',
                    borderRadius:'0 14px 0 10px',
                  }}>F.{String(i+1).padStart(2,'0')}</div>
                  <div style={{
                    width:42, height:42, marginBottom:18,
                    border:'1px solid var(--dfm-jade)', background:'var(--dfm-jade-soft)',
                    borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
                    color:'var(--dfm-jade)', boxShadow:'var(--dfm-glow)',
                  }}><IconC /></div>
                  <h3 style={{fontSize:18, marginBottom:8}}>{f.title}</h3>
                  <p style={{fontSize:14, lineHeight:1.55, color:'var(--dfm-fg-muted)'}}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* POUR QUI */}
      <section style={{padding:'var(--dfm-pad-section) 80px'}}>
        <div style={{maxWidth:1200, margin:'0 auto'}}>
          <SectionHeader
            eyebrow="Pour qui c'est"
            title="Pas pour les pros. Pour les gens qui jouent pour s'amuser."
            sub="Si vous lisez ça, vous êtes probablement déjà dans la cible."
          />
          <div style={{marginTop:48, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14}}>
            {AUDIENCE.map((a, i) => (
              <div key={i} style={{
                padding:'22px 20px',
                background:'var(--dfm-surface)',
                border:'1px solid var(--dfm-line)',
                borderRadius:12,
                position:'relative',
              }}>
                <span style={{
                  fontFamily:'var(--dfm-font-mono)', fontSize:11,
                  color:'var(--dfm-jade)', letterSpacing:'0.14em',
                  display:'block', marginBottom:14,
                }}>0{i+1}/</span>
                <p style={{fontSize:14, lineHeight:1.55}}>{a}</p>
              </div>
            ))}
          </div>

          {/* "Pas pour vous si" complement */}
          <div style={{
            marginTop:40,
            display:'flex', gap:16,
            padding:'22px 24px',
            background:'rgba(232,113,113,0.04)',
            border:'1px solid rgba(232,113,113,0.18)',
            borderRadius:12,
          }}>
            <span style={{color:'var(--dfm-danger)', marginTop:1}}><Icon.cross /></span>
            <div>
              <div style={{fontSize:13, fontFamily:'var(--dfm-font-display)', fontWeight:600, marginBottom:4}}>
                Pas pour vous si vous êtes déjà Diamant+
              </div>
              <p style={{fontSize:13, color:'var(--dfm-fg-muted)', lineHeight:1.5}}>
                Le coach est pensé pour les drafts SoloQ jusqu'à Or/Platine. Au-dessus, vous savez déjà.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{padding:'80px 80px 120px'}}>
        <div style={{
          maxWidth:1100, margin:'0 auto',
          padding:'68px 72px',
          border:'1px solid var(--dfm-jade)',
          borderRadius:20,
          background:'linear-gradient(135deg, var(--dfm-surface) 0%, rgba(63,217,164,0.06) 100%)',
          textAlign:'center',
          position:'relative', overflow:'hidden',
          boxShadow:'var(--dfm-glow-strong)',
        }}>
          <div style={{color:'rgba(140,200,240,1)'}}><HexGridSVG opacity={0.07} glow /></div>
          <div style={{position:'relative'}}>
            <div className="dfm-eyebrow" style={{marginBottom:16}}>Prêt ?</div>
            <h2 style={{fontSize:42, lineHeight:1.1, marginBottom:14}}>Lancez une draft, voyez ce que ça donne.</h2>
            <p style={{color:'var(--dfm-fg-muted)', fontSize:16, lineHeight:1.55, maxWidth:560, margin:'0 auto 32px'}}>
              Aucune création de compte. Vous testez en 30 secondes. Si ça aide, vous revenez.
            </p>
            <button className="dfm-btn dfm-btn-primary" style={{padding:'18px 32px', fontSize:15}}>{ctaText} <Icon.arrow /></button>
          </div>
        </div>
      </section>

      <DFMFooter accent="var(--dfm-jade)" />
    </div>
  );
};

// ─── Hybride hero art: a smaller demo tile floating + role chips ──────────
const HybrideHeroArt = () => (
  <div style={{
    position:'relative',
    aspectRatio: '1 / 1.05',
  }}>
    {/* hex frame backdrop */}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute', inset:0, width:'100%', height:'100%'}}>
      <defs>
        <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(63,217,164,0.4)" />
          <stop offset="100%" stopColor="rgba(63,217,164,0)" />
        </linearGradient>
      </defs>
      <path d="M50 2 L96 28 L96 72 L50 98 L4 72 L4 28 Z" fill="rgba(15,27,48,0.4)" stroke="url(#hg)" strokeWidth="0.4" />
    </svg>

    {/* role chips on the perimeter */}
    {ROLES.map((r, i) => {
      const angle = -90 + i * (360/5);
      const rad = (angle * Math.PI) / 180;
      const cx = 50 + 50 * Math.cos(rad);
      const cy = 50 + 50 * Math.sin(rad);
      const active = r.id === 'mid';
      return (
        <div key={r.id} style={{
          position:'absolute',
          left: `calc(${cx}% - 24px)`, top: `calc(${cy}% - 24px)`,
          width:48, height:48, borderRadius:12,
          background: active ? 'var(--dfm-jade)' : 'var(--dfm-bg-2)',
          color: active ? '#062013' : 'var(--dfm-fg-muted)',
          border:'1px solid', borderColor: active ? 'var(--dfm-jade)' : 'var(--dfm-line-strong)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow: active ? 'var(--dfm-glow-strong)' : 'none',
        }}>
          <RoleIcon role={r.id} size={22} />
        </div>
      );
    })}

    {/* center: stacked rec cards (small) */}
    <div style={{
      position:'absolute', inset:'25% 18%',
      background:'rgba(7,13,27,0.85)',
      backdropFilter:'blur(8px)',
      border:'1px solid var(--dfm-line-strong)',
      borderRadius:14,
      padding:14,
      display:'flex', flexDirection:'column', justifyContent:'space-between',
      boxShadow:'var(--dfm-glow)',
    }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <span style={{fontSize:10, fontFamily:'var(--dfm-font-mono)', color:'var(--dfm-fg-faint)', letterSpacing:'0.14em', textTransform:'uppercase'}}>
          Recommandations
        </span>
        <span style={{display:'flex', gap:3}}>
          <span style={{width:5, height:5, borderRadius:99, background:'var(--dfm-jade)'}} />
          <span style={{width:5, height:5, borderRadius:99, background:'var(--dfm-cyan)'}} />
          <span style={{width:5, height:5, borderRadius:99, background:'var(--dfm-gold)'}} />
        </span>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:8}}>
        {DEMO.recs.map((r, i) => (
          <div key={r.name} style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'8px 10px',
            background: i===0 ? 'var(--dfm-jade-soft)' : 'rgba(15,27,48,0.6)',
            border:'1px solid', borderColor: i===0 ? 'var(--dfm-jade)' : 'var(--dfm-line)',
            borderRadius:8,
          }}>
            <span style={{
              width:22, height:22, borderRadius:5,
              background: RISK_COLOR[r.risk],
              color:'#062013', fontWeight:700, fontSize:11,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'var(--dfm-font-display)',
            }}>{i+1}</span>
            <span style={{flex:1, fontSize:13, fontWeight:600}}>{r.name}</span>
            <span style={{fontSize:9, color: RISK_COLOR[r.risk], fontFamily:'var(--dfm-font-mono)', letterSpacing:'0.1em', textTransform:'uppercase'}}>{r.riskLabel}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

Object.assign(window, { LandingHybride, HybrideHeroArt });
