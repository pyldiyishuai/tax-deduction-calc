/* ==========================================================================
 * ui/form.js — 表单读写（个税专项附加扣除版）
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.UI = APP.UI || {};

(function (UI) {
  'use strict';

  var FIELDS = {
    income: { min: 0, max: 50000000, money: true },
    social: { min: 0, max: 5000000, money: true },
    infants: { min: 0, max: 5, int: true },
    children: { min: 0, max: 5, int: true },
    medical: { min: 0, max: 10000000, money: true }
  };

  var DEFAULTS = {
    income: 240000,
    social: 36000,
    infants: 0,
    children: 1,
    medical: 0
  };

  function stripMoney(s) { return String(s == null ? '' : s).replace(/[^\d.]/g, ''); }

  function groupThousands(s) {
    if (s === '' || s == null) return '';
    var parts = String(s).split('.');
    var intPart = parts[0].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? intPart + '.' + parts[1].slice(0, 2) : intPart;
  }

  function readNum(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var v = parseFloat(String(el.value == null ? '' : el.value).replace(/[,，\s]/g, ''));
    return isFinite(v) ? v : 0;
  }

  function clamp(v, cfg) {
    if (!isFinite(v)) return cfg.min || 0;
    var x = Math.min(Math.max(v, cfg.min), cfg.max);
    return cfg.int ? Math.round(x) : x;
  }

  function getValues() {
    var v = {};
    Object.keys(FIELDS).forEach(function (id) {
      v[id] = clamp(readNum(id), FIELDS[id]);
    });

    var cont = document.getElementById('continuing');
    v.continuing = cont ? Number(cont.value) : 0;

    var rent = document.getElementById('rent');
    v.rent = rent ? Number(rent.value) : 0;

    var loan = document.getElementById('loan');
    v.loan = loan ? loan.checked : false;

    var elder = document.getElementById('elder');
    v.elder = elder ? elder.value : '0';

    return v;
  }

  function setValue(id, value, silent) {
    var el = document.getElementById(id);
    if (!el) return;
    var cfg = FIELDS[id] || {};
    if (cfg.money) el.value = groupThousands(String(Math.round(Number(value) || 0)));
    else el.value = String(Number(value) || 0);
    if (!silent) updateHints();
  }

  function formatMoneyInput(el) {
    var caretFromEnd = el.value.length - (el.selectionStart || 0);
    var formatted = groupThousands(stripMoney(el.value));
    if (formatted === el.value) return;
    el.value = formatted;
    var pos = Math.max(formatted.length - caretFromEnd, 0);
    try { el.setSelectionRange(pos, pos); } catch (e) {}
  }

  function updateHints() {
    var v = getValues();
    var F = UI.Format;
    var monthly = v.income / 12;

    var incomeTip = document.getElementById('incomeTip');
    if (incomeTip) {
      incomeTip.innerHTML = '月均 <b>' + F.moneyFree(monthly, 0) + '</b>' +
        '，基本减除费用 6 万元/年（5,000 元/月）人人都有。';
    }

    var socialTip = document.getElementById('socialTip');
    if (socialTip) {
      socialTip.innerHTML = '社保公积金个人部分可以<b>全额扣除</b>' +
        '，约占年收入 ' + (v.income > 0 ? (v.social / v.income * 100).toFixed(1) : '0') + '%。';
    }

    // 夫妻分配提示
    var totalEl = document.getElementById('totalDed');
    if (totalEl) {
      var ded = APP.Core.Tax.buildDeductions(v);
      totalEl.innerHTML = '全年可扣 <b>' + F.moneyFree(ded.yearly, 0) + '</b>' +
        '（每月 ' + F.moneyFree(ded.monthly, 0) + '）';
    }

    // 贷款 / 租金互斥
    var conflict = document.getElementById('conflictTip');
    if (conflict) {
      if (v.loan && v.rent > 0) {
        conflict.innerHTML = '⚠️ 住房贷款利息和住房租金<b>不能同时享受</b>，' +
          '请只保留金额高的那一项。';
        conflict.style.display = '';
      } else {
        conflict.style.display = 'none';
      }
    }
  }

  function bind(onChange) {
    Object.keys(FIELDS).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var cfg = FIELDS[id];
      el.addEventListener('input', function () {
        if (cfg.money) formatMoneyInput(el);
        updateHints();
        onChange();
      });
      el.addEventListener('blur', function () {
        setValue(id, clamp(readNum(id), cfg));
        onChange();
      });
    });

    ['continuing', 'rent', 'elder'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', function () { updateHints(); onChange(); });
    });

    var loan = document.getElementById('loan');
    if (loan) loan.addEventListener('change', function () { updateHints(); onChange(); });

    // 快捷加减：子女 / 婴幼儿
    document.querySelectorAll('[data-step]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.dataset.step;
        var delta = Number(btn.dataset.delta);
        var cur = readNum(target);
        var cfg = FIELDS[target] || { min: 0, max: 5, int: true };
        setValue(target, clamp(cur + delta, cfg));
        onChange();
      });
    });
  }

  function reset() {
    Object.keys(DEFAULTS).forEach(function (id) { setValue(id, DEFAULTS[id]); });
    var cont = document.getElementById('continuing');
    if (cont) cont.value = '0';
    var rent = document.getElementById('rent');
    if (rent) rent.value = '1100';
    var loan = document.getElementById('loan');
    if (loan) loan.checked = false;
    var elder = document.getElementById('elder');
    if (elder) elder.value = 'only';
    updateHints();
  }

  function init() {
    Object.keys(DEFAULTS).forEach(function (id) { setValue(id, DEFAULTS[id], true); });
    var rent = document.getElementById('rent');
    if (rent) rent.value = '1100';
    var elder = document.getElementById('elder');
    if (elder) elder.value = 'only';
    updateHints();
  }

  UI.Form = {
    init: init, getValues: getValues, setValue: setValue, reset: reset, bind: bind,
    updateHints: updateHints, groupThousands: groupThousands,
    FIELDS: FIELDS, DEFAULTS: DEFAULTS
  };
})(APP.UI);
