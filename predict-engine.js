/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   보물찾기 예측 — 계산 코어
   ──────────────────────────────────────────
   페이지(predict.js)와 Web Worker(predict-worker.js)가
   공유하는 순수 계산 함수. DOM·localStorage 의존 없음.

   모든 보물(직사각형, 90도 회전 가능)을 격자에 겹치지
   않게, 꽝(blocked) 칸을 피해 배치하는 모든 조합을
   백트래킹으로 완전 열거. 각 완성 배치가 모든 보물(hit)
   칸을 덮을 때만 유효 조합으로 인정하고, 칸별 점유 횟수를
   집계 → 칸 확률 = 점유횟수 / 유효조합수.

   grid: string[H][W]  각 칸 'hidden' | 'blocked' | 'hit'
   반환: { prob:number[H][W], totalCombos, aborted, feasible }
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function predictComputeCore(W, H, objects, grid, maxCombos) {
    const N = W * H;

    // blocked / hit 인덱스
    const blocked = new Uint8Array(N);
    const hitIdx  = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const i = r * W + c;
        const s = grid[r][c];
        if (s === 'blocked') blocked[i] = 1;
        else if (s === 'hit') hitIdx.push(i);
    }

    // 보물 그룹(같은 크기 묶음)별 가능한 모든 배치 위치(꽝 칸 회피) 사전 계산
    const groups = objects.map(obj => {
        const seen = new Set();
        const oris = [];
        const add = (w, h) => { const k = w + 'x' + h; if (!seen.has(k)) { seen.add(k); oris.push({ w, h }); } };
        add(obj.w, obj.h);
        add(obj.h, obj.w); // 90도 회전
        const placements = [];
        oris.forEach(({ w, h }) => {
            for (let r = 0; r <= H - h; r++) for (let c = 0; c <= W - w; c++) {
                const cells = [];
                let ok = true;
                for (let dy = 0; dy < h && ok; dy++) for (let dx = 0; dx < w; dx++) {
                    const idx = (r + dy) * W + (c + dx);
                    if (blocked[idx]) { ok = false; break; }
                    cells.push(idx);
                }
                if (ok) placements.push({ cells, anchor: r * W + c });
            }
        });
        return { count: obj.count, placements, area: obj.w * obj.h };
    });

    // 면적 큰 그룹부터 배치(가지치기 효율↑)
    const order = groups.slice().sort((a, b) => b.area - a.area);

    const occ     = new Uint8Array(N);   // 점유 비트맵
    const occList = [];                  // 점유 칸 인덱스 누적(리프 집계용)
    const cover   = new Float64Array(N); // 칸별 점유 누적 횟수
    let total = 0;
    let aborted = false;

    function place(oi) {
        if (aborted) return;
        if (oi === order.length) {
            // 모든 보물 배치 완료 → 기록된 보물(hit) 칸 전부 덮였는지 확인
            for (let k = 0; k < hitIdx.length; k++) if (!occ[hitIdx[k]]) return;
            total++;
            if (total > maxCombos) { aborted = true; return; }
            // 전체 N칸 스캔 대신 점유 칸만 증가
            for (let k = 0; k < occList.length; k++) cover[occList[k]]++;
            return;
        }
        const g = order[oi];
        placeGroup(g.placements, g.count, 0, -1, oi);
    }

    // 같은 그룹 내 count개를 겹치지 않게 배치 (anchor 증가 강제로 중복 순열 제거)
    function placeGroup(placements, remaining, startP, minAnchor, oi) {
        if (aborted) return;
        if (remaining === 0) { place(oi + 1); return; }
        for (let p = startP; p < placements.length; p++) {
            const pl = placements[p];
            if (pl.anchor <= minAnchor) continue;
            const cells = pl.cells;
            let clash = false;
            for (let k = 0; k < cells.length; k++) if (occ[cells[k]]) { clash = true; break; }
            if (clash) continue;
            for (let k = 0; k < cells.length; k++) { occ[cells[k]] = 1; occList.push(cells[k]); }
            placeGroup(placements, remaining - 1, p + 1, pl.anchor, oi);
            for (let k = 0; k < cells.length; k++) occ[cells[k]] = 0;
            occList.length -= cells.length;
            if (aborted) return;
        }
    }

    place(0);

    const prob = Array.from({ length: H }, () => Array(W).fill(0));
    if (total > 0) {
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
            const i = r * W + c;
            prob[r][c] = grid[r][c] === 'hidden' ? cover[i] / total : 0;
        }
    }
    return { prob, totalCombos: total, aborted, feasible: total > 0 };
}

// Node 테스트 환경 지원
if (typeof module !== 'undefined' && module.exports) module.exports = { predictComputeCore };
