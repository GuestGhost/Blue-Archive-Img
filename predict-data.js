/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   보물찾기 예측 — 이벤트 데이터
   ──────────────────────────────────────────
   블루아카이브 이벤트의 9×5 보물찾기 미니게임.
   각 회차(case)마다 정해진 크기(w×h)의 직사각형
   보물이 count개씩 격자에 겹치지 않게 배치됩니다.
   보물은 90도 회전될 수 있습니다.

   데이터 출처: github.com/alphaorderly/blueaka_game
   (팬 제작 도구 · 비영리)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PREDICT_GRID_WIDTH  = 9;
const PREDICT_GRID_HEIGHT = 5;

const PREDICT_EVENTS = [
    {
        id: 'gentle-the-outside-strong-the-inside',
        name: '오욕내강',
        caseOptions: [
            { value: 'case1', label: '1·4 회차', objects: [{ w: 3, h: 2, count: 1 }, { w: 3, h: 1, count: 5 }, { w: 2, h: 1, count: 2 }] },
            { value: 'case2', label: '2·5 회차', objects: [{ w: 4, h: 2, count: 1 }, { w: 2, h: 2, count: 2 }, { w: 3, h: 1, count: 3 }] },
            { value: 'case3', label: '3·6 회차', objects: [{ w: 3, h: 3, count: 1 }, { w: 1, h: 4, count: 3 }, { w: 2, h: 1, count: 2 }] },
            { value: 'case4', label: '7 회차 이상', objects: [{ w: 2, h: 2, count: 2 }, { w: 3, h: 1, count: 3 }, { w: 2, h: 1, count: 6 }] },
        ],
    },
    {
        id: 'shale-final-report',
        name: '샬레 총결산',
        caseOptions: [
            { value: 'case1', label: '1·4 회차', objects: [{ w: 2, h: 2, count: 3 }, { w: 3, h: 2, count: 2 }, { w: 4, h: 2, count: 1 }] },
            { value: 'case2', label: '2·5 회차', objects: [{ w: 1, h: 3, count: 2 }, { w: 3, h: 2, count: 3 }, { w: 3, h: 3, count: 1 }] },
            { value: 'case3', label: '3·6 회차', objects: [{ w: 2, h: 1, count: 6 }, { w: 1, h: 3, count: 4 }, { w: 1, h: 4, count: 2 }] },
            { value: 'case4', label: '7 회차 이상', objects: [{ w: 3, h: 2, count: 2 }, { w: 4, h: 2, count: 1 }, { w: 3, h: 3, count: 1 }] },
        ],
    },
    {
        id: 'shale-final-report-1week',
        name: '샬레 총결산 (1주)',
        caseOptions: [
            { value: 'case1', label: '1·3 회차', objects: [{ w: 2, h: 2, count: 3 }, { w: 3, h: 2, count: 2 }, { w: 4, h: 2, count: 1 }] },
            { value: 'case2', label: '2·4 회차', objects: [{ w: 2, h: 1, count: 7 }, { w: 1, h: 3, count: 3 }, { w: 1, h: 4, count: 2 }] },
            { value: 'case3', label: '5 회차 이상', objects: [{ w: 3, h: 2, count: 2 }, { w: 4, h: 2, count: 1 }, { w: 3, h: 3, count: 1 }] },
        ],
    },
    {
        id: 'secret-midnight-party',
        name: '비밀의 미드나잇 파티',
        caseOptions: [
            { value: 'case1', label: '1·4 회차', objects: [{ w: 3, h: 2, count: 2 }, { w: 3, h: 1, count: 5 }, { w: 2, h: 1, count: 2 }] },
            { value: 'case2', label: '2·5 회차', objects: [{ w: 4, h: 2, count: 1 }, { w: 1, h: 4, count: 2 }, { w: 3, h: 1, count: 5 }] },
            { value: 'case3', label: '3·6 회차', objects: [{ w: 3, h: 3, count: 1 }, { w: 2, h: 2, count: 4 }, { w: 2, h: 1, count: 3 }] },
            { value: 'case4', label: '7 회차 이상', objects: [{ w: 4, h: 2, count: 2 }, { w: 3, h: 1, count: 3 }, { w: 2, h: 1, count: 6 }] },
        ],
    },
    {
        id: 'hyakayori-swimsuit',
        name: '수상 승부 (수영복)',
        caseOptions: [
            { value: 'case1', label: '1·4 회차', objects: [{ w: 3, h: 2, count: 2 }, { w: 3, h: 1, count: 5 }, { w: 2, h: 1, count: 2 }] },
            { value: 'case2', label: '2·5 회차', objects: [{ w: 4, h: 2, count: 1 }, { w: 1, h: 4, count: 2 }, { w: 3, h: 1, count: 5 }] },
            { value: 'case3', label: '3·6 회차', objects: [{ w: 3, h: 3, count: 1 }, { w: 2, h: 2, count: 4 }, { w: 2, h: 1, count: 3 }] },
            { value: 'case4', label: '7 회차 이상', objects: [{ w: 4, h: 2, count: 2 }, { w: 3, h: 1, count: 3 }, { w: 2, h: 1, count: 6 }] },
        ],
    },
];
