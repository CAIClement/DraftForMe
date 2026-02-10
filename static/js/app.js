/* ================================================================
   DraftForMe - Main JavaScript (v2 - Simplified)
   Click enemy champ → get counter suggestions
   ================================================================ */

// ---- State ----
const state = {
    region: 'euw',
    role: 'middle',
    clickMode: 'enemy',    // 'enemy' | 'ban'
    ddragon: {},
    championStats: [],
    playerPool: [],
    enemyPicks: [],         // noms des picks ennemis
    bannedChamps: [],       // noms des bans
    recommendations: [],
    statsLoaded: false,
    profileLoaded: false,
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
function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

function getChampionImage(name) {
    const d = state.ddragon[name];
    if (d) return d.image;
    const key = name.replace(/[\s'.]/g, '');
    return `https://ddragon.leagueoflegends.com/cdn/15.3.1/img/champion/${key}.png`;
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
    state.region = document.getElementById('sel-region').value;
    document.getElementById('sel-region').addEventListener('change', (e) => {
        state.region = e.target.value;
    });

    // Load DDragon (fast, cached)
    try {
        const resp = await fetch('/api/ddragon');
        state.ddragon = await resp.json();
    } catch (e) {
        console.error('DDragon load failed', e);
    }

    renderChampionGrid();
    renderEnemyPicks();
    renderBans();
    renderRecommendations();
});

// ---- Role ----
function selectRole(role) {
    state.role = role;
    document.querySelectorAll('.role-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.role === role);
    });
    // Re-trigger recommendations with new role
    if (state.statsLoaded) updateRecommendations();
}

// ---- Click mode (enemy pick or ban) ----
function setClickMode(mode) {
    state.clickMode = mode;
    document.getElementById('btn-mode-pick').classList.toggle('active', mode === 'enemy');
    document.getElementById('btn-mode-ban').classList.toggle('active', mode === 'ban');
}

// ---- Load ALL (profile + stats in one click) ----
async function loadAll() {
    const summoner = document.getElementById('input-summoner').value.trim();
    const btn = document.getElementById('btn-load-profile');
    btn.disabled = true;

    try {
        // 1) Load champion stats (if not already)
        if (!state.statsLoaded) {
            showLoading('Chargement des stats champions depuis op.gg...');
            const statsResp = await fetch(`/api/champion-stats?region=${state.region}&tier=emerald_plus&role=all`);
            state.championStats = await statsResp.json();
            state.statsLoaded = true;
            document.getElementById('stats-status').textContent = `${state.championStats.length} champions`;
        }

        // 2) Load player profile (if summoner given)
        if (summoner) {
            showLoading(`Chargement du profil ${summoner}...`);
            const profileResp = await fetch(`/api/player?summoner=${encodeURIComponent(summoner)}&region=${state.region}`);
            const profile = await profileResp.json();
            if (profile.error) {
                toast(profile.error);
            } else {
                state.playerPool = (profile.most_played || []).map(c => ({
                    champion: c.champion,
                    win_rate: c.win_rate,
                    games: c.games,
                    wins: c.wins,
                    losses: c.losses,
                    kda: c.kda,
                }));
                state.profileLoaded = true;
                renderPlayerPool();
                toast(`Profil charge : ${profile.tier || '?'} ${profile.lp || ''}LP - ${state.playerPool.length} champions`);
            }
        } else if (!state.statsLoaded) {
            toast('Stats chargees ! Entre ton pseudo pour personnaliser les suggestions.');
        }

        hideLoading();
        renderChampionGrid();
        updateRecommendations();

    } catch (e) {
        hideLoading();
        toast('Erreur de chargement');
        console.error(e);
    } finally {
        btn.disabled = false;
    }
}

// ---- Champion Click ----
function onChampionClick(name) {
    if (!state.statsLoaded) {
        toast('Clique d\'abord sur "Charger" pour charger les stats');
        return;
    }

    if (state.clickMode === 'ban') {
        if (!state.bannedChamps.includes(name)) {
            state.bannedChamps.push(name);
            renderBans();
            renderChampionGrid();
            updateRecommendations();
        }
    } else {
        // enemy pick mode
        if (!state.enemyPicks.includes(name) && state.enemyPicks.length < 5) {
            state.enemyPicks.push(name);
            renderEnemyPicks();
            renderChampionGrid();
            updateRecommendations();
        }
    }
}

// ---- Enemy Picks ----
function renderEnemyPicks() {
    const container = document.getElementById('enemy-picks-list');
    container.innerHTML = '';
    if (state.enemyPicks.length === 0) {
        container.innerHTML = '<span class="hint">Aucun pick ennemi</span>';
        return;
    }
    state.enemyPicks.forEach((name, i) => {
        const chip = document.createElement('div');
        chip.className = 'pick-chip';
        chip.innerHTML = `
            <img src="${getChampionImage(name)}" alt="${name}">
            <span class="chip-name">${name}</span>
            <span class="chip-remove">x</span>
        `;
        chip.addEventListener('click', () => {
            state.enemyPicks.splice(i, 1);
            renderEnemyPicks();
            renderChampionGrid();
            updateRecommendations();
        });
        container.appendChild(chip);
    });
}

function clearEnemyPicks() {
    state.enemyPicks = [];
    renderEnemyPicks();
    renderChampionGrid();
    updateRecommendations();
}

// ---- Bans ----
function renderBans() {
    const container = document.getElementById('bans-list');
    container.innerHTML = '';
    if (state.bannedChamps.length === 0) {
        container.innerHTML = '<span class="hint">Aucun ban</span>';
        return;
    }
    state.bannedChamps.forEach((name, i) => {
        const chip = document.createElement('div');
        chip.className = 'pick-chip banned';
        chip.innerHTML = `
            <img src="${getChampionImage(name)}" alt="${name}">
            <span class="chip-name">${name}</span>
            <span class="chip-remove">x</span>
        `;
        chip.addEventListener('click', () => {
            state.bannedChamps.splice(i, 1);
            renderBans();
            renderChampionGrid();
            updateRecommendations();
        });
        container.appendChild(chip);
    });
}

function clearBans() {
    state.bannedChamps = [];
    renderBans();
    renderChampionGrid();
    updateRecommendations();
}

// ---- Champion Grid ----
function renderChampionGrid() {
    const grid = document.getElementById('champion-grid');
    grid.innerHTML = '';

    const enemySet = new Set(state.enemyPicks.map(n => n.toLowerCase()));
    const banSet = new Set(state.bannedChamps.map(n => n.toLowerCase()));
    const poolNames = new Set(state.playerPool.map(p => p.champion.toLowerCase()));
    const recNames = new Set(state.recommendations.map(r => r.champion.toLowerCase()));

    let champions = [];
    const statsByName = {};
    state.championStats.forEach(s => { statsByName[s.name.toLowerCase()] = s; });

    if (Object.keys(state.ddragon).length > 0) {
        for (const [name, info] of Object.entries(state.ddragon)) {
            champions.push({ name, image: info.image, tags: info.tags, stats: statsByName[name.toLowerCase()] || null });
        }
    } else if (state.championStats.length > 0) {
        state.championStats.forEach(s => {
            champions.push({ name: s.name, image: getChampionImage(s.name), tags: [], stats: s });
        });
    }

    champions.sort((a, b) => a.name.localeCompare(b.name));
    const search = (document.getElementById('champ-search').value || '').toLowerCase();

    for (const champ of champions) {
        const nameLC = champ.name.toLowerCase();
        if (search && !nameLC.includes(search)) continue;

        const cell = document.createElement('div');
        cell.className = 'champ-cell';
        if (banSet.has(nameLC)) cell.classList.add('banned');
        if (enemySet.has(nameLC)) cell.classList.add('picked-enemy');
        if (poolNames.has(nameLC)) cell.classList.add('in-pool');
        if (recNames.has(nameLC)) cell.classList.add('recommended');

        const wr = champ.stats?.win_rate;
        let wrClass = 'mid';
        if (wr != null) wrClass = wr >= 52 ? 'high' : wr <= 48 ? 'low' : 'mid';

        cell.innerHTML = `
            <img src="${champ.image}" alt="${champ.name}" loading="lazy"
                 onerror="this.src='https://ddragon.leagueoflegends.com/cdn/15.3.1/img/champion/Aatrox.png'">
            <span class="champ-name">${champ.name}</span>
            ${wr != null ? `<span class="champ-wr ${wrClass}">${wr}%</span>` : ''}
        `;
        cell.addEventListener('click', () => onChampionClick(champ.name));
        grid.appendChild(cell);
    }
}

function filterChampions() { renderChampionGrid(); }

// ---- Player Pool ----
function renderPlayerPool() {
    const bar = document.getElementById('player-pool-bar');
    const icons = document.getElementById('player-pool-icons');
    if (state.playerPool.length === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    icons.innerHTML = '';
    state.playerPool.forEach(p => {
        const img = document.createElement('img');
        img.className = 'pool-champ';
        img.src = getChampionImage(p.champion);
        img.alt = p.champion;
        img.title = `${p.champion} - ${p.win_rate ?? '?'}% WR, ${p.games ?? '?'} games`;
        icons.appendChild(img);
    });
}

function openPoolEditor() {
    document.getElementById('modal-overlay').classList.remove('hidden');
    renderPoolEditorGrid();
}
function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    renderPlayerPool();
    updateRecommendations();
}

function renderPoolEditorGrid() {
    const grid = document.getElementById('pool-editor-grid');
    grid.innerHTML = '';
    const poolSet = new Set(state.playerPool.map(p => p.champion.toLowerCase()));
    const search = (document.getElementById('pool-search')?.value || '').toLowerCase();
    let names = Object.keys(state.ddragon);
    if (names.length === 0) names = state.championStats.map(s => s.name);
    names.sort();
    for (const name of names) {
        if (search && !name.toLowerCase().includes(search)) continue;
        const cell = document.createElement('div');
        cell.className = 'champ-cell';
        if (poolSet.has(name.toLowerCase())) cell.classList.add('in-pool');
        cell.innerHTML = `
            <img src="${getChampionImage(name)}" alt="${name}" loading="lazy">
            <span class="champ-name">${name}</span>
        `;
        cell.addEventListener('click', () => {
            const lc = name.toLowerCase();
            const idx = state.playerPool.findIndex(p => p.champion.toLowerCase() === lc);
            if (idx >= 0) { state.playerPool.splice(idx, 1); cell.classList.remove('in-pool'); }
            else { state.playerPool.push({ champion: name, win_rate: null, games: null }); cell.classList.add('in-pool'); }
        });
        grid.appendChild(cell);
    }
}
function filterPoolGrid() { renderPoolEditorGrid(); }

// ---- Recommendations ----
async function updateRecommendations() {
    if (!state.statsLoaded) return;

    try {
        const resp = await fetch('/api/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_pool: state.playerPool,
                enemy_picks: state.enemyPicks,
                banned: state.bannedChamps,
                already_picked: state.enemyPicks,
                role: state.role,
                region: state.region,
                top_n: 10,
            }),
        });
        state.recommendations = await resp.json();
    } catch (e) {
        console.error('Recommend error', e);
        state.recommendations = [];
    }

    renderRecommendations();
    renderCharts();
    renderChampionGrid();
}

function renderRecommendations() {
    const list = document.getElementById('rec-list');
    const ctx = document.getElementById('rec-context');
    list.innerHTML = '';

    // Context message
    if (!state.statsLoaded) {
        ctx.className = 'rec-context';
        ctx.textContent = 'Clique sur "Charger" pour commencer.';
        return;
    }

    const hasEnemy = state.enemyPicks.length > 0;
    const hasPool = state.playerPool.length > 0;

    if (hasEnemy) {
        ctx.className = 'rec-context has-enemy';
        ctx.innerHTML = `Mode <b>Counter-Pick</b> : suggestions basees sur les picks ennemis (${state.enemyPicks.join(', ')})` +
            (hasPool ? ' + ton pool.' : '.');
    } else if (hasPool) {
        ctx.className = 'rec-context';
        ctx.innerHTML = 'Mode <b>Blind Pick</b> : suggestions basees sur la meta + ton pool de champions.';
    } else {
        ctx.className = 'rec-context';
        ctx.innerHTML = 'Mode <b>Meta</b> : suggestions basees sur les meilleurs champions de la meta.';
    }

    if (state.recommendations.length === 0) {
        list.innerHTML = '<p class="hint">Aucune suggestion disponible.</p>';
        return;
    }

    const poolSet = new Set(state.playerPool.map(p => p.champion.toLowerCase()));

    state.recommendations.forEach((rec, i) => {
        const item = document.createElement('div');
        item.className = 'rec-item';

        const ms = rec.meta_score || 0;
        const ps = rec.player_score || 0;
        const cs = rec.counter_score || 0;
        const total = ms + ps + cs || 1;

        // Tags
        let tags = '';
        if (poolSet.has(rec.champion.toLowerCase())) tags += '<span class="rec-tag pool">Pool</span>';
        if (hasEnemy && cs > 55) tags += '<span class="rec-tag counter">Counter</span>';
        if (ms > 65) tags += '<span class="rec-tag meta">Meta</span>';

        item.innerHTML = `
            <span class="rec-rank">${i + 1}</span>
            <img src="${getChampionImage(rec.champion)}" alt="${rec.champion}">
            <div class="rec-info">
                <div class="rec-name">${rec.champion} ${tags}</div>
                <div class="rec-details">
                    WR: ${rec.stats?.win_rate ?? '?'}% | Pick: ${rec.stats?.pick_rate ?? '?'}% | KDA: ${rec.stats?.kda ?? '?'}
                </div>
                <div class="score-bar">
                    <div class="bar-meta" style="width:${(ms/total*100).toFixed(0)}%"></div>
                    <div class="bar-player" style="width:${(ps/total*100).toFixed(0)}%"></div>
                    <div class="bar-counter" style="width:${(cs/total*100).toFixed(0)}%"></div>
                </div>
            </div>
            <span class="rec-score">${rec.total_score}</span>
        `;
        list.appendChild(item);
    });
}

// ---- Charts ----
let chartWR = null;
let chartScores = null;

function renderCharts() {
    const recs = state.recommendations.slice(0, 8);
    if (recs.length === 0) return;

    const labels = recs.map(r => r.champion);

    // Win Rate chart
    const ctxWR = document.getElementById('chart-winrate').getContext('2d');
    if (chartWR) chartWR.destroy();
    chartWR = new Chart(ctxWR, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Win Rate %',
                data: recs.map(r => r.stats?.win_rate ?? 0),
                backgroundColor: recs.map(r => {
                    const wr = r.stats?.win_rate ?? 50;
                    return wr >= 52 ? 'rgba(73,181,78,0.7)' : wr <= 48 ? 'rgba(232,64,87,0.7)' : 'rgba(200,170,110,0.7)';
                }),
                borderColor: recs.map(r => {
                    const wr = r.stats?.win_rate ?? 50;
                    return wr >= 52 ? '#49b54e' : wr <= 48 ? '#e84057' : '#c8aa6e';
                }),
                borderWidth: 1,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Win Rate des champions suggeres', color: '#d4d8de', font: { size: 11 } },
            },
            scales: {
                y: { min: 44, max: 58, ticks: { color: '#7b8fa3', callback: v => v + '%' }, grid: { color: '#1e3048' } },
                x: { ticks: { color: '#7b8fa3', font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
            },
        },
    });

    // Score breakdown chart
    const ctxScores = document.getElementById('chart-scores').getContext('2d');
    if (chartScores) chartScores.destroy();
    chartScores = new Chart(ctxScores, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Meta', data: recs.map(r => r.meta_score ?? 0), backgroundColor: 'rgba(10,200,185,0.6)', borderColor: '#0ac8b9', borderWidth: 1 },
                { label: 'Joueur', data: recs.map(r => r.player_score ?? 0), backgroundColor: 'rgba(200,170,110,0.6)', borderColor: '#c8aa6e', borderWidth: 1 },
                { label: 'Counter', data: recs.map(r => r.counter_score ?? 0), backgroundColor: 'rgba(155,89,182,0.6)', borderColor: '#9b59b6', borderWidth: 1 },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#d4d8de', font: { size: 10 } } },
                title: { display: true, text: 'Pourquoi ces champions ?', color: '#d4d8de', font: { size: 11 } },
            },
            scales: {
                y: { stacked: true, ticks: { color: '#7b8fa3' }, grid: { color: '#1e3048' } },
                x: { stacked: true, ticks: { color: '#7b8fa3', font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
            },
        },
    });
}
