# Invoice · Receipt · Quote · P&L Generator (정적 웹앱)

프리랜서·1인 사업자를 위한 **영문 인보이스/영수증/견적서 + 손익계산서(P&L) 생성기**입니다.
해외 패시브 부업 2호기(추후 애드센스) 산출물로, `index.html`을 열면 바로 동작합니다.

- **서버·빌드·CDN 없음**: `index.html` + `assets/` + 정적 파일. GitHub Pages 루트에 그대로 올리면 됩니다(`.nojekyll` 포함).
- **100% 클라이언트 사이드**: 입력값·로고 이미지·PDF가 모두 브라우저 메모리 안에서만 처리됩니다. 업로드 엔드포인트가 없고, 네트워크 요청은 페이지 자체 파일(HTML/CSS/JS/폰트)뿐입니다(브라우저 검수에서 확인).
- **금액은 정수 최소단위(센트)로 계산**: 모든 곱셈을 BigInt로 처리하고 반올림은 사사오입(half away from zero). 부동소수점 오차가 없습니다.
- **샘플 자동 로드**: 첫 화면에 실제 인보이스 샘플이 채워져 있어 방문자가 바로 인쇄 결과를 볼 수 있습니다(`SAMPLE DATA` 배지).

## 폴더 구성

```
index.html                    앱 본체 + SEO 정적 콘텐츠(H1·How-to·FAQ 6문항·JSON-LD)
privacy.html                  개인정보처리방침 (애드센스 심사 대비, 연락처 goodday810202@gmail.com)
robots.txt  sitemap.xml       검색엔진 기본 골격 (canonical/sitemap URL: https://marcj81.github.io/invoice-receipt-pl-generator/)
favicon.svg  .nojekyll
assets/
  styles.css                  디자인 시스템(라이트/다크, 반응형, A4/Letter 용지, @media print)
  ledger.js                   계산 엔진(금액·할인·세금·P&L·CSV·JSON) — DOM 의존 없음 → Node 테스트에서 그대로 실행
  app.js                      UI 배선(폼, 품목 행, 미리보기 렌더, 로고, 인쇄, 내보내기, 임시저장)
  fonts/inter-latin*.woff2    Inter 가변 폰트 라틴 서브셋 (SIL OFL, CDN 아님)
test.js                       Node 단위 테스트 57개
uitest.py                     Playwright 실제 Chrome 검수 191항목 + 실제 PDF 검사 + 스크린샷
preview-desktop.png           데스크톱 1280×800 (에디터 + A4 미리보기)
preview-desktop-full.png      데스크톱 전체 페이지
preview-paper.png             문서 용지 확대
preview-print.png             Chrome 인쇄 파이프라인이 만든 실제 A4 PDF 1페이지
preview-receipt.png           RECEIPT(PAID 도장) 화면
preview-pl.png                P&L 화면(지표 4개 + 차트 + 명세서)
preview-pl-chart.png          카테고리별 비용 차트 확대
preview-mobile.png            모바일 390×844 (에디터)
preview-mobile-paper.png      모바일 미리보기(용지 fit)
preview-mobile-full.png       모바일 전체 페이지
preview-dark.png / -pl.png    다크 테마
```

## 기능

### 1) Invoice · Receipt · Quote

- **문서 유형 3종**: 문서 제목이 `INVOICE` / `RECEIPT` / `QUOTE`로 바뀌고, 영수증은 **PAID 도장**과 "Payment date", 견적서는 "Valid until"로 기한 라벨이 바뀝니다.
- **발행자(From) / 고객(Bill to)**: 상호·담당자·이메일·전화·주소(여러 줄)·Tax/VAT ID.
- **로고**: PNG/JPG/SVG/WebP, 최대 1.5MB. `FileReader`로 data URL 변환 후 미리보기·인쇄에 사용하며 `Remove`로 제거.
- **문서 번호·발행일·기한**: 문서 유형에 따라 기한 라벨이 자동 변경.
- **통화 7종**: USD `$`, EUR `€`, GBP `£`, CAD `C$`, AUD `A$`, JPY `¥`, KRW `₩`.
  JPY·KRW는 소수점 없이, 나머지는 소수 2자리와 천 단위 구분으로 표시합니다. 입력값은 **선택한 통화 기준 금액**으로 해석됩니다(예: `4,200` = `$4,200.00` 또는 `¥4,200`).
- **품목 테이블**: 항목명 + 상세 설명 + 수량(소수 3자리) + 단가 → 행 금액 자동 계산, 행 추가/삭제(최소 1행 유지).
- **계산 순서**: 행 금액 → 소계 → 할인(%, 고정금액, 소계 초과 시 소계까지만) → 과세표준 → 세금(과세표준 기준) → 합계 → 기납부금 → 잔액. 모든 단계가 정수 연산입니다.
  할인 33.3333%, 세금 8.875% 같은 값도 0.01 단위에서 사사오입하며, `0.1 + 0.2`가 정확히 `0.30`이 됩니다.
- **입력 검증**: 숫자가 아닌 값("12x", "6o0")이 들어오면 합계 영역 아래에 `Line 2: unit price "6o0" is not a number.` 같은 경고를 띄우고, 그 행은 0으로 계산합니다(조용히 틀린 금액이 나가지 않도록).
- **음수 수량·단가**: `-2`처럼 음수를 넣으면 그 입력란 바로 아래에 `Quantity must be 0 or more — negative numbers are not allowed.`가 뜨고 입력란에 경고 테두리·`aria-invalid`가 붙습니다. 합계는 0으로 보정되며 합계 영역에도 같은 이유가 표시됩니다. 출력물(용지)에는 음수 대신 `0`이 찍힙니다.
- **메모·결제 안내**: 용지 노트와 하단 결제 조건.
- **실시간 A4/Letter 프리뷰**: 화면 폭에 맞춰 자동 축소(scale)되며, 모바일에서는 `Edit | Preview` 전환으로 용지를 크게 봅니다.
- **Print / Save as PDF**: `@media print`에서 헤더·히어로·탭·에디터·버튼·차트·배경을 모두 제거하고 **용지만** 인쇄합니다. `@page` 크기는 선택한 A4/Letter에 맞춰 JS가 주입합니다.
- **샘플 / Clear / Save draft / JSON Export·Import**: JSON은 `{app, version, mode, doc}` 형태로 내보내고, 다시 불러오면 모든 필드가 복원됩니다(외부 파일은 거부). `Save draft`는 `localStorage`에 저장하고, 새로고침하면 `Draft restored` 배지와 함께 복원됩니다.

### 2) Freelancer P&L

- 기간: `This month` / `This quarter` / `This year` / `Custom range` + 시작·종료일 + 기간 라벨.
- 매출 항목, 비용 항목(카테고리 11종 + 항목명 + 금액) 동적 추가/삭제.
- 요약 지표 4개: Gross revenue, Total expenses, **Net profit**(흑자는 초록, 적자는 빨강), Profit margin(1자리 반올림, 매출 0이면 `—`).
- **카테고리별 비용 비중 차트**: 순수 SVG 가로 막대(트랙 + 값 막대 + 라벨 + 금액 + %), 금액 내림차순.
- **CSV 내보내기**: RFC 4180 이스케이프(쉼표·따옴표·줄바꿈), CRLF, Excel용 UTF-8 BOM 옵션(기본 켜짐).
- **인쇄용 명세서**: 매출/비용/순손익 + 이익률이 A4 한 장으로 출력됩니다.

### 3) SEO · 애드센스 심사 대비

- JS 실행 전 HTML에 H1·설명·How it works 3단계·기능 6개·FAQ 6문항이 존재.
- `WebApplication` + `FAQPage` JSON-LD, canonical·OG·Twitter 카드, `robots.txt`, `sitemap.xml`, `favicon.svg`.
- `privacy.html`: 서버 저장 없음, `localStorage` 초안, 향후 광고/쿠키 안내 및 Google Ads Settings 링크.
- 라이트/다크 테마. **인쇄용 용지는 항상 흰 종이 + 검정 잉크**(테마 변수와 분리).

## 검증

```bash
# 1) 계산 엔진 단위 테스트 (Node 20)
/workspace/scratch/node/node-v20.18.0-linux-x64/bin/node test.js
# → 54 passed

# 2) 실제 Chrome 검수 (Playwright, headless)
python3 uitest.py
# → 191 passed, 0 failed
```

`uitest.py`가 확인하는 것:

- 데스크톱 1280×800 / 모바일 390×844에서 샘플 로드, 품목 추가·수정·삭제 시 금액·총액 갱신.
- 통화 전환(EUR/JPY/KRW) 표기, 문서 유형 전환(RECEIPT의 PAID 도장, QUOTE의 Valid until).
- 할인 %/고정, 부가세 라벨·요율, 기납부금, 초과 납부(크레딧 표시).
- 로고 업로드(실제 파일 선택) → 용지에 data URL로 삽입 → 제거.
- P&L 탭 전환, 지표·차트 SVG·적자 색상, CSV 다운로드(BOM on/off), JSON 왕복, 임시저장 복원.
- **실제 PDF 생성 후 검사**(Chrome 인쇄 파이프라인 + PyMuPDF): A4/Letter 용지 크기, 1페이지, 문서 텍스트 포함, 에디터 UI 미포함.
- 레이아웃 겹침 0, 가로 오버플로 0, 콘솔 에러 0, 외부 요청 0.

## 배포 (GitHub Pages)

1. 새 공개 저장소를 만들고 이 폴더의 **내용물**을 루트에 올립니다(또는 `docs/`).
2. Settings → Pages → Branch: `main` / root.
3. 공개 전에 아래 3곳만 실제 값으로 바꾸세요.
   - `index.html`·`privacy.html`의 `canonical`, OG `og:url`
   - `sitemap.xml`, `robots.txt`의 URL
   - `privacy.html`의 연락처 — `goodday810202@gmail.com`으로 설정됨
4. 애드센스 승인 후 `privacy.html`의 "Advertising and cookies" 문단을 실제 사용 여부에 맞게 갱신하고, 광고 스크립트를 넣더라도 문서 데이터는 여전히 로컬에서만 처리됩니다.

## 참고

- 폰트: Inter (SIL Open Font License 1.1), `assets/fonts/`에 자체 호스팅.
- 계산 규칙·반올림 규칙은 `assets/ledger.js` 상단 주석과 `test.js`에 명시되어 있습니다.
- 이 도구는 문서를 만들어 줄 뿐 회계·세무 자문이 아닙니다(페이지 하단 고지).

## 디자인 시스템 — A안 (Crisp Bento SaaS)

2026-11-22 해외 1~3호기 통일 리디자인 적용. 폼·계산·인쇄 파이프라인은 그대로 두고 스킨만 A안 토큰으로 교체했습니다.
용지(paper)는 두 테마 모두 흰색을 유지하며, 문서의 액센트도 같은 코발트로 맞췄습니다.

| 토큰 | 값 |
| --- | --- |
| 바탕 / 표면 | `#FAFAFA` / `#FFFFFF` |
| 헤어라인 | 1px `#E7E8EA` (강조 `#D7D9DD`) |
| 타일 라운드 | 16px (버튼 12px, 필 999px) |
| 잉크 | `#0C0D0F` (보조 `#3C4045`, 뮤트 `#6B7076`) |
| 액센트 | 코발트 `#2F5BFF` 단일 (hover `#2445C9`, soft `#EEF2FF`) |
| 헤드라인 | 산세리프 800, 자간 -0.04em |
| 상태색 | 성공 `#0B7A55` · 주의 `#A9550A` · 오류 `#B4211C` — 의미 전달에만 사용 |
| 다크 | 바탕 `#0A0B0D` · 표면 `#121317` · 라인 `#24262B` · 액센트 `#8AA4FF` |

- 대비 4.5:1 이상: 라이트·다크 × 데스크톱/모바일/개인정보 페이지 실측 미달 0건(용지 라벨 포함).
- 폰트는 자체 호스팅 Inter 그대로(외부 요청 0건).


## Second upgrade (2026-11-23)

### Real PDF files — `assets/pdf-export.js` (jsPDF 4.2.1 + AutoTable 5.0.9, MIT)
- **Download PDF** builds a fixed A4/Letter file with fixed margins and page breaks, instead of relying on the browser print dialog.
- Amounts come from `ledger.js` (integer minor units, BigInt). The PDF only formats them, so the printed total always matches the on-screen total.
- Document: header, from/bill-to blocks, item table, subtotal/discount/tax/total/paid/balance rows, notes and page numbers.
- Covers invoice, receipt and quote, plus the P&L statement (revenue table, expense table, net profit / margin / expense ratio).

### Excel export — `assets/xlsx-export.js` (SheetJS 0.18.5, Apache-2.0)
- Invoice: `Document` + `Items` sheets. P&L: `Summary` + `Revenue` + `Expenses` sheets.
- Amounts are written as **numbers**, not text, so spreadsheet totals work.
- Both libraries load only when a button is pressed (first paint unchanged).

### Verification
- `node test.js` 57 checks · real Chrome export test (PDF text/amounts, workbook sheet names and numeric cells).
