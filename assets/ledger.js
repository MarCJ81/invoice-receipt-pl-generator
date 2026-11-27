/* ==========================================================================
   Ledger — money, totals, P&L and CSV engine for the invoice generator.
   No DOM, no network, no dependencies: runs in the browser (window.Ledger)
   and in Node (module.exports) so test.js exercises the shipped code.

   Money is held as integer minor units (cents for USD/EUR/GBP/CAD/AUD,
   whole yen/won for JPY/KRW). Every multiplication is done in BigInt and
   rounded half away from zero, so no value goes through binary floating
   point arithmetic.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ledger = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var APP_ID = 'invoice-receipt-pl-generator';
  var VERSION = 1;

  /* 100% expressed in rate units: 1% = 10,000 → 4 decimal places of a percent. */
  var RATE_UNITS = 1000000;
  var QTY_UNITS = 1000; /* quantity to 3 decimal places */
  var MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

  var CURRENCIES = {
    USD: { symbol: '$', decimals: 2, name: 'US dollar' },
    EUR: { symbol: '\u20AC', decimals: 2, name: 'Euro' },
    GBP: { symbol: '\u00A3', decimals: 2, name: 'British pound' },
    CAD: { symbol: 'C$', decimals: 2, name: 'Canadian dollar' },
    AUD: { symbol: 'A$', decimals: 2, name: 'Australian dollar' },
    JPY: { symbol: '\u00A5', decimals: 0, name: 'Japanese yen' },
    KRW: { symbol: '\u20A9', decimals: 0, name: 'Korean won' }
  };

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  var EXPENSE_CATEGORIES = [
    'Software & subscriptions',
    'Hardware & equipment',
    'Contractors & freelancers',
    'Marketing & advertising',
    'Travel & meals',
    'Office & coworking',
    'Education & training',
    'Banking & payment fees',
    'Insurance',
    'Taxes & licences',
    'Other'
  ];

  /* ---------------------------------------------------------------- numbers */

  /**
   * Reads a user-typed number ("$1,234.50", "1 234,50", "(45.00)", 12.5) and
   * returns { neg, int, frac } as digit strings, or null when it is not a number.
   * Grouping separators and the decimal separator are told apart:
   *   both "." and ","  -> the right-most one is the decimal separator
   *   only ","          -> one comma followed by 3 digits means grouping
   *   only "."          -> more than one dot means grouping
   */
  function parseDecimal(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') {
      if (!isFinite(raw)) return null;
      raw = String(raw);
    }
    if (typeof raw !== 'string') return null;
    var s = raw.trim();
    if (!s) return null;

    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[\s\u00A0\u202F']/g, '');
    s = s.replace(/[CA]\$/g, '');
    s = s.replace(/[$\u20AC\u00A3\u00A5\u20A9\uFFE6\uFFE5]/g, '');
    s = s.replace(/^[A-Za-z]{3}(?=[0-9(+\-])/, '');
    s = s.replace(/([0-9])[A-Za-z]{3}$/, '$1');
    if (!s) return null;
    if (/[^0-9.,+\-]/.test(s)) return null;
    if (s.charAt(0) === '-') { neg = !neg; s = s.slice(1); }
    else if (s.charAt(0) === '+') { s = s.slice(1); }
    s = s.replace(/[+-]/g, '');
    if (!s || !/[0-9]/.test(s)) return null;

    var lastDot = s.lastIndexOf('.');
    var lastComma = s.lastIndexOf(',');
    var decimalAt = -1;
    if (lastDot >= 0 && lastComma >= 0) {
      decimalAt = Math.max(lastDot, lastComma);
    } else if (lastComma >= 0) {
      var commas = s.split(',').length - 1;
      var afterComma = s.length - lastComma - 1;
      if (commas === 1 && afterComma !== 3) decimalAt = lastComma;
      else decimalAt = -1;
    } else if (lastDot >= 0) {
      var dots = s.split('.').length - 1;
      decimalAt = dots === 1 ? lastDot : -1;
    }

    var intPart = decimalAt >= 0 ? s.slice(0, decimalAt) : s;
    var fracPart = decimalAt >= 0 ? s.slice(decimalAt + 1) : '';
    intPart = intPart.replace(/[.,]/g, '');
    fracPart = fracPart.replace(/[.,]/g, '');
    if (!intPart && !fracPart) return null;
    if (intPart === '') intPart = '0';
    if (!/^\d+$/.test(intPart) || (fracPart && !/^\d+$/.test(fracPart))) return null;

    intPart = intPart.replace(/^0+(?=\d)/, '');
    return { neg: neg, int: intPart, frac: fracPart };
  }

  /** Turns a parsed decimal into integer units of 10^-decimals, half away from zero. */
  function decimalToUnits(dec, decimals) {
    if (!dec) return null;
    var frac = dec.frac || '';
    var digits;
    if (frac.length <= decimals) {
      digits = dec.int + frac + new Array(decimals - frac.length + 1).join('0');
    } else {
      digits = dec.int + frac.slice(0, decimals);
      if (frac.charAt(decimals) >= '5') {
        digits = (BigInt(digits || '0') + BigInt(1)).toString();
      }
    }
    var value = BigInt(digits || '0');
    if (value > MAX_SAFE) return null;
    var out = Number(value);
    return dec.neg ? -out : out;
  }

  /** Integer division rounded half away from zero. Denominator must be positive. */
  function divRound(numerator, denominator) {
    var n = BigInt(numerator);
    var d = BigInt(denominator);
    if (d <= BigInt(0)) throw new RangeError('divRound: denominator must be positive');
    var negative = n < BigInt(0);
    if (negative) n = -n;
    var q = n / d;
    var r = n - q * d;
    if (r * BigInt(2) >= d) q += BigInt(1);
    var out = BigInt(negative ? -q : q);
    if (out > MAX_SAFE || out < -MAX_SAFE) return null;
    return Number(out);
  }

  function currencyInfo(code) {
    return CURRENCIES[code] || CURRENCIES.USD;
  }

  function minorDecimals(code) {
    return currencyInfo(code).decimals;
  }

  /** "1,234.5" + USD -> 123450. Returns null when the text is not a number. */
  function parseAmount(raw, currency) {
    return decimalToUnits(parseDecimal(raw), minorDecimals(currency));
  }

  /** Quantity in thousandths: "2.5" -> 2500. */
  function parseQuantity(raw) {
    return decimalToUnits(parseDecimal(raw), 3);
  }

  /**
   * True when a raw quantity/unit-price box holds a negative number.
   * The editor uses it to warn right under the input before totals clamp it to 0.
   */
  function isNegativeNumber(raw) {
    var text = String(raw == null ? '' : raw)
      .replace(/[\u2212\u2013\u2014]/g, '-')
      .replace(/[\s\u00A0]/g, '')
      .replace(/[,\u20A9$\u20AC\u00A3\u00A5]/g, '');
    if (!text) return false;
    var value = Number(text);
    return isFinite(value) && value < 0;
  }

  /** Percent in rate units: "8.875" -> 88750 (1% = 10000). */
  function parseRate(raw) {
    return decimalToUnits(parseDecimal(raw), 4);
  }

  function formatAmount(minor, currency, opts) {
    var info = currencyInfo(currency);
    var decimals = info.decimals;
    var group = !(opts && opts.group === false);
    var value = typeof minor === 'number' && isFinite(minor) ? Math.trunc(minor) : 0;
    var negative = value < 0;
    var digits = String(Math.abs(value));
    if (decimals > 0) digits = digits.padStart(decimals + 1, '0');
    var intPart = decimals > 0 ? digits.slice(0, digits.length - decimals) : digits;
    var frac = decimals > 0 ? digits.slice(digits.length - decimals) : '';
    if (group) intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (negative ? '-' : '') + intPart + (frac ? '.' + frac : '');
  }

  function formatMoney(minor, currency) {
    var info = currencyInfo(currency);
    var value = typeof minor === 'number' && isFinite(minor) ? Math.trunc(minor) : 0;
    return (value < 0 ? '-' : '') + info.symbol + formatAmount(Math.abs(value), currency);
  }

  function formatPercent(units) {
    var value = divRound(BigInt(units) * BigInt(100), BigInt(RATE_UNITS));
    return (value === null ? 0 : value) + '%';
  }

  var LOCALE = 'en';
  function setLocale(lang) { LOCALE = (lang === 'ko') ? 'ko' : 'en'; }
  function isKo() { return LOCALE === 'ko'; }
  function monthShort(n) { return isKo() ? (n + '월') : MONTHS[n - 1]; }
  function monthLong(n) { return isKo() ? (n + '월') : MONTHS_LONG[n - 1]; }

  function formatDate(iso) {
    var s = String(iso || '').trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return s;
    var month = Number(m[2]);
    if (month < 1 || month > 12) return s;
    if (isKo()) return m[1] + '년 ' + month + '월 ' + Number(m[3]) + '일';
    return MONTHS[month - 1] + ' ' + Number(m[3]) + ', ' + m[1];
  }

  function formatLongDate(iso) {
    var s = String(iso || '').trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return s;
    var month = Number(m[2]);
    if (month < 1 || month > 12) return s;
    if (isKo()) return m[1] + '년 ' + month + '월 ' + Number(m[3]) + '일';
    return MONTHS_LONG[month - 1] + ' ' + Number(m[3]) + ', ' + m[1];
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function todayISO(now) {
    var d = now ? new Date(now) : new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function addDays(iso, days) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return iso;
    var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    d.setUTCDate(d.getUTCDate() + Number(days || 0));
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  /* ----------------------------------------------------------------- totals */

  var DOC_TYPES = ['INVOICE', 'RECEIPT', 'QUOTE'];

  /**
   * Document totals from raw (string) input.
   *   order: line = qty x price -> subtotal -> discount -> taxable -> tax -> total -> balance
   *   tax is charged on the discounted subtotal; a discount never exceeds the subtotal.
   */
  function computeTotals(doc) {
    doc = doc || {};
    var currency = CURRENCIES[doc.currency] ? doc.currency : 'USD';
    var errors = [];
    var items = Array.isArray(doc.items) ? doc.items : [];
    var lines = [];
    var subtotal = 0;

    for (var i = 0; i < items.length; i++) {
      var item = items[i] || {};
      var qty = 0;
      var price = 0;
      var label = 'Line ' + (i + 1);

      if (String(item.quantity == null ? '' : item.quantity).trim() !== '') {
        var parsedQty = parseQuantity(item.quantity);
        if (parsedQty === null) errors.push(label + ': quantity "' + item.quantity + '" is not a number.');
        else if (parsedQty < 0) {
          errors.push(label + ': quantity must be 0 or more — 0 is used instead.');
          qty = 0;
        } else qty = parsedQty;
      }
      if (String(item.unitPrice == null ? '' : item.unitPrice).trim() !== '') {
        var parsedPrice = parseAmount(item.unitPrice, currency);
        if (parsedPrice === null) errors.push(label + ': unit price "' + item.unitPrice + '" is not a number.');
        else if (parsedPrice < 0) {
          errors.push(label + ': unit price must be 0 or more — 0 is used instead.');
          price = 0;
        } else price = parsedPrice;
      }

      var amount = divRound(BigInt(qty) * BigInt(price), BigInt(QTY_UNITS));
      if (amount === null) {
        errors.push(label + ': amount is too large.');
        amount = 0;
      }
      lines.push({ quantity: qty, unitPrice: price, amount: amount });
      subtotal += amount;
    }

    /* discount */
    var discountDoc = doc.discount || {};
    var discountMode = discountDoc.mode === 'percent' || discountDoc.mode === 'fixed' ? discountDoc.mode : 'none';
    var discount = 0;
    var discountRate = 0;
    var rawDiscount = 0;
    if (discountMode === 'percent') {
      var rate = parseRate(discountDoc.value);
      if (rate === null && String(discountDoc.value == null ? '' : discountDoc.value).trim() !== '') {
        errors.push('Discount "' + discountDoc.value + '" is not a number.');
      } else if (rate !== null) {
        discountRate = Math.max(0, rate);
        rawDiscount = divRound(BigInt(subtotal) * BigInt(discountRate), BigInt(RATE_UNITS)) || 0;
      }
    } else if (discountMode === 'fixed') {
      var fixed = parseAmount(discountDoc.value, currency);
      if (fixed === null && String(discountDoc.value == null ? '' : discountDoc.value).trim() !== '') {
        errors.push('Discount "' + discountDoc.value + '" is not a number.');
      } else if (fixed !== null) {
        rawDiscount = fixed;
      }
    }
    if (rawDiscount < 0) rawDiscount = 0;
    discount = Math.min(rawDiscount, subtotal);

    var taxable = subtotal - discount;

    /* tax */
    var taxDoc = doc.tax || {};
    var taxRate = 0;
    var tax = 0;
    var parsedTax = parseRate(taxDoc.rate);
    if (parsedTax === null && String(taxDoc.rate == null ? '' : taxDoc.rate).trim() !== '') {
      errors.push('Tax rate "' + taxDoc.rate + '" is not a number.');
    } else if (parsedTax !== null) {
      taxRate = Math.max(0, parsedTax);
      tax = divRound(BigInt(taxable) * BigInt(taxRate), BigInt(RATE_UNITS)) || 0;
    }

    var total = taxable + tax;

    /* amount already paid */
    var paid = 0;
    var rawPaid = doc.amountPaid;
    if (String(rawPaid == null ? '' : rawPaid).trim() !== '') {
      var parsedPaid = parseAmount(rawPaid, currency);
      if (parsedPaid === null) errors.push('Amount paid "' + rawPaid + '" is not a number.');
      else if (parsedPaid < 0) errors.push('Amount paid cannot be negative.');
      else paid = parsedPaid;
    }

    var balance = total - paid;

    return {
      ok: errors.length === 0,
      errors: errors,
      currency: currency,
      decimals: minorDecimals(currency),
      lines: lines,
      subtotal: subtotal,
      discount: discount,
      discountRate: discountRate,
      taxable: taxable,
      tax: tax,
      taxRate: taxRate,
      total: total,
      paid: paid,
      balance: balance,
      isOverpaid: balance < 0
    };
  }

  /* -------------------------------------------------------------------- P&L */

  function periodLabel(startISO, endISO) {
    var s = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(startISO || ''));
    var e = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(endISO || ''));
    if (!s) return '';
    if (isKo()) {
      if (!e) return s[1] + '년 ' + Number(s[2]) + '월';
      if (s[1] === e[1] && s[2] === e[2]) return s[1] + '년 ' + Number(s[2]) + '월';
      if (s[1] === e[1]) return s[1] + '년 ' + Number(s[2]) + '월 \u2013 ' + Number(e[2]) + '월';
      return s[1] + '년 ' + Number(s[2]) + '월 \u2013 ' + e[1] + '년 ' + Number(e[2]) + '월';
    }
    if (!e) return MONTHS_LONG[Number(s[2]) - 1] + ' ' + s[1];
    if (s[1] === e[1] && s[2] === e[2]) return MONTHS_LONG[Number(s[2]) - 1] + ' ' + s[1];
    if (s[1] === e[1]) return MONTHS[Number(s[2]) - 1] + ' \u2013 ' + MONTHS[Number(e[2]) - 1] + ' ' + s[1];
    return MONTHS[Number(s[2]) - 1] + ' ' + s[1] + ' \u2013 ' + MONTHS[Number(e[2]) - 1] + ' ' + e[1];
  }

  function computePnL(doc) {
    doc = doc || {};
    var currency = CURRENCIES[doc.currency] ? doc.currency : 'USD';
    var errors = [];
    var revenues = Array.isArray(doc.revenue) ? doc.revenue : [];
    var expenses = Array.isArray(doc.expenses) ? doc.expenses : [];

    var revenueRows = [];
    var grossRevenue = 0;
    for (var i = 0; i < revenues.length; i++) {
      var r = revenues[i] || {};
      var amount = 0;
      var raw = String(r.amount == null ? '' : r.amount).trim();
      if (raw !== '') {
        var parsed = parseAmount(raw, currency);
        if (parsed === null) errors.push('Revenue "' + (r.label || 'item ' + (i + 1)) + '": amount is not a number.');
        else amount = parsed;
      }
      revenueRows.push({ label: String(r.label || ''), amount: amount });
      grossRevenue += amount;
    }

    var expenseRows = [];
    var totalExpenses = 0;
    var byCategory = {};
    var order = [];
    for (var j = 0; j < expenses.length; j++) {
      var e = expenses[j] || {};
      var value = 0;
      var rawE = String(e.amount == null ? '' : e.amount).trim();
      if (rawE !== '') {
        var parsedE = parseAmount(rawE, currency);
        if (parsedE === null) errors.push('Expense "' + (e.label || 'item ' + (j + 1)) + '": amount is not a number.');
        else value = parsedE;
      }
      var category = String(e.category || '').trim() || 'Other';
      expenseRows.push({ label: String(e.label || ''), category: category, amount: value });
      totalExpenses += value;
      if (!Object.prototype.hasOwnProperty.call(byCategory, category)) {
        byCategory[category] = 0;
        order.push(category);
      }
      byCategory[category] += value;
    }

    var netProfit = grossRevenue - totalExpenses;
    var margin = null;
    if (grossRevenue > 0) margin = divRound(BigInt(netProfit) * BigInt(1000), BigInt(grossRevenue)) / 10;

    var categories = order.map(function (name) {
      return { category: name, amount: byCategory[name] };
    }).sort(function (a, b) {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.category < b.category ? -1 : 1;
    });

    var maxCategory = 0;
    categories.forEach(function (c) { if (c.amount > maxCategory) maxCategory = c.amount; });
    categories.forEach(function (c) {
      c.share = totalExpenses > 0 ? divRound(BigInt(c.amount) * BigInt(1000), BigInt(totalExpenses)) / 10 : 0;
      c.ratio = maxCategory > 0 ? c.amount / maxCategory : 0;
    });

    return {
      ok: errors.length === 0,
      errors: errors,
      currency: currency,
      decimals: minorDecimals(currency),
      revenue: revenueRows,
      expenses: expenseRows,
      grossRevenue: grossRevenue,
      totalExpenses: totalExpenses,
      netProfit: netProfit,
      margin: margin,
      isLoss: netProfit < 0,
      categories: categories
    };
  }

  /* -------------------------------------------------------------------- CSV */

  var CSV_SPECIAL = /[",\r\n]/;

  /** RFC 4180: quote when the field holds a comma, quote or line break; double inner quotes. */
  function csvField(value) {
    var s = value === null || value === undefined ? '' : String(value);
    if (CSV_SPECIAL.test(s) || /^\s|\s$/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCSV(rows, opts) {
    var options = opts || {};
    var eol = options.eol || '\r\n';
    var body = rows.map(function (row) {
      return (Array.isArray(row) ? row : [row]).map(csvField).join(',');
    }).join(eol) + eol;
    return (options.bom === false ? '' : '\uFEFF') + body;
  }

  /** P&L export table: one row per figure, amounts as plain decimals for spreadsheets. */
  function buildPnLCSV(doc, opts) {
    var summary = computePnL(doc);
    var currency = summary.currency;
    var plain = function (minor) { return formatAmount(minor, currency, { group: false }); };
    var rows = [
      ['Type', 'Category', 'Item', 'Amount (' + currency + ')'],
      ['Info', '', 'Business', String((doc && doc.business) || '')],
      ['Info', '', 'Period', String((doc && doc.periodLabel) || periodLabel(doc && doc.startDate, doc && doc.endDate))]
    ];
    summary.revenue.forEach(function (r) {
      rows.push(['Revenue', '', r.label, plain(r.amount)]);
    });
    summary.expenses.forEach(function (e) {
      rows.push(['Expense', e.category, e.label, plain(e.amount)]);
    });
    rows.push(['Subtotal', '', 'Gross revenue', plain(summary.grossRevenue)]);
    rows.push(['Subtotal', '', 'Total expenses', plain(summary.totalExpenses)]);
    rows.push(['Total', '', 'Net profit', plain(summary.netProfit)]);
    rows.push(['Total', '', 'Profit margin', summary.margin === null ? '' : summary.margin + '%']);
    return toCSV(rows, opts);
  }

  /* --------------------------------------------------------------- defaults */

  function blankItem() {
    return { description: '', details: '', quantity: '1', unitPrice: '' };
  }

  function blankDoc() {
    var today = todayISO();
    return {
      kind: 'INVOICE',
      currency: 'USD',
      paper: 'a4',
      number: '',
      issueDate: today,
      dueDate: addDays(today, 14),
      logo: '',
      from: { name: '', email: '', phone: '', address: '', taxId: '' },
      billTo: { name: '', contact: '', email: '', address: '' },
      items: [blankItem()],
      discount: { mode: 'none', value: '' },
      tax: { label: 'Tax', rate: '' },
      amountPaid: '',
      notes: '',
      terms: ''
    };
  }

  function sampleDoc() {
    return {
      kind: 'INVOICE',
      currency: 'USD',
      paper: 'a4',
      number: 'INV-2026-0142',
      issueDate: '2026-11-19',
      dueDate: '2026-12-03',
      logo: '',
      from: {
        name: 'Northlight Studio',
        email: 'hello@northlight.studio',
        phone: '+1 (415) 555-0148',
        address: '2180 Bryant Street, Suite 12\nSan Francisco, CA 94110\nUnited States',
        taxId: 'EIN 84-1120933'
      },
      billTo: {
        name: 'Harbor & Pine Co.',
        contact: 'Dana Whitfield',
        email: 'ap@harborpine.com',
        address: '400 W Huron Street\nChicago, IL 60654\nUnited States'
      },
      items: [
        { description: 'Brand identity system', details: 'Logo suite, typography and usage guide', quantity: '1', unitPrice: '4200' },
        { description: 'Landing page design', details: 'Desktop and mobile, two rounds of revisions', quantity: '3', unitPrice: '650' },
        { description: 'Design system handoff', details: 'Figma library and developer notes', quantity: '8', unitPrice: '95' }
      ],
      discount: { mode: 'percent', value: '5' },
      tax: { label: 'Sales tax', rate: '8.875' },
      amountPaid: '2000',
      notes: 'Thank you for working with Northlight Studio. Payment by ACH transfer or card.',
      terms: 'Payment due within 14 days. Late payments carry a 1.5% monthly fee.'
    };
  }

  function blankPnL() {
    return {
      business: '',
      currency: 'USD',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      periodLabel: periodLabel('2026-11-01', '2026-11-30'),
      revenue: [{ label: '', amount: '' }],
      expenses: [{ category: 'Software & subscriptions', label: '', amount: '' }]
    };
  }

  function samplePnL() {
    return {
      business: 'Northlight Studio',
      currency: 'USD',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      periodLabel: 'October 2026',
      revenue: [
        { label: 'Client projects', amount: '8400' },
        { label: 'Retainer \u2014 Harbor & Pine', amount: '2400' },
        { label: 'Template sales', amount: '612.50' }
      ],
      expenses: [
        { category: 'Software & subscriptions', label: 'Figma & Adobe CC', amount: '94.99' },
        { category: 'Software & subscriptions', label: 'Hosting & domains', amount: '38' },
        { category: 'Contractors & freelancers', label: 'Illustration \u2014 J. Park', amount: '1200' },
        { category: 'Marketing & advertising', label: 'Newsletter sponsorship', amount: '450' },
        { category: 'Office & coworking', label: 'Coworking desk', amount: '320' },
        { category: 'Banking & payment fees', label: 'Card and transfer fees', amount: '27.40' },
        { category: 'Education & training', label: 'Type design course', amount: '180' }
      ]
    };
  }

  /* -------------------------------------------------------- import / export */

  function str(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return isFinite(value) ? String(value) : '';
    if (typeof value === 'string') return value;
    return '';
  }

  function normalizeDoc(raw) {
    var base = blankDoc();
    var doc = raw || {};
    var out = {
      kind: DOC_TYPES.indexOf(String(doc.kind || '').toUpperCase()) >= 0 ? String(doc.kind).toUpperCase() : base.kind,
      currency: CURRENCIES[doc.currency] ? doc.currency : base.currency,
      paper: doc.paper === 'letter' ? 'letter' : 'a4',
      number: str(doc.number),
      issueDate: str(doc.issueDate) || base.issueDate,
      dueDate: str(doc.dueDate) || addDays(str(doc.issueDate) || base.issueDate, 14),
      logo: typeof doc.logo === 'string' && /^data:image\//.test(doc.logo) ? doc.logo : '',
      from: {
        name: str(doc.from && doc.from.name),
        email: str(doc.from && doc.from.email),
        phone: str(doc.from && doc.from.phone),
        address: str(doc.from && doc.from.address),
        taxId: str(doc.from && doc.from.taxId)
      },
      billTo: {
        name: str(doc.billTo && doc.billTo.name),
        contact: str(doc.billTo && doc.billTo.contact),
        email: str(doc.billTo && doc.billTo.email),
        address: str(doc.billTo && doc.billTo.address)
      },
      items: (Array.isArray(doc.items) ? doc.items : base.items).map(function (item) {
        item = item || {};
        return {
          description: str(item.description),
          details: str(item.details),
          quantity: str(item.quantity) || '1',
          unitPrice: str(item.unitPrice)
        };
      }),
      discount: {
        mode: ['none', 'percent', 'fixed'].indexOf(doc.discount && doc.discount.mode) >= 0
          ? doc.discount.mode : 'none',
        value: str(doc.discount && doc.discount.value)
      },
      tax: { label: str(doc.tax && doc.tax.label) || 'Tax', rate: str(doc.tax && doc.tax.rate) },
      amountPaid: str(doc.amountPaid),
      notes: str(doc.notes),
      terms: str(doc.terms)
    };
    if (!out.items.length) out.items = [blankItem()];
    return out;
  }

  function normalizePnL(raw) {
    var base = blankPnL();
    var doc = raw || {};
    var start = str(doc.startDate) || base.startDate;
    var end = str(doc.endDate) || base.endDate;
    return {
      business: str(doc.business),
      currency: CURRENCIES[doc.currency] ? doc.currency : base.currency,
      startDate: start,
      endDate: end,
      periodLabel: str(doc.periodLabel) || periodLabel(start, end),
      revenue: (Array.isArray(doc.revenue) ? doc.revenue : base.revenue).map(function (r) {
        r = r || {};
        return { label: str(r.label), amount: str(r.amount) };
      }),
      expenses: (Array.isArray(doc.expenses) ? doc.expenses : base.expenses).map(function (e) {
        e = e || {};
        return {
          category: str(e.category) || 'Other',
          label: str(e.label),
          amount: str(e.amount)
        };
      })
    };
  }

  function exportPayload(mode, doc) {
    return { app: APP_ID, version: VERSION, mode: mode, exportedAt: new Date().toISOString(), doc: doc };
  }

  /**
   * Validates a parsed JSON file and normalizes it into app state.
   * Returns { ok, errors, mode, doc }.
   */
  function importPayload(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, errors: ['This file is not a JSON object.'], mode: null, doc: null };
    }
    if (payload.app && payload.app !== APP_ID) {
      errors.push('This file was not exported by this tool ("' + payload.app + '").');
    }
    if (payload.version !== undefined && Number(payload.version) !== VERSION) {
      errors.push('Unsupported file version: ' + payload.version + '.');
    }
    var mode = payload.mode || (payload.doc && Array.isArray(payload.doc.revenue) ? 'pnl' : 'document');
    if (mode !== 'document' && mode !== 'pnl') errors.push('Unknown document mode: ' + mode + '.');
    var doc = payload.doc || payload.document || payload.data;
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      errors.push('The file has no "doc" object.');
    }
    if (errors.length) return { ok: false, errors: errors, mode: null, doc: null };
    return {
      ok: true,
      errors: [],
      mode: mode,
      doc: mode === 'pnl' ? normalizePnL(doc) : normalizeDoc(doc)
    };
  }

  return {
    APP_ID: APP_ID,
    VERSION: VERSION,
    CURRENCIES: CURRENCIES,
    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    DOC_TYPES: DOC_TYPES,
    RATE_UNITS: RATE_UNITS,
    parseDecimal: parseDecimal,
    parseAmount: parseAmount,
    parseQuantity: parseQuantity,
    parseRate: parseRate,
    divRound: divRound,
    formatAmount: formatAmount,
    formatMoney: formatMoney,
    formatPercent: formatPercent,
    isNegativeNumber: isNegativeNumber,
    formatDate: formatDate,
    setLocale: setLocale,
    formatLongDate: formatLongDate,
    todayISO: todayISO,
    addDays: addDays,
    computeTotals: computeTotals,
    computePnL: computePnL,
    periodLabel: periodLabel,
    csvField: csvField,
    toCSV: toCSV,
    buildPnLCSV: buildPnLCSV,
    blankDoc: blankDoc,
    sampleDoc: sampleDoc,
    blankPnL: blankPnL,
    samplePnL: samplePnL,
    normalizeDoc: normalizeDoc,
    normalizePnL: normalizePnL,
    exportPayload: exportPayload,
    importPayload: importPayload
  };
});
