// 需要参与入场/出场动画的 APP 主内容元素 ID
export const APP_ELEMENT_IDS = [
  "mainTitle", "typeSwitcher", "poolSelectorWrapper",
  "summaryStrip", "dashboardPanel",
  "statsPanel", "historySection"
];

// 游戏机制常量
export const JADE_PER_PULL = 500;           // 1抽 = 500嵌晶玉
export const JADE_PER_STONE = 75;           // 1衍质原石 = 75嵌晶玉
export const WEAPON_QUOTA_PER_TEN = 1980;   // 10连武器 = 1980配额
export const WEAPON_QUOTA_6STAR = 2000;     // 角色池 6★ → 2000 武库配额
export const WEAPON_QUOTA_5STAR = 200;      // 角色池 5★ → 200 武库配额
export const WEAPON_QUOTA_4STAR = 20;       // 角色池 4★ → 20 武库配额
export const SPARK_TIER1 = 120;             // 垫刀第一阶段阈值
export const SPARK_TIER2 = 240;             // 垫刀第二阶段阈值
export const INTEL_BOOK_TIER = 60;          // 特许寻访的寻访情报书触发抽数
export const RUSH_RECRUIT_TIERS = [30, 60, 90]; // 重构寻访的加急招募三档触发抽数
export const RUSH_RECRUIT_MAX = 90;         // 加急招募仅生效 1 次，90 抽后无下一档

// ---- 角色池概率模型（官方规则）----
export const PITY_BOOST_START = 65;         // 概率提升起始抽数
export const CHAR_BASE_RATE = 0.8;          // 角色池 6★ 基础概率
export const CHAR_HARD_PITY = 80;           // 角色池 6★ 硬保底上限

// ---- 模型 A：出货速度（单次出货间隔分布）----
// 仅用于「平均水位欧非」（calculateLuckLevel）与累计期望曲线，
// 推导方式见 docs/luck-eval.md §2：用生存函数求和
//   μ  = Σ_{n≥0} P(X > n)
//   σ² = E[X²] − μ²，E[X²] = Σ_{n≥0} (2n+1)·P(X > n)
// 与模型 B（UP 占比）相互独立，不可混用
export const CHAR_PITY_MU = 53.90;          // 角色池理论平均出货抽数
export const CHAR_PITY_SIGMA = 23.04;       // 角色池单次出货间隔标准差

// ---- 模型 A（武器池）----
// 武器池无单抽，一次申领固定 10 件，保底判定单位是「申领次数」而非件数：
//   每次申领出 ≥1 个 6★ 的概率 p = 1 - 0.96^10 ≈ 33.52%
//   硬保底：连续 3 次申领（30 件）未出 → 第 4 次申领（40 件）必出
//   出货分布按申领次数：33.5% / 22.3% / 14.8% / 29.4%
// 注意：不可用「逐件 4%」建模，那会得到 μ≈20 件，
// 与实际 10 连模型差 4 件，会把「正好平均」的玩家误判为偏非
// 详见 docs/luck-eval.md §2.2
export const WEAPON_PITY_MU = 24.0;         // 武器池理论平均出货件数（= 2.40 次申领）
export const WEAPON_PITY_SIGMA = 12.2;      // 武器池单次出货间隔标准差（= 1.22 次申领）

// 武器池建模参数。保底判定单位是「申领次数」而非件数，故不可用逐件 4% 建模
// 每次申领 10 件，出 ≥1 个 6★ 的概率为 1 - 0.96^10
export const WEAPON_BASE_RATE = 4.0;          // 武器池 6★ 单件基础概率
export const WEAPON_PULLS_PER_CLAIM = 10;     // 每次申领获得件数
export const WEAPON_CLAIM_HARD_PITY = 4;      // 连续 3 次申领未出则第 4 次必出（= 40 件）

// ---- 模型 B：UP 命中（出 6★ 时命中 UP 的条件占比）----
// 仅用于「UP 命中率欧非」（calculateUpLevel），与模型 A 相互独立
export const CHAR_UP_RATE = 0.5;            // 角色池出 6★ 时 UP 占比
export const WEAPON_UP_RATE = 0.25;         // 武器池出 6★ 时 UP 占比

// UI 常量
export const SNACKBAR_AUTO_CLOSE = 4500;    // snackbar 自动关闭延迟 (ms)
export const UPDATE_CHECK_DELAY = 3000;     // 启动后延迟检测新版本 (ms)
export const UPDATE_SNACKBAR_DELAY = 15000; // 更新提示停留时长，需留足阅读与点击时间 (ms)

// Fallback 角色卡池配置（API 加载失败时使用）
export const FALLBACK_CHAR_POOL_CONFIG = {
  "熔火灼痕": "莱万汀",
  "轻飘飘的信使": "洁尔佩塔",
  "热烈色彩": "伊冯",
  "河流的女儿": "汤汤",
  "狼珀": "洛茜",
  "春雷动，万物生": "庄方宜",
  "拳出无悔": "弭弗",
  "逐罪者": "卡缪",
  "临渊望北": "诀",
  "晨星于此闪耀": "梨诺",
  "冬猎": "提弗洛斯",
  "绚丽异彩": "伊冯"
};

// Fallback 武器卡池配置（API 加载失败时使用）
export const FALLBACK_WEAPON_POOL_CONFIG = {
  "坚冰申领": "赫拉芬格",
  "星声申领": "沧溟星梦",
  "远途申领": "不知归",
  "崇山申领": "负山",
  "雷鸣申领": "大雷斑",
  "熔铸申领": "熔铸火焰",
  "迅行申领": "使命必达",
  "绘涂申领": "艺术暴君",
  "新芽申领": "落草",
  "绯珀申领": "狼之绯",
  "行舟申领": "孤舟",
  "绛结申领": "赤缨",
  "染赤申领": "镀红祝福",
  "军列申领": "四二式·肃阵",
  "明曜申领": "曜夜的首演",
  "幽寒申领": "寒夜幽影",
  "点绘申领": "艺术暴君"
};

export const FALLBACK_POOL_ORDER = [
  "熔火灼痕", "轻飘飘的信使", "热烈色彩", "河流的女儿",
  "狼珀", "春雷动，万物生", "拳出无悔", "逐罪者", "临渊望北",
    "晨星于此闪耀", "冬猎", "绚丽异彩"
];
