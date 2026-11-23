/* ============================================================
   xlsx-export.js · Invoice / P&L → Excel (.xlsx)
   ------------------------------------------------------------
   SheetJS(Apache-2.0)를 필요할 때만 받아 장부에 바로 붙일 수 있는
   워크북을 만든다. 회계 프로그램·스프레드시트에서 합계가 숫자로
   살아 있어야 하므로 금액은 문자열이 아니라 숫자로 넣는다.
   (정수 최소단위 BigInt → 표시 단위 실수 변환은 여기서만 한다.)
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.InvoiceXLSX = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var loading = null;

  function load() {
    if (root.XLSX) return Promise.resolve(root.XLSX);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      if (!root.document) { reject(new Error('no_document')); return; }
      var s = root.document.createElement('script');
      s.src = 'assets/vendor/xlsx.full.min.js';
      s.async = true;
      s.onload = function () { resolve(root.XLSX); };
      s.onerror = function () { loading = null; reject(new Error('load_failed')); };
      root.document.head.appendChild(s);
    });
    return loading;
  }

  function toMajor(minor, decimals) {
    var v = Number(minor || 0);
    if (!isFinite(v)) return 0;
    var d = decimals || 0;
    return d > 0 ? v / Math.pow(10, d) : v;
  }

  function fileName(base, ext) {
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var clean = String(base || 'document').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
    return clean + '-' + stamp + '.' + ext;
  }

  /** Invoice · Receipt · Quote → 2시트(문서 요약 + 항목) */
  function exportDoc(docState, L, totals) {
    return load().then(function (XLSX) {
      var d = docState;
      var dec = totals.decimals;
      var wb = XLSX.utils.book_new();

      var info = [
        ['Document', String(d.kind || 'INVOICE')],
        ['Number', String(d.number || '')],
        ['Issue date', String(d.issueDate || '')],
        ['Due date', String(d.dueDate || '')],
        ['Currency', String(totals.currency || '')],
        [],
        ['From', String((d.from && d.from.name) || '')],
        ['From email', String((d.from && d.from.email) || '')],
        ['From address', String((d.from && d.from.address) || '').replace(/\n/g, ', ')],
        ['From tax ID', String((d.from && d.from.taxId) || '')],
        [],
        ['Bill to', String((d.billTo && d.billTo.name) || '')],
        ['Contact', String((d.billTo && d.billTo.contact) || '')],
        ['Bill to email', String((d.billTo && d.billTo.email) || '')],
        ['Bill to address', String((d.billTo && d.billTo.address) || '').replace(/\n/g, ', ')],
        [],
        ['Subtotal', toMajor(totals.subtotal, dec)],
        ['Discount', toMajor(totals.discount, dec)],
        ['Tax', toMajor(totals.tax, dec)],
        ['Total', toMajor(totals.total, dec)],
        ['Paid', toMajor(totals.paid, dec)],
        ['Balance due', toMajor(totals.balance, dec)],
        [],
        ['Notes', String(d.notes || '')],
        ['Terms', String(d.terms || '')],
      ];
      var wsInfo = XLSX.utils.aoa_to_sheet(info);
      wsInfo['!cols'] = [{ wch: 18 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, wsInfo, 'Document');

      var rows = [['#', 'Description', 'Details', 'Qty', 'Unit price', 'Amount']];
      (totals.lines || []).forEach(function (line, i) {
        var item = (d.items || [])[i] || {};
        rows.push([
          i + 1,
          String(item.description || ''),
          String(item.details || ''),
          Number(String(item.quantity == null ? '' : item.quantity).replace(/[^0-9.\-]/g, '')) || 0,
          toMajor(line.unitPrice, dec),
          toMajor(line.amount, dec),
        ]);
      });
      rows.push([]);
      rows.push(['', '', '', '', 'Subtotal', toMajor(totals.subtotal, dec)]);
      if (totals.discount > 0) rows.push(['', '', '', '', 'Discount', -toMajor(totals.discount, dec)]);
      if (totals.tax > 0) rows.push(['', '', '', '', 'Tax', toMajor(totals.tax, dec)]);
      rows.push(['', '', '', '', 'Total', toMajor(totals.total, dec)]);
      if (totals.paid > 0) {
        rows.push(['', '', '', '', 'Paid', -toMajor(totals.paid, dec)]);
        rows.push(['', '', '', '', 'Balance due', toMajor(totals.balance, dec)]);
      }
      var wsItems = XLSX.utils.aoa_to_sheet(rows);
      wsItems['!cols'] = [{ wch: 4 }, { wch: 34 }, { wch: 44 }, { wch: 8 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsItems, 'Items');

      var name = fileName((d.kind || 'document') + '-' + (d.number || ''), 'xlsx');
      XLSX.writeFile(wb, name);
      return { ok: true, filename: name, sheets: ['Document', 'Items'] };
    }).catch(function (err) {
      return { ok: false, reason: (err && err.message) || 'unknown', message: 'Excel engine could not load. Try again after refreshing.' };
    });
  }

  /** P&L → 3시트(요약 + 수입 + 비용) */
  function exportPnL(pl, L, calc) {
    return load().then(function (XLSX) {
      var dec = calc.decimals;
      var wb = XLSX.utils.book_new();

      var summary = [
        ['Business', String(pl.business || '')],
        ['Period', String(pl.periodLabel || '')],
        ['Start', String(pl.startDate || '')],
        ['End', String(pl.endDate || '')],
        ['Currency', String(calc.currency || '')],
        [],
        ['Gross revenue', toMajor(calc.grossRevenue, dec)],
        ['Total expenses', toMajor(calc.totalExpenses, dec)],
        ['Net profit', toMajor(calc.netProfit, dec)],
        ['Profit margin (%)', calc.margin == null ? '' : calc.margin],
        [],
        ['Category', 'Amount', 'Share of expenses (%)'],
      ];
      (calc.categories || []).forEach(function (c) {
        summary.push([String(c.category || ''), toMajor(c.amount, dec), c.share]);
      });
      var wsSummary = XLSX.utils.aoa_to_sheet(summary);
      wsSummary['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      var rev = [['Label', 'Amount']].concat((calc.revenue || []).map(function (r) {
        return [String(r.label || ''), toMajor(r.amount, dec)];
      })).concat([['', ''], ['Total revenue', toMajor(calc.grossRevenue, dec)]]);
      var wsRev = XLSX.utils.aoa_to_sheet(rev);
      wsRev['!cols'] = [{ wch: 40 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsRev, 'Revenue');

      var exp = [['Category', 'Expense', 'Amount']].concat((calc.expenses || []).map(function (r) {
        return [String(r.category || ''), String(r.label || ''), toMajor(r.amount, dec)];
      })).concat([['', '', ''], ['', 'Total expenses', toMajor(calc.totalExpenses, dec)]]);
      var wsExp = XLSX.utils.aoa_to_sheet(exp);
      wsExp['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsExp, 'Expenses');

      var name = fileName('PnL-' + (pl.business || ''), 'xlsx');
      XLSX.writeFile(wb, name);
      return { ok: true, filename: name, sheets: ['Summary', 'Revenue', 'Expenses'] };
    }).catch(function (err) {
      return { ok: false, reason: (err && err.message) || 'unknown', message: 'Excel engine could not load. Try again after refreshing.' };
    });
  }

  return { VERSION: VERSION, exportDoc: exportDoc, exportPnL: exportPnL, fileName: fileName };
});
