/* ================================================================
   DraftForMe - app.js v5
   - Tier list par role depuis op.gg/lol/champions
   - Slider + 3 boutons preset
   - Pas de charts sidebar
   ================================================================ */

const state = {
    region: 'euw',
    role: 'mid',
    priority: 50,
    clickMode: 'enemy',
    ddragon: {},
    championStats: [],
    playerPool: [],
    enemyPicks: [],
    bannedChamps: [],
    recommendations: [],
    statsLoaded: false,
    currentStatsRole: null,
};

function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(el._timer); el._timer = setTimeout(() => el.classList.add('hidden'), 3000);
}
function showLoading(msg) { document.getElementById('loading-text').textContent = msg; document.getElementById('loading-overlay').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loading-overlay').classList.add('hidden'); }

function getChampionImage(name) {
    const d = state.ddragon[name];
    if (d) return d.image;
    return `https://ddragon.leagueoflegends.com/cdn/15.3.1/img/champion/${name.replace(/[\s'.]/g, '')}.png`;
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
    state.region = document.getElementById('sel-region').value;
    document.getElementById('sel-region').addEventListener('change', e => { state.region = e.target.value; });
    try { state.ddragon = await (await fetch('/api/ddragon')).json(); } catch (e) {}
    renderAll();
});

function renderAll() {
    renderChampionGrid(); renderEnemyPicks(); renderBans(); renderPlayerPool(); renderRecommendations();
}

// ---- Role ----
async function selectRole(role) {
    state.role = role;
    document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === role));
    if (state.statsLoaded) {
        await loadStatsForRole(role);
        renderAll(); updateRecommendations();
    }
}

async function loadStatsForRole(role) {
    if (state.currentStatsRole === role && state.championStats.length > 0) return;
    showLoading(`Chargement tier list ${role}...`);
    try {
        const r = await fetch(`/api/champion-stats?region=${state.region}&tier=emerald_plus&role=${role}`);
        state.championStats = await r.json();
        state.currentStatsRole = role;
        state.statsLoaded = true;
        document.getElementById('stats-status').textContent = `${state.championStats.length} champions (${role})`;
    } catch (e) { console.error(e); toast('Erreur chargement'); }
    hideLoading();
}

// ---- Priority ----
function setPriority(value) {
    state.priority = value;
    document.getElementById('priority-slider').value = value;
    document.getElementById('priority-value').textContent = value;
    document.querySelectorAll('.prio-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.prio) === value));
    if (state.statsLoaded) updateRecommendations();
}

function onSliderChange() {
    const v = parseInt(document.getElementById('priority-slider').value);
    state.priority = v;
    document.getElementById('priority-value').textContent = v;
    // Deselect preset buttons if slider is moved to a non-preset value
    document.querySelectorAll('.prio-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.prio) === v));
    if (state.statsLoaded) updateRecommendations();
}

// ---- Click mode ----
function setClickMode(mode) {
    state.clickMode = mode;
    document.getElementById('btn-mode-pick').classList.toggle('active', mode === 'enemy');
    document.getElementById('btn-mode-ban').classList.toggle('active', mode === 'ban');
}

// ---- Load All ----
async function loadAll() {
    const summoner = document.getElementById('input-summoner').value.trim();
    const btn = document.getElementById('btn-load-profile');
    btn.disabled = true;
    try {
        await loadStatsForRole(state.role);
        if (summoner) {
            showLoading(`Chargement profil ${summoner}...`);
            const profile = await (await fetch(`/api/player?summoner=${encodeURIComponent(summoner)}&region=${state.region}`)).json();
            if (!profile.error) {
                state.playerPool = (profile.most_played || []).map(c => ({
                    champion: c.champion, win_rate: c.win_rate, games: c.games,
                    wins: c.wins, losses: c.losses, kda: c.kda,
                }));
                toast(`${profile.tier || '?'} ${profile.lp || ''}LP - ${state.playerPool.length} champs`);
            } else { toast(profile.error); }
            hideLoading();
        }
        renderAll(); updateRecommendations();
    } catch (e) { hideLoading(); toast('Erreur'); console.error(e); }
    finally { btn.disabled = false; }
}

// ---- Champion Click ----
function onChampionClick(name) {
    if (!state.statsLoaded) { toast('Clique "Charger" d\'abord'); return; }
    if (state.clickMode === 'ban') {
        if (!state.bannedChamps.includes(name)) { state.bannedChamps.push(name); renderBans(); }
    } else {
        if (!state.enemyPicks.includes(name) && state.enemyPicks.length < 5) { state.enemyPicks.push(name); renderEnemyPicks(); }
    }
    renderChampionGrid(); updateRecommendations();
}

// ---- Enemy / Bans ----
function renderEnemyPicks() {
    const c = document.getElementById('enemy-picks-list'); c.innerHTML = '';
    if (!state.enemyPicks.length) { c.innerHTML = '<span class="hint">Aucun</span>'; return; }
    state.enemyPicks.forEach((name, i) => {
        const chip = document.createElement('div'); chip.className = 'pick-chip';
        chip.innerHTML = `<img src="${getChampionImage(name)}"><span class="chip-name">${name}</span><span class="chip-remove">x</span>`;
        chip.onclick = () => { state.enemyPicks.splice(i, 1); renderEnemyPicks(); renderChampionGrid(); updateRecommendations(); };
        c.appendChild(chip);
    });
}
function clearEnemyPicks() { state.enemyPicks = []; renderEnemyPicks(); renderChampionGrid(); updateRecommendations(); }

function renderBans() {
    const c = document.getElementById('bans-list'); c.innerHTML = '';
    if (!state.bannedChamps.length) { c.innerHTML = '<span class="hint">Aucun</span>'; return; }
    state.bannedChamps.forEach((name, i) => {
        const chip = document.createElement('div'); chip.className = 'pick-chip banned';
        chip.innerHTML = `<img src="${getChampionImage(name)}"><span class="chip-name">${name}</span><span class="chip-remove">x</span>`;
        chip.onclick = () => { state.bannedChamps.splice(i, 1); renderBans(); renderChampionGrid(); updateRecommendations(); };
        c.appendChild(chip);
    });
}
function clearBans() { state.bannedChamps = []; renderBans(); renderChampionGrid(); updateRecommendations(); }

// ---- Champion Grid (filtre par role = champions dans la tier list) ----
function renderChampionGrid() {
    const grid = document.getElementById('champion-grid'); grid.innerHTML = '';
    const enemySet = new Set(state.enemyPicks.map(n => n.toLowerCase()));
    const banSet = new Set(state.bannedChamps.map(n => n.toLowerCase()));
    const recSet = new Set(state.recommendations.map(r => r.champion.toLowerCase()));
    const roleChamps = new Set(state.championStats.map(s => s.name.toLowerCase()));
    const statsByName = {};
    state.championStats.forEach(s => { statsByName[s.name.toLowerCase()] = s; });

    let champs = [];
    if (Object.keys(state.ddragon).length) {
        for (const [name, info] of Object.entries(state.ddragon))
            champs.push({ name, image: info.image, stats: statsByName[name.toLowerCase()] || null });
    } else {
        state.championStats.forEach(s => champs.push({ name: s.name, image: getChampionImage(s.name), stats: s }));
    }
    champs.sort((a, b) => a.name.localeCompare(b.name));
    const search = (document.getElementById('champ-search').value || '').toLowerCase();

    for (const ch of champs) {
        const lc = ch.name.toLowerCase();
        // Filtre role : si stats chargees, ne montrer que les champs du role (sauf en recherche)
        if (state.statsLoaded && !search && !roleChamps.has(lc)) continue;
        if (search && !lc.includes(search)) continue;
        const cell = document.createElement('div'); cell.className = 'champ-cell';
        if (banSet.has(lc)) cell.classList.add('banned');
        if (enemySet.has(lc)) cell.classList.add('picked-enemy');
        const champInPool = isInPool(ch.name);
        const champIsMeta = ch.stats && ch.stats.rank && ch.stats.rank <= 15;
        if (champInPool && champIsMeta) cell.classList.add('hot-pick');
        else if (champInPool) cell.classList.add('in-pool');
        if (recSet.has(lc)) cell.classList.add('recommended');
        const wr = ch.stats?.win_rate;
        const wrClass = wr != null ? (wr >= 52 ? 'high' : wr <= 48 ? 'low' : 'mid') : 'mid';
        cell.innerHTML = `<img src="${ch.image}" alt="${ch.name}" loading="lazy"
            onerror="this.src='https://ddragon.leagueoflegends.com/cdn/15.3.1/img/champion/Aatrox.png'">
            <span class="champ-name">${ch.name}</span>
            ${wr != null ? `<span class="champ-wr ${wrClass}">${wr}%</span>` : ''}`;
        cell.onclick = () => onChampionClick(ch.name);
        grid.appendChild(cell);
    }
}
function filterChampions() { renderChampionGrid(); }

// ---- Player Pool (top 5 avec 10+ games) ----
const MIN_GAMES = 10;

function getTop5Pool() {
    return [...state.playerPool]
        .filter(p => (p.games || 0) >= MIN_GAMES)
        .sort((a, b) => {
            const gA = a.games || 0, gB = b.games || 0;
            if (gA !== gB) return gB - gA;
            return (b.win_rate || 0) - (a.win_rate || 0);
        }).slice(0, 5);
}

function isInPool(name) {
    const p = state.playerPool.find(p => p.champion.toLowerCase() === name.toLowerCase());
    return p && (p.games || 0) >= MIN_GAMES;
}

function renderPlayerPool() {
    const bar = document.getElementById('player-pool-bar');
    const icons = document.getElementById('player-pool-icons');
    if (!state.playerPool.length) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden'); icons.innerHTML = '';
    getTop5Pool().forEach(p => {
        const img = document.createElement('img'); img.className = 'pool-champ';
        img.src = getChampionImage(p.champion);
        img.title = `${p.champion} - ${p.win_rate ?? '?'}% WR, ${p.games ?? '?'} games`;
        icons.appendChild(img);
    });
}

function openPoolEditor() { document.getElementById('modal-overlay').classList.remove('hidden'); renderPoolEditorGrid(); }
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); renderPlayerPool(); updateRecommendations(); }
function renderPoolEditorGrid() {
    const grid = document.getElementById('pool-editor-grid'); grid.innerHTML = '';
    const poolSet = new Set(state.playerPool.map(p => p.champion.toLowerCase()));
    const search = (document.getElementById('pool-search')?.value || '').toLowerCase();
    let names = Object.keys(state.ddragon);
    if (!names.length) names = state.championStats.map(s => s.name);
    names.sort();
    for (const name of names) {
        if (search && !name.toLowerCase().includes(search)) continue;
        const cell = document.createElement('div'); cell.className = 'champ-cell';
        if (poolSet.has(name.toLowerCase())) cell.classList.add('in-pool');
        cell.innerHTML = `<img src="${getChampionImage(name)}" loading="lazy"><span class="champ-name">${name}</span>`;
        cell.onclick = () => {
            const idx = state.playerPool.findIndex(p => p.champion.toLowerCase() === name.toLowerCase());
            if (idx >= 0) { state.playerPool.splice(idx, 1); cell.classList.remove('in-pool'); }
            else { state.playerPool.push({ champion: name }); cell.classList.add('in-pool'); }
        };
        grid.appendChild(cell);
    }
}
function filterPoolGrid() { renderPoolEditorGrid(); }

// ---- Recommendations ----
async function updateRecommendations() {
    if (!state.statsLoaded) return;
    try {
        state.recommendations = await (await fetch('/api/recommend', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_pool: state.playerPool, enemy_picks: state.enemyPicks,
                banned: state.bannedChamps, already_picked: state.enemyPicks,
                role: state.role, region: state.region, priority: state.priority, top_n: 10,
            }),
        })).json();
    } catch (e) { state.recommendations = []; }
    renderRecommendations(); renderChampionGrid();
}

function renderRecommendations() {
    const list = document.getElementById('rec-list');
    const ctx = document.getElementById('rec-context');
    list.innerHTML = '';
    if (!state.statsLoaded) { ctx.className = 'rec-context'; ctx.textContent = 'Clique "Charger" pour commencer.'; return; }

    const hasEnemy = state.enemyPicks.length > 0;
    const p = state.priority;
    let mode = hasEnemy ? `<b>Counter-Pick</b> vs ${state.enemyPicks.join(', ')}` :
        p <= 15 ? '<b>Mon Pool</b>' : p >= 85 ? '<b>Meta</b>' : '<b>Mix</b>';
    ctx.className = hasEnemy ? 'rec-context has-enemy' : 'rec-context';
    ctx.innerHTML = `${mode} <small>(${state.role})</small>`;

    if (!state.recommendations.length) { list.innerHTML = '<p class="hint">Aucune suggestion.</p>'; return; }

    state.recommendations.forEach((rec, i) => {
        const item = document.createElement('div'); item.className = 'rec-item';
        const ms = rec.meta_score || 0, ps = rec.player_score || 0, cs = rec.counter_score || 0, total = ms + ps + cs || 1;
        const inPool = rec.is_in_pool;
        const isMeta = ms > 60;

        let tags = '';
        if (inPool && isMeta) {
            // Champion meta ET dans le pool -> tag rouge special
            tags += '<span class="rec-tag hot">Meta + Pool</span>';
        } else {
            if (inPool) tags += '<span class="rec-tag pool">Pool</span>';
            if (isMeta) tags += '<span class="rec-tag meta">Meta</span>';
        }
        if (hasEnemy && cs > 55) tags += '<span class="rec-tag counter">Counter</span>';

        // Counters from tier list data
        const champStat = state.championStats.find(s => s.name.toLowerCase() === rec.champion.toLowerCase());
        const countersInfo = champStat?.counters?.length ? `<br><small style="color:var(--text-dim)">Weak vs: ${champStat.counters.join(', ')}</small>` : '';

        item.innerHTML = `
            <span class="rec-rank">${i + 1}</span>
            <img src="${getChampionImage(rec.champion)}">
            <div class="rec-info">
                <div class="rec-name">${rec.champion} ${tags}</div>
                <div class="rec-details">WR ${rec.stats?.win_rate ?? '?'}% | Pick ${rec.stats?.pick_rate ?? '?'}%${countersInfo}</div>
                <div class="score-bar">
                    <div class="bar-meta" style="width:${(ms/total*100).toFixed(0)}%"></div>
                    <div class="bar-player" style="width:${(ps/total*100).toFixed(0)}%"></div>
                    <div class="bar-counter" style="width:${(cs/total*100).toFixed(0)}%"></div>
                </div>
            </div>
            <span class="rec-score">${rec.total_score}</span>`;
        item.onclick = () => openDetail(rec);
        list.appendChild(item);
    });
}

// ---- Detail Panel ----
let chartDetailRadar = null;

function openDetail(rec) {
    document.getElementById('detail-overlay').classList.remove('hidden');
    document.getElementById('detail-img').src = getChampionImage(rec.champion);
    document.getElementById('detail-name').textContent = rec.champion;
    document.getElementById('detail-score-big').textContent = `Score : ${rec.total_score}`;

    const tagsEl = document.getElementById('detail-tags'); tagsEl.innerHTML = '';
    if (rec.is_in_pool && rec.meta_score > 60) tagsEl.innerHTML += '<span class="rec-tag hot">Meta + Pool</span>';
    else {
        if (rec.is_in_pool) tagsEl.innerHTML += '<span class="rec-tag pool">Dans ton pool</span>';
        if (rec.meta_score > 60) tagsEl.innerHTML += '<span class="rec-tag meta">Meta fort</span>';
    }
    if (rec.counter_score > 55) tagsEl.innerHTML += '<span class="rec-tag counter">Bon counter</span>';

    const sg = document.getElementById('detail-stats-grid');
    const s = rec.stats || {};
    const champStat = state.championStats.find(st => st.name.toLowerCase() === rec.champion.toLowerCase());
    sg.innerHTML = `
        <div class="stat-card"><div class="stat-value" style="color:${(s.win_rate||50)>=52?'var(--green)':(s.win_rate||50)<=48?'var(--red)':'var(--gold)'}">${s.win_rate ?? '?'}%</div><div class="stat-label">Win Rate</div></div>
        <div class="stat-card"><div class="stat-value">${s.pick_rate ?? '?'}%</div><div class="stat-label">Pick Rate</div></div>
        <div class="stat-card"><div class="stat-value">${s.ban_rate ?? '?'}%</div><div class="stat-label">Ban Rate</div></div>
        <div class="stat-card"><div class="stat-value">${champStat?.rank ?? '?'}</div><div class="stat-label">Rang Tier List</div></div>`;
    if (champStat?.counters?.length) {
        sg.innerHTML += `<div class="stat-card" style="grid-column:span 2"><div class="stat-value" style="font-size:0.9rem;color:var(--red)">${champStat.counters.join(', ')}</div><div class="stat-label">Faible contre</div></div>`;
    }
    const playerData = state.playerPool.find(p => p.champion.toLowerCase() === rec.champion.toLowerCase());
    if (playerData) {
        sg.innerHTML += `
            <div class="stat-card" style="border:1px solid var(--gold)"><div class="stat-value" style="color:var(--gold)">${playerData.win_rate ?? '?'}%</div><div class="stat-label">Ton WR</div></div>
            <div class="stat-card" style="border:1px solid var(--gold)"><div class="stat-value" style="color:var(--gold)">${playerData.games ?? '?'}</div><div class="stat-label">Tes Games</div></div>`;
    }

    const ww = document.getElementById('detail-weights');
    const w = rec.weights || {};
    ww.innerHTML = `
        <div class="weight-bar"><div class="wb-label">Meta</div><div class="wb-track"><div class="wb-fill meta" style="width:${rec.meta_score}%"></div></div><div class="wb-score">${rec.meta_score} <small style="color:var(--text-dim)">x${(w.meta*100).toFixed(0)}%</small></div></div>
        <div class="weight-bar"><div class="wb-label">Joueur</div><div class="wb-track"><div class="wb-fill player" style="width:${rec.player_score}%"></div></div><div class="wb-score">${rec.player_score} <small style="color:var(--text-dim)">x${(w.player*100).toFixed(0)}%</small></div></div>
        <div class="weight-bar"><div class="wb-label">Counter</div><div class="wb-track"><div class="wb-fill counter" style="width:${rec.counter_score}%"></div></div><div class="wb-score">${rec.counter_score} <small style="color:var(--text-dim)">x${(w.counter*100).toFixed(0)}%</small></div></div>`;

    const ctx = document.getElementById('chart-detail-radar').getContext('2d');
    if (chartDetailRadar) chartDetailRadar.destroy();
    const maxPR = Math.max(...state.championStats.map(s => s.pick_rate ?? 0), 1);
    const maxBR = Math.max(...state.championStats.map(s => s.ban_rate ?? 0), 1);
    chartDetailRadar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Win Rate', 'Pick Rate', 'Ban Rate', 'Meta', 'Joueur', 'Counter'],
            datasets: [{ label: rec.champion,
                data: [ Math.min(100, ((s.win_rate||50)-45)*10), Math.min(100,(s.pick_rate||0)/maxPR*100),
                    Math.min(100,(s.ban_rate||0)/maxBR*100), rec.meta_score||0, rec.player_score||0, rec.counter_score||0 ],
                backgroundColor: 'rgba(10,200,185,0.2)', borderColor: '#0ac8b9', borderWidth: 2, pointBackgroundColor: '#0ac8b9',
            }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#d4d8de' } } },
            scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: '#1e3048' }, pointLabels: { color: '#7b8fa3', font: { size: 10 } } } } },
    });
}

function closeDetail() { document.getElementById('detail-overlay').classList.add('hidden'); }
