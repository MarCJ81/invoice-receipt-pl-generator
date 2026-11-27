/* ==========================================================================
   Invoice · Receipt · Quote · P&L Generator · KO / EN runtime
   English is the default in the markup; this file adds Korean.
   - Language choice: ?lang=ko|en → localStorage('onetap_lang') → navigator.language
   - Static text is translated by exact match on the text node, so the markup
     stays readable and no string is duplicated.
   - Dynamic strings call t('english') from app.js / ics-core.js.
   - Elements holding inline markup get a data-ko-html="…" attribute.
   ========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'onetap_lang';
  var DEFAULT_LANG = 'en';
  var OTHER_LANG = 'ko';

  var DICT = {
    /* ---- shell / head ---- */
    'Free Invoice, Receipt & P&L Generator — Print or Save as PDF': '무료 인보이스·영수증·손익계산서 생성기 — 인쇄하거나 PDF로 저장',
    'Skip to the generator': '생성기로 바로 가기',
    'Invoice & P&L': '인보이스·손익',
    'Generator': '생성기',
    'How it works': '쓰는 방법',
    'Features': '기능',
    'Free · No sign-up · Nothing uploaded': '무료 · 가입 없음 · 업로드 없음',
    'Free invoice, receipt & profit-and-loss generator': '무료 인보이스·영수증·손익계산서 생성기',
    'Fill in one form and watch a real A4 page build itself: invoice, paid receipt, quote or a freelancer P&L statement. Amounts, discounts, tax and margins are worked out to the cent, and': '한 장의 입력 폼만 채우면 실제 A4 문서가 만들어집니다. 인보이스, 결제 완료 영수증, 견적서, 프리랜서 손익계산서까지. 금액·할인·세금·마진은 센트 단위로 계산되고,',
    'Print / Save as PDF': '인쇄 / PDF 저장',
    'gives you a clean file with no watermark.': '를 누르면 워터마크 없는 깨끗한 파일이 나옵니다.',
    '100% in your browser': '100% 브라우저에서',
    '7 currencies': '통화 7종',
    'A4 & Letter': 'A4 · Letter',
    'Print-ready PDF': '바로 인쇄하는 PDF',
    'PAID': '결제 완료',
    'Invoice · Receipt · Quote': '인보이스 · 영수증 · 견적서',
    'Freelancer P&L': '프리랜서 손익',
    'Sample data': '예시 데이터',
    'Draft restored': '임시저장 복원됨',
    'Edit': '편집',
    'Preview': '미리보기',
    'Document': '문서',
    'Invoice': '인보이스',
    'Receipt': '영수증',
    'Quote': '견적서',
    'Currency': '통화',
    '$ USD — US dollar': '$ USD — 미국 달러',
    '€ EUR — Euro': '€ EUR — 유로',
    '£ GBP — British pound': '£ GBP — 영국 파운드',
    'C$ CAD — Canadian dollar': 'C$ CAD — 캐나다 달러',
    'A$ AUD — Australian dollar': 'A$ AUD — 호주 달러',
    '¥ JPY — Japanese yen': '¥ JPY — 일본 엔',
    '₩ KRW — Korean won': '₩ KRW — 대한민국 원',
    'Paper size': '용지 크기',
    'A4 — 210 × 297 mm': 'A4 — 210 × 297 mm',
    'Letter — 8.5 × 11 in': 'Letter — 8.5 × 11 in',
    'Document number': '문서 번호',
    'Issue date': '발행일',
    'Due date': '납기일',
    'Logo': '로고',
    'PNG, JPG or SVG': 'PNG, JPG, SVG',
    'Choose image': '이미지 선택',
    'Replace': '바꾸기',
    'Remove': '삭제',
    'From': '공급자',
    'Business or your name': '상호 또는 이름',
    'Email': '이메일',
    'Phone': '전화',
    'Tax / VAT ID': '사업자·부가세 번호',
    'optional': '선택',
    'Address': '주소',
    'Bill to': '받는 곳',
    'Client or company': '고객사 또는 회사',
    'Contact person': '담당자',
    'Line items': '품목',
    'Description': '품목명',
    'Qty': '수량',
    'Unit price': '단가',
    'Amount': '금액',
    '+ Add line item': '+ 품목 추가',
    'Amounts update as you type.': '입력하는 즉시 금액이 계산됩니다.',
    'Discount, tax & payment': '할인·세금·결제',
    'Discount': '할인',
    'None': '없음',
    'Percentage': '비율',
    'Fixed amount': '정액',
    'Discount value': '할인 값',
    'Amount paid': '결제한 금액',
    'Tax label': '세금 항목명',
    'Tax rate': '세율',
    'Notes': '메모',
    'Note to the client': '고객에게 남길 메모',
    'Payment terms': '결제 조건',
    'Download PDF': 'PDF 내려받기',
    'Download Excel': 'Excel 내려받기',
    'Load sample': '예시 불러오기',
    'Save draft': '임시저장',
    'Export JSON': 'JSON 내보내기',
    'Import JSON': 'JSON 가져오기',
    'Clear': '지우기',
    'Total': '합계',
    'Balance due': '청구 잔액',
    'A4 · 210 × 297 mm': 'A4 · 210 × 297 mm',
    'Print / PDF': '인쇄 / PDF',
    'Print or save as PDF': '인쇄하거나 PDF로 저장',
    'One click opens the browser\'s print dialog. Choose "Save as PDF" and you get a clean page with no buttons, ads or watermark on it.':
      '한 번 누르면 브라우저 인쇄 창이 열립니다. "PDF로 저장"을 고르면 버튼도 광고도 워터마크도 없는 깨끗한 페이지가 나옵니다.',
    'Printing keeps only this page — the editor, navigation and page background are dropped automatically.': '인쇄할 때는 이 문서만 남습니다. 편집 화면·메뉴·배경은 자동으로 빠집니다.',
    'Gross revenue': '총매출',
    'Total expenses': '총비용',
    'Net profit': '순이익',
    'Profit margin': '이익률',
    'Statement': '손익계산서',
    'Business name': '상호',
    'Period': '기간',
    'This month': '이번 달',
    'This quarter': '이번 분기',
    'This year': '올해',
    'Custom range': '직접 지정',
    'Period label': '기간 표기',
    'Start date': '시작일',
    'End date': '종료일',
    'Revenue': '매출',
    '+ Add revenue line': '+ 매출 항목 추가',
    'Expenses': '비용',
    '+ Add expense': '+ 비용 추가',
    'Download CSV': 'CSV 내려받기',
    'Excel BOM': 'Excel BOM',
    'Expenses by category': '분류별 비용',
    '0 categories': '0개 분류',
    'Add an expense to see where the money goes.': '비용을 넣으면 어디에 돈이 나가는지 보입니다.',
    'Statement preview': '손익 미리보기',
    'Three steps, no account.': '세 단계면 됩니다. 가입은 필요 없습니다.',
    'Pick the document': '문서 고르기',
    'Invoice for work you are billing, receipt for money already received, quote for work you are proposing, or a P&L statement for your books.': '청구할 일에는 인보이스, 이미 받은 돈에는 영수증, 제안할 일에는 견적서, 장부에는 손익계산서를 고르세요.',
    'Type the details': '내용 입력하기',
    "Your details, the client's, the line items and any discount or tax. The page on the right updates on every keystroke, in the currency you choose.": '내 정보와 고객 정보, 품목, 할인·세금을 적습니다. 오른쪽 문서는 키를 누를 때마다 고른 통화로 다시 계산됩니다.',
    'One click opens the browser\'s print dialog. Choose "Save as PDF" and you get a clean page with no buttons, ads or watermark on it.': '한 번 누르면 브라우저 인쇄 창이 열립니다. "PDF로 저장"을 고르면 버튼도 광고도 워터마크도 없는 깨끗한 페이지가 나옵니다.',
    'What you can make': '무엇을 만들 수 있나',
    'Built for freelancers, contractors and one-person studios.': '프리랜서, 외주 개발자, 1인 스튜디오를 위해 만들었습니다.',
    'Invoice with a balance due': '잔액이 남는 인보이스',
    'Subtotal, discount, tax and an amount already paid roll up into the exact figure still owed — with correct rounding even on fractional hours.': '소계·할인·세금·기결제액을 모두 반영해 아직 받을 금액을 정확히 계산합니다. 시간 단위 소수점도 반올림이 어긋나지 않습니다.',
    'Paid receipt': '결제 완료 영수증',
    'Switch the document type and the page becomes a receipt with a PAID stamp and the payment date, ready to hand over.': '문서 종류만 바꾸면 결제 완료 도장과 결제일이 찍힌 영수증이 되어 바로 건넬 수 있습니다.',
    'Quote with a validity date': '유효기간이 있는 견적서',
    'Send a priced proposal that shows how long the offer stands, using the same items and tax rules as your invoices.': '같은 품목과 세금 규칙으로, 제안이 언제까지 유효한지 표시된 견적을 보냅니다.',
    'List revenue and categorised expenses for a month, quarter or year. Net profit and margin are computed for you, and a loss is shown in red.': '월·분기·연 단위로 매출과 분류별 비용을 나열합니다. 순이익과 이익률은 자동 계산되고, 손실은 빨간색으로 표시됩니다.',
    'Category chart and CSV': '분류 차트와 CSV',
    'See which expense category takes the biggest bite, then download the whole statement as CSV for your spreadsheet or accountant.': '어느 비용 분류가 가장 큰지 한눈에 보고, 손익계산서 전체를 CSV로 내려받아 스프레드시트나 세무사에게 넘기세요.',
    'Reuse it next month': '다음 달에 다시 쓰기',
    'Export the document as JSON, import it later, change the dates and figures, and print again. Nothing to retype, nothing to sign up for.': '문서를 JSON으로 내보냈다가 다음에 다시 불러와 날짜와 금액만 고쳐 인쇄하세요. 다시 입력할 것도, 가입할 것도 없습니다.',
    'Frequently asked questions': '자주 묻는 질문',
    'Is this invoice generator really free?': '이 인보이스 생성기는 정말 무료인가요?',
    'Yes. Every feature on this page is free and there is no account, no trial and no watermark on the printed document. The page is funded by advertising, so no payment details are ever requested.': '네. 이 페이지의 모든 기능이 무료이고, 계정도 체험 기간도 없으며 인쇄물에 워터마크도 없습니다. 페이지 운영은 광고로 충당하므로 결제 정보를 요구하지 않습니다.',
    'Where does my invoice data go?': '인보이스 데이터는 어디로 가나요?',
    "Nowhere. The form, the logo image and the PDF all stay in your browser's memory. Nothing is uploaded, there is no server behind the tool, and you can keep working with the network offline once the page has loaded.": '어디로도 가지 않습니다. 입력 내용, 로고 이미지, PDF 모두 브라우저 메모리 안에만 있습니다. 업로드하지 않고 이 도구 뒤에 서버도 없으며, 페이지를 한 번 열면 인터넷이 끊겨도 계속 쓸 수 있습니다.',
    'How do I save the invoice as a PDF?': '인보이스를 PDF로 어떻게 저장하나요?',
    'Press': '누르고',
    'and choose "Save as PDF" as the printer. The print stylesheet removes the editor, buttons, navigation and background so only the document page is printed, in A4 or Letter as selected.': '를 고른 뒤 인쇄 대상을 "PDF로 저장"으로 선택하세요. 인쇄용 스타일이 편집기·버튼·메뉴·배경을 빼서 문서 페이지만, 고른 A4 또는 Letter 크기로 인쇄됩니다.',
    'Does it support tax, VAT and discounts?': '세금, 부가세, 할인을 지원하나요?',
    'Yes. You can apply a percentage or a fixed discount, add a tax or VAT rate with your own label, and record an amount already paid. Tax is calculated on the discounted subtotal and the remaining balance is shown on the document.': '지원합니다. 비율 할인이나 정액 할인을 적용하고, 원하는 이름으로 세금·부가세율을 넣고, 이미 받은 금액을 기록할 수 있습니다. 세금은 할인 후 소계에 대해 계산하고, 남은 잔액은 문서에 표시됩니다.',
    'Which currencies can I use?': '어떤 통화를 쓸 수 있나요?',
    'US dollars, euros, pounds sterling, Canadian dollars, Australian dollars, Japanese yen and Korean won. Yen and won are shown without decimals and all other currencies with two, using correct thousands separators.': '미국 달러, 유로, 영국 파운드, 캐나다 달러, 호주 달러, 일본 엔, 대한민국 원입니다. 엔과 원은 소수점 없이, 나머지는 소수점 두 자리로 표시하며 천 단위 구분도 정확합니다.',
    'Can I reuse an invoice next month?': '다음 달에 같은 인보이스를 다시 쓸 수 있나요?',
    'Yes. Export JSON keeps every field, so you can import the file later, change the dates and amounts, and print again. Save draft stores the same data in your own browser so the form is still filled when you come back.': '됩니다. JSON 내보내기는 모든 항목을 담아 두므로 나중에 불러와 날짜와 금액만 바꿔 다시 인쇄할 수 있습니다. 임시저장은 같은 데이터를 브라우저에 보관해 두었다가 다시 열었을 때 그대로 채워 줍니다.',
    'This tool produces a document; it is not accounting, tax or legal advice. Tax rules, invoice requirements and retention periods differ by country — check what applies to you before sending.': '이 도구는 문서를 만들어 줄 뿐, 회계·세무·법률 자문이 아닙니다. 세금 규칙, 인보이스 기재 요건, 보관 기간은 나라마다 다르니 보내기 전에 해당 규정을 확인하세요.',
    'Invoice & P&L Generator — a small, free tool that runs entirely in your browser.': '인보이스·손익 생성기 — 브라우저 안에서만 도는 작고 무료인 도구입니다.',
    'Privacy': '개인정보',
    'This generator needs JavaScript. Nothing would be uploaded in any case — all of the work happens on your device.': '이 생성기는 JavaScript가 필요합니다. 어느 경우에도 업로드하지 않습니다. 모든 작업은 기기 안에서 일어납니다.',

    /* ---- generated document labels ---- */
    'INVOICE': '인보이스',
    'RECEIPT': '영수증',
    'QUOTE': '견적서',
    'Payment date': '결제일',
    'Valid until': '유효기간',
    'Total paid': '결제 금액',
    'Quote total': '견적 합계',
    'Amount due': '청구 금액',
    'Subtotal': '소계',
    'Tax': '세금',
    'Tax ID: ': '사업자번호: ',
    'Your business': '상호를 입력하세요',
    'Your client': '고객명을 입력하세요',
    'No line items yet — add one on the left.': '아직 품목이 없습니다. 왼쪽에서 추가하세요.',
    'Credit': '남은 금액',
    'Profit & Loss Statement': '손익계산서',
    'Statement period': '손익 기간',
    'No revenue recorded': '매출이 없습니다',
    'No expenses recorded': '비용이 없습니다',
    'Net loss': '순손실',
    'Prepared from the figures entered in this statement. Not a substitute for accounting or tax advice.': '이 손익계산서에 입력한 숫자로 작성했습니다. 회계·세무 자문을 대신하지 않습니다.',
    'Description ': '품목명 ',
    'Item description / ': '품목명 / ',
    'Expenses by category, largest first': '분류별 비용, 큰 순서',

    'Letter — 8.5 × 11 in': 'Letter — 8.5 × 11 in',
    'PNG, JPG, SVG': 'PNG, JPG, SVG',
    'Hardware & equipment': '하드웨어·장비',
    'Software & subscriptions': '소프트웨어·구독',
    'Contractors & freelancers': '외주·프리랜서',
    'Marketing & advertising': '마케팅·광고',
    'Travel & meals': '출장·식비',
    'Office & coworking': '사무실·공유오피스',
    'Education & training': '교육·훈련',
    'Banking & payment fees': '은행·결제 수수료',
    'Insurance': '보험',
    'Taxes & licences': '세금·라이선스',
    'Rent & utilities': '임대료·공과금',
    'Other': '기타',

    /* ---- app toasts / warnings / aria ---- */
    'Switch to light theme': '밝은 테마로 바꾸기',
    'Switch to dark theme': '어두운 테마로 바꾸기',
    'Draft saved in this browser': '이 브라우저에 임시저장했습니다',
    'This browser refused to store the draft': '브라우저가 임시저장을 거부했습니다',
    'Use a PNG, JPG, SVG or WebP image': 'PNG, JPG, SVG, WebP 이미지를 써 주세요',
    'That image is larger than 1.5 MB': '이미지가 1.5MB를 넘습니다',
    'The image could not be read': '이미지를 읽지 못했습니다',
    'PDF engine is not loaded': 'PDF 엔진을 불러오지 못했습니다',
    'Building PDF…': 'PDF 만드는 중…',
    'PDF downloaded · ': 'PDF 내려받음 · ',
    ' page(s)': '쪽',
    'PDF failed': 'PDF 생성 실패',
    'Excel engine is not loaded': 'Excel 엔진을 불러오지 못했습니다',
    'Building Excel…': 'Excel 만드는 중…',
    'Excel downloaded · ': 'Excel 내려받음 · ',
    'Excel failed': 'Excel 생성 실패',
    'Sample invoice loaded': '예시 인보이스를 불러왔습니다',
    'Form cleared': '입력을 지웠습니다',
    'JSON exported': 'JSON을 내보냈습니다',
    'That file is not valid JSON': '올바른 JSON 파일이 아닙니다',
    'That file could not be imported': '이 파일을 가져오지 못했습니다',
    'Imported ': '가져옴: ',
    'The file could not be read': '파일을 읽지 못했습니다',
    'CSV downloaded': 'CSV를 내려받았습니다',
    'Sample statement loaded': '예시 손익을 불러왔습니다',
    'Statement cleared': '손익 항목을 지웠습니다',
    'Quantity must be 0 or more — negative numbers are not allowed.': '수량은 0 이상이어야 합니다. 음수는 쓸 수 없습니다.',
    'Unit price must be 0 or more — negative numbers are not allowed.': '단가는 0 이상이어야 합니다. 음수는 쓸 수 없습니다.',
    'Enter 0 or more in the highlighted fields — negative values are counted as 0.': '표시된 칸에 0 이상을 넣어 주세요. 음수는 0으로 계산됩니다.',
    'Item description': '품목명',
    'Item detail': '품목 상세',
    'Quantity': '수량',
    'Remove item': '품목 삭제',
    'Revenue line': '매출 항목',
    'Expense line': '비용 항목',
    'Expense category': '비용 분류',
    'Revenue amount': '매출 금액',
    'Expense amount': '비용 금액',
    'Remove revenue line': '매출 항목 삭제',
    'Remove expense': '비용 삭제',
    'Other': '기타',
    'Software & subscriptions': '소프트웨어·구독',
    'Category': '분류',
    'categories': '개 분류',
    ' category': '개 분류'
  };

  var META = {
    ko: {
      title: '무료 인보이스·영수증·손익계산서 생성기 — 인쇄하거나 PDF로 저장',
      description: '브라우저에서 인보이스, 영수증, 견적서, 프리랜서 손익계산서를 만듭니다. 실시간 A4 미리보기, 통화 7종, 세금·할인 계산, 인쇄나 PDF 저장까지. 가입 없이 업로드 없이.',
      ogTitle: '무료 인보이스·영수증·손익계산서 생성기',
      ogDescription: '실시간 A4 미리보기로 인보이스, 영수증, 견적서, 손익계산서를 만들고 인쇄하거나 PDF로 저장하세요. 모든 처리는 브라우저 안에서 끝납니다.'
    }
  };

  /* Keys are matched on whitespace-collapsed text, so store them that way. */
  var DICT_NORM = {};
  Object.keys(DICT).forEach(function (k) {
    var nk = String(k).replace(/\s+/g, ' ').trim();
    if (DICT_NORM[nk] == null) DICT_NORM[nk] = DICT[k];
  });

  var current = DEFAULT_LANG;
  var textOrig = new Map();
  var attrOrig = new WeakMap();
  var htmlOrig = new Map();
  var metaOrig = null;

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function isOther() { return current === OTHER_LANG; }

  function detect() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'ko' || q === 'en') return q;
    } catch (e) { /* older engines */ }
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved === 'ko' || saved === 'en') return saved;
    } catch (e) { /* private mode */ }
    var nav = navigator.language || navigator.userLanguage || '';
    return /^ko/i.test(nav) ? 'ko' : 'en';
  }

  function t(en) {
    if (isOther() && en != null) {
      var key = norm(en);
      if (DICT_NORM[key] != null) return DICT_NORM[key];
    }
    return en;
  }

  function L(en, ko) { return isOther() ? ko : en; }

  function textNodes(root) {
    var out = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        if (p === 'SCRIPT' || p === 'STYLE' || p === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

  function translateTextNode(node) {
    var orig = textOrig.get(node);
    if (orig == null) {
      if (!isOther()) return;
      orig = node.nodeValue;
      textOrig.set(node, orig);
    }
    var key = norm(orig);
    var tr = (isOther() && key) ? DICT_NORM[key] : null;
    if (tr == null && isOther() && /^[·\u00b7]\s/.test(key)) {
      var tail = key.replace(/^[·\u00b7]\s/, '');
      if (DICT_NORM[tail] != null) tr = key.slice(0, key.length - tail.length) + DICT_NORM[tail];
    }
    if (tr != null) {
      var lead = (orig.match(/^\s*/) || [''])[0];
      var trail = (orig.match(/\s*$/) || [''])[0];
      node.nodeValue = lead + tr + trail;
    } else {
      node.nodeValue = orig;
    }
  }

  function translateAttrs(el) {
    var rec = attrOrig.get(el);
    ATTRS.forEach(function (attr) {
      var val = el.getAttribute(attr);
      if (val == null) return;
      if (!rec) { rec = {}; attrOrig.set(el, rec); }
      if (!(attr in rec)) {
        if (!isOther()) return;
        rec[attr] = val;
      }
      var orig = rec[attr];
      var tr = isOther() ? DICT_NORM[norm(orig)] : null;
      el.setAttribute(attr, tr != null ? tr : orig);
    });
  }

  /* Translate one subtree. Used for the first paint and for markup that the
     app writes later (documents, table rows, dialogs). */
  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { translateTextNode(root); return; }
    if (root.nodeType !== 1) return;
    if (root.hasAttribute && root.hasAttribute('data-ko-html')) {
      if (!htmlOrig.has(root)) htmlOrig.set(root, root.innerHTML);
      root.innerHTML = isOther() ? root.getAttribute('data-ko-html') : htmlOrig.get(root);
      return;
    }
    textNodes(root).forEach(translateTextNode);
    if (root.nodeType === 1) translateAttrs(root);
    Array.prototype.slice.call(root.querySelectorAll('body *')).forEach(translateAttrs);
  }

  var observer = null;
  var muting = false;
  function watch() {
    if (observer || !window.MutationObserver || !isOther()) return;
    observer = new MutationObserver(function (records) {
      if (muting) return;
      muting = true;
      try {
        records.forEach(function (rec) {
          Array.prototype.slice.call(rec.addedNodes || []).forEach(function (n) {
            if (n.nodeType === 1 || n.nodeType === 3) translateTree(n);
          });
        });
      } finally { muting = false; }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function applyDom() {
    textNodes(document.body).forEach(translateTextNode);
    Array.prototype.slice.call(document.querySelectorAll('[data-ko-html]')).forEach(translateTree);
    Array.prototype.slice.call(document.querySelectorAll('body *')).forEach(translateAttrs);
    if (isOther()) watch();
  }

  function setMeta(attr, name, value) {
    var el = document.querySelector('meta[' + attr + '="' + name + '"]');
    if (el) el.setAttribute('content', value);
  }

  function applyMeta() {
    if (!metaOrig) {
      metaOrig = {
        title: document.title,
        description: (document.querySelector('meta[name="description"]') || {}).content || '',
        ogTitle: (document.querySelector('meta[property="og:title"]') || {}).content || '',
        ogDescription: (document.querySelector('meta[property="og:description"]') || {}).content || ''
      };
    }
    var pack = isOther() ? META[OTHER_LANG] : null;
    document.title = pack ? pack.title : metaOrig.title;
    setMeta('name', 'description', pack ? pack.description : metaOrig.description);
    setMeta('property', 'og:title', pack ? pack.ogTitle : metaOrig.ogTitle);
    setMeta('property', 'og:description', pack ? pack.ogDescription : metaOrig.ogDescription);
  }

  function paintButtons() {
    Array.prototype.slice.call(document.querySelectorAll('[data-lang]')).forEach(function (b) {
      var on = b.getAttribute('data-lang') === current;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function apply(lang) {
    current = (lang === 'ko' || lang === 'en') ? lang : DEFAULT_LANG;
    document.documentElement.lang = current;
    applyMeta();
    applyDom();
    paintButtons();
  }

  function set(lang) {
    if (lang !== 'ko' && lang !== 'en') return;
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* private mode */ }
    apply(lang);
    bind();
    fireLang();
  }

  function bind() {
    Array.prototype.slice.call(document.querySelectorAll('[data-lang]')).forEach(function (b) {
      if (b.getAttribute('data-bound') === '1') return;
      b.setAttribute('data-bound', '1');
      b.addEventListener('click', function () { set(b.getAttribute('data-lang')); });
    });
  }

  /* Apps that build text in JS render before this file boots; tell them once
     so their first paint matches the chosen language. */
  function fireLang() {
    try {
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: current } }));
    } catch (e) { /* older engines */ }
  }

  function boot() {
    apply(detect());
    bind();
    fireLang();
  }

  window.OneTapLang = {
    detect: detect,
    current: function () { return current; },
    set: set,
    apply: apply,
    bind: bind,
    t: t,
    L: L,
    translate: translateTree,
    isKo: function () { return isOther(); }
  };
  window.t = t;
  window.L = L;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
