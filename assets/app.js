/* ==========================================================================
   Invoice · Receipt · Quote · P&L Generator — UI
   Reads and writes only what is on this page. No network calls, ever.
   ========================================================================== */
(function () {
  'use strict';

  var L = window.Ledger;
  var STORE_KEY = 'invoice-pl:draft:v1';
  var THEME_KEY = 'invoice-pl:theme';
  var MAX_LOGO_BYTES = 1.5 * 1024 * 1024;

  var state = {
    doc: L.sampleDoc(),
    pl: L.samplePnL(),
    plLabelAuto: true,
    draftRestored: false
  };

  /* ------------------------------------------------------------- helpers */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (c) {
      return ESCAPES[c];
    });
  }

  function getPath(obj, path) {
    return path.split('.').reduce(function (acc, key) {
      return acc && typeof acc === 'object' ? acc[key] : undefined;
    }, obj);
  }

  function setPath(obj, path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var target = keys.reduce(function (acc, key) {
      if (!acc[key] || typeof acc[key] !== 'object') acc[key] = {};
      return acc[key];
    }, obj);
    target[last] = value;
  }

  var toastTimer = null;
  function toast(message) {
    var el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      link.remove();
    }, 500);
  }

  function safeFilename(base) {
    return String(base || 'document').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document';
  }

  /* ---------------------------------------------------------------- theme */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = $('#theme-toggle');
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* private mode */ }
    if (saved !== 'light' && saved !== 'dark') {
      saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(saved);
  }

  /* ------------------------------------------------------------ paper fit */

  function fitPaper(stage) {
    var paper = $('.paper', stage);
    if (!paper) return;
    var width = stage.clientWidth;
    if (!width) return;
    var natural = paper.offsetWidth;
    var scale = Math.min(1, width / natural);
    paper.style.setProperty('--scale', String(scale));
    stage.style.height = Math.round(paper.offsetHeight * scale) + 'px';
  }

  function fitAllPapers() {
    $$('.paper-stage').forEach(fitPaper);
  }

  /* ------------------------------------------------------- doc form sync */

  function dueLabelFor(kind) {
    return kind === 'RECEIPT' ? 'Payment date' : kind === 'QUOTE' ? 'Valid until' : 'Due date';
  }

  function syncDocForm() {
    var doc = state.doc;
    $$('#doc-form [data-model]').forEach(function (input) {
      var value = getPath(doc, input.getAttribute('data-model'));
      input.value = value === undefined || value === null ? '' : value;
    });
    $$('#doc-kind button').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-kind') === doc.kind);
    });
    $('#due-label').textContent = dueLabelFor(doc.kind);
    var affix = $('#discount-affix');
    var discountInput = $('#discount-value');
    var mode = doc.discount.mode;
    discountInput.disabled = mode === 'none';
    affix.textContent = mode === 'fixed' ? L.CURRENCIES[doc.currency].symbol : '%';
    $('[data-currency-affix]').textContent = L.CURRENCIES[doc.currency].symbol;
    renderLogo();
  }

  /* --------------------------------------------------------------- items */

  function itemRow(item, index, count) {
    var cur = state.doc.currency;
    var totals = L.computeTotals({ currency: cur, items: [item] });
    return '' +
      '<div class="item-row" data-idx="' + index + '">' +
        '<div class="item-desc">' +
          '<input class="inp desc" type="text" data-item="description" aria-label="Item description ' + (index + 1) + '" placeholder="Design work" value="' + esc(item.description) + '">' +
          '<input class="inp details" type="text" data-item="details" aria-label="Item detail ' + (index + 1) + '" placeholder="Optional description" value="' + esc(item.details) + '">' +
        '</div>' +
        '<span class="item-cell"><span class="cell-cap">Qty</span>' +
          '<input class="inp num" type="text" inputmode="decimal" data-item="quantity" aria-label="Quantity ' + (index + 1) + '" aria-describedby="item-warn-' + index + '" placeholder="1" value="' + esc(item.quantity) + '"></span>' +
        '<span class="item-cell"><span class="cell-cap">Unit price</span>' +
          '<input class="inp num" type="text" inputmode="decimal" data-item="unitPrice" aria-label="Unit price ' + (index + 1) + '" aria-describedby="item-warn-' + index + '" placeholder="0.00" value="' + esc(item.unitPrice) + '"></span>' +
        '<span class="item-amount" data-amount="' + index + '">' + L.formatMoney(totals.lines[0] ? totals.lines[0].amount : 0, cur) + '</span>' +
        '<button type="button" class="item-del" data-del-item="' + index + '" aria-label="Remove item ' + (index + 1) + '"' + (count <= 1 ? ' disabled' : '') + '>&times;</button>' +
        '<p class="item-warn" id="item-warn-' + index + '" data-item-warn="' + index + '" aria-live="polite" hidden></p>' +
      '</div>';
  }

  function renderItems() {
    var body = $('#items-body');
    body.innerHTML = state.doc.items.map(function (item, index) {
      return itemRow(item, index, state.doc.items.length);
    }).join('');
    updateItemWarnings();
  }

  /* --------------------------------------------------- negative input guard */

  var ITEMS_HINT = 'Amounts update as you type.';

  function itemWarningText(field) {
    return field === 'quantity'
      ? 'Quantity must be 0 or more — negative numbers are not allowed.'
      : 'Unit price must be 0 or more — negative numbers are not allowed.';
  }

  /** Qty·unit price의 음수를 행 단위로 모아 바로 아래에 안내한다. */
  function updateItemWarnings() {
    var count = 0;
    $$('#items-body .item-row').forEach(function (row) {
      var messages = [];
      $$('[data-item]', row).forEach(function (input) {
        var field = input.getAttribute('data-item');
        if (field !== 'quantity' && field !== 'unitPrice') return;
        var bad = L.isNegativeNumber(input.value);
        input.setAttribute('aria-invalid', bad ? 'true' : 'false');
        input.classList.toggle('is-invalid', bad);
        if (bad) {
          count += 1;
          messages.push(itemWarningText(field));
        }
      });
      var warn = $('[data-item-warn]', row);
      if (warn) {
        warn.hidden = !messages.length;
        warn.textContent = messages.join(' ');
      }
    });
    var hint = $('#items-hint');
    if (hint) {
      hint.classList.toggle('is-warn', count > 0);
      hint.textContent = count
        ? 'Enter 0 or more in the highlighted fields — negative values are counted as 0.'
        : ITEMS_HINT;
    }
    return count;
  }

  function updateItemAmounts() {
    var totals = L.computeTotals(state.doc);
    $$('#items-body .item-amount').forEach(function (el) {
      var idx = Number(el.getAttribute('data-amount'));
      var line = totals.lines[idx];
      el.textContent = L.formatMoney(line ? line.amount : 0, state.doc.currency);
    });
  }

  /* ---------------------------------------------------------------- logo */

  function renderLogo() {
    var pick = $('.logo-pick');
    var label = $('.logo-pick span');
    var remove = $('#logo-clear');
    var existing = $('img', pick);
    if (state.doc.logo) {
      if (!existing) {
        existing = document.createElement('img');
        existing.alt = '';
        pick.insertBefore(existing, label);
      }
      existing.src = state.doc.logo;
      label.textContent = 'Replace';
      pick.classList.add('has-logo');
      remove.hidden = false;
    } else {
      if (existing) existing.remove();
      label.textContent = 'Choose image';
      pick.classList.remove('has-logo');
      remove.hidden = true;
      $('#logo-input').value = '';
    }
  }

  /* --------------------------------------------------------- document paper */

  function addressBlock(address) {
    var text = String(address || '').trim();
    if (!text) return '';
    return '<div class="p-lines">' + esc(text) + '</div>';
  }

  function docPaperMarkup() {
    var doc = state.doc;
    var totals = L.computeTotals(doc);
    var cur = doc.currency;
    var money = function (v) { return L.formatMoney(v, cur); };
    var kind = doc.kind;
    var title = kind === 'RECEIPT' ? 'RECEIPT' : kind === 'QUOTE' ? 'QUOTE' : 'INVOICE';
    var metaDateLabel = dueLabelFor(kind);
    var dueCaption = kind === 'RECEIPT' ? 'Total paid' : kind === 'QUOTE' ? 'Quote total' : 'Amount due';
    var dueValue = kind === 'INVOICE' ? totals.balance : totals.total;
    var from = doc.from;
    var bill = doc.billTo;

    var fromLines = [];
    if (from.email) fromLines.push('<a href="mailto:' + esc(from.email) + '">' + esc(from.email) + '</a>');
    if (from.phone) fromLines.push(esc(from.phone));
    var fromMeta = fromLines.length ? '<div class="p-lines">' + fromLines.join(' &nbsp;·&nbsp; ') + '</div>' : '';

    var visibleItems = doc.items.filter(function (item, index) {
      return String(item.description || '').trim() !== '' || String(item.unitPrice || '').trim() !== '' ||
        (totals.lines[index] && totals.lines[index].amount !== 0);
    });

    var itemRows = visibleItems.map(function (item) {
      var index = doc.items.indexOf(item);
      var line = totals.lines[index] || { amount: 0 };
      var qty = item.quantity ? esc(item.quantity) : '';
      var price = String(item.unitPrice || '').trim() === '' ? '' : money(line.unitPrice);
      return '<tr>' +
        '<td><span class="it-name">' + esc(item.description) + '</span>' +
        (item.details ? '<span class="it-detail">' + esc(item.details) + '</span>' : '') + '</td>' +
        '<td class="num">' + qty + '</td>' +
        '<td class="num">' + price + '</td>' +
        '<td class="num it-amount">' + money(line.amount) + '</td>' +
      '</tr>';
    }).join('');

    var totalRows = '';
    totalRows += '<tr class="sub"><th>Subtotal</th><td>' + money(totals.subtotal) + '</td></tr>';
    if (totals.discount > 0) {
      var discountLabel = 'Discount' + (doc.discount.mode === 'percent' && doc.discount.value ? ' (' + esc(String(doc.discount.value).trim()) + '%)' : '');
      totalRows += '<tr><th>' + discountLabel + '</th><td>&minus;' + money(totals.discount) + '</td></tr>';
    }
    if (totals.tax > 0) {
      var taxLabel = (doc.tax.label || 'Tax').trim();
      var rate = String(doc.tax.rate || '').trim();
      totalRows += '<tr><th>' + esc(taxLabel) + (rate ? ' (' + esc(rate) + '%)' : '') + '</th><td>' + money(totals.tax) + '</td></tr>';
    }
    totalRows += '<tr class="grand"><th>Total</th><td>' + money(totals.total) + '</td></tr>';
    /* A receipt is issued for money already received, so it only shows a payment
       row while the payment is still short of the total. */
    var showPaid = kind === 'RECEIPT'
      ? totals.paid > 0 && totals.paid < totals.total
      : totals.paid > 0;
    if (showPaid) {
      totalRows += '<tr class="dim"><th>Amount paid</th><td>&minus;' + money(totals.paid) + '</td></tr>';
      totalRows += '<tr class="balance"><th>Balance due</th><td>' + money(totals.balance) + '</td></tr>';
    }

    var notesHtml = doc.notes.trim() ? '<div class="p-notes"><p class="p-notes-title">Notes</p>' + esc(doc.notes) + '</div>' : '<div class="p-notes"></div>';
    var footerParts = [];
    if (doc.terms.trim()) footerParts.push('<span>' + esc(doc.terms) + '</span>');
    if (from.email) footerParts.push('<span>' + esc(from.email) + '</span>');
    var footerHtml = footerParts.length ? '<footer class="p-foot">' + footerParts.join('') + '</footer>' : '<footer class="p-foot"><span></span></footer>';

    return '' +
      '<div class="p-head">' +
        '<div class="p-brand">' +
          (doc.logo ? '<img class="p-logo" src="' + esc(doc.logo) + '" alt="">' : '') +
          '<div>' +
            '<div class="p-name">' + esc(from.name || 'Your business') + '</div>' +
            fromMeta +
            addressBlock(from.address) +
            (from.taxId ? '<div class="p-lines">Tax ID: ' + esc(from.taxId) + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="p-doctype">' +
          '<div class="p-doc-title">' + title + '</div>' +
          (doc.number ? '<div class="p-doc-num">' + esc(doc.number) + '</div>' : '') +
          (kind === 'RECEIPT' ? '<span class="p-stamp">PAID</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="p-parties">' +
        '<div>' +
          '<span class="p-label">Bill to</span>' +
          '<div class="p-client">' +
            '<strong>' + esc(bill.name || 'Your client') + '</strong>' +
            (bill.contact ? '<div>' + esc(bill.contact) + '</div>' : '') +
            (bill.email ? '<div>' + esc(bill.email) + '</div>' : '') +
            addressBlock(bill.address) +
          '</div>' +
        '</div>' +
        '<div class="p-meta-grid">' +
          '<div class="p-meta-row"><span class="p-label">Issue date</span><b>' + esc(L.formatDate(doc.issueDate) || '—') + '</b></div>' +
          '<div class="p-meta-row"><span class="p-label">' + metaDateLabel + '</span><b>' + esc(L.formatDate(doc.dueDate) || '—') + '</b></div>' +
          '<div class="p-due"><span>' + dueCaption + '</span><b>' + money(dueValue) + '</b></div>' +
        '</div>' +
      '</div>' +
      '<table class="p-items">' +
        '<thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>' +
        '<tbody>' + (itemRows || '<tr><td colspan="4" class="p-empty">No line items yet — add one on the left.</td></tr>') + '</tbody>' +
      '</table>' +
      '<div class="p-summary">' +
        notesHtml +
        '<table class="p-totals"><tbody>' + totalRows + '</tbody></table>' +
      '</div>' +
      footerHtml;
  }

  function renderDocPaper() {
    var paper = $('#paper-doc');
    paper.classList.toggle('paper-letter', state.doc.paper === 'letter');
    paper.innerHTML = docPaperMarkup();
    var size = state.doc.paper === 'letter' ? 'Letter · 8.5 × 11 in' : 'A4 · 210 × 297 mm';
    $('#preview-meta').textContent = size;
    requestAnimationFrame(fitAllPapers);
  }

  function showWarning(el, errors) {
    if (!el) return;
    if (!errors || !errors.length) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = errors.length === 1
      ? errors[0]
      : errors.slice(0, 2).join(' ') + (errors.length > 2 ? ' …and ' + (errors.length - 2) + ' more.' : '');
  }

  function renderDocTotals() {
    var totals = L.computeTotals(state.doc);
    showWarning($('#doc-error'), totals.errors);
    $('#strip-total').textContent = L.formatMoney(totals.total, state.doc.currency);
    $('#balance-label').textContent = totals.balance < 0 ? 'Credit' : 'Balance due';
    $('#strip-balance').textContent = L.formatMoney(Math.abs(totals.balance), state.doc.currency);
    updateItemAmounts();
    renderDocPaper();
  }

  /* ------------------------------------------------------------- P&L paper */

  function plPaperMarkup() {
    var doc = state.pl;
    var summary = L.computePnL(doc);
    var money = function (v) { return L.formatMoney(v, doc.currency); };
    var revenueRows = summary.revenue.map(function (r) {
      return '<div class="pl-line"><span>' + esc(r.label || 'Revenue') + '</span><b>' + money(r.amount) + '</b></div>';
    }).join('');
    var expenseRows = summary.expenses.map(function (e) {
      return '<div class="pl-line"><span>' + esc(e.label || 'Expense') +
        ' <span class="pl-cat">· ' + esc(e.category) + '</span></span><b>' + money(e.amount) + '</b></div>';
    }).join('');
    var margin = summary.margin === null ? '—' : summary.margin.toFixed(1) + '%';

    return '' +
      '<div class="p-head">' +
        '<div class="p-brand"><div>' +
          '<div class="p-name">' + esc(doc.business || 'Your business') + '</div>' +
          '<div class="p-lines">Profit &amp; Loss Statement</div>' +
        '</div></div>' +
        '<div class="p-doctype">' +
          '<div class="p-doc-title">P&amp;L</div>' +
          '<div class="p-doc-num">' + esc(doc.periodLabel || L.periodLabel(doc.startDate, doc.endDate)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="p-parties" style="grid-template-columns:1fr auto">' +
        '<div><span class="p-label">Statement period</span><div class="p-client">' +
          esc(L.formatDate(doc.startDate) || '—') + ' — ' + esc(L.formatDate(doc.endDate) || '—') + '</div></div>' +
        '<div class="p-meta-grid"><div class="p-meta-row"><span class="p-label">Currency</span><b>' + esc(doc.currency) + '</b></div></div>' +
      '</div>' +
      '<div class="pl-section"><h3>Revenue</h3>' +
        (revenueRows || '<div class="pl-line"><span>No revenue recorded</span><b>' + money(0) + '</b></div>') +
        '<div class="pl-subtotal"><span>Gross revenue</span><b>' + money(summary.grossRevenue) + '</b></div>' +
      '</div>' +
      '<div class="pl-section"><h3>Expenses</h3>' +
        (expenseRows || '<div class="pl-line"><span>No expenses recorded</span><b>' + money(0) + '</b></div>') +
        '<div class="pl-subtotal"><span>Total expenses</span><b>' + money(summary.totalExpenses) + '</b></div>' +
      '</div>' +
      '<div class="pl-net' + (summary.isLoss ? ' is-loss' : '') + '">' +
        '<div><div class="pl-net-label">' + (summary.isLoss ? 'Net loss' : 'Net profit') + '</div>' +
        '<div class="pl-net-value">' + money(summary.netProfit) + '</div></div>' +
        '<div class="pl-margin">Profit margin<b>' + margin + '</b></div>' +
      '</div>' +
      '<footer class="p-foot"><span>Prepared from the figures entered in this statement. Not a substitute for accounting or tax advice.</span><span>' + esc(doc.business || '') + '</span></footer>';
  }

  function renderPlPaper() {
    var paper = $('#paper-pl');
    paper.classList.toggle('paper-letter', state.doc.paper === 'letter');
    paper.innerHTML = plPaperMarkup();
    var size = state.doc.paper === 'letter' ? 'Letter · 8.5 × 11 in' : 'A4 · 210 × 297 mm';
    $('#pl-preview-meta').textContent = size;
    requestAnimationFrame(fitAllPapers);
  }

  /* ------------------------------------------------------------ P&L rows */

  function revenueRow(row, index) {
    return '' +
      '<div class="pl-row revenue-row" data-idx="' + index + '">' +
        '<input class="inp" type="text" data-pl="label" aria-label="Revenue line ' + (index + 1) + '" placeholder="Client projects" value="' + esc(row.label) + '">' +
        '<span class="affix-field"><span class="affix" data-pl-currency>' + L.CURRENCIES[state.pl.currency].symbol + '</span>' +
          '<input class="inp" type="text" inputmode="decimal" data-pl="amount" aria-label="Revenue amount ' + (index + 1) + '" placeholder="0.00" value="' + esc(row.amount) + '"></span>' +
        '<button type="button" class="item-del" data-del-revenue="' + index + '" aria-label="Remove revenue line ' + (index + 1) + '">&times;</button>' +
      '</div>';
  }

  function expenseRow(row, index) {
    var options = L.EXPENSE_CATEGORIES.map(function (category) {
      return '<option value="' + esc(category) + '"' + (category === row.category ? ' selected' : '') + '>' + esc(category) + '</option>';
    }).join('');
    return '' +
      '<div class="pl-row" data-idx="' + index + '">' +
        '<input class="inp" type="text" data-pl="label" aria-label="Expense line ' + (index + 1) + '" placeholder="Figma subscription" value="' + esc(row.label) + '">' +
        '<select data-pl="category" aria-label="Expense category ' + (index + 1) + '">' + options + '</select>' +
        '<span class="affix-field"><span class="affix" data-pl-currency>' + L.CURRENCIES[state.pl.currency].symbol + '</span>' +
          '<input class="inp" type="text" inputmode="decimal" data-pl="amount" aria-label="Expense amount ' + (index + 1) + '" placeholder="0.00" value="' + esc(row.amount) + '"></span>' +
        '<button type="button" class="item-del" data-del-expense="' + index + '" aria-label="Remove expense ' + (index + 1) + '">&times;</button>' +
      '</div>';
  }

  function renderPlRows() {
    $('#rev-rows').innerHTML = state.pl.revenue.map(revenueRow).join('');
    $('#exp-rows').innerHTML = state.pl.expenses.map(expenseRow).join('');
  }

  function renderChart(summary) {
    var body = $('#chart-body');
    var empty = $('#chart-empty');
    var meta = $('#chart-meta');
    var categories = summary.categories.filter(function (c) { return c.amount !== 0; });
    meta.textContent = categories.length + (categories.length === 1 ? ' category' : ' categories');
    if (!categories.length) {
      body.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    var W = 580, rowH = 27, labelW = 186, valueW = 118;
    var barX = labelW + 10;
    var barW = W - barX - valueW;
    var H = categories.length * rowH + 6;
    var money = function (v) { return L.formatMoney(v, summary.currency); };
    var rows = categories.map(function (c, i) {
      var y = i * rowH + 4;
      var mid = y + rowH / 2 - 4;
      var width = Math.max(3, Math.round(c.ratio * barW));
      var label = c.category.length > 27 ? c.category.slice(0, 26) + '…' : c.category;
      return '' +
        '<g class="chart-row">' +
          '<text class="chart-label" x="0" y="' + mid + '" dominant-baseline="middle">' + esc(label) + '</text>' +
          '<rect class="chart-track" x="' + barX + '" y="' + (mid - 6) + '" width="' + barW + '" height="12" rx="6"></rect>' +
          '<rect class="chart-bar" x="' + barX + '" y="' + (mid - 6) + '" width="' + width + '" height="12" rx="6" style="opacity:' + (0.95 - Math.min(i, 6) * 0.11) + '"></rect>' +
          '<text class="chart-value" x="' + (W - 2) + '" y="' + mid + '" dominant-baseline="middle" text-anchor="end">' +
            money(c.amount) + '  <tspan class="chart-share">' + c.share.toFixed(1) + '%</tspan></text>' +
        '</g>';
    }).join('');
    body.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Expenses by category, largest first">' + rows + '</svg>';
  }

  function renderPlTotals() {
    var summary = L.computePnL(state.pl);
    showWarning($('#pl-error'), summary.errors);
    $('#m-gross').textContent = L.formatMoney(summary.grossRevenue, summary.currency);
    $('#m-expenses').textContent = L.formatMoney(summary.totalExpenses, summary.currency);
    $('#m-net').textContent = L.formatMoney(summary.netProfit, summary.currency);
    $('#m-margin').textContent = summary.margin === null ? '—' : summary.margin.toFixed(1) + '%';
    var card = $('#card-net');
    card.classList.toggle('is-loss', summary.isLoss);
    card.classList.toggle('is-profit', !summary.isLoss && summary.netProfit > 0);
    renderChart(summary);
    renderPlPaper();
  }

  function syncPlForm() {
    var pl = state.pl;
    $$('#pl-form [data-model]').forEach(function (input) {
      var value = getPath(pl, input.getAttribute('data-model'));
      input.value = value === undefined || value === null ? '' : value;
    });
    $$('#rev-rows [data-pl-currency], #exp-rows [data-pl-currency]').forEach(function (el) {
      el.textContent = L.CURRENCIES[pl.currency].symbol;
    });
  }

  /* ------------------------------------------------------------- lifecycle */

  function renderAll() {
    syncDocForm();
    renderItems();
    renderDocTotals();
    syncPlForm();
    renderPlRows();
    renderPlTotals();
    applyPageSize();
    fitAllPapers();
  }

  function applyPageSize() {
    var rule = document.getElementById('page-rule');
    if (!rule) {
      rule = document.createElement('style');
      rule.id = 'page-rule';
      document.head.appendChild(rule);
    }
    rule.textContent = '@page { size: ' + (state.doc.paper === 'letter' ? 'Letter' : 'A4') + '; margin: 12mm; }';
  }

  function setTab(tab) {
    var docActive = tab === 'doc';
    $('#tab-doc').classList.toggle('is-active', docActive);
    $('#tab-doc').setAttribute('aria-selected', docActive ? 'true' : 'false');
    $('#tab-pl').classList.toggle('is-active', !docActive);
    $('#tab-pl').setAttribute('aria-selected', !docActive ? 'true' : 'false');
    $('#panel-doc').hidden = !docActive;
    $('#panel-pl').hidden = docActive;
    requestAnimationFrame(fitAllPapers);
  }

  function setMobileView(workspace, view) {
    workspace.setAttribute('data-mobile-view', view);
    $$('.mobile-switch button', workspace).forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-view') === view);
    });
    requestAnimationFrame(fitAllPapers);
  }

  /* ---------------------------------------------------------------- drafts */

  function saveDraft(quiet) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        doc: state.doc,
        pl: state.pl
      }));
      if (!quiet) toast('Draft saved in this browser');
      return true;
    } catch (e) {
      toast('This browser refused to store the draft');
      return false;
    }
  }

  function clearDraft() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    state.draftRestored = false;
    $('#draft-badge').hidden = true;
  }

  function restoreDraft() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;
      if (parsed.doc) state.doc = L.normalizeDoc(parsed.doc);
      if (parsed.pl) state.pl = L.normalizePnL(parsed.pl);
      state.draftRestored = true;
      $('#draft-badge').hidden = false;
      $('#sample-badge').hidden = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ----------------------------------------------------------------- wires */

  function bindDocForm() {
    $('#doc-form').addEventListener('input', function (event) {
      var target = event.target;
      var model = target.getAttribute && target.getAttribute('data-model');
      if (model) {
        setPath(state.doc, model, target.value);
        if (model === 'currency') {
          syncDocForm();
          renderItems();
        }
        if (model === 'discount.mode') {
          syncDocForm();
        }
        renderDocTotals();
        return;
      }
      var field = target.getAttribute && target.getAttribute('data-item');
      if (field) {
        var row = target.closest('.item-row');
        var index = Number(row.getAttribute('data-idx'));
        state.doc.items[index][field] = target.value;
        updateItemWarnings();
        renderDocTotals();
      }
    });

    $('#doc-form').addEventListener('change', function (event) {
      var target = event.target;
      var model = target.getAttribute && target.getAttribute('data-model');
      if (!model) return;
      setPath(state.doc, model, target.value);
      if (model === 'currency' || model === 'paper' || model === 'discount.mode') {
        syncDocForm();
        renderItems();
        applyPageSize();
      }
      renderDocTotals();
      fitAllPapers();
    });

    $('#items').addEventListener('click', function (event) {
      var btn = event.target.closest('[data-del-item]');
      if (!btn || btn.disabled) return;
      var index = Number(btn.getAttribute('data-del-item'));
      state.doc.items.splice(index, 1);
      if (!state.doc.items.length) state.doc.items.push(L.blankDoc().items[0]);
      renderItems();
      renderDocTotals();
    });

    $('#add-item').addEventListener('click', function () {
      state.doc.items.push({ description: '', details: '', quantity: '1', unitPrice: '' });
      renderItems();
      renderDocTotals();
      var rows = $$('#items-body .item-row');
      var input = rows.length ? $('[data-item="description"]', rows[rows.length - 1]) : null;
      if (input) input.focus();
    });

    $$('#doc-kind button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.doc.kind = btn.getAttribute('data-kind');
        if (state.doc.kind === 'RECEIPT') {
          state.doc.amountPaid = state.doc.amountPaid || L.formatAmount(L.computeTotals(state.doc).total, state.doc.currency, { group: false });
          state.doc.dueDate = state.doc.dueDate || L.todayISO();
          $('#due-date').value = state.doc.dueDate;
          $('#amount-paid').value = state.doc.amountPaid;
        }
        syncDocForm();
        renderDocTotals();
      });
    });

    $('#logo-input').addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) {
        toast('Use a PNG, JPG, SVG or WebP image');
        event.target.value = '';
        return;
      }
      if (file.size > MAX_LOGO_BYTES) {
        toast('That image is larger than 1.5 MB');
        event.target.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        state.doc.logo = String(reader.result);
        renderLogo();
        renderDocPaper();
      };
      reader.onerror = function () { toast('The image could not be read'); };
      reader.readAsDataURL(file);
    });

    $('#logo-clear').addEventListener('click', function () {
      state.doc.logo = '';
      renderLogo();
      renderDocPaper();
    });

    ['#btn-print-doc', '#btn-print-doc-top'].forEach(function (sel) {
      $(sel).addEventListener('click', function () {
        applyPageSize();
        renderDocPaper();
        window.print();
      });
    });

    $('#btn-sample').addEventListener('click', function () {
      state.doc = L.sampleDoc();
      $('#sample-badge').hidden = false;
      renderAll();
      toast('Sample invoice loaded');
    });

    $('#btn-clear').addEventListener('click', function () {
      state.doc = L.blankDoc();
      $('#sample-badge').hidden = true;
      clearDraft();
      renderAll();
      toast('Form cleared');
    });

    ['#btn-save-draft', '#btn-save-draft-pl'].forEach(function (sel) {
      $(sel).addEventListener('click', function () { saveDraft(false); });
    });

    $('#btn-export').addEventListener('click', function () {
      var payload = L.exportPayload('document', state.doc);
      download(safeFilename('invoice-' + (state.doc.number || state.doc.issueDate)) + '.json',
        JSON.stringify(payload, null, 2), 'application/json');
      toast('JSON exported');
    });

    $('#btn-import').addEventListener('click', function () { $('#import-file').click(); });

    $('#import-file').addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var payload = null;
        try {
          payload = JSON.parse(String(reader.result));
        } catch (e) {
          toast('That file is not valid JSON');
          event.target.value = '';
          return;
        }
        var result = L.importPayload(payload);
        if (!result.ok) {
          toast(result.errors[0] || 'That file could not be imported');
          event.target.value = '';
          return;
        }
        if (result.mode === 'pnl') {
          state.pl = result.doc;
          $('#pl-period').value = 'custom';
          syncPlForm();
          renderPlRows();
          renderPlTotals();
          setTab('pl');
        } else {
          state.doc = result.doc;
          syncDocForm();
          renderItems();
          renderDocTotals();
          setTab('doc');
        }
        $('#sample-badge').hidden = true;
        applyPageSize();
        fitAllPapers();
        toast('Imported ' + file.name);
        event.target.value = '';
      };
      reader.onerror = function () { toast('The file could not be read'); };
      reader.readAsText(file);
    });
  }

  function bindPlForm() {
    $('#pl-form').addEventListener('input', function (event) {
      var target = event.target;
      var model = target.getAttribute && target.getAttribute('data-model');
      if (model) {
        setPath(state.pl, model, target.value);
        if (model === 'startDate' || model === 'endDate') {
          if (state.plLabelAuto) {
            state.pl.periodLabel = L.periodLabel(state.pl.startDate, state.pl.endDate);
            $('#pl-label').value = state.pl.periodLabel;
          }
        }
        if (model === 'periodLabel') state.plLabelAuto = false;
        if (model === 'currency') {
          syncPlForm();
          renderPlRows();
        }
        renderPlTotals();
        return;
      }
      var field = target.getAttribute && target.getAttribute('data-pl');
      if (!field) return;
      var row = target.closest('.pl-row');
      var index = Number(row.getAttribute('data-idx'));
      var list = row.classList.contains('revenue-row') ? state.pl.revenue : state.pl.expenses;
      if (list[index]) list[index][field] = target.value;
      renderPlTotals();
    });

    $('#pl-form').addEventListener('change', function (event) {
      var target = event.target;
      var model = target.getAttribute && target.getAttribute('data-model');
      if (model) {
        setPath(state.pl, model, target.value);
        if (model === 'currency') {
          syncPlForm();
          renderPlRows();
        }
        if (model === 'startDate' || model === 'endDate') {
          if (state.plLabelAuto) {
            state.pl.periodLabel = L.periodLabel(state.pl.startDate, state.pl.endDate);
            $('#pl-label').value = state.pl.periodLabel;
          }
        }
        renderPlTotals();
      }
    });

    $('#pl-period').addEventListener('change', function () {
      var value = $('#pl-period').value;
      var now = new Date();
      var y = now.getFullYear();
      var m = now.getMonth();
      var start, end;
      if (value === 'month') {
        start = new Date(y, m, 1);
        end = new Date(y, m + 1, 0);
      } else if (value === 'quarter') {
        var q = Math.floor(m / 3) * 3;
        start = new Date(y, q, 1);
        end = new Date(y, q + 3, 0);
      } else if (value === 'year') {
        start = new Date(y, 0, 1);
        end = new Date(y, 11, 31);
      } else {
        return;
      }
      var iso = function (d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      };
      state.pl.startDate = iso(start);
      state.pl.endDate = iso(end);
      state.pl.periodLabel = L.periodLabel(state.pl.startDate, state.pl.endDate);
      state.plLabelAuto = true;
      $('#pl-start').value = state.pl.startDate;
      $('#pl-end').value = state.pl.endDate;
      $('#pl-label').value = state.pl.periodLabel;
      renderPlTotals();
    });

    $('#rev-rows').addEventListener('click', function (event) {
      var btn = event.target.closest('[data-del-revenue]');
      if (!btn) return;
      state.pl.revenue.splice(Number(btn.getAttribute('data-del-revenue')), 1);
      if (!state.pl.revenue.length) state.pl.revenue.push({ label: '', amount: '' });
      renderPlRows();
      renderPlTotals();
    });

    $('#exp-rows').addEventListener('click', function (event) {
      var btn = event.target.closest('[data-del-expense]');
      if (!btn) return;
      state.pl.expenses.splice(Number(btn.getAttribute('data-del-expense')), 1);
      if (!state.pl.expenses.length) state.pl.expenses.push({ category: 'Other', label: '', amount: '' });
      renderPlRows();
      renderPlTotals();
    });

    $('#add-revenue').addEventListener('click', function () {
      state.pl.revenue.push({ label: '', amount: '' });
      renderPlRows();
      renderPlTotals();
      var rows = $$('#rev-rows .pl-row');
      var input = rows.length ? $('[data-pl="label"]', rows[rows.length - 1]) : null;
      if (input) input.focus();
    });

    $('#add-expense').addEventListener('click', function () {
      state.pl.expenses.push({ category: 'Software & subscriptions', label: '', amount: '' });
      renderPlRows();
      renderPlTotals();
      var rows = $$('#exp-rows .pl-row');
      var input = rows.length ? $('[data-pl="label"]', rows[rows.length - 1]) : null;
      if (input) input.focus();
    });

    ['#btn-print-pl', '#btn-print-pl-top'].forEach(function (sel) {
      $(sel).addEventListener('click', function () {
        applyPageSize();
        renderPlPaper();
        window.print();
      });
    });

    $('#btn-csv').addEventListener('click', function () {
      var csv = L.buildPnLCSV(state.pl, { bom: $('#csv-bom').checked });
      var name = safeFilename('pnl-' + state.pl.business + '-' + state.pl.startDate) + '.csv';
      download(name, csv, 'text/csv;charset=utf-8');
      toast('CSV downloaded');
    });

    $('#btn-pl-sample').addEventListener('click', function () {
      state.pl = L.samplePnL();
      state.plLabelAuto = true;
      $('#pl-period').value = 'custom';
      syncPlForm();
      renderPlRows();
      renderPlTotals();
      toast('Sample statement loaded');
    });

    $('#btn-pl-clear').addEventListener('click', function () {
      state.pl = L.blankPnL();
      state.plLabelAuto = true;
      syncPlForm();
      renderPlRows();
      renderPlTotals();
      toast('Statement cleared');
    });
  }

  function bindChrome() {
    $('#tab-doc').addEventListener('click', function () { setTab('doc'); });
    $('#tab-pl').addEventListener('click', function () { setTab('pl'); });

    $$('.mobile-switch').forEach(function (group) {
      var workspace = group.closest('.workspace');
      group.addEventListener('click', function (event) {
        var btn = event.target.closest('button[data-view]');
        if (!btn) return;
        setMobileView(workspace, btn.getAttribute('data-view'));
      });
    });

    $('#theme-toggle').addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    });

    window.addEventListener('resize', function () { requestAnimationFrame(fitAllPapers); });

    if (typeof ResizeObserver === 'function') {
      var observer = new ResizeObserver(function () { requestAnimationFrame(fitAllPapers); });
      $$('.paper-stage').forEach(function (stage) { observer.observe(stage); });
      $$('.paper').forEach(function (paper) { observer.observe(paper); });
    }
  }

  /* ------------------------------------------------------------------ init */

  function init() {
    initTheme();
    if (!restoreDraft()) {
      state.doc = L.sampleDoc();
      state.pl = L.samplePnL();
      $('#sample-badge').hidden = false;
      $('#draft-badge').hidden = true;
    }
    bindChrome();
    bindDocForm();
    bindPlForm();
    $('#pl-period').value = 'custom';
    renderAll();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { requestAnimationFrame(fitAllPapers); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
