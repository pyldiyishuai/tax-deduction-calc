/* ==========================================================================
 * tests/smoke.js — 个税专项附加扣除计算器冒烟测试
 * ========================================================================== */

(async function () {
  var out = { total: 0, passed: 0, failed: 0, failures: [] };

  function ok(name, cond, got) {
    out.total++;
    if (cond) out.passed++;
    else { out.failed++; out.failures.push(name + '  →  got: ' + JSON.stringify(got)); }
  }
  function eq(name, got, want) {
    ok(name, String(got) === String(want), got + ' (want ' + want + ')');
  }
  function near(name, got, want, tol) {
    ok(name, Math.abs(Number(got) - Number(want)) <= (tol == null ? 0.5 : tol),
       got + ' (want ' + want + ')');
  }
  function $(id) { return document.getElementById(id); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var T = APP.Core.Tax;

  function base(over) {
    var f = {
      income: 240000, social: 36000,
      infants: 0, children: 1, continuing: 0, medical: 0,
      loan: false, rent: 1100, elder: 'only'
    };
    Object.keys(over || {}).forEach(function (k) { f[k] = over[k]; });
    return f;
  }

  /* ==================================================================
   * 一、税率表
   * ================================================================== */

  eq('应纳税所得额 0 → 税率 3%', T.bracketOf(0).rate, 0.03);
  eq('36,000 仍在 3% 档', T.bracketOf(36000).rate, 0.03);
  eq('36,001 进入 10% 档', T.bracketOf(36001).rate, 0.10);
  eq('144,000 仍在 10% 档', T.bracketOf(144000).rate, 0.10);
  eq('144,001 进入 20% 档', T.bracketOf(144001).rate, 0.20);
  eq('30 万进 25%', T.bracketOf(300001).rate, 0.25);
  eq('42 万进 30%', T.bracketOf(420001).rate, 0.30);
  eq('66 万进 35%', T.bracketOf(660001).rate, 0.35);
  eq('96 万进 45%', T.bracketOf(960001).rate, 0.45);
  eq('1000 万仍是 45%', T.bracketOf(10000000).rate, 0.45);

  eq('36,000 的税 = 1,080', T.taxOf(36000), 1080);
  eq('144,000 的税 = 11,880', T.taxOf(144000), 11880);
  eq('300,000 的税 = 43,080', T.taxOf(300000), 43080);
  eq('420,000 的税 = 73,080', T.taxOf(420000), 73080);
  eq('660,000 的税 = 145,080', T.taxOf(660000), 145080);
  eq('960,000 的税 = 250,080', T.taxOf(960000), 250080);
  eq('0 的税 = 0', T.taxOf(0), 0);
  eq('负数返回 0', T.taxOf(-1000), 0);
  eq('100 万的税 = 268,080', T.taxOf(1000000), 268080);

  /* ==================================================================
   * 二、七项扣除逐项
   * ================================================================== */

  var d1 = T.buildDeductions(base());
  eq('默认：子女 1 个 → 24,000/年', d1.list[1].yearly, 24000);
  eq('默认：租金 1,100 → 13,200/年', d1.list[5].yearly, 13200);
  eq('默认：独生子女 → 36,000/年', d1.list[6].yearly, 36000);
  eq('默认：合计 73,200', d1.yearly, 73200);
  eq('默认：月度 6,100', d1.monthly, 6100);
  eq('默认：启用 3 项', d1.activeCount, 3);

  // 婴幼儿
  var dInfant = T.buildDeductions(base({ infants: 2 }));
  eq('2 个婴幼儿 → 48,000/年', dInfant.list[0].yearly, 48000);
  near('婴幼儿月度 4,000', dInfant.list[0].monthly, 4000);

  // 子女
  var dChild = T.buildDeductions(base({ children: 3 }));
  eq('3 个子女 → 72,000/年', dChild.list[1].yearly, 72000);
  eq('子女数量上限 5', T.buildDeductions(base({ children: 9 })).list[1].yearly, 120000);

  // 继续教育
  var dCont = T.buildDeductions(base({ continuing: 400 }));
  eq('学历继续教育 400 → 4,800/年', dCont.list[2].yearly, 4800);
  var dCert = T.buildDeductions(base({ continuing: 300 }));
  eq('职业资格 300/月 → 3,600/年', dCert.list[2].yearly, 3600);

  // 大病医疗
  var dMed0 = T.buildDeductions(base({ medical: 10000 }));
  eq('大病 1 万不超门槛 → 0', dMed0.list[3].yearly, 0);
  var dMed1 = T.buildDeductions(base({ medical: 20000 }));
  eq('大病 2 万 → 扣 5,000', dMed1.list[3].yearly, 5000);
  var dMed2 = T.buildDeductions(base({ medical: 50000 }));
  eq('大病 5 万 → 扣 35,000', dMed2.list[3].yearly, 35000);
  var dMed3 = T.buildDeductions(base({ medical: 200000 }));
  eq('大病 20 万封顶 80,000', dMed3.list[3].yearly, 80000);
  eq('大病 15,000 整不扣', T.buildDeductions(base({ medical: 15000 })).list[3].yearly, 0);
  eq('大病 15,001 扣 1 元', T.buildDeductions(base({ medical: 15001 })).list[3].yearly, 1);

  // 房贷
  var dLoan = T.buildDeductions(base({ loan: true }));
  eq('有房贷 → 12,000/年', dLoan.list[4].yearly, 12000);
  eq('无房贷 → 0', dLoan.list[4].yearly === 0 ? 0 : 1, 1);

  // 租金三档
  eq('租金 1,500 → 18,000', T.buildDeductions(base({ rent: 1500 })).list[5].yearly, 18000);
  eq('租金 800 → 9,600', T.buildDeductions(base({ rent: 800 })).list[5].yearly, 9600);
  eq('租金 0 → 0', T.buildDeductions(base({ rent: 0 })).list[5].yearly, 0);

  // 赡养老人
  eq('非独生分摊 → 18,000/年', T.buildDeductions(base({ elder: 'shared' })).list[6].yearly, 18000);
  eq('不赡养老人 → 0', T.buildDeductions(base({ elder: '0' })).list[6].yearly, 0);

  /* ==================================================================
   * 三、主计算（默认场景）
   * ================================================================== */

  var r = T.buildResult(base());

  eq('基本减除 60,000', r.basic, 60000);
  eq('应纳税所得额（不含专项）= 240000-36000-60000 = 144,000', r.taxable.base, 144000);
  eq('应纳税所得额（含专项）= 144000-73200 = 70,800', r.taxable.full, 70800);
  eq('减少 73,200', r.taxable.reduced, 73200);

  eq('不填扣除的税 11,880', r.tax.base, 11880);
  eq('填了扣除的税 4,560', r.tax.full, 4560);
  eq('少缴 7,320', r.tax.saved, 7320);
  eq('平均每月少缴 610', r.tax.savedMonthly, 610);
  eq('边际税率 10%', r.tax.rate, 0.10);

  eq('税后到手 = 240000-36000-4560 = 199,440', r.effective.netAfter, 199440);
  near('实际税负（不含专项）9.95%', r.effective.rateBase, 4.95, 0.05);

  /* ==================================================================
   * 四、边际税率与抵税价值
   * ================================================================== */

  var childItem = r.deduction.list[1];
  eq('子女教育抵税 = 24000 × 10% = 2,400', childItem.taxValue, 2400);
  var elderItem = r.deduction.list[6];
  eq('赡养老人抵税 = 36000 × 10% = 3,600', elderItem.taxValue, 3600);
  var rentItem = r.deduction.list[5];
  eq('租金抵税 = 13200 × 10% = 1,320', rentItem.taxValue, 1320);

  // 高收入边际税率更高
  var rHigh = T.buildResult(base({ income: 600000 }));
  eq('60 万收入边际税率 30%', rHigh.tax.rate, 0.30);
  eq('同样赡养老人抵税 10,800', rHigh.deduction.list[6].taxValue, 10800);

  var rLow = T.buildResult(base({ income: 100000 }));
  eq('10 万收入边际税率 3%', rLow.tax.rate, 0.03);
  eq('低税率下赡养老人抵税 1,080', rLow.deduction.list[6].taxValue, 1080);

  /* ==================================================================
   * 五、扣除为 0 与免税
   * ================================================================== */

  var rNone = T.buildResult(base({
    children: 0, rent: 0, elder: '0', infants: 0, continuing: 0,
    medical: 0, loan: false
  }));
  eq('没有扣除时启用 0 项', rNone.deduction.activeCount, 0);
  eq('没有扣除时节税 0', rNone.tax.saved, 0);
  eq('含专项与不含专项相等', rNone.taxable.base, rNone.taxable.full);

  var rFree = T.buildResult(base({ income: 80000, social: 10000 }));
  eq('收入 8 万社保 1 万 → 应纳税所得额 1 万', rFree.taxable.base, 10000);
  eq('扣除后应纳税所得额 0', rFree.taxable.full, 0);
  eq('扣除后税为 0', rFree.tax.full, 0);
  eq('节税 = 原来的 300', rFree.tax.saved, 300);

  /* ==================================================================
   * 六、分档明细
   * ================================================================== */

  var br = r.brackets;
  eq('70,800 分 2 档', br.length, 2);
  eq('第一档 36,000 元 @3%', br[0].amount, 36000);
  eq('第一档税 1,080', br[0].tax, 1080);
  eq('第二档 34,800 元 @10%', br[1].amount, 34800);
  eq('第二档税 3,480', br[1].tax, 3480);
  eq('分档税额合计 = 4,560', br[0].tax + br[1].tax, 4560);

  var brBig = T.buildResult(base({ income: 1200000, social: 60000 })).brackets;
  ok('高收入分多档', brBig.length >= 5, brBig.length);
  near('分档合计等于总税额',
    brBig.reduce(function (s, b) { return s + b.tax; }, 0),
    T.buildResult(base({ income: 1200000, social: 60000 })).tax.full, 1);

  var brZero = T.buildResult(base({ income: 50000, social: 5000 })).brackets;
  eq('应纳税所得额为 0 时无分档', brZero.length, 0);

  /* ==================================================================
   * 七、提示
   * ================================================================== */

  ok('默认有提示', r.tips.length >= 3, r.tips.length);
  ok('第一句提到节税', r.tips[0].text.indexOf('少缴') > -1, r.tips[0].text.slice(0, 40));
  ok('提示里没有 undefined', r.tips[0].text.indexOf('undefined') === -1, r.tips[0].text);

  var tipsNone = T.buildResult(base({
    children: 0, rent: 0, elder: '0'
  })).tips;
  ok('没有扣除时第一条是警告', tipsNone[0].type === 'warn', tipsNone[0].type);
  ok('警告提到「纯损失」', tipsNone[0].text.indexOf('纯损失') > -1, tipsNone[0].text);

  /* ==================================================================
   * 八、边界
   * ================================================================== */

  eq('收入 0 时 valid 为 false', T.buildResult(base({ income: 0 })).valid, false);
  var rNeg = T.buildResult(base({ income: -1000, social: -500, children: -2 }));
  eq('负收入钳制为 0', rNeg.input.income, 0);
  eq('负社保钳制为 0', rNeg.input.social, 0);
  eq('负子女数钳制为 0', rNeg.deduction.list[1].yearly, 0);

  var rSocial = T.buildResult(base({ social: 500000 }));
  eq('社保不能超过收入', rSocial.input.social, 240000);
  eq('社保等于收入时应纳税所得额 0', rSocial.taxable.base, 0);

  /* ==================================================================
   * 九、DOM
   * ================================================================== */

  eq('主数字 7,320', $('heroValue').textContent, '7,320');
  eq('税率徽章 10% 档', $('rateBadge').textContent, '10% 档');
  eq('不填扣除税额 ¥11,880', $('taxBase').textContent, '¥11,880');
  eq('填了扣除税额 ¥4,560', $('taxFull').textContent, '¥4,560');
  eq('税后到手 ¥199,440', $('netAfter').textContent, '¥199,440');
  eq('七项扣除 7 张卡 + 合计', document.querySelectorAll('#dedBox .ded').length, 7);
  eq('启用的扣除卡 3 张',
     document.querySelectorAll('#dedBox .ded.is-on').length, 3);
  eq('分档 2 行', document.querySelectorAll('#bracketBox .bk-row').length, 2);
  eq('误区 6 条', document.querySelectorAll('#mythList .myth__item').length, 6);
  eq('FAQ 12 条', document.querySelectorAll('#faqList .faq__item').length, 12);
  ok('提示区没有 undefined', $('adviceText').textContent.indexOf('undefined') === -1,
     $('adviceText').textContent.slice(0, 80));
  ok('扣除合计 ¥73,200', $('dedBox').textContent.indexOf('73,200') > -1,
     $('dedBox').textContent.slice(-60));

  var ld = Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]'));
  ok('注入 FAQPage', ld.some(function (s) { return s.textContent.indexOf('FAQPage') > -1; }), ld.length);

  /* ==================================================================
   * 十、交互
   * ================================================================== */

  // 10.1 子女 +1
  var addChild = document.querySelector('[data-step="children"][data-delta="1"]');
  addChild.click();
  await sleep(700);
  eq('加 1 个子女后输入为 2', $('children').value, '2');
  ok('2 个子女后合计 97,200', $('dedBox').textContent.indexOf('97,200') > -1,$('dedBox').textContent.slice(-40));
  ok('2 个子女节税上升', $('heroValue').textContent !== '7,320', $('heroValue').textContent);

  // 10.2 减回来
  document.querySelector('[data-step="children"][data-delta="-1"]').click();
  await sleep(700);
  eq('减回 1 个子女', $('children').value, '1');
  eq('回到 7,320', $('heroValue').textContent, '7,320');

  // 10.3 打开房贷 → 冲突提示
  var loan = $('loan');
  loan.checked = true;
  loan.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(700);
  ok('房贷+租金冲突提示出现', $('conflictTip').style.display !== 'none',
     $('conflictTip').style.display);
  eq('房贷让启用项变成 4', document.querySelectorAll('#dedBox .ded.is-on').length, 4);

  // 10.4 关掉租户，冲突消失
  loan.checked = false;
  loan.dispatchEvent(new Event('change', { bubbles: true }));
  var rent = $('rent');
  rent.value = '0';
  rent.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(700);
  eq('关掉租金后冲突提示隐藏', $('conflictTip').style.display, 'none');
  eq('剩余启用 2 项', document.querySelectorAll('#dedBox .ded.is-on').length, 2);

  // 10.5 赡养老人切非独生
  var elder = $('elder');
  elder.value = 'shared';
  elder.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(700);
  ok('非独生后合计变为 42,000', $('dedBox').textContent.indexOf('42,000') > -1,
     $('dedBox').textContent.slice(-60));

  // 10.6 恢复默认
  $('btnReset').click();
  await sleep(700);
  eq('重置后子女 1 个', $('children').value, '1');
  eq('重置后租金 1,100', $('rent').value, '1100');
  eq('重置后赡养老人为独生', $('elder').value, 'only');
  eq('重置后主数字 7,320', $('heroValue').textContent, '7,320');

  return out;
})()
