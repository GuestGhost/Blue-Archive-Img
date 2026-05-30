/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   보물찾기 예측 — Web Worker
   계산 코어를 메인 스레드와 분리해 UI 멈춤 방지.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
importScripts('predict-engine.js');

self.onmessage = function (e) {
    const { id, W, H, objects, grid, maxCombos } = e.data;
    try {
        const res = predictComputeCore(W, H, objects, grid, maxCombos);
        self.postMessage({ id, ok: true, ...res });
    } catch (err) {
        self.postMessage({ id, ok: false, error: String(err && err.message || err) });
    }
};
