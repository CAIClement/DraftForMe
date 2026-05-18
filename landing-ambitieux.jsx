// landing-ambitieux.jsx — V3 Ambitieux · broadcast Rift, HUD assumé, glows

const LandingAmbitieux = ({ ctaText = 'Tester une draft' }) => {
  return (
    <div className="dfm" data-screen-label="V3 Ambitieux" data-palette="lumineux" style={{minHeight:'100%'}}>
      {/* Custom top bar — broadcast feel */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'14px 56px',
        borderBottom:'1px solid var(--dfm-line)',
        background:'var(--dfm-bg-0)',
        fontFamily:'var(--dfm-font-mono)', fontSize:11, letterSpacing:'0.12em',
        color:'var(--dfm-fg-faint)', textTransform:'uppercase',
      }}>
        <div style={{display:'flex', gap:22}}>
          <span><span style={{display:'inline-block', width:6, height:6, borderRadius:99, background:'var(--dfm-jade)', boxShadow:'0 0 10px var(--dfm-jade)', marginRight:8, verticalAlign:'middle'}} /> LIVE BETA</span>
          <span>v2026.05.17</span>
        </div>
        <div style={{display:'flex', gap:22}}>
          <span>FR · EU-WEST</span>
          <span>5 ROLES INDEXED</span>
          <span style={{color:'var(--dfm-jade)'}}>OPERATIONAL</span>
        </div>
      </div>

      <DFMHeader accent="var(--dfm-jade)" label="Patch 16.10" />

      {/* HERO */}
      <section style={{
        position:'relative', overflow:'hidden',
        padding:'90px 80px 110px',
        background:'var(--dfm-bg-0)',
      }}>
        {/* layered backgrounds */}
        <div style={{color:'rgba(160,220,255,1)', position:'absolute', inset:0}}>
          <HexGridSVG opacity={0.18} glow />
        </div>
        <div style={{position:'absolute', inset:0, background:'radial-gradient(80% 60% at 50% 0%, rgba(63,217,164,0.18) 0%, transparent 60%)', pointerEvents:'none'}} />
        <div style={{position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 0%, var(--dfm-bg-1) 95%)', pointerEvents:'none'}} />

        {/* corner brackets large */}
        {['tl','tr','bl','br'].map((c) => (
          <span key={c} style={{
            position:'absolute', width:42, height:42, zIndex:1,
            ...(c[0]==='t' ? {top:24} : {bottom:24}),
            ...(c[1]==='l' ? {left:24} : {right:24}),
            borderTop:    c[0]==='t' ? '1.5px solid var(--dfm-jade)' : 'none',
            borderBottom: c[0]==='b' ? '1.5px solid var(--dfm-jade)' : 'none',
            borderLeft:   c[1]==='l' ? '1.5px solid var(--dfm-jade)' : 'none',
            borderRight:  c[1]==='r' ? '1.5px solid var(--dfm-jade)' : 'none',
            boxShadow: 'var(--dfm-glow)',
          }} />
        ))}

        <div style={{maxWidth:1280, margin:'0 auto', position:'relative', textAlign:'center', paddingBottom:60}}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:12,
            padding:'8px 18px', borderRadius:99,
            border:'1px solid var(--dfm-jade)',
            background:'var(--dfm-jade-soft)',
            marginBottom:32,
            boxShadow:'var(--dfm-glow)',
          }}>
            <DFMMark size={16} color="var(--dfm-jade)" tone="var(--dfm-jade)" />
            <span className="dfm-eyebrow" style={{fontSize:11, letterSpacing:'0.2em'}}>Draft coach · League of Legends</span>
          </div>

          <h1 style={{
            fontSize:88, lineHeight:1.0, letterSpacing:'-0.03em',
            fontWeight:700, marginBottom:24,
            fontFamily:'var(--dfm-font-display)',
          }}>
            Quel champion <em style={{fontStyle:'normal', color:'var(--dfm-jade)', position:'relative', display:'inline-block'}}>
              pick
              <svg style={{position:'absolute', left:-6, right:-6, top:-6, bottom:-6, width:'calc(100% + 12px)', height:'calc(100% + 12px)', pointerEvents:'none'}} viewBox="0 0 100 60" preserveAspectRatio="none">
                <path d="M5 30 L95 30 M50 5 L50 55" stroke="var(--dfm-jade)" strokeWidth="0.5" opacity="0.5" />
                <circle cx="50" cy="30" r="22" fill="none" stroke="var(--dfm-jade)" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.6" />
              </svg>
            </em><br />
            dans cette draft ?
          </h1>

          <p style={{
            fontSize:20, lineHeight:1.5, color:'var(--dfm-fg-muted)',
            maxWidth:640, margin:'0 auto 40px',
          }}>
            DraftForMe analyse la composition, le rôle joué et les risques de la partie — et vous propose <strong style={{color:'var(--dfm-fg)'}}>trois picks adaptés</strong>, classés du plus safe au plus pointu.
          </p>

          <div style={{display:'flex', gap:14, justifyContent:'center', marginBottom:20}}>
            <button className="dfm-btn dfm-btn-primary" style={{padding:'18px 30px', fontSize:15}}>{ctaText} <Icon.arrow /></button>
            <button className="dfm-btn dfm-btn-secondary" style={{padding:'18px 30px', fontSize:15}}>Voir un exemple</button>
          </div>
          <div style={{fontFamily:'var(--dfm-font-mono)', fontSize:11, letterSpacing:'0.12em', color:'var(--dfm-fg-faint)', textTransform:'uppercase'}}>
            Sans création de compte · Gratuit pendant la beta
          </div>
        </div>

        {/* The full demo panel, full-bleed in hero — broadcast HUD */}
        <div style={{maxWidth:1280, margin:'0 auto', position:'relative'}}>
          <DemoPanel />
        </div>
      </section>

      {/* COMMENT ÇA MARCHE — flow on a track */}
      <section style={{padding:'var(--dfm-pad-section) 80px', borderTop:'1px solid var(--dfm-line-soft)'}}>
        <div style={{maxWidth:1280, margin:'0 auto'}}>
          <div style={{textAlign:'center', marginBottom:64}}>
            <div className="dfm-eyebrow" style={{marginBottom:16}}>Comment ça marche</div>
            <h2 style={{fontSize:48, lineHeight:1.1}}>Du contexte. Trois picks. Une décision.</h2>
            <p style={{fontSize:16, lineHeight:1.6, color:'var(--dfm-fg-muted)', maxWidth:600, margin:'18px auto 0'}}>
              L'enchaînement complet, du moment où vous ouvrez l'outil jusqu'à votre pick verrouillé.
            </p>
          </div>

          {/* The flow — a horizontal HUD track */}
          <div style={{
            position:'relative',
            padding:'40px 0',
          }}>
            {/* connecting line */}
            <div style={{
              position:'absolute', left:'8%', right:'8%', top:'50%',
              height:1, background:'linear-gradient(90deg, transparent 0%, var(--dfm-jade) 20%, var(--dfm-jade) 80%, transparent 100%)',
              opacity:0.5,
            }} />
            <div style={{
              position:'absolute', left:'8%', right:'8%', top:'50%',
              height:1, background:'var(--dfm-jade)',
              boxShadow:'0 0 8px var(--dfm-jade)', opacity:0.4,
            }} />

            <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:24, position:'relative'}}>
              {STEPS.map((s, i) => (
                <div key={s.n} style={{textAlign:'center'}}>
                  <div style={{
                    width:88, height:88, margin:'0 auto 20px',
                    position:'relative',
                  }}>
                    {/* hexagon frame */}
                    <svg viewBox="0 0 88 88" style={{position:'absolute', inset:0}}>
                      <path d="M44 4 L78 22 L78 66 L44 84 L10 66 L10 22 Z"
                            fill="var(--dfm-bg-2)"
                            stroke="var(--dfm-jade)" strokeWidth="1.4" />
                      <path d="M44 12 L70 26 L70 62 L44 76 L18 62 L18 26 Z"
                            fill="none" stroke="var(--dfm-jade)" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6" />
                    </svg>
                    <div style={{
                      position:'absolute', inset:0,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'var(--dfm-jade)',
                    }}>
                      <RoleIcon role={s.role} size={30} />
                    </div>
                    <span style={{
                      position:'absolute', top:-2, right:-2,
                      width:24, height:24, borderRadius:99,
                      background:'var(--dfm-bg-1)',
                      border:'1px solid var(--dfm-jade)',
                      color:'var(--dfm-jade)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, fontWeight:700, fontFamily:'var(--dfm-font-display)',
                    }}>{i+1}</span>
                  </div>
                  <h3 style={{fontSize:18, marginBottom:10}}>{s.title}</h3>
                  <p style={{fontSize:13, lineHeight:1.55, color:'var(--dfm-fg-muted)', maxWidth:240, margin:'0 auto'}}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FONCTIONNALITÉS — broadcast tiles */}
      <section style={{padding:'var(--dfm-pad-section) 80px', borderTop:'1px solid var(--dfm-line-soft)', background:'var(--dfm-bg-0)'}}>
        <div style={{maxWidth:1280, margin:'0 auto'}}>
          <div style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:48}}>
            <div>
              <div className="dfm-eyebrow" style={{marginBottom:16}}>Fonctionnalités</div>
              <h2 style={{fontSize:48, lineHeight:1.1, maxWidth:600}}>Tout ce qu'il faut pour pick bien. Rien de plus.</h2>
            </div>
            <div style={{
              fontFamily:'var(--dfm-font-mono)', fontSize:11, letterSpacing:'0.14em',
              color:'var(--dfm-fg-faint)', textTransform:'uppercase',
              padding:'10px 16px', border:'1px solid var(--dfm-line)', borderRadius:99,
            }}>
              4 MODULES · COUNTERPICK CORE
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14}}>
            {FEATURES.map((f, i) => {
              const IconC = Icon[f.icon];
              return (
                <div key={f.title} style={{
                  position:'relative',
                  padding:'28px 24px',
                  background:'var(--dfm-bg-2)',
                  border:'1px solid var(--dfm-line-strong)',
                  borderRadius:14,
                  overflow:'hidden',
                  minHeight:280,
                  display:'flex', flexDirection:'column',
                }}>
                  {/* hex deco */}
                  <div style={{
                    position:'absolute', top:-30, right:-30,
                    width:120, height:120, color:'var(--dfm-jade)', opacity:0.12,
                  }}>
                    <svg viewBox="0 0 120 120"><path d="M60 5 L106 32 L106 88 L60 115 L14 88 L14 32 Z" stroke="currentColor" strokeWidth="1" fill="none"/></svg>
                  </div>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24}}>
                    <span style={{
                      fontFamily:'var(--dfm-font-mono)', fontSize:10, letterSpacing:'0.14em',
                      color:'var(--dfm-jade)', textTransform:'uppercase',
                    }}>MODULE_0{i+1}</span>
                    <span style={{
                      width:8, height:8, borderRadius:99, background:'var(--dfm-jade)',
                      boxShadow:'0 0 8px var(--dfm-jade)',
                    }} />
                  </div>
                  <div style={{
                    width:54, height:54, marginBottom:22,
                    background:'rgba(63,217,164,0.12)',
                    border:'1px solid var(--dfm-jade)',
                    borderRadius:12,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'var(--dfm-jade)',
                    boxShadow:'inset 0 0 12px rgba(63,217,164,0.2)',
                  }}>
                    <IconC style={{transform:'scale(1.4)'}} />
                  </div>
                  <h3 style={{fontSize:19, marginBottom:10, lineHeight:1.25}}>{f.title}</h3>
                  <p style={{fontSize:13, lineHeight:1.55, color:'var(--dfm-fg-muted)'}}>{f.desc}</p>
                </div>
              );
            })}
          </div>

          {/* lane map split panel */}
          <div style={{
            marginTop:24,
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:14,
          }}>
            <div style={{
              padding:32,
              background:'var(--dfm-bg-2)',
              border:'1px solid var(--dfm-line-strong)',
              borderRadius:14,
              display:'flex', alignItems:'center', gap:32,
            }}>
              <div style={{color:'var(--dfm-fg-muted)', flex:'0 0 auto'}}>
                <RiftLanes width={240} height={240} accent="var(--dfm-jade)" />
              </div>
              <div>
                <div style={{
                  fontFamily:'var(--dfm-font-mono)', fontSize:11, letterSpacing:'0.14em',
                  color:'var(--dfm-jade)', textTransform:'uppercase', marginBottom:14,
                }}>RIFT_MAP</div>
                <h3 style={{fontSize:22, marginBottom:10}}>Conseils par lane, par phase, par contexte.</h3>
                <p style={{fontSize:13, lineHeight:1.6, color:'var(--dfm-fg-muted)'}}>
                  Mid roam, jungle dive, bot scaling — chaque lane a ses propres signaux. DraftForMe les lit pour vous.
                </p>
              </div>
            </div>

            <div style={{
              padding:32,
              background:'var(--dfm-bg-2)',
              border:'1px solid var(--dfm-line-strong)',
              borderRadius:14,
            }}>
              <div style={{
                fontFamily:'var(--dfm-font-mono)', fontSize:11, letterSpacing:'0.14em',
                color:'var(--dfm-jade)', textTransform:'uppercase', marginBottom:14,
              }}>RISK_METER</div>
              <h3 style={{fontSize:22, marginBottom:18}}>Trois niveaux de risque, jamais un seul "best pick".</h3>
              <div style={{display:'flex', flexDirection:'column', gap:14}}>
                {[
                  { lbl: 'SAFE',       desc: 'Difficile à punir, marche partout', color: 'var(--dfm-jade)', pct: 85 },
                  { lbl: 'ÉQUILIBRÉ',  desc: 'Bonne value si bien joué',           color: 'var(--dfm-cyan)', pct: 65 },
                  { lbl: 'PLUS POINTU',desc: 'Tranche la comp adverse — risqué',  color: 'var(--dfm-gold)', pct: 40 },
                ].map(r => (
                  <div key={r.lbl} style={{display:'flex', alignItems:'center', gap:14}}>
                    <span style={{
                      flex:'0 0 100px', fontFamily:'var(--dfm-font-mono)', fontSize:11, letterSpacing:'0.14em',
                      color:r.color,
                    }}>{r.lbl}</span>
                    <div style={{flex:1, height:6, background:'var(--dfm-bg-3)', borderRadius:99, overflow:'hidden', position:'relative'}}>
                      <div style={{width:`${r.pct}%`, height:'100%', background:r.color, boxShadow:`0 0 10px ${r.color}`}} />
                    </div>
                    <span style={{flex:'0 0 auto', fontSize:11, color:'var(--dfm-fg-muted)'}}>{r.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* POUR QUI */}
      <section style={{padding:'var(--dfm-pad-section) 80px'}}>
        <div style={{maxWidth:1180, margin:'0 auto'}}>
          <div style={{textAlign:'center', marginBottom:56}}>
            <div className="dfm-eyebrow" style={{marginBottom:16}}>Pour qui c'est</div>
            <h2 style={{fontSize:48, lineHeight:1.1, maxWidth:700, margin:'0 auto'}}>
              Pas pour les pros.<br />Pour les joueurs qui veulent juste s'amuser.
            </h2>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:14}}>
            {AUDIENCE.map((a, i) => (
              <div key={i} style={{
                display:'flex', gap:20,
                padding:'24px 28px',
                background:'var(--dfm-surface)',
                border:'1px solid var(--dfm-line)',
                borderRadius:14,
                position:'relative',
              }}>
                <div style={{
                  flex:'0 0 auto',
                  width:48, height:48,
                  borderRadius:12,
                  background:'var(--dfm-jade-soft)',
                  border:'1px solid var(--dfm-jade)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'var(--dfm-jade)', fontFamily:'var(--dfm-font-display)', fontWeight:700, fontSize:14,
                }}>0{i+1}</div>
                <p style={{fontSize:15, lineHeight:1.55, alignSelf:'center'}}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL — Broadcast end card */}
      <section style={{padding:'80px 80px 120px', background:'var(--dfm-bg-0)'}}>
        <div style={{
          maxWidth:1180, margin:'0 auto',
          padding:'88px 64px',
          border:'1px solid var(--dfm-jade)',
          borderRadius:20,
          background:'linear-gradient(180deg, rgba(63,217,164,0.04) 0%, var(--dfm-surface) 100%)',
          textAlign:'center',
          position:'relative', overflow:'hidden',
          boxShadow:'var(--dfm-glow-strong)',
        }}>
          {/* hex bg */}
          <div style={{color:'rgba(160,220,255,1)'}}><HexGridSVG opacity={0.14} glow /></div>

          <div style={{position:'relative'}}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:10,
              fontFamily:'var(--dfm-font-mono)', fontSize:11, letterSpacing:'0.18em',
              color:'var(--dfm-jade)', textTransform:'uppercase',
              padding:'6px 14px', border:'1px solid var(--dfm-jade)', borderRadius:99,
              marginBottom:32,
            }}>
              <span style={{width:6, height:6, borderRadius:99, background:'var(--dfm-jade)', boxShadow:'0 0 8px var(--dfm-jade)'}} />
              READY TO DRAFT
            </div>
            <h2 style={{fontSize:60, lineHeight:1.05, marginBottom:20, letterSpacing:'-0.025em'}}>
              Lancez une draft.<br />
              <span style={{color:'var(--dfm-jade)'}}>Voyez si ça change votre game.</span>
            </h2>
            <p style={{color:'var(--dfm-fg-muted)', fontSize:17, lineHeight:1.55, maxWidth:560, margin:'0 auto 36px'}}>
              30 secondes. Aucun compte. Si ça aide, vous revenez. Sinon, vous nous oubliez sans regret.
            </p>
            <button className="dfm-btn dfm-btn-primary" style={{padding:'20px 36px', fontSize:16}}>{ctaText} <Icon.arrow /></button>
          </div>
        </div>
      </section>

      <DFMFooter accent="var(--dfm-jade)" />
    </div>
  );
};

Object.assign(window, { LandingAmbitieux });
