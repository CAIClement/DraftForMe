// app.jsx — mounts the design canvas + 3 artboards + global tweaks panel

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "profond",
  "font": "grotesk",
  "density": "regular",
  "glow": "subtle",
  "cards": "solid",
  "theme": "dark",
  "ctaText": "Tester une draft"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply tweaks at the artboard-content level via data-* attrs on each .dfm root.
  // The 3 landings each set their own preferred palette by default; the tweak
  // overrides ALL of them. Same for theme/font/density/glow/cards.
  const dataAttrs = {
    'data-palette': t.palette,
    'data-font': t.font,
    'data-density': t.density,
    'data-glow': t.glow,
    'data-cards': t.cards,
    'data-theme': t.theme,
  };

  // We wrap each landing inside a container that propagates tweaks via inline
  // override of data-* on the .dfm root. Simplest: use a key to force remount
  // OR pass via cloneElement. Simpler: render with a wrapping div that has the
  // same .dfm class and overrides. But .dfm class is on the landing's outer
  // div, so the wrapping div would create a second .dfm. Instead, we override
  // each landing's outer attrs imperatively in a useEffect.
  React.useEffect(() => {
    document.querySelectorAll('.dfm').forEach((el) => {
      Object.entries(dataAttrs).forEach(([k, v]) => el.setAttribute(k, v));
    });
  }, [t.palette, t.font, t.density, t.glow, t.cards, t.theme]);

  const ctaText = t.ctaText || 'Tester une draft';

  return (
    <>
      <DesignCanvas>
        <DCSection
          id="landings"
          title="DraftForMe — Landing page"
          subtitle="Trois directions visuelles, de la plus sobre à la plus ambitieuse — même contenu."
        >
          <DCArtboard id="sobre" label="V1 · Sobre" width={1280} height={4100}>
            <LandingSobre ctaText={ctaText} />
          </DCArtboard>
          <DCArtboard id="hybride" label="V2 · Hybride" width={1280} height={4600}>
            <LandingHybride ctaText={ctaText} />
          </DCArtboard>
          <DCArtboard id="ambitieux" label="V3 · Ambitieux" width={1280} height={4650}>
            <LandingAmbitieux ctaText={ctaText} />
          </DCArtboard>
        </DCSection>

        <DCSection
          id="decision"
          title="Espace de décision"
          subtitle="La section « suggestion » repensée comme un espace où l'on compare, comprend, et voit les risques avant de lock."
        >
          <DCArtboard id="decision-desktop" label="Desktop · grille + détail" width={1400} height={1180}>
            <DecisionDesktop />
          </DCArtboard>
          <DCArtboard id="decision-mobile" label="Mobile · stack" width={390} height={1480}>
            <DecisionMobile />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="Palette" />
        <TweakRadio
          label="Ambiance"
          value={t.palette}
          options={[
            { value: 'sobre',    label: 'Sobre'    },
            { value: 'profond',  label: 'Profond'  },
            { value: 'lumineux', label: 'Lumineux' },
          ]}
          onChange={(v) => setTweak('palette', v)}
        />
        <TweakToggle
          label="Mode clair"
          value={t.theme === 'light'}
          onChange={(v) => setTweak('theme', v ? 'light' : 'dark')}
        />
        <TweakRadio
          label="Intensité des lueurs"
          value={t.glow}
          options={[
            { value: 'off',    label: 'Off'    },
            { value: 'subtle', label: 'Subtil' },
            { value: 'strong', label: 'Fort'   },
          ]}
          onChange={(v) => setTweak('glow', v)}
        />

        <TweakSection label="Typographie & rythme" />
        <TweakRadio
          label="Police d'affichage"
          value={t.font}
          options={[
            { value: 'inter',    label: 'Inter'   },
            { value: 'grotesk',  label: 'Grotesk' },
            { value: 'rajdhani', label: 'Rajdhani'},
          ]}
          onChange={(v) => setTweak('font', v)}
        />
        <TweakRadio
          label="Densité"
          value={t.density}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'regular', label: 'Normal'  },
            { value: 'aere',    label: 'Aéré'    },
          ]}
          onChange={(v) => setTweak('density', v)}
        />

        <TweakSection label="Cartes" />
        <TweakRadio
          label="Style"
          value={t.cards}
          options={[
            { value: 'line',  label: 'Lignes' },
            { value: 'solid', label: 'Solides'},
            { value: 'frame', label: 'Cadre'  },
          ]}
          onChange={(v) => setTweak('cards', v)}
        />

        <TweakSection label="Copy" />
        <TweakSelect
          label="CTA principal"
          value={t.ctaText}
          options={[
            'Tester une draft',
            'Lancer une draft',
            'Analyser ma draft',
            'Voir mes picks',
            'Essayer maintenant',
          ]}
          onChange={(v) => setTweak('ctaText', v)}
        />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
