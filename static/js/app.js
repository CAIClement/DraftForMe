/* ================================================================
   DraftForMe - app.js (v3 - Slider + Detail Panel)
   ================================================================ */

const state = {
    region: 'euw',
    role: 'middle',
    priority: 50,           // 0=pool, 100=meta
    clickMode: 'enemy',
    ddragon: {},
    championStats: [],
    playerPool: [],
    enemyPicks: [],
    bannedChamps: [],
    recommendations: [],
    statsLoaded: false,
};

// ---- Utility ----
function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), 3000);
}
function showLoading(msg) {
    document.getElementById('loading-text').textContent = msg;
    document.getElementById('loading-overlay').classList.remove('hidden');
}
function hideLoading() { document.getElementById('loading-overlay').classList.add('hidden'); }

function getChampionImage(name) {
    const d = state.ddragon[name];
    if (d) return d.image;
    const key = name.replace(/[\s'.]/g, '');
    return `https://ddragon.leagueoflegends.com/cdn/15.3.1/img/champion/${key}.png`;
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
    state.region = document.getElementById('sel-region').value;
    document.getElementById('sel-region').addEventListener('change', e => { state.region = e.target.value; });
    try {
        const resp = await fetch('/api/ddragon');
        state.ddragon = await resp.json();
    } catch (e) { console.error('DDragon failed', e); }
    renderChampionGrid();
    renderEnemyPicks();
    renderBans();
    renderRecommendations();
});

// ---- Role ----
function selectRole(role) {
    state.role = role;
    document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === role));
    if (state.statsLoaded) updateRecommendations();
}

// ---- Priority slider ----
function onPriorityChange() {
    const slider = document.getElementById('priority-slider');
    state.priority = parseInt(slider.value);
    document.getElementById('priority-value').textContent = state.priority;
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
        if (!state.statsLoaded) {
            showLoading('Chargement des stats champions...');
            const r = await fetch(`/api/champion-stats?region=${state.region}&tier=emerald_plus&role=all`);
            state.championStats = await r.json();
            state.statsLoaded = true;
            document.getElementById('stats-status').textContent = `${state.championStats.length} champions`;
        }
        if (summoner) {
            showLoading(`Chargement du profil ${summoner}...`);
            const r2 = await fetch(`/api/player?summoner=${encodeURIComponent(summoner)}&region=${state.region}`);
            const profile = await r2.json();
            if (!profile.error) {
                state.playerPool = (profile.most_played || []).map(c => ({
                    champion: c.champion, win_rate: c.win_rate, games: c.games,
                    wins: c.wins, losses: c.losses, kda: c.kda,
                }));
                renderPlayerPool();
                toast(`${profile.tier || '?'} ${profile.lp || ''}LP - ${state.playerPool.length} champions`);
            } else { toast(profile.error); }
        }
        hideLoading();
        renderChampionGrid();
        updateRecommendations();
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
    renderChampionGrid();
    updateRecommendations();
}

// ---- Enemy Picks ----
function renderEnemyPicks() {
    const c = document.getElementById('enemy-picks-list');
    c.innerHTML = '';
    if (!state.enemyPicks.length) { c.innerHTML = '<span class="hint">Aucun</span>'; return; }
    state.enemyPicks.forEach((name, i) => {
        const chip = document.createElement('div');
        chip.className = 'pick-chip';
        chip.innerHTML = `<img src="${getChampionImage(name)}"><span class="chip-name">${name}</span><span class="chip-remove">x</span>`;
        chip.onclick = () => { state.enemyPicks.splice(i, 1); renderEnemyPicks(); renderChampionGrid(); updateRecommendations(); };
        c.appendChild(chip);
    });
}
function clearEnemyPicks() { state.enemyPicks = []; renderEnemyPicks(); renderChampionGrid(); updateRecommendations(); }

// ---- Bans ----
function renderBans() {
    const c = document.getElementById('bans-list');
    c.innerHTML = '';
    if (!state.bannedChamps.length) { c.innerHTML = '<span class="hint">Aucun</span>'; return; }
    state.bannedChamps.forEach((name, i) => {
        const chip = document.createElement('div');
        chip.className = 'pick-chip banned';
        chip.innerHTML = `<img src="${getChampionImage(name)}"><span class="chip-name">${name}</span><span class="chip-remove">x</span>`;
        chip.onclick = () => { state.bannedChamps.splice(i, 1); renderBans(); renderChampionGrid(); updateRecommendations(); };
        c.appendChild(chip);
    });
}
function clearBans() { state.bannedChamps = []; renderBans(); renderChampionGrid(); updateRecommendations(); }

// ---- Champion Grid ----
function renderChampionGrid() {
    const grid = document.getElementById('champion-grid');
    grid.innerHTML = '';
    const enemySet = new Set(state.enemyPicks.map(n => n.toLowerCase()));
    const banSet = new Set(state.bannedChamps.map(n => n.toLowerCase()));
    const poolSet = new Set(state.playerPool.map(p => p.champion.toLowerCase()));
    const recSet = new Set(state.recommendations.map(r => r.champion.toLowerCase()));
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
        if (search && !lc.includes(search)) continue;
        const cell = document.createElement('div');
        cell.className = 'champ-cell';
        if (banSet.has(lc)) cell.classList.add('banned');
        if (enemySet.has(lc)) cell.classList.add('picked-enemy');
        if (poolSet.has(lc)) cell.classList.add('in-pool');
        if (recSet.has(lc)) cell.classList.add('recommended');
        const wr = ch.stats?.win_rate;
        const wrClass = wr != null ? (wr >= 52 ? 'high' : wr <= 48 ? 'low' : 'mid') : 'mid';
        cell.innerHTML = `
            <img src="${ch.image}" alt="${ch.name}" loading="lazy"
                 onerror="this.src='https://ddragon.leagueoflegends.com/cdn/15.3.1/img/champion/Aatrox.png'">
            <span class="champ-name">${ch.name}</span>
            ${wr != null ? `<span class="champ-wr ${wrClass}">${wr}%</span>` : ''}`;
        cell.onclick = () => onChampionClick(ch.name);
        grid.appendChild(cell);
    }
}
function filterChampions() { renderChampionGrid(); }

// ---- Player Pool ----
function renderPlayerPool() {
    const bar = document.getElementById('player-pool-bar');
    const icons = document.getElementById('player-pool-icons');
    if (!state.playerPool.length) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    icons.innerHTML = '';
    state.playerPool.forEach(p => {
        const img = document.createElement('img');
        img.className = 'pool-champ'; img.src = getChampionImage(p.champion);
        img.title = `${p.champion} - ${p.win_rate ?? '?'}% WR, ${p.games ?? '?'} games`;
        icons.appendChild(img);
    });
}
function openPoolEditor() { document.getElementById('modal-overlay').classList.remove('hidden'); renderPoolEditorGrid(); }
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); renderPlayerPool(); updateRecommendations(); }
function renderPoolEditorGrid() {
    const grid = document.getElementById('pool-editor-grid');
    grid.innerHTML = '';
    const poolSet = new Set(state.playerPool.map(p => p.champion.toLowerCase()));
    const search = (document.getElementById('pool-search')?.value || '').toLowerCase();
    let names = Object.keys(state.ddragon);
    if (!names.length) names = state.championStats.map(s => s.name);
    names.sort();
    for (const name of names) {
        if (search && !name.toLowerCase().includes(search)) continue;
        const cell = document.createElement('div');
        cell.className = 'champ-cell';
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
        const resp = await fetch('/api/recommend', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_pool: state.playerPool, enemy_picks: state.enemyPicks,
                banned: state.bannedChamps, already_picked: state.enemyPicks,
                role: state.role, region: state.region, priority: state.priority, top_n: 10,
            }),
        });
        state.recommendations = await resp.json();
    } catch (e) { state.recommendations = []; console.error(e); }
    renderRecommendations();
    renderCharts();
    renderChampionGrid();
}

function renderRecommendations() {
    const list = document.getElementById('rec-list');
    const ctx = document.getElementById('rec-context');
    list.innerHTML = '';

    if (!state.statsLoaded) { ctx.className = 'rec-context'; ctx.textContent = 'Clique "Charger" pour commencer.'; return; }

    const hasEnemy = state.enemyPicks.length > 0;
    const hasPool = state.playerPool.length > 0;
    const prio = state.priority;

    let modeText = '';
    if (hasEnemy) modeText = `<b>Counter-Pick</b> vs ${state.enemyPicks.join(', ')}`;
    else if (prio < 30) modeText = '<b>Focus Pool</b> : tes meilleurs champions';
    else if (prio > 70) modeText = '<b>Focus Meta</b> : champions les plus forts';
    else modeText = hasPool ? '<b>Equilibre</b> : meta + ton pool' : '<b>Meta</b>';
    ctx.className = hasEnemy ? 'rec-context has-enemy' : 'rec-context';
    ctx.innerHTML = modeText;

    if (!state.recommendations.length) { list.innerHTML = '<p class="hint">Aucune suggestion.</p>'; return; }

    const poolSet = new Set(state.playerPool.map(p => p.champion.toLowerCase()));

    state.recommendations.forEach((rec, i) => {
        const item = document.createElement('div');
        item.className = 'rec-item';
        const ms = rec.meta_score || 0, ps = rec.player_score || 0, cs = rec.counter_score || 0;
        const total = ms + ps + cs || 1;

        let tags = '';
        if (poolSet.has(rec.champion.toLowerCase())) tags += '<span class="rec-tag pool">Pool</span>';
        if (hasEnemy && cs > 55) tags += '<span class="rec-tag counter">Counter</span>';
        if (ms > 65) tags += '<span class="rec-tag meta">Meta</span>';

        item.innerHTML = `
            <span class="rec-rank">${i + 1}</span>
            <img src="${getChampionImage(rec.champion)}" alt="${rec.champion}">
            <div class="rec-info">
                <div class="rec-name">${rec.champion} ${tags}</div>
                <div class="rec-details">WR ${rec.stats?.win_rate ?? '?'}% | Pick ${rec.stats?.pick_rate ?? '?'}% | KDA ${rec.stats?.kda ?? '?'}</div>
                <div class="score-bar">
                    <div class="bar-meta" style="width:${(ms/total*100).toFixed(0)}%"></div>
                    <div class="bar-player" style="width:${(ps/total*100).toFixed(0)}%"></div>
                    <div class="bar-counter" style="width:${(cs/total*100).toFixed(0)}%"></div>
                </div>
            </div>
            <span class="rec-score">${rec.total_score}</span>`;
        // Click -> open detail
        item.onclick = () => openDetail(rec, i);
        list.appendChild(item);
    });
}

// ================================================================
// DETAIL PANEL (popup au clic sur une suggestion)
// ================================================================
let chartDetailCompare = null;
let chartDetailRadar = null;

function openDetail(rec, idx) {
    const overlay = document.getElementById('detail-overlay');
    overlay.classList.remove('hidden');

    // Header
    document.getElementById('detail-img').src = getChampionImage(rec.champion);
    document.getElementById('detail-name').textContent = rec.champion;
    document.getElementById('detail-score-big').textContent = `Score : ${rec.total_score}`;

    // Tags
    const tagsEl = document.getElementById('detail-tags');
    tagsEl.innerHTML = '';
    const poolSet = new Set(state.playerPool.map(p => p.champion.toLowerCase()));
    if (poolSet.has(rec.champion.toLowerCase())) tagsEl.innerHTML += '<span class="rec-tag pool">Dans ton pool</span>';
    if (rec.counter_score > 55) tagsEl.innerHTML += '<span class="rec-tag counter">Bon counter</span>';
    if (rec.meta_score > 65) tagsEl.innerHTML += '<span class="rec-tag meta">Meta fort</span>';

    // Stats grid
    const sg = document.getElementById('detail-stats-grid');
    const s = rec.stats || {};
    sg.innerHTML = `
        <div class="stat-card"><div class="stat-value" style="color:${(s.win_rate||50)>=52?'var(--green)':(s.win_rate||50)<=48?'var(--red)':'var(--gold)'}">${s.win_rate ?? '?'}%</div><div class="stat-label">Win Rate</div></div>
        <div class="stat-card"><div class="stat-value">${s.pick_rate ?? '?'}%</div><div class="stat-label">Pick Rate</div></div>
        <div class="stat-card"><div class="stat-value">${s.ban_rate ?? '?'}%</div><div class="stat-label">Ban Rate</div></div>
        <div class="stat-card"><div class="stat-value">${s.kda ?? '?'}</div><div class="stat-label">KDA</div></div>
        <div class="stat-card"><div class="stat-value">${s.cs ?? '?'}</div><div class="stat-label">CS / game</div></div>
        <div class="stat-card"><div class="stat-value">${s.gold ?? '?'}</div><div class="stat-label">Gold / game</div></div>
        <div class="stat-card"><div class="stat-value">${s.games_played ?? '?'}</div><div class="stat-label">Games (meta)</div></div>
    `;

    // Player specific stats
    const playerData = state.playerPool.find(p => p.champion.toLowerCase() === rec.champion.toLowerCase());
    if (playerData) {
        sg.innerHTML += `
            <div class="stat-card" style="border:1px solid var(--gold)"><div class="stat-value" style="color:var(--gold)">${playerData.win_rate ?? '?'}%</div><div class="stat-label">Ton WR</div></div>
            <div class="stat-card" style="border:1px solid var(--gold)"><div class="stat-value" style="color:var(--gold)">${playerData.games ?? '?'}</div><div class="stat-label">Tes Games</div></div>
            <div class="stat-card" style="border:1px solid var(--gold)"><div class="stat-value" style="color:var(--gold)">${playerData.kda ?? '?'}</div><div class="stat-label">Ton KDA</div></div>
        `;
    }

    // Weights bars
    const ww = document.getElementById('detail-weights');
    const w = rec.weights || {};
    ww.innerHTML = `
        <div class="weight-bar">
            <div class="wb-label">Meta</div>
            <div class="wb-track"><div class="wb-fill meta" style="width:${rec.meta_score}%"></div></div>
            <div class="wb-score">${rec.meta_score} <small style="color:var(--text-dim)">x${(w.meta*100).toFixed(0)}%</small></div>
        </div>
        <div class="weight-bar">
            <div class="wb-label">Joueur</div>
            <div class="wb-track"><div class="wb-fill player" style="width:${rec.player_score}%"></div></div>
            <div class="wb-score">${rec.player_score} <small style="color:var(--text-dim)">x${(w.player*100).toFixed(0)}%</small></div>
        </div>
        <div class="weight-bar">
            <div class="wb-label">Counter</div>
            <div class="wb-track"><div class="wb-fill counter" style="width:${rec.counter_score}%"></div></div>
            <div class="wb-score">${rec.counter_score} <small style="color:var(--text-dim)">x${(w.counter*100).toFixed(0)}%</small></div>
        </div>
    `;

    // Charts
    renderDetailCharts(rec, idx);
}

function closeDetail() {
    document.getElementById('detail-overlay').classList.add('hidden');
}

function renderDetailCharts(rec, idx) {
    const top5 = state.recommendations.slice(0, 5);
    const labels = top5.map(r => r.champion);
    const currentIdx = top5.findIndex(r => r.champion === rec.champion);

    // Comparison bar chart
    const ctx1 = document.getElementById('chart-detail-compare').getContext('2d');
    if (chartDetailCompare) chartDetailCompare.destroy();
    chartDetailCompare = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Meta', data: top5.map(r => r.meta_score), backgroundColor: 'rgba(10,200,185,0.6)' },
                { label: 'Joueur', data: top5.map(r => r.player_score), backgroundColor: 'rgba(200,170,110,0.6)' },
                { label: 'Counter', data: top5.map(r => r.counter_score), backgroundColor: 'rgba(155,89,182,0.6)' },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#d4d8de', font: { size: 10 } } } },
            scales: {
                y: { stacked: true, ticks: { color: '#7b8fa3' }, grid: { color: '#1e3048' } },
                x: { stacked: true, ticks: { color: '#7b8fa3', font: { size: 10 } }, grid: { display: false } },
            },
        },
    });

    // Radar chart (champion profile)
    const ctx2 = document.getElementById('chart-detail-radar').getContext('2d');
    if (chartDetailRadar) chartDetailRadar.destroy();

    // Normalize stats for radar (0-100)
    const allWR = state.championStats.map(s => s.win_rate ?? 50);
    const allPR = state.championStats.map(s => s.pick_rate ?? 0);
    const allBR = state.championStats.map(s => s.ban_rate ?? 0);
    const maxPR = Math.max(...allPR, 1);
    const maxBR = Math.max(...allBR, 1);

    function radarData(r) {
        const s = r.stats || {};
        return [
            Math.min(100, ((s.win_rate || 50) - 45) * 10),     // WR normalized 45-55 -> 0-100
            Math.min(100, (s.pick_rate || 0) / maxPR * 100),    // PR
            Math.min(100, (s.ban_rate || 0) / maxBR * 100),     // BR (perception)
            r.meta_score || 0,
            r.player_score || 0,
            r.counter_score || 0,
        ];
    }

    chartDetailRadar = new Chart(ctx2, {
        type: 'radar',
        data: {
            labels: ['Win Rate', 'Pick Rate', 'Ban Rate', 'Score Meta', 'Score Joueur', 'Score Counter'],
            datasets: [{
                label: rec.champion,
                data: radarData(rec),
                backgroundColor: 'rgba(10,200,185,0.2)',
                borderColor: '#0ac8b9',
                borderWidth: 2,
                pointBackgroundColor: '#0ac8b9',
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#d4d8de' } } },
            scales: {
                r: {
                    min: 0, max: 100,
                    ticks: { display: false },
                    grid: { color: '#1e3048' },
                    pointLabels: { color: '#7b8fa3', font: { size: 10 } },
                },
            },
        },
    });
}

// ---- Main Charts (sidebar) ----
let chartWR = null, chartScores = null;

function renderCharts() {
    const recs = state.recommendations.slice(0, 8);
    if (!recs.length) return;
    const labels = recs.map(r => r.champion);

    const ctx1 = document.getElementById('chart-winrate').getContext('2d');
    if (chartWR) chartWR.destroy();
    chartWR = new Chart(ctx1, {
        type: 'bar',
        data: { labels, datasets: [{
            label: 'Win Rate %',
            data: recs.map(r => r.stats?.win_rate ?? 0),
            backgroundColor: recs.map(r => {
                const wr = r.stats?.win_rate ?? 50;
                return wr >= 52 ? 'rgba(73,181,78,0.7)' : wr <= 48 ? 'rgba(232,64,87,0.7)' : 'rgba(200,170,110,0.7)';
            }),
            borderWidth: 1,
        }]},
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: 'Win Rate', color: '#d4d8de', font: { size: 11 } } },
            scales: {
                y: { min: 44, max: 58, ticks: { color: '#7b8fa3', callback: v => v+'%' }, grid: { color: '#1e3048' } },
                x: { ticks: { color: '#7b8fa3', font: { size: 8 }, maxRotation: 45 }, grid: { display: false } },
            },
        },
    });

    const ctx2 = document.getElementById('chart-scores').getContext('2d');
    if (chartScores) chartScores.destroy();
    chartScores = new Chart(ctx2, {
        type: 'bar',
        data: { labels, datasets: [
            { label: 'Meta', data: recs.map(r => r.meta_score ?? 0), backgroundColor: 'rgba(10,200,185,0.6)' },
            { label: 'Joueur', data: recs.map(r => r.player_score ?? 0), backgroundColor: 'rgba(200,170,110,0.6)' },
            { label: 'Counter', data: recs.map(r => r.counter_score ?? 0), backgroundColor: 'rgba(155,89,182,0.6)' },
        ]},
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#d4d8de', font: { size: 9 } } }, title: { display: true, text: 'Scores', color: '#d4d8de', font: { size: 11 } } },
            scales: {
                y: { stacked: true, ticks: { color: '#7b8fa3' }, grid: { color: '#1e3048' } },
                x: { stacked: true, ticks: { color: '#7b8fa3', font: { size: 8 }, maxRotation: 45 }, grid: { display: false } },
            },
        },
    });
}
