/* ============================================================
   pdf-export.js · Invoice / Receipt / Quote / P&L → A4 PDF
   ------------------------------------------------------------
   인쇄(window.print) 대신 jsPDF + jspdf-autotable 로 좌표가 고정된
   PDF를 만든다. 브라우저·프린터 설정에 따라 여백이 달라지지 않는다.

   - 금액은 ledger.js가 계산한 정수 최소단위(BigInt) 값을 그대로 받아
     표시만 한다(재계산 없음 → 반올림 차이 없음).
   - 영문 문서라 jsPDF 기본 Helvetica를 쓴다(폰트 임베드 없음).
   - jsPDF 4.2.1 (MIT) · jspdf-autotable 5.0.9 (MIT) 지연 로딩.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.InvoicePDF = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var cache = {};

  function load(src) {
    if (cache[src]) return cache[src];
    cache[src] = new Promise(function (resolve, reject) {
      if (!root.document) { reject(new Error('no_document')); return; }
      var s = root.document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { cache[src] = null; reject(new Error('load_failed:' + src)); };
      root.document.head.appendChild(s);
    });
    return cache[src];
  }

  function deps() {
    var okJs = root.jspdf && root.jspdf.jsPDF;
    var chain = okJs ? Promise.resolve(true) : load('assets/vendor/jspdf.umd.min.js');
    return chain
      .then(function () {
        if (root.jspdf.jsPDF.API.autoTable) return true;
        return load('assets/vendor/jspdf.plugin.autotable.min.js');
      });
  }

  function newDoc(paper) {
    var format = String(paper || 'a4').toLowerCase() === 'letter' ? 'letter' : 'a4';
    return new root.jspdf.jsPDF({ unit: 'mm', format: format, compress: true });
  }

  function money(L, minor, currency) {
    return L.formatMoney(minor, currency);
  }

  function footer(doc, label) {
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text((label || '') + '   ·   ' + i + ' / ' + n, 105, 289, { align: 'center' });
    }
  }

  /* ── Invoice · Receipt · Quote ─────────────────────────── */

  function buildDoc(docState, L, totals) {
    var doc = newDoc(docState.paper);
    var W = 210;
    var M = 16;
    var y = 18;
    var cur = totals.currency;
    var d = docState;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(20);
    doc.text(String(d.kind || 'INVOICE'), M, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    var meta = [
      d.number ? 'No. ' + d.number : '',
      d.issueDate ? 'Issued ' + L.formatDate(d.issueDate) : '',
      d.dueDate ? 'Due ' + L.formatDate(d.dueDate) : '',
    ].filter(Boolean).join('   ·   ');
    doc.text(meta, W - M, y, { align: 'right' });

    y += 10;
    doc.setDrawColor(228);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 8;

    /* From / Bill to */
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text('FROM', M, y);
    doc.text(d.kind === 'RECEIPT' ? 'RECEIVED FROM' : 'BILL TO', M + 92, y);
    y += 5;

    doc.setTextColor(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(String((d.from && d.from.name) || ''), M, y);
    doc.text(String((d.billTo && d.billTo.name) || ''), M + 92, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    doc.setTextColor(80);

    var fromLines = [
      (d.from && d.from.email) || '',
      (d.from && d.from.phone) || '',
      (d.from && d.from.address) || '',
      (d.from && d.from.taxId) || '',
    ].filter(Boolean);
    var billLines = [
      (d.billTo && d.billTo.contact) || '',
      (d.billTo && d.billTo.email) || '',
      (d.billTo && d.billTo.address) || '',
    ].filter(Boolean);

    function block(lines, x) {
      var yy = y;
      lines.forEach(function (line) {
        var wrapped = doc.splitTextToSize(String(line), 78);
        wrapped.forEach(function (l) {
          doc.text(l, x, yy);
          yy += 4;
        });
      });
      return yy;
    }
    var yFrom = block(fromLines, M);
    var yBill = block(billLines, M + 92);
    y = Math.max(yFrom, yBill) + 6;

    /* Items */
    var body = (totals.lines || []).map(function (line, i) {
      var item = (d.items || [])[i] || {};
      return [
        String(i + 1),
        String(item.description || '') + (item.details ? '\n' + item.details : ''),
        String(item.quantity == null ? '' : item.quantity),
        money(L, line.unitPrice, cur),
        money(L, line.amount, cur),
      ];
    });

    var totalRows = [];
    totalRows.push(['', 'Subtotal', '', '', money(L, totals.subtotal, cur)]);
    if (totals.discount > 0) {
      var dPct = totals.discountRate && L.formatPercent ? ' (' + L.formatPercent(totals.discountRate) + ')' : '';
      totalRows.push(['', 'Discount' + dPct, '', '', '-' + money(L, totals.discount, cur)]);
    }
    if (totals.tax > 0) {
      var tPct = totals.taxRate && L.formatPercent ? ' (' + L.formatPercent(totals.taxRate) + ')' : '';
      totalRows.push(['', (d.tax && d.tax.label ? d.tax.label : 'Tax') + tPct, '', '', money(L, totals.tax, cur)]);
    }
    totalRows.push(['', 'Total', '', '', money(L, totals.total, cur)]);
    if (totals.paid > 0) {
      totalRows.push(['', 'Paid', '', '', '-' + money(L, totals.paid, cur)]);
      totalRows.push(['', 'Balance due', '', '', money(L, totals.balance, cur)]);
    }

    doc.autoTable({
      startY: y,
      margin: { left: M, right: M, top: 18, bottom: 20 },
      head: [['#', 'Description', 'Qty', 'Unit price', 'Amount']],
      body: body.concat(totalRows),
      styles: { font: 'helvetica', fontSize: 8.6, cellPadding: 2.2, lineColor: [230, 230, 230], lineWidth: 0.2, textColor: [30, 30, 30] },
      headStyles: { fillColor: [25, 27, 33], textColor: [255, 255, 255], fontSize: 8.6, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 96 },
        2: { cellWidth: 16, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 33, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [250, 250, 251] },
      didParseCell: function (data) {
        if (data.section !== 'body') return;
        if (data.row.index >= body.length) {
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.halign = 'right';
          var label = String((data.row.raw && data.row.raw[1]) || '');
          if (label === 'Total' || label === 'Balance due') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 9.6;
          }
        }
      },
    });

    y = doc.lastAutoTable.finalY + 8;

    /* Notes & terms */
    var notes = [d.terms, d.notes].filter(function (s) { return String(s || '').trim(); });
    if (notes.length && y < 250) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(40);
      doc.text('Notes', M, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.6);
      doc.setTextColor(90);
      notes.forEach(function (line) {
        var wrapped = doc.splitTextToSize(String(line), W - M * 2);
        wrapped.forEach(function (l) {
          if (y > 278) { doc.addPage(); y = 20; }
          doc.text(l, M, y);
          y += 4.2;
        });
        y += 1.5;
      });
    }

    footer(doc, [d.from && d.from.name, d.number].filter(Boolean).join(' · '));
    return doc;
  }

  /* ── P&L ───────────────────────────────────────────────── */

  function buildPnL(pl, L, calc) {
    var doc = newDoc('a4');
    var W = 210, M = 16, y = 18;
    var cur = calc.currency;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(20);
    doc.text('PROFIT & LOSS', M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(String(pl.business || ''), W - M, y, { align: 'right' });
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(90);
    var period = (pl.periodLabel || '') + '   ' + [pl.startDate && L.formatDate(pl.startDate), pl.endDate && L.formatDate(pl.endDate)].filter(Boolean).join(' – ');
    doc.text(period.trim(), M, y);
    y += 6;
    doc.setDrawColor(228);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 4;

    doc.autoTable({
      startY: y,
      margin: { left: M, right: M, top: 18, bottom: 20 },
      head: [['Revenue', 'Amount']],
      body: (calc.revenue || []).map(function (r) { return [String(r.label || ''), money(L, r.amount, cur)]; })
        .concat([['Total revenue', money(L, calc.grossRevenue, cur)]]),
      styles: { font: 'helvetica', fontSize: 8.8, cellPadding: 2.2, lineColor: [232, 232, 232], lineWidth: 0.2 },
      headStyles: { fillColor: [25, 27, 33], textColor: [255, 255, 255], fontSize: 9 },
      columnStyles: { 0: { cellWidth: 128 }, 1: { cellWidth: 50, halign: 'right' } },
      didParseCell: function (data) {
        if (data.section === 'body' && data.row.index === (calc.revenue || []).length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [248, 249, 251];
        }
      },
    });
    y = doc.lastAutoTable.finalY + 6;

    doc.autoTable({
      startY: y,
      margin: { left: M, right: M, top: 18, bottom: 20 },
      head: [['Category', 'Expense', 'Amount']],
      body: (calc.expenses || []).map(function (r) {
        return [String(r.category || ''), String(r.label || ''), money(L, r.amount, cur)];
      }).concat([['', 'Total expenses', money(L, calc.totalExpenses, cur)]]),
      styles: { font: 'helvetica', fontSize: 8.8, cellPadding: 2.2, lineColor: [232, 232, 232], lineWidth: 0.2 },
      headStyles: { fillColor: [25, 27, 33], textColor: [255, 255, 255], fontSize: 9 },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 88 }, 2: { cellWidth: 40, halign: 'right' } },
      didParseCell: function (data) {
        if (data.section === 'body' && data.row.index === (calc.expenses || []).length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [248, 249, 251];
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;

    var summary = [
      ['Net profit', money(L, calc.netProfit, cur)],
      ['Profit margin', calc.margin != null ? String(calc.margin) + '%' : '—'],
      ['Expense ratio', calc.grossRevenue > 0 ? (Math.round(calc.totalExpenses / calc.grossRevenue * 1000) / 10) + '%' : '—'],
    ];
    doc.autoTable({
      startY: y,
      margin: { left: M, right: M, bottom: 20 },
      body: summary,
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.6, lineColor: [232, 232, 232], lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 40, halign: 'right' } },
      theme: 'grid',
    });

    footer(doc, pl.business || '');
    return doc;
  }

  function fileName(base, ext) {
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var clean = String(base || 'document').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
    return clean + '-' + stamp + '.' + ext;
  }

  function exportDoc(docState, L, totals, opts) {
    var o = opts || {};
    if (!root.document) return Promise.resolve({ ok: false, message: 'Open this page in a browser to export.' });
    return deps().then(function () {
      var doc = buildDoc(docState, L, totals);
      var name = fileName((docState.kind || 'document') + '-' + (docState.number || ''), 'pdf');
      doc.save(name);
      return { ok: true, filename: name, pages: doc.getNumberOfPages() };
    }).catch(function (err) {
      return { ok: false, reason: (err && err.message) || 'unknown', message: 'PDF engine could not load. Use Print / Save as PDF instead.' };
    });
  }

  function exportPnL(pl, L, calc, opts) {
    if (!root.document) return Promise.resolve({ ok: false, message: 'Open this page in a browser to export.' });
    return deps().then(function () {
      var doc = buildPnL(pl, L, calc);
      var name = fileName('PnL-' + (pl.business || ''), 'pdf');
      doc.save(name);
      return { ok: true, filename: name, pages: doc.getNumberOfPages() };
    }).catch(function (err) {
      return { ok: false, reason: (err && err.message) || 'unknown', message: 'PDF engine could not load. Use Print / Save as PDF instead.' };
    });
  }

  return { VERSION: VERSION, exportDoc: exportDoc, exportPnL: exportPnL, fileName: fileName };
});
