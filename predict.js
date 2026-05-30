/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   보물찾기 예측 — 로직 & UI
   ──────────────────────────────────────────
   9×5 격자에 직사각형 보물들이 겹치지 않게 숨겨져
   있습니다. 칸을 열어 "꽝/보물"을 기록하면, 그 기록과
   모순되지 않는 모든 배치 조합을 완전 열거하여 남은
   칸마다 보물이 있을 확률을 계산하고 다음에 열 칸을
   추천합니다.

   칸 상태: 'hidden'(미개봉) · 'blocked'(꽝) · 'hit'(보물)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PREDICT_W = PREDICT_GRID_WIDTH;
const PREDICT_H = PREDICT_GRID_HEIGHT;
const PREDICT_MAX_COMBOS = 2000000; // 안전 상한 (초과 시 중단)

/* ━━━ 상태 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let _pEvent  = null;     // 현재 이벤트
let _pCase   = null;     // 현재 회차(caseOption)
let _pGrid   = null;     // string[][]  각 칸 상태
let _pMarkCell = null;   // 기록 중인 칸 {r,c}
let _pInited = false;

/* 계산: Web Worker + 캐시 + 오래된 요청 취소 */
let _pWorker   = null;        // Web Worker 인스턴스
let _pWorkerBroken = false;   // 워커 생성/실행 실패 시 동기 폴백
let _pReqId    = 0;           // 현재 유효 요청 id (이전 요청은 무시)
let _pPending  = {};          // { reqId: callback }
let _pLastProb = null;        // 직전 확률(계산 중 임시 표시용)
const _pCache  = new Map();   // gridKey → result (최근 60개)

function predictGetWorker() {
    if (_pWorkerBroken) return null;
    if (_pWorker) return _pWorker;
    try {
        _pWorker = new Worker('predict-worker.js');
        _pWorker.onmessage = (e) => {
            const { id } = e.data;
            const cb = _pPending[id];
            if (cb) { delete _pPending[id]; cb(e.data); }
        };
        _pWorker.onerror = () => {
            // 워커 실행 불가(file:// 등) → 이후 동기 폴백
            _pWorkerBroken = true;
            try { _pWorker.terminate(); } catch (e) { /* noop */ }
            _pWorker = null;
            _pPending = {};
            if (_pEvent && _pCase && _pGrid) predictRender();
        };
        return _pWorker;
    } catch (e) {
        _pWorkerBroken = true;
        _pWorker = null;
        return null;
    }
}

function predictGridKey() {
    return `${_pEvent.id}|${_pCase.value}|${_pGrid.map(r => r.join('')).join(',')}`;
}
function predictCacheSet(key, res) {
    _pCache.set(key, res);
    if (_pCache.size > 60) _pCache.delete(_pCache.keys().next().value);
}

/* ━━━ 뷰 전환 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function switchView(name) {
    const farm    = document.getElementById('view-farm');
    const predict = document.getElementById('view-predict');
    const tabFarm = document.getElementById('tab-farm');
    const tabPred = document.getElementById('tab-predict');
    const isFarm  = name === 'farm';
    farm.style.display    = isFarm ? 'block' : 'none';
    predict.style.display = isFarm ? 'none'  : 'block';
    tabFarm.classList.toggle('active', isFarm);
    tabPred.classList.toggle('active', !isFarm);
    localStorage.setItem('ba_active_view', name);
    if (!isFarm && !_pInited) predictInit();
}

/* ━━━ 초기화 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
window.addEventListener('load', () => {
    const sel = document.getElementById('predictEvent');
    if (sel) {
        sel.innerHTML = PREDICT_EVENTS
            .map(e => `<option value="${e.id}">${e.name}</option>`)
            .join('');
    }
    if (localStorage.getItem('ba_active_view') === 'predict') switchView('predict');
});

function predictInit() {
    _pInited = true;
    const sel = document.getElementById('predictEvent');
    const savedEventId = localStorage.getItem('ba_predict_event');
    if (savedEventId && PREDICT_EVENTS.some(e => e.id === savedEventId)) sel.value = savedEventId;
    predictLoadEvent(sel.value);
}

/* ━━━ 이벤트 / 회차 로드 ━━━━━━━━━━━━━━━━━━ */
function predictOnEventChange() { predictLoadEvent(document.getElementById('predictEvent').value); }

function predictLoadEvent(eventId) {
    _pEvent = PREDICT_EVENTS.find(e => e.id === eventId) || PREDICT_EVENTS[0];
    localStorage.setItem('ba_predict_event', _pEvent.id);

    // 회차 select 채우기
    const cs = document.getElementById('predictCase');
    cs.innerHTML = _pEvent.caseOptions
        .map(c => `<option value="${c.value}">${c.label}</option>`)
        .join('');
    const savedCase = localStorage.getItem(`ba_predict_case_${_pEvent.id}`);
    if (savedCase && _pEvent.caseOptions.some(c => c.value === savedCase)) cs.value = savedCase;

    predictLoadCase(cs.value);
}

function predictOnCaseChange() { predictLoadCase(document.getElementById('predictCase').value); }

function predictLoadCase(caseValue) {
    _pCase = _pEvent.caseOptions.find(c => c.value === caseValue) || _pEvent.caseOptions[0];
    localStorage.setItem(`ba_predict_case_${_pEvent.id}`, _pCase.value);
    _pGrid = predictLoadGridState();
    predictRender();
}

/* ━━━ 격자 상태 저장/복원 ━━━━━━━━━━━━━━━━━ */
function predictEmptyGrid() {
    return Array.from({ length: PREDICT_H }, () => Array(PREDICT_W).fill('hidden'));
}
function predictStateKey() { return `ba_predict_grid_${_pEvent.id}_${_pCase.value}`; }

function predictLoadGridState() {
    try {
        const raw = localStorage.getItem(predictStateKey());
        if (raw) {
            const s = JSON.parse(raw);
            if (Array.isArray(s) && s.length === PREDICT_H && s[0] && s[0].length === PREDICT_W) return s;
        }
    } catch (e) { /* 무시 */ }
    return predictEmptyGrid();
}
function predictSaveGridState() {
    if (_pEvent && _pCase && _pGrid) localStorage.setItem(predictStateKey(), JSON.stringify(_pGrid));
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   확률 계산 (Web Worker 비동기 + 동기 폴백)
   계산 로직은 predict-engine.js의 predictComputeCore.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function predictBestCell(prob) {
    let best = null;
    for (let r = 0; r < PREDICT_H; r++) for (let c = 0; c < PREDICT_W; c++) {
        if (_pGrid[r][c] !== 'hidden') continue;
        const p = prob[r][c];
        if (!best || p > best.p) best = { r, c, p };
    }
    return best;
}

function predictApplyResult(result) {
    _pLastProb = result.prob;
    const best = predictBestCell(result.prob);
    predictRenderSummary(result, best);
    predictRenderGrid(result.prob, best, false);
    predictRenderLegend(result.prob, result);
}

/* ━━━ 렌더링 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function predictRender() {
    if (!_pEvent || !_pCase || !_pGrid) return;

    const reqId = ++_pReqId;                 // 이전 요청 무효화
    const key   = predictGridKey();
    const objects = _pCase.objects;
    const gridCopy = _pGrid.map(r => r.slice());

    // 캐시 적중 → 즉시 반영(워커 호출 없음)
    const cached = _pCache.get(key);
    if (cached) { predictApplyResult(cached); return; }

    const done = (res) => {
        if (reqId !== _pReqId) return;       // 오래된 결과 폐기
        predictCacheSet(key, res);
        predictApplyResult(res);
    };

    // 계산 중에도 격자는 즉시 클릭 가능 (직전 확률 표시 + '계산 중' 배지)
    predictRenderGrid(_pLastProb || predictZeroProb(), null, true);
    predictSetCalculating();

    const worker = predictGetWorker();
    if (worker) {
        _pPending[reqId] = (msg) => {
            if (!msg.ok) {                   // 워커 내부 오류 → 동기 폴백
                _pWorkerBroken = true;
                const res = predictComputeCore(PREDICT_W, PREDICT_H, objects, gridCopy, PREDICT_MAX_COMBOS);
                done(res);
                return;
            }
            done(msg);
        };
        worker.postMessage({ id: reqId, W: PREDICT_W, H: PREDICT_H, objects, grid: gridCopy, maxCombos: PREDICT_MAX_COMBOS });
    } else {
        // 동기 폴백: 스피너가 먼저 그려지도록 한 틱 미룸
        setTimeout(() => {
            if (reqId !== _pReqId) return;
            const res = predictComputeCore(PREDICT_W, PREDICT_H, objects, gridCopy, PREDICT_MAX_COMBOS);
            done(res);
        }, 20);
    }
}

function predictZeroProb() {
    return Array.from({ length: PREDICT_H }, () => Array(PREDICT_W).fill(0));
}

function predictSetCalculating() {
    const el = document.getElementById('predict-summary');
    if (el) el.innerHTML = `<div class="predict-rec calc"><span class="predict-spinner"></span>⏳ 가능한 배치 계산 중…</div>`;
    const wrap = document.getElementById('predict-grid-wrap');
    if (wrap) wrap.classList.add('calculating');
}

function predictRenderSummary(result, best) {
    const el = document.getElementById('predict-summary');
    let opened = 0, hits = 0, treasureCells = 0;
    _pCase.objects.forEach(o => { treasureCells += o.w * o.h * o.count; });
    for (let r = 0; r < PREDICT_H; r++) for (let c = 0; c < PREDICT_W; c++) {
        if (_pGrid[r][c] !== 'hidden') opened++;
        if (_pGrid[r][c] === 'hit') hits++;
    }
    const total = PREDICT_W * PREDICT_H;

    let rec;
    if (!result.feasible) {
        rec = `<div class="predict-rec none">⚠️ 입력한 기록과 맞는 배치가 없습니다. 꽝/보물 표시를 확인하세요.</div>`;
    } else if (best && best.p > 0) {
        rec = `<div class="predict-rec">🎯 다음 추천: <b>${best.r + 1}행 ${best.c + 1}열</b>
                <span class="predict-rec-pct">보물 확률 ${(best.p * 100).toFixed(1)}%</span></div>`;
    } else {
        rec = `<div class="predict-rec done">✅ 남은 미개봉 칸에 보물이 없습니다 (모두 확정).</div>`;
    }

    const comboTxt = result.aborted
        ? `${PREDICT_MAX_COMBOS.toLocaleString()}+ (상한 도달, 근사값)`
        : result.totalCombos.toLocaleString();

    el.innerHTML = `
        <div class="predict-stat-row">
            <span class="predict-stat">열어본 칸 <b>${opened}/${total}</b></span>
            <span class="predict-stat">찾은 보물 칸 <b>${hits}/${treasureCells}</b></span>
            <span class="predict-stat">가능한 배치 <b>${comboTxt}</b></span>
        </div>
        ${rec}`;
}

function predictHeat(p) {
    // 확률 0~1 → 파랑(낮음)~금색(높음) 보간 배경
    if (p <= 0) return 'transparent';
    const a = 0.12 + 0.78 * p;
    // 낮으면 하늘색, 높으면 골드 쪽으로
    const r = Math.round(91  + (245 - 91)  * p);
    const g = Math.round(184 + (200 - 184) * p);
    const b = Math.round(245 + (66  - 245) * p);
    return `rgba(${r},${g},${b},${a})`;
}

function predictRenderGrid(prob, best, calculating) {
    const wrap = document.getElementById('predict-grid-wrap');
    wrap.classList.toggle('calculating', !!calculating);
    const grid = document.createElement('div');
    grid.className = 'predict-grid';
    grid.style.gridTemplateColumns = `repeat(${PREDICT_W}, 1fr)`;

    for (let r = 0; r < PREDICT_H; r++) for (let c = 0; c < PREDICT_W; c++) {
        const cell = document.createElement('button');
        cell.className = 'predict-cell';
        cell.onclick = () => predictOpenMark(r, c);
        const state = _pGrid[r][c];

        if (state === 'hit') {
            cell.classList.add('hit');
            cell.innerHTML = `<span class="pc-icon">💎</span>`;
            cell.title = `${r + 1}행 ${c + 1}열 · 보물`;
        } else if (state === 'blocked') {
            cell.classList.add('blocked');
            cell.innerHTML = `<span class="pc-x">✕</span>`;
            cell.title = `${r + 1}행 ${c + 1}열 · 꽝`;
        } else {
            const p = prob[r][c];
            cell.style.background = predictHeat(p);
            if (p > 0) {
                cell.innerHTML = `<span class="pc-pct">${(p * 100).toFixed(0)}</span>`;
                cell.title = `${r + 1}행 ${c + 1}열 · 보물 확률 ${(p * 100).toFixed(1)}%`;
            } else {
                cell.classList.add('zero');
                cell.innerHTML = `<span class="pc-pct">·</span>`;
                cell.title = `${r + 1}행 ${c + 1}열 · 보물 없음(확정)`;
            }
            if (best && best.p > 0 && r === best.r && c === best.c) cell.classList.add('recommend');
        }
        grid.appendChild(cell);
    }
    wrap.innerHTML = '';
    wrap.appendChild(grid);
}

function predictRenderLegend(prob, result) {
    const el = document.getElementById('predict-legend');
    const objs = _pCase.objects.map((o, i) => {
        const rot = o.w !== o.h ? ' <small>(회전 가능)</small>' : '';
        return `<div class="legend-item">
            <span class="legend-num">${i + 1}</span>
            <div class="legend-main">
                <div class="legend-name">${o.w}×${o.h} 보물${rot}</div>
                <div class="legend-top">${o.count}개 숨겨짐 · ${o.w * o.h}칸 크기</div>
            </div>
            <div class="legend-shape">${predictShapePreview(o)}</div>
        </div>`;
    }).join('');

    el.innerHTML = `
        <div class="legend-title">🧩 이번 회차의 보물</div>
        <div class="legend-grid">${objs}</div>
        <div class="legend-hint">칸을 눌러 열어본 결과(💎 보물 / ✕ 꽝)를 기록하세요. 숫자는 보물이 있을 확률(%)입니다.</div>`;
}

function predictShapePreview(o) {
    let html = `<div class="shape-mini" style="grid-template-columns:repeat(${o.w},6px)">`;
    for (let i = 0; i < o.w * o.h; i++) html += `<span class="shape-dot"></span>`;
    html += '</div>';
    return html;
}

/* ━━━ 칸 기록 모달 ━━━━━━━━━━━━━━━━━━━━━━━ */
function predictOpenMark(r, c) {
    _pMarkCell = { r, c };
    document.getElementById('cellMarkTitle').textContent = `${r + 1}행 ${c + 1}열 기록`;
    const state = _pGrid[r][c];
    document.getElementById('cellMarkBody').innerHTML = `
        <div class="mark-desc">이 칸을 열었을 때 나온 결과를 선택하세요.</div>
        <div class="mark-grid">
            <button class="mark-btn hit ${state === 'hit' ? 'active' : ''}" onclick="predictSetCell('hit')">💎 보물</button>
            <button class="mark-btn empty ${state === 'blocked' ? 'active' : ''}" onclick="predictSetCell('blocked')">✕ 꽝 (빈 칸)</button>
        </div>
        ${state !== 'hidden' ? `<button class="ba-btn ba-btn-ghost mark-undo" onclick="predictSetCell('hidden')">↩ 안 열어본 상태로 되돌리기</button>` : ''}`;
    document.getElementById('cellMarkModal').classList.add('active');
}

function predictSetCell(value) {
    if (!_pMarkCell) return;
    const { r, c } = _pMarkCell;
    _pGrid[r][c] = value;
    predictSaveGridState();
    predictCloseMark();
    predictRender();
}

function predictCloseMark() {
    document.getElementById('cellMarkModal').classList.remove('active');
    _pMarkCell = null;
}

/* ━━━ 초기화 버튼 ━━━━━━━━━━━━━━━━━━━━━━━━ */
function predictReset() {
    if (!_pEvent || !_pCase) return;
    if (!confirm('현재 회차의 기록을 모두 지우시겠습니까?')) return;
    _pGrid = predictEmptyGrid();
    predictSaveGridState();
    predictRender();
    if (typeof showToast === 'function') showToast('🔄 보물찾기 기록 초기화 완료', 'info');
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') predictCloseMark(); });
