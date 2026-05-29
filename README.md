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
