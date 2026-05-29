/* ━━━ 상수 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const API_URL = "https://script.google.com/macros/s/AKfycbxHeNYJBcw-Iy0gUCx9uBpXLXyEqgIsDhxXNur-Yl1PXR-JtpH8FevIrDaUXYXzG2H7gA/exec";
const CATEGORIES = { "Hat":"모자","Gloves":"장갑","Shoes":"신발","Bag":"가방","Badge":"배지","Hairpin":"헤어핀","Charm":"부적","Watch":"손목시계","Necklace":"목걸이" };
const CATEGORY_ORDER = ["Hat","Gloves","Shoes","Bag","Badge","Hairpin","Charm","Watch","Necklace"];

/* ━━━ 상태 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let GLOBAL_RAW_DATA = [];
let activeModalInfo  = null;
let _activeFilter    = 'all';
let _lastSortedArea  = null;
let _lastGlobalAvg   = 0;
let _lastHData       = {};
let _mulN = 1, _mulH = 1;
let _invDebounceTimer = null;

/* ━━━ 토스트 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function showToast(msg, type = 'info', duration = 2800) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, duration);
}

/* ━━━ 로딩 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function setLoading(on) {
    document.getElementById('loading').classList.toggle('active', on);
}

/* ━━━ 초기화 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
window.addEventListener('load', () => {
    const savedCode = localStorage.getItem('ba_friend_code');
    if (savedCode) document.getElementById('friendCode').value = savedCode;
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    const toggleBtn  = document.getElementById('toggleInventoryBtn');
    const invWrapper = document.getElementById('inventoryWrapper');
    if (toggleBtn && invWrapper) {
        const isCollapsed = localStorage.getItem('ba_inventory_collapsed') === 'true';
        if (isCollapsed) { invWrapper.classList.add('collapsed'); toggleBtn.textContent = '▶ 펼치기'; }
        toggleBtn.addEventListener('click', () => {
            const collapsed = invWrapper.classList.toggle('collapsed');
            toggleBtn.textContent = collapsed ? '▶ 펼치기' : '▼ 접기';
            localStorage.setItem('ba_inventory_collapsed', String(collapsed));
        });
    }
    autoInit();
});

/* ━━━ API: 초기 로드 ━━━━━━━━━━━━━━━━━━━━━━ */
async function autoInit() {
    const statusEl  = document.getElementById('load-status');
    const statusDot = document.getElementById('statusDot');
    try {
        const res  = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) {
            GLOBAL_RAW_DATA = data.farming_data;
            statusEl.textContent  = '시스템 정상';
            statusDot.className   = 'ba-status-dot ok';
            document.getElementById('app-content').style.display = 'block';
            drawInventory();
            runAnalysis();
        } else throw new Error('API error');
    } catch (e) {
        statusEl.textContent = e.message.startsWith('HTTP') ? `서버 오류 (${e.message})` : 'DB 연결 실패';
        statusDot.className  = 'ba-status-dot err';
        console.error('[autoInit]', e);
    }
}

/* ━━━ API: 불러오기 ━━━━━━━━━━━━━━━━━━━━━━━ */
async function syncLoad() {
    const code = document.getElementById('friendCode').value.trim();
    if (!code) return showToast('코드를 입력하세요.', 'warning');
    setLoading(true);
    try {
        const res  = await fetch(`${API_URL}?id=${encodeURIComponent(code)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('ba_inv_data',    data.user.inv);
            localStorage.setItem('ba_hard_count',  data.user.hard);
            localStorage.setItem('ba_friend_code', code);
            drawInventory(); runAnalysis();
            showToast('✅ 동기화 완료!', 'success');
        } else showToast('❌ 코드를 찾을 수 없습니다.', 'error');
    } catch (e) { showToast('❌ 불러오기 실패: 네트워크 오류', 'error'); console.error(e); }
    finally { setLoading(false); }
}

/* ━━━ API: 저장 ━━━━━━━━━━━━━━━━━━━━━━━━━━ */
async function syncSave() {
    const code = document.getElementById('friendCode').value.trim();
    if (!code) return showToast('코드를 입력하세요.', 'warning');
    setLoading(true);
    try {
        const res  = await fetch(API_URL, { method:'POST', body: JSON.stringify({ id:code, inv:localStorage.getItem('ba_inv_data'), hard:localStorage.getItem('ba_hard_count'), date:new Date().toLocaleDateString() }) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success !== false) showToast('💾 저장 완료!', 'success');
        else showToast('❌ 저장 실패: 서버 오류', 'error');
    } catch (e) { showToast('❌ 저장 실패: 네트워크 오류', 'error'); console.error(e); }
    finally { setLoading(false); }
}

/* ━━━ 인벤토리 렌더링 ━━━━━━━━━━━━━━━━━━━━━ */
function drawInventory() {
    const root  = document.getElementById('inventory-ui');
    const saved = JSON.parse(localStorage.getItem('ba_inv_data') || '{}');
    const frag  = document.createDocumentFragment();
    Object.keys(CATEGORIES).forEach(cat => {
        const group = document.createElement('div');
        group.className = 'item-group';

        const hdr = document.createElement('div');
        hdr.className = 'item-group-header';
        hdr.innerHTML = `<div class="item-group-dot"></div><span class="item-group-name">${CATEGORIES[cat]}</span>`;
        group.appendChild(hdr);

        const grid = document.createElement('div');
        grid.className = 'item-grid';
        for (let t = 1; t <= 10; t++) {
            const k = `${cat}_T${t}`;
            const wrap = document.createElement('div');
            wrap.className = 'item-input';
            const lbl = document.createElement('label');
            lbl.textContent = `T${t}`; lbl.htmlFor = k;
            // 아이콘 이미지
            const ICON_MAP = {
                Hat:     ["Equipment_Icon_Hat_Tier1.png","Equipment_Icon_Hat_Tier2.png","Equipment_Icon_Hat_Tier3.png","Equipment_Icon_Hat_Tier4.png","Equipment_Icon_Hat_Tier5.png","Equipment_Icon_Hat_Tier6.png","Equipment_Icon_Hat_Tier7.png","Equipment_Icon_Hat_Tier8.png","Equipment_Icon_Hat_Tier9.png","Equipment_Icon_Hat_Tier10.png"],
                Gloves:  ["Equipment_Icon_Gloves_Tier1.png","Equipment_Icon_Gloves_Tier2.png","Equipment_Icon_Gloves_Tier3.png","Equipment_Icon_Gloves_Tier4.png","Equipment_Icon_Gloves_Tier5.png","Equipment_Icon_Gloves_Tier6.png","Equipment_Icon_Gloves_Tier7.png","Equipment_Icon_Gloves_Tier8.png","Equipment_Icon_Gloves_Tier9.png","Equipment_Icon_Gloves_Tier10.png"],
                Shoes:   ["Equipment_Icon_Shoes_Tier1.png","Equipment_Icon_Shoes_Tier2.png","Equipment_Icon_Shoes_Tier3.png","Equipment_Icon_Shoes_Tier4.png","Equipment_Icon_Shoes_Tier5.png","Equipment_Icon_Shoes_Tier6.png","Equipment_Icon_Shoes_Tier7.png","Equipment_Icon_Shoes_Tier8.png","Equipment_Icon_Shoes_Tier9.png","Equipment_Icon_Shoes_Tier10.png"],
                Bag:     ["Equipment_Icon_Bag_Tier1.png","Equipment_Icon_Bag_Tier2.png","Equipment_Icon_Bag_Tier3.png","Equipment_Icon_Bag_Tier4.png","Equipment_Icon_Bag_Tier5.png","Equipment_Icon_Bag_Tier6.png","Equipment_Icon_Bag_Tier7.png","Equipment_Icon_Bag_Tier8.png","Equipment_Icon_Bag_Tier9.png","Equipment_Icon_Bag_Tier10.png"],
                Badge:   ["Equipment_Icon_Badge_Tier1.png","Equipment_Icon_Badge_Tier2.png","Equipment_Icon_Badge_Tier3.png","Equipment_Icon_Badge_Tier4.png","Equipment_Icon_Badge_Tier5.png","Equipment_Icon_Badge_Tier6.png","Equipment_Icon_Badge_Tier7.png","Equipment_Icon_Badge_Tier8.png","Equipment_Icon_Badge_Tier9.png","Equipment_Icon_Badge_Tier10.png"],
                Hairpin: ["Equipment_Icon_Hairpin_Tier1.png","Equipment_Icon_Hairpin_Tier2.png","Equipment_Icon_Hairpin_Tier3.png","Equipment_Icon_Hairpin_Tier4.png","Equipment_Icon_Hairpin_Tier5.png","Equipment_Icon_Hairpin_Tier6.png","Equipment_Icon_Hairpin_Tier7.png","Equipment_Icon_Hairpin_Tier8.png","Equipment_Icon_Hairpin_Tier9.png","Equipment_Icon_Hairpin_Tier10.png"],
                Charm:   ["Equipment_Icon_Charm_Tier1.png","Equipment_Icon_Charm_Tier2.png","Equipment_Icon_Charm_Tier3.png","Equipment_Icon_Charm_Tier4.png","Equipment_Icon_Charm_Tier5.png","Equipment_Icon_Charm_Tier6.png","Equipment_Icon_Charm_Tier7.png","Equipment_Icon_Charm_Tier8.png","Equipment_Icon_Charm_Tier9.png","Equipment_Icon_Charm_Tier10.png"],
                Watch:   ["Equipment_Icon_Watch_Tier1.png","Equipment_Icon_Watch_Tier2.png","Equipment_Icon_Watch_Tier3.png","Equipment_Icon_Watch_Tier4.png","Equipment_Icon_Watch_Tier5.png","Equipment_Icon_Watch_Tier6.png","Equipment_Icon_Watch_Tier7.png","Equipment_Icon_Watch_Tier8.png","Equipment_Icon_Watch_Tier9.png","Equipment_Icon_Watch_Tier10.png"],
                Necklace:["Equipment_Icon_Necklace_Tier1.png","Equipment_Icon_Necklace_Tier2.png","Equipment_Icon_Necklace_Tier3.png","Equipment_Icon_Necklace_Tier4.png","Equipment_Icon_Necklace_Tier5.png","Equipment_Icon_Necklace_Tier6.png","Equipment_Icon_Necklace_Tier7.png","Equipment_Icon_Necklace_Tier8.png","Equipment_Icon_Necklace_Tier9.png","Equipment_Icon_Necklace_Tier10.png"],
            };
            const BASE_IMG = "https://raw.githubusercontent.com/GuestGhost/Blue-Archive-Img/refs/heads/main/images";
            const iconFile = ICON_MAP[cat] && ICON_MAP[cat][t-1];
            if (iconFile) {
                const img = document.createElement('img');
                img.src = `${BASE_IMG}/${iconFile}`;
                img.alt = `T${t}`;
                img.className = 'item-icon';
                img.loading = 'lazy';
                wrap.appendChild(img);
            }
            const inp = document.createElement('input');
            inp.type = 'number'; inp.id = k; inp.min = '0'; inp.value = saved[k] || 0;
            inp.addEventListener('change', onInventoryChange);
            wrap.appendChild(lbl); wrap.appendChild(inp);
            grid.appendChild(wrap);
        }
        group.appendChild(grid);
        frag.appendChild(group);
    });
    root.innerHTML = '';
    root.appendChild(frag);
}

/* ━━━ 인벤토리 변경 (debounce) ━━━━━━━━━━━━ */
function onInventoryChange() {
    const data = {};
    document.querySelectorAll('.item-input input').forEach(el => {
        data[el.id] = Math.max(parseInt(el.value) || 0, 0);
    });
    localStorage.setItem('ba_inv_data', JSON.stringify(data));
    clearTimeout(_invDebounceTimer);
    _invDebounceTimer = setTimeout(() => {
        document.getElementById('stale-notice').style.display = 'flex';
    }, 300);
}

/* ━━━ 배수 변경 ━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function getMultipliers() { return { mulN: _mulN, mulH: _mulH }; }
function onMulChange() {
    const selN = document.getElementById('mulNormal');
    const selH = document.getElementById('mulHard');
    if (selN) _mulN = parseInt(selN.value);
    if (selH) _mulH = parseInt(selH.value);
    runAnalysis();
}

/* ━━━ 분석 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function runAnalysis() {
    const inv   = JSON.parse(localStorage.getItem('ba_inv_data') || '{}');
    const hData = JSON.parse(localStorage.getItem('ba_hard_count') || '{}');
    const { mulN, mulH } = getMultipliers();
    document.getElementById('stale-notice').style.display = 'none';
    const area = document.getElementById('results-area');
    area.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ba-text-sub);font-weight:700">⏳ 분석 중...</div>`;

    requestAnimationFrame(() => {
        const allCounts  = GLOBAL_RAW_DATA.map(item => inv[`${item.category}_T${item.tier}`] || 0);
        const globalAvg  = allCounts.reduce((a,b) => a+b, 0) / (allCounts.length || 1);
        const globalMin  = allCounts.length ? Math.min(...allCounts) : 0;
        const globalMax  = allCounts.length ? Math.max(...allCounts) : 0;
        const globalRange= Math.max(globalMax - globalMin, 1);

        const areaScores = {};
        GLOBAL_RAW_DATA.forEach(item => {
            const k = `${item.category}_T${item.tier}`;
            const count = inv[k] || 0;
            item.mission_drops.forEach(d => {
                const loc = d.mission;
                const isH = loc.includes('H');
                if (isH && (hData[loc] || 0) >= 3) return;
                if (!areaScores[loc]) areaScores[loc] = { drops:[], isH, ap: isH?20:10, score:0, minCount:Infinity, maxTierOfMin:0, topItemInfo:'', scoreBreakdown:[] };
                if (!areaScores[loc].drops.some(x => x.id === k)) {
                    areaScores[loc].drops.push({ id:k, name:`${item.tier}T ${item.name_ko}`, rate:d.rates_percent[0], m: isH?mulH:mulN, tier:item.tier, category:item.category, count });
                }
                if (count < areaScores[loc].minCount) { areaScores[loc].minCount = count; areaScores[loc].maxTierOfMin = item.tier; areaScores[loc].topItemInfo = `${item.tier}T ${item.name_ko} (보유: ${count})`; }
                else if (count === areaScores[loc].minCount && item.tier > areaScores[loc].maxTierOfMin) { areaScores[loc].maxTierOfMin = item.tier; areaScores[loc].topItemInfo = `${item.tier}T ${item.name_ko} (보유: ${count})`; }
            });
        });

        Object.entries(areaScores).forEach(([loc, info]) => {
            if (!info.drops.length) return;
            const counts = info.drops.map(d => d.count);
            const areaAvg = counts.reduce((a,b) => a+b, 0) / counts.length;
            const variance = counts.reduce((s,c) => s + Math.pow(c-areaAvg,2), 0) / counts.length;
            const stdDev = Math.sqrt(variance);
            const spreadPenalty = Math.min(stdDev / (globalRange*0.5+1), 0.5);
            let totalScore = 0;
            info.drops.forEach(drop => {
                const c = drop.count, t = drop.tier;
                const expQty = (drop.rate/100) * drop.m;
                const needRatio = 1 - (c-globalMin)/(globalRange+1);
                let overflowPenalty = 1.0;
                if (globalAvg > 0 && c > globalAvg*2.5) overflowPenalty = Math.max(1/(c/(globalAvg*2.5)), 0.05);
                const itemScore = needRatio * overflowPenalty * (1+(t-1)*0.15) * expQty * (10/info.ap);
                totalScore += itemScore;
                info.scoreBreakdown.push({ name:drop.name, count:c, needRatio:needRatio.toFixed(2), overflow:overflowPenalty.toFixed(2), itemScore:itemScore.toFixed(3) });
            });
            info.score = totalScore * (1-spreadPenalty);
            info.remainingHard = Math.max(3-(hData[loc]||0), 0);
            info._debug = {
                areaMin:Math.min(...counts), areaMax:Math.max(...counts),
                areaAvg:areaAvg.toFixed(1), stdDev:stdDev.toFixed(1),
                spreadPenalty:spreadPenalty.toFixed(2), rawScore:totalScore.toFixed(3), finalScore:info.score.toFixed(3)
            };
        });

        const allSorted = Object.entries(areaScores).filter(([,i]) => i.drops.length > 0).sort((a,b) => {
            if (Math.abs(b[1].score-a[1].score) > 0.0001) return b[1].score-a[1].score;
            if (a[1].minCount !== b[1].minCount) return a[1].minCount-b[1].minCount;
            return b[1].maxTierOfMin-a[1].maxTierOfMin;
        });

        _lastSortedArea = allSorted; _lastGlobalAvg = globalAvg; _lastHData = hData;
        renderResults(allSorted, globalAvg, hData, _activeFilter, mulN, mulH);
    });
}

/* ━━━ 필터 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function setFilter(mode) {
    _activeFilter = mode;
    document.querySelectorAll('.filter-btn').forEach(b => b.className = 'filter-btn');
    const btn = document.getElementById('filter-btn-' + mode);
    if (btn) btn.classList.add('active-' + mode);
    if (_lastSortedArea) renderResults(_lastSortedArea, _lastGlobalAvg, _lastHData, mode, _mulN, _mulH);
}

/* ━━━ 하드 초기화 ━━━━━━━━━━━━━━━━━━━━━━━━━ */
function resetHardCounts() {
    if (confirm('모든 하드 구역의 소탕 횟수를 0으로 초기화하시겠습니까?')) {
        localStorage.setItem('ba_hard_count', JSON.stringify({}));
        runAnalysis();
        showToast('🔄 하드 횟수 초기화 완료', 'info');
    }
}

/* ━━━ 결과 렌더링 ━━━━━━━━━━━━━━━━━━━━━━━━━ */
function renderResults(allSorted, globalAvg, hData, filterMode, mulN, mulH) {
    let filtered = allSorted;
    if (filterMode === 'hard') filtered = allSorted.filter(([,i]) => i.isH);
    else if (filterMode === 'norm') filtered = allSorted.filter(([,i]) => !i.isH);
    const top10 = filtered.slice(0, 10);

    const area = document.getElementById('results-area');
    const multiplierHtml = `
        <div class="multiplier-area">
            <div class="multiplier-controls">
                <div class="mul-group">
                    <span class="mul-label">🎁 노말 배수</span>
                    <select class="mul-select" id="mulNormal" onchange="onMulChange()">
                        <option value="1" ${mulN===1?'selected':''}>1배 (기본)</option>
                        <option value="2" ${mulN===2?'selected':''}>2배 이벤트</option>
                        <option value="3" ${mulN===3?'selected':''}>3배 이벤트</option>
                    </select>
                </div>
                <div class="mul-group">
                    <span class="mul-label">🎁 하드 배수</span>
                    <select class="mul-select" id="mulHard" onchange="onMulChange()">
                        <option value="1" ${mulH===1?'selected':''}>1배 (기본)</option>
                        <option value="2" ${mulH===2?'selected':''}>2배 이벤트</option>
                        <option value="3" ${mulH===3?'selected':''}>3배 이벤트</option>
                    </select>
                </div>
            </div>
            <div class="multiplier-note">ℹ️ 이벤트 배수는 드롭 <b>확률</b>이 아닌<br>드롭 <b>수량</b>이 늘어나는 이벤트입니다.</div>
        </div>`;

    const headerHtml = `
        <div class="results-header">
            <div class="results-title">
                <div class="section-title-bar" style="height:18px;"></div>
                📍 추천 파밍 구역 TOP 10
            </div>
            <span class="results-meta">평균 보유량 ${globalAvg.toFixed(0)}개 기준</span>
        </div>
        <div class="filter-bar">
            <span class="filter-label">필터</span>
            <button id="filter-btn-all"  class="filter-btn ${filterMode==='all' ?'active-all' :''}" onclick="setFilter('all')">전체</button>
            <button id="filter-btn-norm" class="filter-btn ${filterMode==='norm'?'active-norm':''}" onclick="setFilter('norm')">🔵 노말</button>
            <button id="filter-btn-hard" class="filter-btn ${filterMode==='hard'?'active-hard':''}" onclick="setFilter('hard')">🔴 하드</button>
        </div>
        ${multiplierHtml}`;

    if (!top10.length) {
        area.innerHTML = headerHtml + `<div style="text-align:center;padding:40px;color:var(--ba-text-sub);font-weight:700">해당 조건에 맞는 추천 구역이 없습니다.</div>`;
        return;
    }

    const cardParts = top10.map(([loc, info]) => {
        const sortedDrops = [...info.drops].sort((a,b) => {
            if (a.tier !== b.tier) return b.tier - a.tier;
            return CATEGORY_ORDER.indexOf(b.category) - CATEGORY_ORDER.indexOf(a.category);
        });

        const itemListHtml = sortedDrops.map(u => {
            const isOverflow  = globalAvg > 0 && u.count > globalAvg * 2.5;
            const overflowTag = isOverflow ? `<span class="overflow-tag">⚠️ 과잉</span>` : '';
            const rowStyle    = isOverflow ? 'opacity:0.5;' : '';
            const qtyInfo     = u.m > 1 ? `<span class="qty-badge">${u.m}배 이벤트</span>` : '';
            return `<div class="farm-row" style="${rowStyle}">
                <div class="item-name-area">
                    <div class="item-name-row">
                        <span class="item-name">${u.name}</span>
                        ${overflowTag}
                        <span class="item-qty">(보유 ${u.count})</span>
                        ${qtyInfo}
                    </div>
                    <span class="drop-rate">드롭 확률 ${u.rate}%</span>
                </div>
            </div>`;
        }).join('');

        const usedNow = hData[loc] || 0;
        const remaining = 3 - usedNow;
        const hardRemainInfo = info.isH
            ? `<div class="hard-remain-badge">🎫 오늘 남은 소탕: <b>${remaining}회</b></div>`
            : '';

        const d = info._debug;
        const apEff = (info.score / (info.ap / 10)).toFixed(2);
        return `<div class="rec-card">
            <div class="rec-header ${info.isH ? 'is-hard' : 'is-norm'}">
                <div class="rec-header-left">
                    <span class="rec-title">${loc}</span>
                    <span class="rec-ap-tag">${info.ap}AP</span>
                    <span class="ap-eff-tag">효율 ${apEff}</span>
                </div>
                <div class="rec-header-right">
                    <span class="score-tag">점수 ${info.score.toFixed(2)}</span>
                    <span class="badge ${info.isH?'badge-h':'badge-n'}">${info.isH?'HARD':'NORMAL'}</span>
                </div>
            </div>
            <div class="rec-body">
                ${hardRemainInfo}
                ${itemListHtml}
                <button class="btn-commit" onclick="openModalForCard('${loc}', ${info.isH})">📦 수량 입력 & 반영</button>
            </div>
            <div class="analysis-report">
                💡 <b>분석:</b>
                최솟값 <b>${info.minCount}개</b> · 구역평균 <b>${d.areaAvg}개</b> · 편차 <b>±${d.stdDev}</b> · 편차패널티 <b>${(d.spreadPenalty*100).toFixed(0)}%</b> · AP효율점수 <b>${Number(d.finalScore).toFixed(2)}</b>
                &nbsp;|&nbsp; 핵심: <b>${info.topItemInfo}</b>
            </div>
        </div>`;
    });

    area.innerHTML = headerHtml + cardParts.join('');
}

/* ━━━ 모달: 열기 ━━━━━━━━━━━━━━━━━━━━━━━━━ */
function openModalForCard(loc, isH) {
    if (!_lastSortedArea) return;
    const found = _lastSortedArea.find(([l]) => l === loc);
    if (!found) { showToast('❌ 구역 정보를 찾을 수 없습니다.', 'error'); return; }

    const hData = JSON.parse(localStorage.getItem('ba_hard_count') || '{}');
    const areaInfo = found[1];
    const drops = areaInfo.drops;
    const remainingHard = isH ? Math.max(3-(hData[loc]||0), 0) : 0;
    activeModalInfo = { loc, isH, drops, remainingHard, currentHardUsed: hData[loc]||0 };

    document.getElementById('modalTitle').textContent = `${loc} 수량 입력`;
    const modalBody = document.getElementById('modalBody');
    const frag = document.createDocumentFragment();

    [...drops].sort((a,b) => {
        if (a.tier !== b.tier) return b.tier-a.tier;
        return CATEGORY_ORDER.indexOf(b.category) - CATEGORY_ORDER.indexOf(a.category);
    }).forEach(drop => {
        const cc = drop.count;
        const row = document.createElement('div'); row.className = 'modal-item-row';
        const nd  = document.createElement('div'); nd.className = 'modal-item-name';
        // 아이콘 이미지
        const MODAL_ICON_MAP = {
            Hat:     ["Equipment_Icon_Hat_Tier1.png","Equipment_Icon_Hat_Tier2.png","Equipment_Icon_Hat_Tier3.png","Equipment_Icon_Hat_Tier4.png","Equipment_Icon_Hat_Tier5.png","Equipment_Icon_Hat_Tier6.png","Equipment_Icon_Hat_Tier7.png","Equipment_Icon_Hat_Tier8.png","Equipment_Icon_Hat_Tier9.png","Equipment_Icon_Hat_Tier10.png"],
            Gloves:  ["Equipment_Icon_Gloves_Tier1.png","Equipment_Icon_Gloves_Tier2.png","Equipment_Icon_Gloves_Tier3.png","Equipment_Icon_Gloves_Tier4.png","Equipment_Icon_Gloves_Tier5.png","Equipment_Icon_Gloves_Tier6.png","Equipment_Icon_Gloves_Tier7.png","Equipment_Icon_Gloves_Tier8.png","Equipment_Icon_Gloves_Tier9.png","Equipment_Icon_Gloves_Tier10.png"],
            Shoes:   ["Equipment_Icon_Shoes_Tier1.png","Equipment_Icon_Shoes_Tier2.png","Equipment_Icon_Shoes_Tier3.png","Equipment_Icon_Shoes_Tier4.png","Equipment_Icon_Shoes_Tier5.png","Equipment_Icon_Shoes_Tier6.png","Equipment_Icon_Shoes_Tier7.png","Equipment_Icon_Shoes_Tier8.png","Equipment_Icon_Shoes_Tier9.png","Equipment_Icon_Shoes_Tier10.png"],
            Bag:     ["Equipment_Icon_Bag_Tier1.png","Equipment_Icon_Bag_Tier2.png","Equipment_Icon_Bag_Tier3.png","Equipment_Icon_Bag_Tier4.png","Equipment_Icon_Bag_Tier5.png","Equipment_Icon_Bag_Tier6.png","Equipment_Icon_Bag_Tier7.png","Equipment_Icon_Bag_Tier8.png","Equipment_Icon_Bag_Tier9.png","Equipment_Icon_Bag_Tier10.png"],
            Badge:   ["Equipment_Icon_Badge_Tier1.png","Equipment_Icon_Badge_Tier2.png","Equipment_Icon_Badge_Tier3.png","Equipment_Icon_Badge_Tier4.png","Equipment_Icon_Badge_Tier5.png","Equipment_Icon_Badge_Tier6.png","Equipment_Icon_Badge_Tier7.png","Equipment_Icon_Badge_Tier8.png","Equipment_Icon_Badge_Tier9.png","Equipment_Icon_Badge_Tier10.png"],
            Hairpin: ["Equipment_Icon_Hairpin_Tier1.png","Equipment_Icon_Hairpin_Tier2.png","Equipment_Icon_Hairpin_Tier3.png","Equipment_Icon_Hairpin_Tier4.png","Equipment_Icon_Hairpin_Tier5.png","Equipment_Icon_Hairpin_Tier6.png","Equipment_Icon_Hairpin_Tier7.png","Equipment_Icon_Hairpin_Tier8.png","Equipment_Icon_Hairpin_Tier9.png","Equipment_Icon_Hairpin_Tier10.png"],
            Charm:   ["Equipment_Icon_Charm_Tier1.png","Equipment_Icon_Charm_Tier2.png","Equipment_Icon_Charm_Tier3.png","Equipment_Icon_Charm_Tier4.png","Equipment_Icon_Charm_Tier5.png","Equipment_Icon_Charm_Tier6.png","Equipment_Icon_Charm_Tier7.png","Equipment_Icon_Charm_Tier8.png","Equipment_Icon_Charm_Tier9.png","Equipment_Icon_Charm_Tier10.png"],
            Watch:   ["Equipment_Icon_Watch_Tier1.png","Equipment_Icon_Watch_Tier2.png","Equipment_Icon_Watch_Tier3.png","Equipment_Icon_Watch_Tier4.png","Equipment_Icon_Watch_Tier5.png","Equipment_Icon_Watch_Tier6.png","Equipment_Icon_Watch_Tier7.png","Equipment_Icon_Watch_Tier8.png","Equipment_Icon_Watch_Tier9.png","Equipment_Icon_Watch_Tier10.png"],
            Necklace:["Equipment_Icon_Necklace_Tier1.png","Equipment_Icon_Necklace_Tier2.png","Equipment_Icon_Necklace_Tier3.png","Equipment_Icon_Necklace_Tier4.png","Equipment_Icon_Necklace_Tier5.png","Equipment_Icon_Necklace_Tier6.png","Equipment_Icon_Necklace_Tier7.png","Equipment_Icon_Necklace_Tier8.png","Equipment_Icon_Necklace_Tier9.png","Equipment_Icon_Necklace_Tier10.png"],
        };
        const BASE_IMG = "https://raw.githubusercontent.com/GuestGhost/Blue-Archive-Img/refs/heads/main/images";
        const modalIconFile = MODAL_ICON_MAP[drop.category] && MODAL_ICON_MAP[drop.category][drop.tier - 1];
        if (modalIconFile) {
            const mimg = document.createElement('img');
            mimg.src = `${BASE_IMG}/${modalIconFile}`;
            mimg.alt = drop.name; mimg.className = 'modal-item-icon'; mimg.loading = 'lazy';
            nd.appendChild(mimg);
        }
        const ndText = document.createElement('div');
        ndText.innerHTML = `<span>${drop.name}</span><small>드롭률 ${drop.rate}% ${drop.m>1?`(x${drop.m}배)`:''} · 보유: ${cc}개</small>`;
        nd.appendChild(ndText);
        const inp = document.createElement('input');
        inp.type='number'; inp.className='modal-item-input'; inp.value='0'; inp.min='0';
        inp.setAttribute('data-item-id', drop.id);
        const fin = document.createElement('span'); fin.className='modal-item-final'; fin.textContent=`→ ${cc}개`;
        inp.addEventListener('input', () => { fin.textContent = `→ ${cc + Math.max(parseInt(inp.value)||0,0)}개`; });
        row.appendChild(nd); row.appendChild(inp); row.appendChild(fin);
        frag.appendChild(row);
    });

    if (isH) {
        const hd = document.createElement('div'); hd.className = 'hard-selector-modal';
        if (remainingHard > 0) {
            hd.innerHTML = `<span>🔁 소탕 횟수 (남은 ${remainingHard}회)</span>
                <select id="modalHardTimes">${Array.from({length:remainingHard},(_,i)=>`<option value="${i+1}" ${i+1===remainingHard?'selected':''}>${i+1}회</option>`).join('')}</select>`;
        } else {
            hd.style.background = '#FEE2E2'; hd.style.borderColor = '#F5B8BE';
            hd.textContent = '⚠️ 오늘 하드 소탕 횟수를 모두 사용했습니다.';
        }
        frag.appendChild(hd);
    }

    modalBody.innerHTML = ''; modalBody.appendChild(frag);
    document.getElementById('quantityModal').classList.add('active');
}

/* ━━━ 모달: 닫기 ━━━━━━━━━━━━━━━━━━━━━━━━━ */
function closeModal() {
    document.getElementById('quantityModal').classList.remove('active');
    activeModalInfo = null;
}

/* ━━━ 모달: 반영 ━━━━━━━━━━━━━━━━━━━━━━━━━ */
function confirmModal() {
    if (!activeModalInfo) return;
    const { loc, isH, remainingHard } = activeModalInfo;
    const inv = JSON.parse(localStorage.getItem('ba_inv_data') || '{}');
    document.querySelectorAll('#modalBody .modal-item-input').forEach(inp => {
        const addQty = Math.max(parseInt(inp.value)||0, 0);
        if (addQty > 0) inv[inp.getAttribute('data-item-id')] = (inv[inp.getAttribute('data-item-id')]||0) + addQty;
    });
    const hData = JSON.parse(localStorage.getItem('ba_hard_count') || '{}');
    if (isH && remainingHard > 0) {
        const ts = document.getElementById('modalHardTimes');
        if (ts) hData[loc] = (hData[loc]||0) + parseInt(ts.value);
    }
    localStorage.setItem('ba_inv_data', JSON.stringify(inv));
    localStorage.setItem('ba_hard_count', JSON.stringify(hData));
    Object.entries(inv).forEach(([k,v]) => { const el = document.getElementById(k); if (el) el.value = v; });
    closeModal(); runAnalysis();
    showToast('✅ 반영 완료! 분석 결과가 갱신되었습니다.', 'success');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   화면 인식
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let _scStream = null;
const _scIcons = {};
let _scIconsLoaded = false;
const SC_MATCH_SIZE = 32;
const SC_BASE = "https://raw.githubusercontent.com/GuestGhost/Blue-Archive-Img/refs/heads/main/images";
const SC_ICON_FILES = {
    Hat:     Array.from({length:10},(_,i)=>`Equipment_Icon_Hat_Tier${i+1}.png`),
    Gloves:  Array.from({length:10},(_,i)=>`Equipment_Icon_Gloves_Tier${i+1}.png`),
    Shoes:   Array.from({length:10},(_,i)=>`Equipment_Icon_Shoes_Tier${i+1}.png`),
    Bag:     Array.from({length:10},(_,i)=>`Equipment_Icon_Bag_Tier${i+1}.png`),
    Badge:   Array.from({length:10},(_,i)=>`Equipment_Icon_Badge_Tier${i+1}.png`),
    Hairpin: Array.from({length:10},(_,i)=>`Equipment_Icon_Hairpin_Tier${i+1}.png`),
    Charm:   Array.from({length:10},(_,i)=>`Equipment_Icon_Charm_Tier${i+1}.png`),
    Watch:   Array.from({length:10},(_,i)=>`Equipment_Icon_Watch_Tier${i+1}.png`),
    Necklace:Array.from({length:10},(_,i)=>`Equipment_Icon_Necklace_Tier${i+1}.png`),
};

async function scLoadIcons() {
    if (_scIconsLoaded) return;
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = SC_MATCH_SIZE;
    const ctx = tmp.getContext('2d', { willReadFrequently: true });
    const tasks = [];
    for (const [cat, files] of Object.entries(SC_ICON_FILES)) {
        for (let t = 1; t <= 10; t++) {
            const key = `${cat}_T${t}`;
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = `${SC_BASE}/${files[t-1]}`;
            tasks.push(new Promise(resolve => {
                img.onload = () => {
                    ctx.clearRect(0, 0, SC_MATCH_SIZE, SC_MATCH_SIZE);
                    ctx.drawImage(img, 0, 0, SC_MATCH_SIZE, SC_MATCH_SIZE);
                    _scIcons[key] = Array.from(ctx.getImageData(0, 0, SC_MATCH_SIZE, SC_MATCH_SIZE).data);
                    resolve();
                };
                img.onerror = () => resolve();
            }));
        }
    }
    await Promise.all(tasks);
    _scIconsLoaded = true;
}


function scPixelDiff(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i += 4)
        d += Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]);
    return d / (a.length / 4 * 3);
}

function scMatchIcon(srcCanvas, x, y, w, h) {
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = SC_MATCH_SIZE;
    const ctx = tmp.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(srcCanvas, x, y, w, h, 0, 0, SC_MATCH_SIZE, SC_MATCH_SIZE);
    const cellData = Array.from(ctx.getImageData(0, 0, SC_MATCH_SIZE, SC_MATCH_SIZE).data);
    let best = { key: null, diff: Infinity };
    for (const [key, refData] of Object.entries(_scIcons)) {
        const d = scPixelDiff(cellData, refData);
        if (d < best.diff) best = { key, diff: d };
    }
    return best;
}

function scParseQty(text) {
    const m = text.replace(/\s/g,'').match(/[xX](\d[\d,.]*)\s*([Kk])?/);
    if (!m) return null;
    let n = parseFloat(m[1].replace(/,/g,''));
    if (isNaN(n)) return null;
    if (m[2]) n *= 1000;
    return Math.round(n);
}

/* 셀 높이 자동 측정 — 티어 뱃지(진한 파란 원) 위치 기반 */
function scMeasureCellHeight(ctx, x1, y1, x2, y2, cellW) {
    const fullH = Math.round(y2 - y1);
    const badgeCentersY = [];

    for (let col = 0; col < 5; col++) {
        // 뱃지는 각 셀 왼쪽 15% 지점에 위치
        const sampleX = Math.round(x1 + (col + 0.15) * cellW);
        if (sampleX >= x2) continue;
        const imgData = ctx.getImageData(sampleX, Math.round(y1), 1, fullH);
        const data = imgData.data;
        let inBadge = false, badgeStart = -1;
        for (let py = 0; py < fullH; py++) {
            const idx = py * 4;
            const r = data[idx], g = data[idx+1], b = data[idx+2];
            // 진한 파란색: R<100, G<180, B>140, B가 R의 1.8배 이상
            const isBadge = r < 100 && g < 180 && b > 140 && b > r * 1.8;
            if (isBadge && !inBadge) { inBadge = true; badgeStart = py; }
            if (!isBadge && inBadge) {
                badgeCentersY.push((badgeStart + py) / 2);
                inBadge = false;
            }
        }
    }

    if (badgeCentersY.length < 2) return cellW * 1.1; // 폴백

    badgeCentersY.sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < badgeCentersY.length; i++) {
        const gap = badgeCentersY[i] - badgeCentersY[i-1];
        if (gap > cellW * 0.5 && gap < cellW * 2.2) gaps.push(gap);
    }
    if (!gaps.length) return cellW * 1.1;
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)]; // 중앙값
}

async function startScreenCapture() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
        showToast('이 브라우저는 화면 공유를 지원하지 않습니다. Chrome을 사용하세요.', 'error');
        return;
    }
    try {
        _scStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'window' }, audio: false });
        const video = document.getElementById('sc-video');
        video.srcObject = _scStream;
        await new Promise(r => { video.onloadedmetadata = r; });
        video.play();
        document.getElementById('sc-live').style.display = 'block';
        _scStream.getVideoTracks()[0].addEventListener('ended', stopScreenCapture);
        showToast('게임 장비 목록 화면으로 이동 후 [캡처 & 분석]을 누르세요.', 'info', 4000);
        scLoadIcons();
    } catch(e) {
        if (e.name !== 'NotAllowedError' && e.name !== 'AbortError')
            showToast('화면 공유 오류: ' + e.message, 'error');
    }
}

function stopScreenCapture() {
    if (_scStream) { _scStream.getTracks().forEach(t => t.stop()); _scStream = null; }
    ['sc-live','sc-select-wrap','sc-result'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

function scCaptureFrame() {
    const video = document.getElementById('sc-video');
    if (!video.videoWidth) return showToast('화면 공유 대기 중입니다.', 'warning');
    const canvas = document.getElementById('sc-canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const displayCanvas = document.getElementById('sc-display');
    const maxW = Math.min(700, (document.querySelector('.page-wrap')?.offsetWidth || 700) - 40);
    const scale = Math.min(1, maxW / canvas.width);
    displayCanvas.width = Math.round(canvas.width * scale);
    displayCanvas.height = Math.round(canvas.height * scale);
    displayCanvas._scScale = scale;
    displayCanvas.getContext('2d').drawImage(canvas, 0, 0, displayCanvas.width, displayCanvas.height);

    document.getElementById('sc-select-wrap').style.display = 'block';
    document.getElementById('sc-result').style.display = 'none';
    scInitDrag(displayCanvas);
    showToast('장비 그리드 영역을 드래그로 선택하세요.', 'info');
}

function scInitDrag(dc) {
    const overlay = document.getElementById('sc-sel-overlay');
    let dragging = false, sx = 0, sy = 0;

    const getPos = (e) => {
        const r = dc.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return [
            Math.max(0, Math.min(src.clientX - r.left, dc.width)),
            Math.max(0, Math.min(src.clientY - r.top,  dc.height))
        ];
    };
    const updateOverlay = (ex, ey) => {
        Object.assign(overlay.style, {
            display:'block',
            left:  `${Math.min(sx,ex)}px`, top:    `${Math.min(sy,ey)}px`,
            width: `${Math.abs(ex-sx)}px`, height: `${Math.abs(ey-sy)}px`
        });
    };
    const finish = async (ex, ey) => {
        dragging = false;
        const scale = dc._scScale || 1;
        const [x1,y1] = [Math.min(sx,ex)/scale, Math.min(sy,ey)/scale];
        const [x2,y2] = [Math.max(sx,ex)/scale, Math.max(sy,ey)/scale];
        if (x2-x1 < 80 || y2-y1 < 40) { showToast('영역이 너무 작습니다. 다시 선택하세요.','warning'); return; }
        await scProcessGrid(x1, y1, x2, y2);
    };

    dc.onmousedown  = (e) => { e.preventDefault(); [sx,sy]=getPos(e); dragging=true; overlay.style.display='none'; };
    dc.onmousemove  = (e) => { if (dragging) updateOverlay(...getPos(e)); };
    dc.onmouseup    = (e) => { if (dragging) finish(...getPos(e)); };
    dc.ontouchstart = (e) => { e.preventDefault(); [sx,sy]=getPos(e); dragging=true; };
    dc.ontouchmove  = (e) => { e.preventDefault(); if (dragging) updateOverlay(...getPos(e)); };
    dc.ontouchend   = (e) => { if (dragging) finish(...getPos({ touches: e.changedTouches })); };
}

async function scProcessGrid(x1, y1, x2, y2) {
    setLoading(true);
    const srcCanvas = document.getElementById('sc-canvas');
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    try {
        await scLoadIcons();

        const cols  = 5;
        const cellW = (x2 - x1) / cols;
        // 해상도 독립: 뱃지 위치로 셀 높이 자동 측정
        const cellH = scMeasureCellHeight(srcCtx, x1, y1, x2, y2, cellW);
        const rows  = Math.max(1, Math.round((y2 - y1) / cellH));

        const detected = [];
        const tmpOcr   = document.createElement('canvas');

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cx = x1 + c * cellW;
                const cy = y1 + r * cellH;
                if (cx + cellW > srcCanvas.width || cy + cellH > srcCanvas.height) continue;

                // 아이콘 영역: 셀 상단 60%, 좌우 10% 여백
                const im   = cellW * 0.10;
                const match = scMatchIcon(srcCanvas, cx+im, cy+im, cellW-im*2, cellH*0.60);
                console.log(`[SC] r${r}c${c} match=${match.key} diff=${match.diff?.toFixed(1)}`);
                if (!match.key || match.diff > 95) continue;

                // 수량 OCR: 셀 하단 31%, 오른쪽 61% (뱃지 오른쪽 영역)
                const qx = Math.round(cx + cellW * 0.37);
                const qy = Math.round(cy + cellH * 0.67);
                const qw = Math.round(cellW * 0.61);
                const qh = Math.round(cellH * 0.31);
                const S  = 3; // 업스케일 배율
                tmpOcr.width  = qw * S;
                tmpOcr.height = qh * S;
                const oCtx = tmpOcr.getContext('2d', { willReadFrequently: true });
                oCtx.fillStyle = '#fff';
                oCtx.fillRect(0, 0, tmpOcr.width, tmpOcr.height);
                oCtx.drawImage(srcCanvas, qx, qy, qw, qh, 0, 0, tmpOcr.width, tmpOcr.height);

                // 대비 강화 (이진화 - 흰 글씨→검정, 배경→흰색으로 반전)
                const imgData = oCtx.getImageData(0, 0, tmpOcr.width, tmpOcr.height);
                for (let i = 0; i < imgData.data.length; i += 4) {
                    const avg = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2]) / 3;
                    // 밝은 픽셀(글씨)=검정, 어두운 픽셀(배경)=흰색 → Tesseract 최적화
                    const v = avg > 140 ? 0 : 255;
                    imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = v;
                }
                oCtx.putImageData(imgData, 0, 0);

                let qty = null;
                try {
                    const result = await Tesseract.recognize(tmpOcr, 'eng', {
                        logger: () => {},
                        tessedit_char_whitelist: 'xXKk0123456789',
                        tessedit_pageseg_mode: '7', // PSM.SINGLE_LINE
                    });
                    qty = scParseQty(result.data?.text ?? result.text ?? '');
                    console.log('[SC OCR raw]', result.data?.text ?? result.text);
                } catch(e) { console.warn('[SC OCR]', e); }
                if (qty === null) continue;

                const [cat, tierStr] = match.key.split('_');
                detected.push({ key: match.key, cat, tier: parseInt(tierStr.slice(1)), qty });
            }
        }
        scRenderResults(detected);
    } catch(e) {
        showToast('분석 오류: ' + e.message, 'error');
        console.error('[scProcessGrid]', e);
    } finally {
        setLoading(false);
    }
}

function scRenderResults(items) {
    const el = document.getElementById('sc-result');
    if (!items.length) {
        el.innerHTML = `
          <div style="text-align:center;padding:20px;color:var(--ba-red);font-weight:700;line-height:2">
            ⚠️ 인식된 장비가 없습니다.<br>
            <span style="color:var(--ba-text-sub);font-size:12px;font-weight:600">
              장비 목록 화면인지 확인하고, 아이콘 전체가 포함되도록 선택하세요.
            </span>
          </div>`;
        el.style.display = 'block';
        return;
    }
    const rows = items.map(item => `
      <tr style="border-bottom:1px solid var(--ba-paper2)">
        <td style="padding:7px 10px">
          <img src="${SC_BASE}/${SC_ICON_FILES[item.cat][item.tier-1]}"
            style="width:36px;height:28px;object-fit:contain;border-radius:4px;background:rgba(91,184,245,0.07);border:1px solid var(--ba-border);padding:2px;display:block">
        </td>
        <td style="padding:7px 10px;font-weight:700;font-size:13px;color:var(--ba-navy)">
          ${CATEGORIES[item.cat]} T${item.tier}
        </td>
        <td style="padding:7px 10px">
          <input type="number" min="0" value="${item.qty}" data-sc-key="${item.key}"
            style="width:90px;padding:6px 8px;border:1.5px solid var(--ba-border);border-radius:8px;font-weight:800;font-size:13px;text-align:center;font-family:'Rajdhani',sans-serif;color:var(--ba-sky-dk);outline:none">
        </td>
      </tr>`).join('');
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:800;color:var(--ba-navy)">📋 인식 결과</span>
        <span style="font-size:12px;color:var(--ba-text-sub);font-weight:600">${items.length}개 · 수정 후 반영 가능</span>
      </div>
      <div style="border:1.5px solid var(--ba-border);border-radius:12px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead style="background:var(--ba-paper2)">
            <tr>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--ba-text-sub);font-weight:700">아이콘</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--ba-text-sub);font-weight:700">아이템</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--ba-text-sub);font-weight:700">인식 수량</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <button class="ba-btn ba-btn-primary" style="margin-top:12px;width:100%;padding:13px;border-radius:12px" onclick="scApply()">
        ✅ 인벤토리에 반영
      </button>`;
    el.style.display = 'block';
}

function scApply() {
    const inv = JSON.parse(localStorage.getItem('ba_inv_data') || '{}');
    let count = 0;
    document.querySelectorAll('#sc-result input[data-sc-key]').forEach(inp => {
        const key = inp.getAttribute('data-sc-key');
        const val = Math.max(parseInt(inp.value) || 0, 0);
        inv[key] = val;
        const el = document.getElementById(key);
        if (el) el.value = val;
        count++;
    });
    localStorage.setItem('ba_inv_data', JSON.stringify(inv));
    document.getElementById('stale-notice').style.display = 'flex';
    showToast(`✅ ${count}개 항목이 인벤토리에 반영되었습니다!`, 'success');
}

/* ━━━ iframe 높이 자동 전달 ━━━━━━━━━━━━━━━━━ */
(function() {
    function sendHeight() {
        window.parent.postMessage({ type: 'resize', height: document.body.scrollHeight }, '*');
    }
    const ro = new ResizeObserver(sendHeight);
    ro.observe(document.body);
    sendHeight();
})();
