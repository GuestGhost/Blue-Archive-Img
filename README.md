# 블루 아카이브 파밍 효율 도우미

블루 아카이브의 장비 설계도 인벤토리를 관리하고, 최적 파밍 구역을 분석해주는 웹 도구입니다.

🔗 **[바로가기](https://guestghost.github.io/Blue-Archive-Img/)**

---

## 주요 기능

### 📦 인벤토리 관리

- **T1 장비 (공통)** 섹션이 최상단에 별도 표시 — T1은 설계도가 필요 없어 다른 티어와 구분
- T2~T10 장비는 카테고리(모자·장갑·신발·가방·배지·헤어핀·부적·손목시계·목걸이)별로 그룹화
- 각 장비 아이콘 및 수량 입력란 제공
- 수량 변경 시 자동으로 localStorage에 저장

### 🔍 파밍 구역 분석

- 보유 인벤토리 기준으로 **부족한 아이템을 파밍할 수 있는 최적 구역**을 자동 계산
- 노말 / 하드 소탕 배수 설정 가능
- **보유 수량 상한 설정** — 특정 값(예: 500) 입력 시 초과 수량은 해당 값으로 인식하여 분석
  - 특정 아이템을 과도하게 보유한 경우 엉뚱한 구역이 추천되는 문제 방지
  - 0 입력 시 제한 없음

### 🔁 하드 소탕 횟수 관리

- 하드 구역별 소탕 횟수(최대 3회) 추적
- **매일 새벽 4시 자동 초기화** — 페이지 방문 시 기준 시각이 지났으면 자동 리셋 및 알림 표시
- 수동 초기화 버튼 제공

### ☁️ 친구코드 동기화

- 친구코드 입력 후 **저장 / 불러오기**로 Google Sheets 서버에 인벤토리 백업 및 복원
- 여러 기기에서 동일한 코드로 데이터 공유 가능

### 🔍 보물찾기 예측 (신규)

상단 탭에서 **파밍 효율 도우미 / 보물찾기 예측** 두 기능을 전환합니다.

- 블루아카이브 이벤트의 **9×5 보물찾기 미니게임** 확률 예측기
- 이벤트·회차(case)를 선택하면 해당 회차에 숨겨진 보물(크기·개수)이 표시됨
- 격자의 각 칸을 눌러 **열어본 결과(💎 보물 / ✕ 꽝)**를 기록
- 기록과 모순되지 않는 **모든 배치 조합을 완전 열거**하여 남은 칸마다 보물이 있을 **확률**을 계산
  - 보물은 90도 회전·겹치지 않음 제약을 모두 반영
- 전체 확률이 가장 높은 칸을 **🎯 다음 추천 칸**으로 강조, 히트맵으로 시각화
- 이벤트/회차별 기록은 localStorage에 자동 저장 (탭·선택 상태도 복원)
- 이벤트 데이터는 `predict-data.js`에서 추가·수정 가능
  - 데이터 참고: [alphaorderly/blueaka_game](https://github.com/alphaorderly/blueaka_game) (팬 제작 도구)

---

## 기술 스택

| 구분 | 내용 |
|---|---|
| 호스팅 | GitHub Pages (정적) |
| 프론트엔드 | Vanilla JS + HTML5 Canvas |
| 데이터 저장 | localStorage (로컬) + Google Apps Script (클라우드) |
| 폰트 | Rajdhani, Noto Sans KR (Google Fonts) |

---

## 티스토리 블로그 연동

iframe으로 삽입 시 부모 페이지에 아래 스크립트를 추가하면 콘텐츠 높이에 맞게 자동 조절됩니다.

```html
<iframe src="https://guestghost.github.io/Blue-Archive-Img/" id="ba-frame" style="width:100%;border:none"></iframe>
<script>
window.addEventListener('message', function(e) {
  if (e.data?.type === 'resize') {
    document.getElementById('ba-frame').style.height = e.data.height + 'px';
  }
});
</script>
```
