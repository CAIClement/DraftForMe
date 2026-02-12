/* DraftForMe v6 - No left bar, bigger icons, items build */
const state = {
    region:'euw', role:'mid', priority:50, clickMode:'enemy',
    ddragon:{}, championStats:[], playerPool:[], enemyPicks:[], bannedChamps:[],
    recommendations:[], statsLoaded:false, currentStatsRole:null,
};
const MIN_GAMES = 10;

function toast(m){const e=document.getElementById('toast');e.textContent=m;e.classList.remove('hidden');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.add('hidden'),3000)}
function showLoading(m){document.getElementById('loading-text').textContent=m;document.getElementById('loading-overlay').classList.remove('hidden')}
function hideLoading(){document.getElementById('loading-overlay').classList.add('hidden')}
function getImg(n){const d=state.ddragon[n];return d?d.image:`https://ddragon.leagueoflegends.com/cdn/15.3.1/img/champion/${n.replace(/[\s'.]/g,'')}.png`}
function isInPool(n){const p=state.playerPool.find(p=>p.champion.toLowerCase()===n.toLowerCase());return p&&(p.games||0)>=MIN_GAMES}

document.addEventListener('DOMContentLoaded',async()=>{
    state.region=document.getElementById('sel-region').value;
    document.getElementById('sel-region').addEventListener('change',e=>{state.region=e.target.value});
    try{state.ddragon=await(await fetch('/api/ddragon')).json()}catch(e){}
    renderAll();
});
function renderAll(){renderChampionGrid();renderEnemyPicks();renderBans();renderPlayerPool();renderRecommendations()}

// Role
async function selectRole(r){
    state.role=r;
    document.querySelectorAll('.role-btn').forEach(b=>b.classList.toggle('active',b.dataset.role===r));
    if(state.statsLoaded){await loadStatsForRole(r);renderAll();updateRecommendations()}
}
async function loadStatsForRole(r){
    if(state.currentStatsRole===r&&state.championStats.length>0)return;
    showLoading(`Tier list ${r}...`);
    try{state.championStats=await(await fetch(`/api/champion-stats?region=${state.region}&tier=emerald_plus&role=${r}`)).json();
        state.currentStatsRole=r;state.statsLoaded=true;
        document.getElementById('stats-status').textContent=`${state.championStats.length} champs`;
    }catch(e){toast('Erreur')}
    hideLoading();
}

// Priority
function setPriority(v){
    state.priority=v;document.getElementById('priority-slider').value=v;
    document.getElementById('priority-value').textContent=v;
    document.querySelectorAll('.prio-btn').forEach(b=>b.classList.toggle('active',+b.dataset.prio===v));
    if(state.statsLoaded)updateRecommendations();
}
function onSliderChange(){
    const v=+document.getElementById('priority-slider').value;state.priority=v;
    document.getElementById('priority-value').textContent=v;
    document.querySelectorAll('.prio-btn').forEach(b=>b.classList.toggle('active',+b.dataset.prio===v));
    if(state.statsLoaded)updateRecommendations();
}
function setClickMode(m){
    state.clickMode=m;
    document.getElementById('btn-mode-pick').classList.toggle('active',m==='enemy');
    document.getElementById('btn-mode-ban').classList.toggle('active',m==='ban');
}

// Load All
async function loadAll(){
    const s=document.getElementById('input-summoner').value.trim();
    const btn=document.getElementById('btn-load-profile');btn.disabled=true;
    try{
        await loadStatsForRole(state.role);
        if(s){showLoading(`Profil ${s}...`);
            const p=await(await fetch(`/api/player?summoner=${encodeURIComponent(s)}&region=${state.region}`)).json();
            if(!p.error){state.playerPool=(p.most_played||[]).map(c=>({champion:c.champion,win_rate:c.win_rate,games:c.games,wins:c.wins,losses:c.losses,kda:c.kda}));
                toast(`${p.tier||'?'} ${p.lp||''}LP - ${state.playerPool.length} champs`)}
            else toast(p.error);hideLoading()}
        renderAll();updateRecommendations();
    }catch(e){hideLoading();toast('Erreur')}finally{btn.disabled=false}
}

// Champion click
function onChampionClick(n){
    if(!state.statsLoaded){toast('Clique Charger');return}
    if(state.clickMode==='ban'){if(!state.bannedChamps.includes(n)){state.bannedChamps.push(n);renderBans()}}
    else{if(!state.enemyPicks.includes(n)&&state.enemyPicks.length<5){state.enemyPicks.push(n);renderEnemyPicks()}}
    renderChampionGrid();updateRecommendations();
}

// Enemy / Bans (chips inline)
function renderEnemyPicks(){
    const c=document.getElementById('enemy-picks-list');c.innerHTML='';
    if(!state.enemyPicks.length){c.innerHTML='<span class="hint">-</span>';return}
    state.enemyPicks.forEach((n,i)=>{const ch=document.createElement('div');ch.className='pick-chip';
        ch.innerHTML=`<img src="${getImg(n)}"><span class="chip-name">${n}</span><span class="chip-remove">x</span>`;
        ch.onclick=()=>{state.enemyPicks.splice(i,1);renderEnemyPicks();renderChampionGrid();updateRecommendations()};c.appendChild(ch)});
}
function clearEnemyPicks(){state.enemyPicks=[];renderEnemyPicks();renderChampionGrid();updateRecommendations()}
function renderBans(){
    const c=document.getElementById('bans-list');c.innerHTML='';
    if(!state.bannedChamps.length){c.innerHTML='<span class="hint">-</span>';return}
    state.bannedChamps.forEach((n,i)=>{const ch=document.createElement('div');ch.className='pick-chip banned';
        ch.innerHTML=`<img src="${getImg(n)}"><span class="chip-name">${n}</span><span class="chip-remove">x</span>`;
        ch.onclick=()=>{state.bannedChamps.splice(i,1);renderBans();renderChampionGrid();updateRecommendations()};c.appendChild(ch)});
}
function clearBans(){state.bannedChamps=[];renderBans();renderChampionGrid();updateRecommendations()}

// Champion Grid
function renderChampionGrid(){
    const g=document.getElementById('champion-grid');g.innerHTML='';
    const eS=new Set(state.enemyPicks.map(n=>n.toLowerCase()));
    const bS=new Set(state.bannedChamps.map(n=>n.toLowerCase()));
    const recS=new Set(state.recommendations.map(r=>r.champion.toLowerCase()));
    const roleS=new Set(state.championStats.map(s=>s.name.toLowerCase()));
    const byN={};state.championStats.forEach(s=>{byN[s.name.toLowerCase()]=s});
    let ch=[];
    if(Object.keys(state.ddragon).length)for(const[n,i]of Object.entries(state.ddragon))ch.push({name:n,image:i.image,stats:byN[n.toLowerCase()]||null});
    else state.championStats.forEach(s=>ch.push({name:s.name,image:getImg(s.name),stats:s}));
    ch.sort((a,b)=>a.name.localeCompare(b.name));
    const srch=(document.getElementById('champ-search').value||'').toLowerCase();
    for(const c of ch){
        const lc=c.name.toLowerCase();
        if(state.statsLoaded&&!srch&&!roleS.has(lc))continue;
        if(srch&&!lc.includes(srch))continue;
        const el=document.createElement('div');el.className='champ-cell';el.style.position='relative';
        if(bS.has(lc))el.classList.add('banned');
        if(eS.has(lc))el.classList.add('picked-enemy');
        const ip=isInPool(c.name),im=c.stats&&c.stats.rank&&c.stats.rank<=15;
        if(ip&&im)el.classList.add('hot-pick');else if(ip)el.classList.add('in-pool');
        if(recS.has(lc))el.classList.add('recommended');
        const wr=c.stats?.win_rate;const wc=wr!=null?(wr>=52?'high':wr<=48?'low':'mid'):'mid';
        el.innerHTML=`<img src="${c.image}" alt="${c.name}" loading="lazy" onerror="this.src='https://ddragon.leagueoflegends.com/cdn/15.3.1/img/champion/Aatrox.png'"><span class="champ-name">${c.name}</span>${wr!=null?`<span class="champ-wr ${wc}">${wr}%</span>`:''}`;
        el.onclick=()=>onChampionClick(c.name);g.appendChild(el);
    }
}
function filterChampions(){renderChampionGrid()}

// Pool
function renderPlayerPool(){
    const bar=document.getElementById('player-pool-bar'),icons=document.getElementById('player-pool-icons');
    const pool=[...state.playerPool].filter(p=>(p.games||0)>=MIN_GAMES).sort((a,b)=>(b.games||0)-(a.games||0)||(b.win_rate||0)-(a.win_rate||0)).slice(0,5);
    if(!pool.length){bar.classList.add('hidden');return}
    bar.classList.remove('hidden');icons.innerHTML='';
    pool.forEach(p=>{const i=document.createElement('img');i.className='pool-champ';i.src=getImg(p.champion);
        i.title=`${p.champion} ${p.win_rate??'?'}% WR, ${p.games??'?'}G`;icons.appendChild(i)});
}
function openPoolEditor(){document.getElementById('modal-overlay').classList.remove('hidden');renderPoolEditorGrid()}
function closeModal(){document.getElementById('modal-overlay').classList.add('hidden');renderPlayerPool();updateRecommendations()}
function renderPoolEditorGrid(){
    const g=document.getElementById('pool-editor-grid');g.innerHTML='';
    const ps=new Set(state.playerPool.map(p=>p.champion.toLowerCase()));
    const s=(document.getElementById('pool-search')?.value||'').toLowerCase();
    let ns=Object.keys(state.ddragon);if(!ns.length)ns=state.championStats.map(s=>s.name);ns.sort();
    for(const n of ns){if(s&&!n.toLowerCase().includes(s))continue;
        const c=document.createElement('div');c.className='champ-cell';
        if(ps.has(n.toLowerCase()))c.classList.add('in-pool');
        c.innerHTML=`<img src="${getImg(n)}" loading="lazy"><span class="champ-name">${n}</span>`;
        c.onclick=()=>{const i=state.playerPool.findIndex(p=>p.champion.toLowerCase()===n.toLowerCase());
            if(i>=0){state.playerPool.splice(i,1);c.classList.remove('in-pool')}
            else{state.playerPool.push({champion:n});c.classList.add('in-pool')}};g.appendChild(c)}
}
function filterPoolGrid(){renderPoolEditorGrid()}

// Recommendations
async function updateRecommendations(){
    if(!state.statsLoaded)return;
    try{state.recommendations=await(await fetch('/api/recommend',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({player_pool:state.playerPool,enemy_picks:state.enemyPicks,banned:state.bannedChamps,
            already_picked:state.enemyPicks,role:state.role,region:state.region,priority:state.priority,top_n:10})})).json();
    }catch(e){state.recommendations=[]}
    renderRecommendations();renderChampionGrid();
}

function renderRecommendations(){
    const list=document.getElementById('rec-list'),ctx=document.getElementById('rec-context');
    document.getElementById('rec-role-label').textContent=state.role;
    list.innerHTML='';
    if(!state.statsLoaded){ctx.className='rec-context';ctx.textContent='Clique "Charger"';return}
    const hE=state.enemyPicks.length>0,p=state.priority;
    let mode=hE?`<b>Counter</b> vs ${state.enemyPicks.join(', ')}`:p<=15?'<b>Pool</b>':p>=85?'<b>Meta</b>':'<b>Mix</b>';
    ctx.className=hE?'rec-context has-enemy':'rec-context';ctx.innerHTML=mode;
    if(!state.recommendations.length){list.innerHTML='<p class="hint">Aucune suggestion.</p>';return}

    state.recommendations.forEach((rec,i)=>{
        const it=document.createElement('div');it.className='rec-item';
        const ms=rec.meta_score||0,ps=rec.player_score||0,cs=rec.counter_score||0,tot=ms+ps+cs||1;
        const ip=rec.is_in_pool,im=ms>60;
        let tags='';
        if(ip&&im)tags+='<span class="rec-tag hot">Meta+Pool</span>';
        else{if(ip)tags+='<span class="rec-tag pool">Pool</span>';if(im)tags+='<span class="rec-tag meta">Meta</span>'}
        if(hE&&cs>55)tags+='<span class="rec-tag counter">Counter</span>';

        const st=state.championStats.find(s=>s.name.toLowerCase()===rec.champion.toLowerCase());
        const ctr=st?.counters?.length?` | <small style="color:var(--red)">Weak: ${st.counters.join(', ')}</small>`:'';

        it.innerHTML=`<span class="rec-rank">${i+1}</span><img src="${getImg(rec.champion)}">
            <div class="rec-info"><div class="rec-name">${rec.champion} ${tags}</div>
            <div class="rec-details">WR ${rec.stats?.win_rate??'?'}% | Pick ${rec.stats?.pick_rate??'?'}%${ctr}</div>
            <div class="score-bar"><div class="bar-meta" style="width:${(ms/tot*100).toFixed(0)}%"></div>
            <div class="bar-player" style="width:${(ps/tot*100).toFixed(0)}%"></div>
            <div class="bar-counter" style="width:${(cs/tot*100).toFixed(0)}%"></div></div></div>
            <span class="rec-score">${rec.total_score}</span>`;
        it.onclick=()=>openDetail(rec);list.appendChild(it);
    });
}

// Detail Panel + Items
let chartR=null;
async function openDetail(rec){
    document.getElementById('detail-overlay').classList.remove('hidden');
    document.getElementById('detail-img').src=getImg(rec.champion);
    document.getElementById('detail-name').textContent=rec.champion;
    document.getElementById('detail-score-big').textContent=`Score : ${rec.total_score}`;

    const tE=document.getElementById('detail-tags');tE.innerHTML='';
    if(rec.is_in_pool&&rec.meta_score>60)tE.innerHTML+='<span class="rec-tag hot">Meta+Pool</span>';
    else{if(rec.is_in_pool)tE.innerHTML+='<span class="rec-tag pool">Pool</span>';
        if(rec.meta_score>60)tE.innerHTML+='<span class="rec-tag meta">Meta</span>'}
    if(rec.counter_score>55)tE.innerHTML+='<span class="rec-tag counter">Counter</span>';

    const sg=document.getElementById('detail-stats-grid'),s=rec.stats||{};
    const st=state.championStats.find(x=>x.name.toLowerCase()===rec.champion.toLowerCase());
    sg.innerHTML=`
        <div class="stat-card"><div class="stat-value" style="color:${(s.win_rate||50)>=52?'var(--green)':(s.win_rate||50)<=48?'var(--red)':'var(--gold)'}">${s.win_rate??'?'}%</div><div class="stat-label">Win Rate</div></div>
        <div class="stat-card"><div class="stat-value">${s.pick_rate??'?'}%</div><div class="stat-label">Pick Rate</div></div>
        <div class="stat-card"><div class="stat-value">${s.ban_rate??'?'}%</div><div class="stat-label">Ban Rate</div></div>
        <div class="stat-card"><div class="stat-value">#${st?.rank??'?'}</div><div class="stat-label">Rang</div></div>`;
    if(st?.counters?.length)sg.innerHTML+=`<div class="stat-card" style="grid-column:span 2"><div class="stat-value" style="font-size:.85rem;color:var(--red)">${st.counters.join(', ')}</div><div class="stat-label">Faible contre</div></div>`;
    const pd=state.playerPool.find(p=>p.champion.toLowerCase()===rec.champion.toLowerCase());
    if(pd&&(pd.games||0)>=MIN_GAMES)sg.innerHTML+=`<div class="stat-card" style="border:1px solid var(--gold)"><div class="stat-value" style="color:var(--gold)">${pd.win_rate??'?'}%</div><div class="stat-label">Ton WR</div></div><div class="stat-card" style="border:1px solid var(--gold)"><div class="stat-value" style="color:var(--gold)">${pd.games??'?'}</div><div class="stat-label">Tes Games</div></div>`;

    const w=rec.weights||{};
    document.getElementById('detail-weights').innerHTML=`
        <div class="weight-bar"><div class="wb-label">Meta</div><div class="wb-track"><div class="wb-fill meta" style="width:${rec.meta_score}%"></div></div><div class="wb-score">${rec.meta_score}</div></div>
        <div class="weight-bar"><div class="wb-label">Joueur</div><div class="wb-track"><div class="wb-fill player" style="width:${rec.player_score}%"></div></div><div class="wb-score">${rec.player_score}</div></div>
        <div class="weight-bar"><div class="wb-label">Counter</div><div class="wb-track"><div class="wb-fill counter" style="width:${rec.counter_score}%"></div></div><div class="wb-score">${rec.counter_score}</div></div>`;

    // Load items
    const itemsEl=document.getElementById('detail-items');
    itemsEl.innerHTML='<span class="spinner"></span> Chargement du build...';
    const slug=st?.slug||rec.champion.toLowerCase().replace(/[\s'.]/g,'');
    try{
        const build=await(await fetch(`/api/build/${slug}?role=${state.role}&region=${state.region}`)).json();
        if(build.core_items&&build.core_items.length){
            itemsEl.innerHTML='';
            build.core_items.forEach((item,idx)=>{
                if(idx>0&&idx%3===0)itemsEl.insertAdjacentHTML('beforeend','<span class="item-separator">→</span>');
                const img=document.createElement('img');img.className='item-icon';img.src=item.image;
                img.alt=item.name;img.title=item.name;itemsEl.appendChild(img);
            });
            if(build.skill_order)itemsEl.insertAdjacentHTML('beforeend',`<div style="width:100%;margin-top:6px;font-size:.75rem;color:var(--text-dim)">Skills : ${build.skill_order}</div>`);
        }else itemsEl.innerHTML='<span class="hint">Build non disponible</span>';
    }catch(e){itemsEl.innerHTML='<span class="hint">Erreur chargement build</span>'}

    // Radar
    const ctx=document.getElementById('chart-detail-radar').getContext('2d');
    if(chartR)chartR.destroy();
    const mPR=Math.max(...state.championStats.map(x=>x.pick_rate??0),1);
    const mBR=Math.max(...state.championStats.map(x=>x.ban_rate??0),1);
    chartR=new Chart(ctx,{type:'radar',data:{labels:['WR','Pick','Ban','Meta','Joueur','Counter'],
        datasets:[{label:rec.champion,data:[Math.min(100,((s.win_rate||50)-45)*10),Math.min(100,(s.pick_rate||0)/mPR*100),
            Math.min(100,(s.ban_rate||0)/mBR*100),rec.meta_score||0,rec.player_score||0,rec.counter_score||0],
            backgroundColor:'rgba(10,200,185,.2)',borderColor:'#0ac8b9',borderWidth:2,pointBackgroundColor:'#0ac8b9'}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#d4d8de'}}},
            scales:{r:{min:0,max:100,ticks:{display:false},grid:{color:'#1e3048'},pointLabels:{color:'#7b8fa3',font:{size:9}}}}}});
}
function closeDetail(){document.getElementById('detail-overlay').classList.add('hidden')}
