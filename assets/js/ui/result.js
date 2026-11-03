/* ==========================================================================
 * ui/result.js — 结果渲染（个税专项附加扣除版）
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.UI = APP.UI || {};

(function (UI) {
  'use strict';

  var F = null;
  function fmt() { if (!F) F = UI.Format; return F; }

  var animRaf = {};
  function animateValue(el, from, to, formatter, duration) {
    if (!el) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !isFinite(from) || !isFinite(to)) { el.textContent = formatter(to); return; }
    var id = el.id || (el.id = 'v' + Math.random().toString(36).slice(2));
    if (animRaf[id]) cancelAnimationFrame(animRaf[id]);
    var start = performance.now(), dur = duration || 660, delta = to - from;
    function step(now) {
      var t = Math.min((now - start) / dur, 1);
      var e = 1 - Math.pow(1 - t, 3);
      el.textContent = formatter(from + delta * e);
      if (t < 1) animRaf[id] = requestAnimationFrame(step);
      else animRaf[id] = null;
    }
    animRaf[id] = requestAnimationFrame(step);
  }

  var prevSaved = 0;

  function renderAll(r) {
    var f = fmt();
    renderHero(r, f);
    renderCompare(r, f);
    renderDeductions(r, f);
    renderBrackets(r, f);
    renderTips(r.tips);

    var stamp = document.getElementById('resultStamp');
    if (stamp) {
      stamp.textContent = '已更新 ' + new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit', minute: '2-digit'
      });
      stamp.classList.add('is-fresh');
      setTimeout(function () { stamp.classList.remove('is-fresh'); }, 1400);
    }
    setText('dockSave', f.num(r.tax.saved, 0));
  }

  function renderHero(r, f) {
    animateValue(document.getElementById('heroValue'), prevSaved, r.tax.saved,
      function (v) { return f.num(v, 0); }, 720);
    prevSaved = r.tax.saved;

    var sub = document.getElementById('heroSub');
    if (sub) {
      sub.innerHTML = r.tax.saved > 0
        ? '平均每月少缴 <b>' + f.moneyFree(r.tax.savedMonthly, 0) + '</b>，' +
          '按边际税率 <b>' + (r.tax.rate * 100) + '%</b> 计算'
        : '当前没有可享受的专项附加扣除';
    }

    var badge = document.getElementById('rateBadge');
    if (badge) {
      badge.textContent = (r.tax.rate * 100) + '% 档';
      badge.className = 'result__level';
    }

    setText('taxBase', f.moneyFree(r.tax.base, 0));
    setText('taxFull', f.moneyFree(r.tax.full, 0));
    setText('taxableBase', f.moneyFree(r.taxable.base, 0));
    setText('taxableFull', f.moneyFree(r.taxable.full, 0));
    setText('netAfter', f.moneyFree(r.effective.netAfter, 0));
  }

  /* ---------- 对比 ---------- */
  function renderCompare(r, f) {
    var bar = document.getElementById('cmpBar');
    if (!bar) return;

    var max = Math.max(r.tax.base, 1);
    var pBase = 100;
    var pFull = Math.max((r.tax.full / max) * 100, 0);

    bar.innerHTML =
      '<div class="cmp-row">' +
        '<span class="cmp-label">不填扣除</span>' +
        '<div class="cmp-track"><div class="cmp-fill cmp-fill--base" style="width:' + pBase + '%"></div></div>' +
        '<b class="cmp-val">' + f.moneyFree(r.tax.base, 0) + '</b>' +
      '</div>' +
      '<div class="cmp-row">' +
        '<span class="cmp-label">填了扣除</span>' +
        '<div class="cmp-track"><div class="cmp-fill cmp-fill--full" style="width:' + pFull + '%"></div></div>' +
        '<b class="cmp-val cmp-val--ok">' + f.moneyFree(r.tax.full, 0) + '</b>' +
      '</div>' +
      '<p class="cmp-note">' +
        '应纳税所得额从 <b>' + f.moneyFree(r.taxable.base, 0) + '</b> 降到 <b>' +
        f.moneyFree(r.taxable.full, 0) + '</b>，少缴 <b class="ok">' +
        f.moneyFree(r.tax.saved, 0) + '</b>' +
      '</p>';
  }

  /* ---------- 七项扣除 ---------- */
  function renderDeductions(r, f) {
    var box = document.getElementById('dedBox');
    if (!box) return;

    box.innerHTML = r.deduction.list.map(function (it) {
      var cls = 'ded' + (it.active ? ' is-on' : '');
      var val = it.active
        ? (it.yearly >= 12000
            ? f.moneyFree(it.yearly, 0) + '<small>/年</small>'
            : f.moneyFree(it.yearly, 0) + '<small>/年</small>')
        : '—';
      return '<div class="' + cls + '">' +
        '<span class="ded__icon" aria-hidden="true">' + it.icon + '</span>' +
        '<div class="ded__body">' +
          '<div class="ded__top">' +
            '<b class="ded__name">' + it.name + '</b>' +
            '<span class="ded__val">' + val + '</span>' +
          '</div>' +
          '<p class="ded__label">' + it.label + '</p>' +
          (it.active
            ? '<p class="ded__tax">抵税 <b>' + f.moneyFree(it.taxValue, 0) + '</b></p>'
            : '<p class="ded__desc">' + it.desc + '</p>') +
        '</div>' +
      '</div>';
    }).join('') +
    '<div class="ded__total">' +
      '<span>全年扣除合计</span>' +
      '<b>' + f.moneyFree(r.deduction.yearly, 0) + '</b>' +
    '</div>';
  }

  /* ---------- 税率分档 ---------- */
  function renderBrackets(r, f) {
    var box = document.getElementById('bracketBox');
    if (!box) return;

    if (!r.brackets.length) {
      box.innerHTML = '<div class="bracket-empty">应纳税所得额为 0，不用缴个税。</div>';
      return;
    }

    var total = r.brackets.reduce(function (s, b) { return s + b.tax; }, 0) || 1;

    box.innerHTML = r.brackets.map(function (b) {
      var pct = (b.tax / total) * 100;
      return '<div class="bk-row">' +
        '<span class="bk-rate">' + (b.rate * 100) + '%</span>' +
        '<div class="bk-body">' +
          '<div class="bk-bar"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
          '<span class="bk-range">' + f.num(b.amount, 0) + ' 元按 ' +
            (b.rate * 100) + '% 计</span>' +
        '</div>' +
        '<b class="bk-tax">' + f.moneyFree(b.tax, 0) + '</b>' +
      '</div>';
    }).join('') +
    '<div class="bk-total">' +
      '<span>全年应缴个税</span>' +
      '<b>' + f.moneyFree(r.tax.full, 0) + '</b>' +
    '</div>';
  }

  /* ---------- 提示 ---------- */
  function renderTips(list) {
    var textEl = document.getElementById('adviceText');
    var box = document.getElementById('advice');
    if (!textEl || !list) return;
    textEl.innerHTML = list.map(function (item, i) {
      var cls = 'advice__item advice__item--' + (item.type || 'info');
      if (i === 0) cls += ' advice__lead';
      return '<span class="' + cls + '">' + item.text + '</span>';
    }).join('');
    if (box) box.style.display = '';
  }

  /* ---------- 误区 ---------- */
  function renderMyths() {
    var box = document.getElementById('mythList');
    var list = (APP.DATA && APP.DATA.myths) || [];
    if (!box) return;
    box.innerHTML = list.map(function (t, i) {
      return '<div class="myth__item">' +
        '<span class="myth__num">' + (i + 1) + '</span>' +
        '<div class="myth__body">' +
          '<h3 class="myth__title">' + t.title + '</h3>' +
          '<p class="myth__text">' + t.text + '</p>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  UI.Result = {
    renderAll: renderAll,
    renderMyths: renderMyths
  };
})(APP.UI);
