/* ==========================================================================
 * core/tax.js — 个税与专项附加扣除计算（纯函数层）
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.Core = APP.Core || {};

(function (Core) {
  'use strict';

  function n(v) {
    var x = Number(v);
    return isFinite(x) ? x : 0;
  }
  function r2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
  function rules() { return APP.DATA || {}; }

  /* ======================================================================
   * 一、税率表
   * ==================================================================== */

  /** 按年度应纳税所得额查档 */
  function bracketOf(taxable) {
    var table = rules().brackets || [];
    var t = Math.max(n(taxable), 0);
    for (var i = 0; i < table.length; i++) {
      if (t <= table[i].upTo) return table[i];
    }
    return table[table.length - 1];
  }

  /** 速算：应纳税额 = 应纳税所得额 × 税率 − 速算扣除数 */
  function taxOf(taxable) {
    var t = Math.max(n(taxable), 0);
    if (t <= 0) return 0;
    var b = bracketOf(t);
    return Math.max(r2(t * b.rate - b.deduct), 0);
  }

  /** 边际税率（用于算扣除项的价值） */
  function marginalRate(taxable) {
    return bracketOf(taxable).rate;
  }

  /* ======================================================================
   * 二、专项附加扣除计算
   * ==================================================================== */

  /**
   * @param {Object} f
   *  f.infants     婴幼儿数量
   *  f.children    子女数量
   *  f.continuing  继续教育档位（0 / 400 / 300）
   *  f.medical     大病医疗个人自付金额
   *  f.loan        是否有首套房贷（bool）
   *  f.rent        租金档位（0 / 1500 / 1100 / 800）
   *  f.elder       赡养老人档位：0 / 'only' / 'shared'
   */
  function buildDeductions(f) {
    var list = [];
    var defs = rules().deductions || [];
    var total = 0;

    defs.forEach(function (def) {
      var monthly = 0;
      var yearly = 0;
      var label = '';
      var active = false;

      if (def.key === 'infant') {
        var cnt = Math.min(Math.max(Math.round(n(f.infants)), 0), def.max);
        monthly = cnt * def.monthly;
        yearly = monthly * 12;
        label = cnt > 0 ? cnt + ' 个 × ' + def.monthly + ' 元/月' : '没有 3 岁以下婴幼儿';
        active = cnt > 0;
      } else if (def.key === 'education') {
        var c2 = Math.min(Math.max(Math.round(n(f.children)), 0), def.max);
        monthly = c2 * def.monthly;
        yearly = monthly * 12;
        label = c2 > 0 ? c2 + ' 个 × ' + def.monthly + ' 元/月' : '没有处于教育阶段的子女';
        active = c2 > 0;
      } else if (def.key === 'continuing') {
        var opt = n(f.continuing);
        monthly = opt;
        yearly = monthly * 12;
        var found = (def.options || []).filter(function (o) { return o.value === opt; })[0];
        label = found && opt > 0 ? found.label + ' ' + opt + ' 元/月' : '没有继续教育';
        active = opt > 0;
      } else if (def.key === 'medical') {
        var paid = Math.max(n(f.medical), 0);
        var over = Math.max(paid - def.threshold, 0);
        yearly = Math.min(over, def.yearlyCap);
        monthly = yearly / 12;
        label = paid > 0
          ? '自付 ' + Math.round(paid).toLocaleString('zh-CN') + ' 元，' +
            (over > 0
              ? '扣除 ' + Math.round(yearly).toLocaleString('zh-CN') + ' 元'
              : '未超过 ' + def.threshold.toLocaleString('zh-CN') + ' 元门槛')
          : '没有大病医疗支出';
        active = yearly > 0;
      } else if (def.key === 'loan') {
        var hasLoan = !!f.loan;
        monthly = hasLoan ? def.monthly : 0;
        yearly = monthly * 12;
        label = hasLoan ? '首套房贷 ' + def.monthly + ' 元/月' : '没有首套房贷';
        active = hasLoan;
      } else if (def.key === 'rent') {
        var rent = n(f.rent);
        monthly = rent;
        yearly = rent * 12;
        var rf = (def.options || []).filter(function (o) { return o.value === rent; })[0];
        label = rent > 0 ? (rf ? rf.label : '') + ' ' + rent + ' 元/月' : '没有租房支出';
        active = rent > 0;
      } else if (def.key === 'elder') {
        var e = String(f.elder || '0');
        if (e === 'only') { monthly = def.onlyChild; label = '独生子女 ' + def.onlyChild + ' 元/月'; active = true; }
        else if (e === 'shared') { monthly = def.sharedMax; label = '非独生子女分摊 ' + def.sharedMax + ' 元/月'; active = true; }
        else { monthly = 0; label = '没有赡养老人支出'; }
        yearly = monthly * 12;
      }

      total += yearly;
      list.push({
        key: def.key,
        name: def.name,
        icon: def.icon,
        desc: def.desc,
        basis: def.basis,
        note: def.note,
        active: active,
        monthly: r2(monthly),
        yearly: r2(yearly),
        label: label
      });
    });

    return {
      list: list,
      yearly: r2(total),
      monthly: r2(total / 12),
      activeCount: list.filter(function (i) { return i.active; }).length
    };
  }

  /* ======================================================================
   * 三、主计算
   * ==================================================================== */

  /**
   * @param {Object} f
   *  f.income      年收入（税前）
   *  f.social      个人缴纳的社保公积金（年）
   *  其余为专项附加扣除字段
   */
  function buildResult(f) {
    var income = Math.max(n(f.income), 0);
    var social = Math.min(Math.max(n(f.social), 0), income);

    var basic = rules().basicDeduction || 60000;
    var ded = buildDeductions(f);

    // 不含专项附加扣除
    var taxableBase = Math.max(income - social - basic, 0);
    var taxBase = taxOf(taxableBase);

    // 含专项附加扣除
    var taxableFull = Math.max(income - social - basic - ded.yearly, 0);
    var taxFull = taxOf(taxableFull);

    var saved = r2(taxBase - taxFull);
    var rate = marginalRate(taxableFull || taxableBase);

    // 各项扣除的抵税价值（按最终边际税率）
    var items = ded.list.map(function (it) {
      return Object.assign({}, it, {
        taxValue: r2(it.yearly * rate)
      });
    });

    // 分档明细（含专项）
    var brackets = breakdown(taxableFull);

    return {
      valid: income > 0,
      input: {
        income: r2(income),
        social: r2(social)
      },
      basic: r2(basic),
      deduction: {
        list: items,
        yearly: ded.yearly,
        monthly: ded.monthly,
        activeCount: items.filter(function (i) { return i.active; }).length
      },
      taxable: {
        base: r2(taxableBase),
        full: r2(taxableFull),
        reduced: r2(taxableBase - taxableFull)
      },
      tax: {
        base: taxBase,
        full: taxFull,
        saved: saved,
        savedMonthly: r2(saved / 12),
        rate: rate
      },
      effective: {
        rateBase: income > 0 ? r2(taxBase / income * 100) : 0,
        rateFull: income > 0 ? r2(taxFull / income * 100) : 0,
        netAfter: r2(income - social - taxFull)
      },
      brackets: brackets,
      tips: buildTips(income, ded, saved, rate, taxableFull)
    };
  }

  /* ======================================================================
   * 四、分档明细
   * ==================================================================== */

  function breakdown(taxable) {
    var table = rules().brackets || [];
    var t = Math.max(n(taxable), 0);
    var out = [];
    var lower = 0;

    for (var i = 0; i < table.length; i++) {
      var b = table[i];
      if (t <= lower) break;
      var upper = b.upTo === Infinity ? t : Math.min(b.upTo, t);
      var amount = upper - lower;
      if (amount <= 0) break;
      out.push({
        rate: b.rate,
        from: lower,
        to: upper,
        amount: r2(amount),
        tax: r2(amount * b.rate)
      });
      lower = upper;
      if (t <= b.upTo) break;
    }
    return out;
  }

  /* ======================================================================
   * 五、提示
   * ==================================================================== */

  function buildTips(income, ded, saved, rate, taxableFull) {
    var out = [];
    var notes = rules().notes || {};

    if (ded.activeCount === 0) {
      out.push({
        type: 'warn',
        text: '你还没有填任何专项附加扣除。<b>这是纯损失</b>——' +
              '只要有子女、租房、房贷、赡养老人中的任何一项，都可以填。'
      });
    } else if (saved > 0) {
      out.push({
        type: 'ok',
        text: '填了 <b>' + ded.activeCount + ' 项</b>扣除，一年少缴 <b>' +
              Math.round(saved).toLocaleString('zh-CN') + ' 元</b>，' +
              '平均每月 ' + Math.round(saved / 12).toLocaleString('zh-CN') + ' 元。'
      });
    }

    // 边际税率提示
    if (rate >= 0.2) {
      out.push({
        type: 'tip',
        text: '你的边际税率是 <b>' + (rate * 100) + '%</b>，' +
              '每多扣 1000 元就少缴 <b>' + Math.round(1000 * rate) + ' 元</b>。' +
              '收入越高，同样的扣除越值钱——所以夫妻之间' +
              '<b>让税率高的一方扣</b>更划算。'
      });
    }

    // 临界点提示
    var table = rules().brackets || [];
    for (var i = 0; i < table.length - 1; i++) {
      var gap = table[i].upTo - taxableFull;
      if (gap > 0 && gap <= 6000) {
        out.push({
          type: 'info',
          text: '你的应纳税所得额距离 <b>' + table[i].upTo.toLocaleString('zh-CN') +
                ' 元</b>这个税率分界点只差 <b>' + Math.round(gap).toLocaleString('zh-CN') +
                ' 元</b>。再多扣一点就能降到 ' + (table[i].rate * 100) + '% 档。'
        });
        break;
      }
    }

    if (taxableFull <= 0 && income > 0) {
      out.push({
        type: 'ok',
        text: '扣除之后应纳税所得额为 0，<b>不用缴个税</b>。' +
              '如果单位已经预扣了，汇算清缴时可以全额退回。'
      });
    }

    out.push({ type: 'info', text: notes.value });
    out.push({ type: 'tip', text: notes.app });
    out.push({ type: 'info', text: notes.refund });

    return out;
  }

  /* ======================================================================
   * 六、扩展
   * ==================================================================== */

  /** 达到某档最高限额所需的扣除金额 */
  function deductionToReach(taxableBase, targetBracketIndex) {
    var table = rules().brackets || [];
    var target = table[Math.max(targetBracketIndex, 0)];
    if (!target) return 0;
    var base = Math.max(n(taxableBase), 0);
    return r2(Math.max(base - target.upTo, 0));
  }

  /** 年终奖单独计税对比（简化：用月度税率表） */
  function monthlyTax(amount) {
    var t = Math.max(n(amount), 0);
    if (t <= 3000) return r2(t * 0.03);
    if (t <= 12000) return r2(t * 0.10 - 210);
    if (t <= 25000) return r2(t * 0.20 - 1410);
    if (t <= 35000) return r2(t * 0.25 - 2660);
    return r2(t * 0.30 - 4410);
  }

  Core.Tax = {
    buildResult: buildResult,
    buildDeductions: buildDeductions,
    bracketOf: bracketOf,
    taxOf: taxOf,
    marginalRate: marginalRate,
    breakdown: breakdown,
    deductionToReach: deductionToReach
  };
})(APP.Core);
