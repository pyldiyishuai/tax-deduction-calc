/* ==========================================================================
 * config.js — 全局配置中心（个税专项附加扣除计算器）
 * ========================================================================== */

var APP = window.APP || {};
window.APP = APP;

APP.SITE = {
  name: '个税专项附加扣除计算器',
  domain: 'https://pyldiyishuai.github.io/tax-deduction-calc',
  contactEmail: 'hello@example.com',
  icp: '',
  beian: '',
  year: 2025
};

APP.DEBUG = { enabled: false, noDebounce: false };

APP.ADS = {
  enabled: false,
  provider: '',
  slots: {
    resultInline: { id: '', format: 'fluid', label: 'result-inline' },
    contentBanner: { id: '', format: 'horizontal', label: 'content-banner' },
    leadBox: { id: '', format: 'fluid', label: 'lead-box' }
  },
  afterCalcDelay: 600,
  refreshOnRecalc: false
};

APP.ANALYTICS = {
  enabled: false,
  provider: '',
  id: '',
  debug: false,
  events: { pageView: 'page_view', calcRun: 'calc_run', leadClick: 'lead_click' }
};

APP.API = {
  enabled: false,
  baseUrl: '',
  timeout: 8000,
  endpoints: {
    rules: '/api/tax-rules',
    savePlan: '/api/tax-plan',
    feedback: '/api/feedback',
    leadSubmit: '/api/lead'
  }
};

APP.AUTH = {
  enabled: false,
  provider: '',
  loginUrl: '/login',
  storageKey: 'tax_auth_token'
};

APP.FEATURES = {
  // ---- 已实现 ----
  sevenDeductions: true,   // 七项专项附加扣除逐项
  marginalRate: true,      // 边际税率与抵税价值
  taxCompare: true,        // 填 vs 不填对比
  bracketDetail: true,     // 超额累进分档明细
  clashDetect: true,       // 房贷/租金互斥提示
  thresholdTip: true,      // 临界点提示
  netAfterTax: true,       // 税后到手

  // ---- 预留 ----
  bonusSeparate: false,    // 年终奖单独计税 / 并入综合所得对比
  spouseSplit: false,      // 夫妻分配最优化（谁扣更划算）
  multiIncome: false,      // 多处所得合并
  monthlyWithhold: false,  // 月度预扣预缴明细
  refundCalc: false,       // 汇算清缴退补税计算
  historyCompare: false,   // 历年对比
  exportReport: false,
  taxLead: false,          // 报税服务线索 ★ 变现
  cloudSave: false,
  i18n: false
};

APP.CONST = {
  MAX_AMOUNT: 50000000,
  MONEY_DECIMALS: 2,
  STORAGE_PREFIX: 'tax_',
  ANIM_DURATION: 660
};
