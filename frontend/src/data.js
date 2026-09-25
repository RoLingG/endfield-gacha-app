import { SPARK_TIER1, SPARK_TIER2, INTEL_BOOK_TIER, RUSH_RECRUIT_TIERS, RUSH_RECRUIT_MAX, PITY_BOOST_START, CHAR_BASE_RATE, CHAR_HARD_PITY, CHAR_PITY_MU, CHAR_PITY_SIGMA, WEAPON_PITY_MU, WEAPON_PITY_SIGMA, WEAPON_BASE_RATE, WEAPON_PULLS_PER_CLAIM, WEAPON_CLAIM_HARD_PITY, CHAR_UP_RATE, WEAPON_UP_RATE } from './constants.js';
import {getGlobalCharPoolOrder, getGlobalWeaponPoolOrder} from "./state";

export const DEFAULT_EMPTY_POOL_STATS = {
  total: 0,
  notFreeTotal: 0,
  sixStarCount: 0,
  fiveStarCount: 0,
  fourStarCount: 0,
  rate: "0.00"
};
export const DEFAULT_AVG_PITY = { avgPity: 0, sixStarCount: 0 };
export const DEFAULT_MAX_DROUGHT = { maxDrought: 0, currentDrought: 0 };
export const DEFAULT_MONTHLY_STATS = [];
export const DEFAULT_PITY_DISTRIBUTION = {
  labels: ['1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80'],
  counts: [0, 0, 0, 0, 0, 0, 0, 0],
  upCounts: [0, 0, 0, 0, 0, 0, 0, 0],
  offCounts: [0, 0, 0, 0, 0, 0, 0, 0]
};
export const DEFAULT_ARRAY = [];

// 复刻池按「池名#期数」作分组 key（如 绚丽异彩#1），普通池保持池名原样。
// 显示时经 formatPoolLabel 转成「绚丽异彩 #1」，故此处只需还原出池名与期数
export function makePoolKey(poolName, poolVersion) {
  return poolVersion > 0 ? `${poolName}#${poolVersion}` : poolName;
}

// 把分组 key 转为展示用文案：复刻池转成「池名 #期数」，普通池原样返回
export function formatPoolLabel(key) {
  const parsed = parsePoolKey(key);
  return parsed.version > 0 ? `${parsed.name} #${parsed.version}` : parsed.name;
}

// 从分组 key 还原池名与期数。无期数的普通池返回 { name: key, version: 0 }
export function parsePoolKey(key) {
  if (!key) return { name: "", version: 0 };
  const idx = key.lastIndexOf("#");
  if (idx < 0) return { name: key, version: 0 };
  const version = Number(key.slice(idx + 1));
  if (!Number.isInteger(version) || version <= 0) return { name: key, version: 0 };
  return { name: key.slice(0, idx), version };
}

export function groupDataByPool(flatList) {
  const grouped = {};
  if (!flatList || flatList.length === 0) return grouped;
  flatList.forEach(item => {
    const pool = makePoolKey(item.poolName, item.poolVersion) || "UNKNOWN";
    if (!grouped[pool]) {
      grouped[pool] = [];
    }
    grouped[pool].push(item);
  });
  return grouped;
}

// 获取通用名称 (处理 CharName 和 WeaponName 的差异)
export function getItemName(item) {
  return item.charName || item.weaponName || "UNKNOWN";
}

// 判断是否为真实抽卡记录（排除 gift_intel_book 等非抽卡条目）
export function isDraw(item) {
  return !item.kind || item.kind === "draw";
}

// 计算卡池六星详细信息
export function calculateSixStarDetails(items, reverse = false, allItems) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_ARRAY;

  // allItems 用于计算各继承链的水位（跨池继承），items 决定显示哪些池子
  const pitySource = allItems || items;
  // 按时间排序（保证跨池保底计数正确），再按卡池分组
  const sorted = [...pitySource].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));

  const pools = {};
  const poolOrder = [];
  sorted.forEach(item => {
    const key = item.poolName;
    if (!pools[key]) {
      pools[key] = [];
      poolOrder.push(key);
    }
    pools[key].push(item);
  });

  // 需要显示 6★ 的池子集合
  const displayPools = new Set(items.map(i => i.poolName));

  // 按卡池分别统计
  // chainPity 为各继承链的水位，用于继承水位角标，poolPity 为当前池内计数，用于 pityText
  const allDetails = [];
  const chainPity = getEmptyChainPity();
  for (const key of poolOrder) {
    const firstItem = pools[key][0];
    const chain = getPityChain(firstItem?.poolId);

    if (!chain) {
      // 水位独立的池，用本池计数器
      let poolPity = 0;
      const details = [];
      pools[key].forEach(item => {
        if (!isDraw(item)) return; // 跳过寻访情报书等非抽卡条目
        if (item.rarity === 6 && displayPools.has(key)) {
          const detail = {
            name: getItemName(item),
            isNew: item.isNew,
            pityText: item.isFree ? "FREE" : ++poolPity
          };
          if (item.poolName) detail.poolName = makePoolKey(item.poolName, item.poolVersion);
          details.push(detail);
          if (!item.isFree) poolPity = 0;
        } else {
          if (!item.isFree) poolPity++;
        }
      });
      if (reverse) details.reverse();
      allDetails.push(...details);
    } else {
      // 参与继承的池，chainPity[chain] 跨池累加，poolPity 当前池内计数
      const details = [];
      const inheritedPity = chainPity[chain];
      let poolPity = 0;
      let firstSixStar = true;
      pools[key].forEach(item => {
        if (!isDraw(item)) return; // 跳过寻访情报书等非抽卡条目
        if (item.rarity === 6) {
          if (displayPools.has(key)) {
            const detail = {
              name: getItemName(item),
              isNew: item.isNew,
              pityText: item.isFree ? "FREE" : ++poolPity
            };
            if (item.poolName) detail.poolName = makePoolKey(item.poolName, item.poolVersion);
            if (!item.isFree && firstSixStar && inheritedPity > 0) {
              detail.inheritedPity = inheritedPity;
            }
            details.push(detail);
          } else {
            if (!item.isFree) poolPity++;
          }
          firstSixStar = false;
          if (!item.isFree) { chainPity[chain] = 0; poolPity = 0; }
        } else {
          if (!item.isFree) { chainPity[chain]++; poolPity++; }
        }
      });
      if (reverse) details.reverse();
      allDetails.push(...details);
    }
  }
  return allDetails;
}

// 判断是否为角色复刻池（重构寻访）
function isRerunCharPool(poolId) {
  return !!poolId?.startsWith('rerun_chr_');
}

// 下一个加急招募档位（30 / 60 / 90）
function nextRushTier(count) {
  return RUSH_RECRUIT_TIERS.find(tier => count < tier) ?? RUSH_RECRUIT_MAX;
}

// 计算卡池大保底信息
// 复刻池无寻访情报书，里程奖励为加急招募 30 / 60 / 90 三档，与特许寻访的 60 抽情报书不同
// 返回 subKey 与 subParams 而非拼接文案，由渲染层经 i18n 组装
export function calculateSparkInfo(reversed, targetUp, poolId = '') {
  const isRerun = isRerunCharPool(poolId);
  let sparkCount = 0;
  let sparkConsumed = false;
  for (let item of reversed) {
    if (!isDraw(item)) continue; // 跳过寻访情报书等非抽卡条目
    if (!item.isFree) sparkCount++;
    const name = getItemName(item);
    if (name === targetUp && !item.isFree && sparkCount <= SPARK_TIER1) {
      sparkConsumed = true;
    }
  }

  let targetLimit, subKey, subParams = {};
  if (sparkCount >= SPARK_TIER2) {
    targetLimit = SPARK_TIER2;
    subKey = 'spark.maxReached';
  } else if (sparkCount > SPARK_TIER1) {
    targetLimit = SPARK_TIER2;
    subKey = 'spark.nextTarget';
    subParams = { tier: SPARK_TIER2 };
  } else {
    targetLimit = sparkConsumed ? SPARK_TIER2 : SPARK_TIER1;
    if (isRerun) {
      // 复刻池走加急招募档位
      if (sparkCount >= RUSH_RECRUIT_MAX) {
        subKey = 'spark.rushMaxed';
      } else {
        subKey = 'spark.rushRecruit';
        subParams = { count: sparkCount, tier: nextRushTier(sparkCount) };
      }
    } else if (sparkCount < INTEL_BOOK_TIER) {
      subKey = 'spark.intelBook';
      subParams = { count: sparkCount, tier: INTEL_BOOK_TIER };
    } else if (sparkConsumed) {
      subKey = 'spark.tier1Consumed';
      subParams = { tier1: SPARK_TIER1, tier2: SPARK_TIER2 };
    } else {
      subKey = 'spark.intelBookObtained';
    }
  }

  return { sparkCount, targetLimit, subKey, subParams };
}

// 不参与跨池水位继承的特殊卡池（基础寻访、启程寻访与常规武器池，均无继承规则）
const EXCLUDED_FROM_PITY = ['standard', 'beginner'];

function isWeaponPool(poolId) {
  return poolId?.startsWith('weaponbox_') || poolId?.startsWith('weponbox_') || poolId?.startsWith('rerun_wpn_');
}

function isPityExcluded(poolId) {
  return EXCLUDED_FROM_PITY.includes(poolId) || isWeaponPool(poolId);
}

// 限定武器池（申领），常驻池 ID 为 weaponbox_constant_*，不在其列
function isLimitedWeaponPool(poolId) {
  return !!poolId?.startsWith('weponbox_') || !!poolId?.startsWith('rerun_wpn_');
}

// 水位继承链标识，保底只在同链内继承
// main 为当期池（特许寻访与联合寻访），rerun_char 为角色复刻池，跨角色共用一条链
// 返回 null 表示该池水位独立计算，不与任何池互通
// （基础寻访、启程寻访、常规武器池、武器复刻池）
function getPityChain(poolId) {
  if (!poolId) return null;
  if (isPityExcluded(poolId)) return null;
  if (poolId.startsWith('rerun_chr_')) return 'rerun_char';
  return 'main';
}

// 各继承链的水位计数器，每次遍历前取一份新的
function getEmptyChainPity() {
  return { main: 0, rerun_char: 0 };
}

// 统计用途的水位键。与 getPityChain 的区别在于不返回 null
// 水位不继承的池（武器池等）按池 ID 各自独立计数，仍需参与统计
// （武器池有独立的期望基准 WEAPON_PITY_MU，其出货水位必须照常统计）
function getStatPityKey(poolId) {
  const chain = getPityChain(poolId);
  return chain ?? `solo:${poolId}`;
}

// 不参与欧非统计的卡池。仅基础寻访与启程寻访，其保底水位不被继承链承认，
// 且出货水位普遍极低，计入会拉低均值使评级偏欧；武器池有独立的期望基准，
// 需正常统计，故不可复用 isPityExcluded
function isStatsExcluded(poolId) {
  return EXCLUDED_FROM_PITY.includes(poolId);
}

// 计算每个池子各自的水位，参与继承的池取所处链的累计水位
// 不参与继承的池（武器池等）取本池内计数，其水位独立且需要照常展示
export function calculatePerPoolPity(dataMap, poolOrder) {
  const perPoolPity = {};
  const chainPity = getEmptyChainPity();

  // 按配置顺序逐池遍历。poolOrder 里是原始池名，dataMap 的 key 对复刻池带 #期数后缀，
  // 故按原始池名匹配，同名的各期按升序相邻排列
  const dataKeys = Object.keys(dataMap);
  const allPoolNames = [];
  for (const orderName of poolOrder) {
    const matched = dataKeys.filter(k => parsePoolKey(k).name === orderName);
    matched.sort((a, b) => parsePoolKey(a).version - parsePoolKey(b).version);
    allPoolNames.push(...matched);
  }
  dataKeys.forEach(k => {
    if (!allPoolNames.includes(k)) allPoolNames.push(k);
  });

  for (const poolName of allPoolNames) {
    if (!dataMap[poolName]) continue;
    const chain = getPityChain(dataMap[poolName][0]?.poolId);
    // 池内按时间升序排序，同时间戳按 seqId 升序（保证十连批次内顺序正确）
    const items = [...dataMap[poolName]].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));

    if (!chain) {
      // 水位独立的池，用本池计数器
      let poolPity = 0;
      for (const item of items) {
        if (!isDraw(item)) continue;
        if (item.isFree) continue;
        poolPity++;
        if (item.rarity === 6) { poolPity = 0; }
      }
      perPoolPity[poolName] = poolPity;
      continue;
    }

    for (const item of items) {
      if (!isDraw(item)) continue; // 跳过寻访情报书等非抽卡条目
      if (item.isFree) continue;
      chainPity[chain]++;
      if (item.rarity === 6) { chainPity[chain] = 0; }
    }
    perPoolPity[poolName] = chainPity[chain];
  }

  return perPoolPity;
}

// 计算当前水位下一次单抽出 6★ 概率
// 入参 currentPity = 已垫抽数，即「下一次抽」是第 currentPity+1 抽
// 官方规则（docs/luck-eval.md §2.1）：第 1~65 抽 0.8%；第 66 抽起每抽 +5%；第 80 抽必出
// 换算到 currentPity：水位 >=79 时下一次即第 80 抽，必出
function calcSingleProb(currentPity) {
  if (currentPity >= CHAR_HARD_PITY - 1) {
    return 100
  }
  if (currentPity >= PITY_BOOST_START) {
    const extraRate = (currentPity - (PITY_BOOST_START - 1)) * 5;
    return Math.min(CHAR_BASE_RATE + extraRate, 100);
  }
  return CHAR_BASE_RATE
}

// 计算当前水位下一次十连内出 6★ 的累计概率
// basePity: 当前水位, pulls: 再抽次数
// P = 1 - ∏(1 - p_i), p_i 随软保底递增
function calcCumulatedProb(basePity, pulls) {
  let probNoSix = 1;
  for (let k = 1; k <= pulls; k++) {
    const p = calcSingleProb(basePity + k) / 100;
    probNoSix *= (1 - p);
  }
  return (1 - probNoSix) * 100;
}

// 水位概率计算
export function calculatePityBoost(currentPity, poolId, isWeapon) {
  if (!isWeapon && currentPity >= PITY_BOOST_START && !EXCLUDED_FROM_PITY.includes(poolId)) {
    const singlePullProb = calcSingleProb(currentPity)
    const tenPullProb = calcCumulatedProb(currentPity, 10);
    return {
      pityColor: "#ff5722",
      pitySubText: `1x: ${singlePullProb.toFixed(1)}% // 10x: ${tenPullProb.toFixed(1)}%`
    };
  }
  return {
    pityColor: "var(--ef-yellow)",
    pitySubText: "SINCE LAST 6★"
  };
}

// 计算卡池当前相关信息
export function calculatePoolStats(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_EMPTY_POOL_STATS;

  // 只统计真实抽卡记录，排除寻访情报书等非抽卡条目
  const drawItems = items.filter(isDraw);
  const total = drawItems.length;
  const notFreeTotal = drawItems.filter(item => !item.isFree).length;
  const sixStarCount = drawItems.filter(i => i.rarity === 6).length;
  const fiveStarCount = drawItems.filter(i => i.rarity === 5).length;
  const fourStarCount = drawItems.filter(i => i.rarity === 4).length;
  const rate = total > 0 ? ((sixStarCount / total) * 100).toFixed(2) : "0.00";
  return { total, notFreeTotal, sixStarCount, fiveStarCount, fourStarCount, rate };
}

// 合并所有卡池的数据并按卡池配置顺序排序
export function mergeAllPoolsData(dataMap, type = 'char') {
  if (!dataMap || typeof dataMap !== 'object' || Object.keys(dataMap).length === 0) return DEFAULT_ARRAY;

  const poolOrder = (type === 'weapon') ? getGlobalWeaponPoolOrder() : getGlobalCharPoolOrder();
  const dataKeys = Object.keys(dataMap);
  const merged = [];
  // 新池→旧池遍历（反转配置顺序），保持池内顺序不变。
  // poolOrder 里是原始池名，dataMap 的 key 对复刻池带 #期数后缀，故按原始池名匹配
  const used = new Set();
  for (let i = poolOrder.length - 1; i >= 0; i--) {
    const matched = dataKeys.filter(k => parsePoolKey(k).name === poolOrder[i]);
    // 期数升序，保证 #1 → #2 依次排列
    matched.sort((a, b) => parsePoolKey(a).version - parsePoolKey(b).version);
    matched.forEach(k => {
      merged.push(...dataMap[k]);
      used.add(k);
    });
  }
  // 再把 dataMap 中有但 poolOrder 没有的池子加进去（保底）
  dataKeys.forEach(k => {
    if (!used.has(k)) merged.push(...dataMap[k]);
  });
  return merged;
}

// 平均出货抽数，水位按继承链分别维护，出 6★ 归零
// 口径需与欧非判定所用理论模型（μ=CHAR_PITY_MU，按特许寻访规则推导）一致
export function calculateAvgPity(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_AVG_PITY;

  const sorted = [...items].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));
  const chainPity = {};
  let sixCount = 0;
  const pityList = [];
  for (const item of sorted) {
    if (!isDraw(item)) continue; // 跳过寻访情报书等非抽卡条目
    if (item.isFree) continue;
    const key = getStatPityKey(item.poolId);
    chainPity[key] = (chainPity[key] || 0) + 1;
    if (item.rarity === 6) {
      // 标准/启程寻访的出货不参与平均
      if (!isStatsExcluded(item.poolId)) {
        pityList.push(chainPity[key]);
        sixCount++;
      }
      chainPity[key] = 0;
    }
  }
  // 最后未出6★的抽数不计入平均（没有出货就不计入平均水位）
  const avgPity = pityList.length > 0
    ? +(pityList.reduce((a, b) => a + b, 0) / pityList.length).toFixed(1)
    : 0;
  return { avgPity, sixStarCount: sixCount };
}

// 最长不出货记录，水位按继承链分别维护
// currentDrought 取主链水位，汇总模式下用户关注的是当期池的进展
export function calculateMaxDrought(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_MAX_DROUGHT;

  const sorted = [...items].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));
  const chainStreak = {};
  let maxDrought = 0;
  for (const item of sorted) {
    if (!isDraw(item)) continue; // 跳过寻访情报书等非抽卡条目
    if (item.isFree) continue;
    if (isStatsExcluded(item.poolId)) continue; // 标准/启程寻访不参与连续未出货统计
    const key = getStatPityKey(item.poolId);
    if (item.rarity === 6) {
      if ((chainStreak[key] || 0) > maxDrought) maxDrought = chainStreak[key];
      chainStreak[key] = 0;
    } else {
      chainStreak[key] = (chainStreak[key] || 0) + 1;
    }
  }
  return { maxDrought, currentDrought: chainStreak.main || 0 };
}

// 按月统计抽数和出货数，跳过不参与统计的池
// 免费抽计入，加急招募同样是按基础概率裸抽，其抽数与出货反映真实抽卡行为
export function calculateMonthlyStats(items, poolConfig = {}) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_MONTHLY_STATS;

  const monthMap = new Map();
  for (const item of items) {
    if (!isDraw(item)) continue; // 跳过寻访情报书等非抽卡条目
    if (isStatsExcluded(item.poolId)) continue; // 标准/启程寻访不参与月度统计
    const date = new Date(Number(item.gachaTs));
    if (isNaN(date.getTime())) continue;
    const month = date.toISOString().slice(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, { totalPulls: 0, sixStarCount: 0, upCount: 0, offCount: 0 });
    }
    const entry = monthMap.get(month);
    entry.totalPulls++;
    if (item.rarity === 6) {
      entry.sixStarCount++;
      const upName = poolConfig[item.poolName];
      if (upName && getItemName(item) === upName) {
        entry.upCount++;
      } else {
        entry.offCount++;
      }
    }
  }
  const result = [];
  for (const [month, data] of monthMap) {
    result.push({
      month,
      totalPulls: data.totalPulls,
      sixStarCount: data.sixStarCount,
      upCount: data.upCount,
      offCount: data.offCount,
      rate: data.sixStarCount > 0
        ? ((data.sixStarCount / data.totalPulls) * 100).toFixed(2) + '%'
        : '0.00%'
    });
  }
  // 按月份从旧到新排序
  result.sort((a, b) => a.month.localeCompare(b.month));
  return result;
}

// 6★ 之间的抽数间隔分布（排除免费抽与非继承池的出货，保底跨池继承）
export function calculatePityDistribution(items, poolConfig = {}) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_PITY_DISTRIBUTION

  const sorted = [...items].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0]; // 1-10, 11-20, ..., 71-80
  const upBuckets = [0, 0, 0, 0, 0, 0, 0, 0];
  const offBuckets = [0, 0, 0, 0, 0, 0, 0, 0];
  const chainStreak = {};
  for (const item of sorted) {
    if (!isDraw(item)) continue; // 跳过寻访情报书等非抽卡条目
    if (item.isFree) continue;
    const key = getStatPityKey(item.poolId);
    chainStreak[key] = (chainStreak[key] || 0) + 1;
    if (item.rarity === 6) {
      // 标准/启程寻访的出货不进分桶
      if (!isStatsExcluded(item.poolId)) {
        const bucketIndex = Math.min(Math.floor((chainStreak[key] - 1) / 10), 7);
        buckets[bucketIndex]++;
        const upName = poolConfig[item.poolName];
        if (upName && getItemName(item) === upName) {
          upBuckets[bucketIndex]++;
        } else {
          offBuckets[bucketIndex]++;
        }
      }
      chainStreak[key] = 0;
    }
  }
  return {
    labels: ['1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80'],
    counts: buckets,
    upCounts: upBuckets,
    offCounts: offBuckets
  };
}

// 6★ 出货欧非评定函数，按平均出货抽数相对理论期望的 z 分数分档 6★，少于 3 个 6★ 返回 null
export function calculateLuckLevel(avgPity, sixStarCount, isWeapon) {
  if (sixStarCount < 3) return null;
  const mu = isWeapon ? WEAPON_PITY_MU : CHAR_PITY_MU;
  const sigma = isWeapon ? WEAPON_PITY_SIGMA : CHAR_PITY_SIGMA;
  const z = (avgPity - mu) / (sigma / Math.sqrt(sixStarCount));
  if (z < -1.5) return 'stats.luckEmp';
  if (z < -0.5) return 'stats.luckAbove';
  if (z < 0.5) return 'stats.luckNormal';
  if (z < 1.5) return 'stats.luckBelow';
  return 'stats.luckBad';
}

// UP 命中率欧非评定函数，出 6★ 时命中 UP 的比例相对理论占比的 z 分数分档（方向与出货速度相反，z 越大越欧）
export function calculateUpLevel(upCount, sixStarCount, isWeapon) {
  if (sixStarCount < 3) return null;
  const p = isWeapon ? WEAPON_UP_RATE : CHAR_UP_RATE;
  const z = (upCount / sixStarCount - p) / Math.sqrt(p * (1 - p) / sixStarCount);
  if (z > 1.5) return 'stats.luckEmp';
  if (z > 0.5) return 'stats.luckAbove';
  if (z > -0.5) return 'stats.luckNormal';
  if (z > -1.5) return 'stats.luckBelow';
  return 'stats.luckBad';
}

export const DEFAULT_OFF_RATE = { sixStarCount: 0, upCount: 0, offCount: 0, offRate: "0.0" };

// 计算生涯总歪率
// 跳过不参与统计的池与无 UP 配置的池，两者都无法判定 UP 或歪
// 免费抽计入，加急招募同样是按基础概率裸抽，其结果参与运气评价
export function calculateOffRate(items, poolConfig = {}) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_OFF_RATE;

  let sixStarCount = 0;
  let upCount = 0;
  let offCount = 0;
  for (const item of items) {
    if (!isDraw(item) || item.rarity !== 6) continue;
    if (isStatsExcluded(item.poolId)) continue;
    const upName = poolConfig[item.poolName];
    if (!upName) continue; // 无 UP 配置的池不参与歪率统计
    sixStarCount++;
    if (getItemName(item) === upName) upCount++;
    else offCount++;
  }
  const offRate = sixStarCount > 0
    ? ((offCount / sixStarCount) * 100).toFixed(1)
    : "0.0";
  return { sixStarCount, upCount, offCount, offRate };
}

// 卡池剖面数据，每池的总抽数、出货周期列表与末尾未出货抽数
// cycles：每次出货一个周期，含该次消耗水位 pity、名称、是否 UP / 新获得
// tail：最后一次出货之后累计未出货的抽数（进行中，可能为 0）
export function calculatePoolProfile(dataMap, poolOrder, poolConfig = {}) {
  const profiles = [];
  if (!dataMap || typeof dataMap !== 'object') return profiles;

  // poolOrder 里是原始池名，dataMap 的 key 对复刻池带 #期数后缀，故按原始池名匹配
  const dataKeys = Object.keys(dataMap);
  const poolNames = [];
  const used = new Set();
  for (const orderName of poolOrder) {
    const matched = dataKeys.filter(k => parsePoolKey(k).name === orderName);
    matched.sort((a, b) => parsePoolKey(a).version - parsePoolKey(b).version);
    matched.forEach(k => { poolNames.push(k); used.add(k); });
  }
  dataKeys.forEach(k => {
    if (!used.has(k)) poolNames.push(k);
  });

  for (const poolName of poolNames) {
    const items = dataMap[poolName];
    if (!items || items.length === 0) continue;

    const drawItems = items.filter(isDraw).filter(i => !i.isFree);
    const total = drawItems.length;
    if (total === 0) continue;

    const sorted = drawItems.sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));
    // 查 UP 名需用原始池名 —— dataMap 的 key 对复刻池带 #期数后缀
    const upName = poolConfig[parsePoolKey(poolName).name];

    let streak = 0;
    let deepest = 0;
    const cycles = [];
    for (const item of sorted) {
      streak++;
      if (item.rarity === 6) {
        cycles.push({
          pity: streak,
          name: getItemName(item),
          isUp: !!(upName && getItemName(item) === upName),
          isNew: !!item.isNew
        });
        if (streak > deepest) deepest = streak;
        streak = 0;
      }
    }
    profiles.push({
      poolName,
      total,
      deepest,
      cycles,
      tail: streak
    });
  }
  return profiles;
}

// 稀有度成分堆叠数据，每池 6★/5★/4★ 计数
export function calculateRarityStack(dataMap, poolOrder) {
  const stacks = [];
  if (!dataMap || typeof dataMap !== 'object') return stacks;

  // poolOrder 里是原始池名，dataMap 的 key 对复刻池带 #期数后缀，故按原始池名匹配
  const dataKeys = Object.keys(dataMap);
  const poolNames = [];
  const used = new Set();
  for (const orderName of poolOrder) {
    const matched = dataKeys.filter(k => parsePoolKey(k).name === orderName);
    matched.sort((a, b) => parsePoolKey(a).version - parsePoolKey(b).version);
    matched.forEach(k => { poolNames.push(k); used.add(k); });
  }
  dataKeys.forEach(k => {
    if (!used.has(k)) poolNames.push(k);
  });

  for (const poolName of poolNames) {
    const items = dataMap[poolName];
    if (!items || !Array.isArray(items) || items.length === 0) continue;
    const stats = calculatePoolStats(items);
    stacks.push({
      poolName,
      total: stats.total,
      six: stats.sixStarCount,
      five: stats.fiveStarCount,
      four: stats.fourStarCount
    });
  }
  return stacks;
}

// UP 抽卡命中数据，按卡池分行列出命中记录（歪池计入所属 UP 行，无配置池不参与）
// 限定池与复刻池的机制不同，即使 UP 是同一角色也分行统计
// 每行含：抽数 / 6★ 数 / 出货率 / 均水位 / 歪率 / 最深水位
export function calculateUpHitRecords(items, poolConfig = {}) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_ARRAY;

  const sorted = [...items]
    .filter(item => isDraw(item) && !item.isFree)
    .sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));

  // 水位（跨池继承口径）
  const recordMap = new Map();
  // 出货前即建行，使抽数能从周期起点开始累计。
  // 行按池分组 key 区分（复刻池各期独立成行），upName 仍取自原始池名的配置
  const ensureRow = (poolKey, upName) => {
    if (!recordMap.has(poolKey)) {
      recordMap.set(poolKey, {
        poolName: poolKey, upName, sixStarCount: 0, upCount: 0, offCount: 0,
        deepest: 0, pulls: 0, pitySum: 0
      });
    }
    return recordMap.get(poolKey);
  };
  

  let lastPoolId = '';
  let currentUp = null;
  const chainStreak = {};
  let streak = 0; // 当前项所属链的水位（下方每次从 chainStreak 同步）

  for (const item of sorted) {
    if (item.poolId !== lastPoolId) {
      lastPoolId = item.poolId;
      currentUp = poolConfig[item.poolName] || null;
    }
    const key = getStatPityKey(item.poolId);
    chainStreak[key] = (chainStreak[key] || 0) + 1;
    streak = chainStreak[key];
    if (currentUp) ensureRow(makePoolKey(item.poolName, item.poolVersion), currentUp).pulls++;

    if (item.rarity === 6) {
      const upName = poolConfig[item.poolName];
      if (!upName) {
        chainStreak[key] = 0;
        continue; // 常驻池无 UP 配置，不参与命中记录表
      }
      const rec = ensureRow(makePoolKey(item.poolName, item.poolVersion), upName);
      rec.sixStarCount++;
      rec.pitySum += streak;
      const isUp = getItemName(item) === upName;
      if (isUp) rec.upCount++; else rec.offCount++;
      if (streak > rec.deepest) rec.deepest = streak;
      chainStreak[key] = 0;
    }
  }

  return [...recordMap.values()].map(rec => ({
    poolName: rec.poolName,
    upName: rec.upName,
    pulls: rec.pulls,
    sixStarCount: rec.sixStarCount,
    upCount: rec.upCount,
    offCount: rec.offCount,
    deepest: rec.deepest,
    rate: rec.pulls > 0 ? +((rec.sixStarCount / rec.pulls) * 100).toFixed(2) : 0,
    avgPity: rec.sixStarCount > 0 ? +(rec.pitySum / rec.sixStarCount).toFixed(1) : 0,
    offRate: rec.sixStarCount > 0 ? +((rec.offCount / rec.sixStarCount) * 100).toFixed(0) : 0
  }));
}

// 累计出货曲线，按抽卡顺序累计抽数与 6★ 数
// 只计有效出货段，即各次出货消耗的水位之和，末次出货后的垫刀无对应出货故不计入，单独作 tailPulls 返回
// 非继承池不参与，因为期望线按特许寻访规则（μ=CHAR_PITY_MU）推导
// 累计出货曲线（角色池）：按继承链拆成两条，横轴为各自的累计出货水位、纵轴为累计 6★ 数
// 限定池走 main 链、复刻池走 rerun_char 链，两条线各自从 (0,0) 起
// 两者的期望基准同为 μ=CHAR_PITY_MU，故共用一条期望线
// 末次出货后的垫刀单独作 tailPulls 返回，两条链各自统计
export function calculateCumulativeCurve(items) {
  const empty = { main: [], rerun: [], maxPulls: 0, mainTail: 0, rerunTail: 0 };
  if (!items || !Array.isArray(items) || items.length === 0) return empty;

  const sorted = [...items]
    .filter(item => isDraw(item) && !item.isFree && !isStatsExcluded(item.poolId))
    .sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));

  const chains = {
    main: { points: [{ pull: 0, six: 0 }], cum: 0, six: 0, streak: 0 },
    rerun_char: { points: [{ pull: 0, six: 0 }], cum: 0, six: 0, streak: 0 },
  };

  for (const item of sorted) {
    const chain = getPityChain(item.poolId);
    if (!chain) continue;
    const c = chains[chain];
    c.streak++;
    if (item.rarity === 6) {
      c.cum += c.streak;
      c.six++;
      c.points.push({ pull: c.cum, six: c.six });
      c.streak = 0;
    }
  }

  return {
    main: chains.main.points,
    rerun: chains.rerun_char.points,
    maxPulls: Math.max(chains.main.cum, chains.rerun_char.cum),
    mainTail: chains.main.streak,
    rerunTail: chains.rerun_char.streak,
  };
}

// 限定武器池的出货曲线：按玩家的实际申领顺序累加，横轴为累计申领次数、纵轴为累计 6★ 数
// 武器池一次申领固定 10 件、保底单位为申领次数，用水位累加无法与角色池同尺度比较
// 各次申领记录所属池名与本次出货数，供图表 popover 展示
// 常驻池（weaponbox_constant_*）不参与，其无跨期活动的概率提升机制
export function calculateWeaponClaimCurves(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_ARRAY;

  const sorted = [...items]
    .filter(item => isDraw(item) && !item.isFree && isLimitedWeaponPool(item.poolId))
    .sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));

  // 同一 gachaTs 为一次申领的 10 件，聚合成一条申领记录
  const claims = [];
  for (const item of sorted) {
    const last = claims[claims.length - 1];
    if (last && last.ts === item.gachaTs) {
      if (item.rarity === 6) last.six++;
      continue;
    }
    claims.push({
      ts: item.gachaTs,
      poolName: item.poolName || item.poolId,
      six: item.rarity === 6 ? 1 : 0,
    });
  }

  // 起点 (0,0)，随后每次申领累加
  const points = [{ claim: 0, six: 0, poolName: '', sixThisClaim: 0 }];
  let cumSix = 0;
  claims.forEach((c, i) => {
    cumSix += c.six;
    points.push({ claim: i + 1, six: cumSix, poolName: c.poolName, sixThisClaim: c.six });
  });

  return { points, claimCount: claims.length, sixStarCount: cumSix };
}

// 理论累计期望曲线，横轴为累计抽数（武器池为件数），纵轴为累计 6★ 数
// 角色池按 docs/luck-eval.md §2.1 的逐抽概率模型，用存活分布卷积求解
//   alive[k] 为单周期垫到第 k 抽仍未出货的概率，start[n] 为单周期恰在第 n 抽开始的概率，
//   q[n] = Σ start[n-i] · alive[i-1] · p(i) 为各周期起点与出货概率的卷积，expect[N] = Σ_{n≤N} q[n]
// 武器池按 §2.2，保底判定单位是申领次数而非件数，故按申领建模后换算到件坐标
export function calculateExpectedCurve(maxPulls, isWeapon = false) {
  return isWeapon
    ? buildWeaponExpectedCurve(maxPulls)
    : buildCharExpectedCurve(maxPulls);
}

// 角色池：逐抽概率随水位递增，用存活分布卷积求解
function buildCharExpectedCurve(maxPulls) {
  const curve = [{ pull: 0, expect: 0 }];
  if (!maxPulls || maxPulls <= 0) return curve;

  const pOf = k => calcSingleProb(k - 1) / 100;

  const alive = [1];
  for (let k = 1; k <= CHAR_HARD_PITY; k++) {
    alive[k] = alive[k - 1] * (1 - pOf(k));
  }

  const q = new Array(maxPulls + 1).fill(0);
  const start = new Array(maxPulls + 1).fill(0);
  start[1] = 1;

  for (let n = 1; n <= maxPulls; n++) {
    if (start[n] <= 0) continue;
    for (let k = 1; k <= CHAR_HARD_PITY && n + k - 1 <= maxPulls; k++) {
      const hitAt = n + k - 1;
      const pHit = start[n] * alive[k - 1] * pOf(k);
      q[hitAt] += pHit;
      // 出货后开新周期
      if (hitAt + 1 <= maxPulls) start[hitAt + 1] += pHit;
    }
  }

  let expect = 0;
  for (let n = 1; n <= maxPulls; n++) {
    expect += q[n];
    curve.push({ pull: n, expect: +expect.toFixed(4) });
  }
  return curve;
}

// 武器池：以申领次数为单位建模，再换算到件坐标
// 每次申领 10 件，单次出 ≥1 个 6★ 的概率为 1 - 0.96^10，连续 3 次未出则第 4 次必出
// 单周期内出货落在第 n 次申领的概率：p(1)=p0，p(2)=p0(1-p0)，p(3)=p0(1-p0)^2，p(4)=(1-p0)^3
// 每个周期的期望出货数为 1，该期望在周期内按件均匀计入，故每件贡献 1/(claim*per)
function buildWeaponExpectedCurve(maxPulls) {
  const curve = [{ pull: 0, expect: 0 }];
  if (!maxPulls || maxPulls <= 0) return curve;

  const per = WEAPON_PULLS_PER_CLAIM;
  const p0 = 1 - Math.pow(1 - WEAPON_BASE_RATE / 100, per);

  // 单周期内出货落在第 n 次申领的概率
  const claimDist = [];
  let alive = 1;
  for (let n = 1; n <= WEAPON_CLAIM_HARD_PITY; n++) {
    const p = n === WEAPON_CLAIM_HARD_PITY ? 1 : p0;
    claimDist.push({ claim: n, pmf: alive * p });
    alive *= (1 - p);
  }

  // 每件期望出货数：每个周期的期望出货为 1 个，周期期望长度为 Σ (claim*per)*pmf，
  // 故每件期望 = 1 / 周期期望长度（注意不可写成 Σ pmf/(claim*per)，那是「长度的倒数的期望」）
  const avgCyclePieces = claimDist.reduce((sum, d) => sum + d.claim * per * d.pmf, 0);
  const perPieceExpect = 1 / avgCyclePieces;

  let expect = 0;
  for (let n = 1; n <= maxPulls; n++) {
    expect += perPieceExpect;
    curve.push({ pull: n, expect: +expect.toFixed(4) });
  }
  return curve;
}

// 统计命中 UP 的 6★ 数量
// @deprecated 已无调用点，命中率统计请用 calculateUpStats，歪率统计见 calculateOffRate
export function calculateUpCount(items, poolConfig = {}) {
  let upCount = 0;
  for (const item of items) {
    if (!isDraw(item) || item.rarity !== 6) continue;
    if (item.isFree) continue;
    if (isStatsExcluded(item.poolId)) continue;
    const upName = poolConfig[item.poolName];
    if (upName && getItemName(item) === upName) upCount++;
  }
  return upCount;
}

// UP 命中率专用统计，返回命中数与分母，两者同源同口径
// 跳过不参与统计的池与无 UP 配置的池，免费抽计入
// 分母不可复用 calculateAvgPity 的 sixStarCount，后者统计的是水位序列，口径不同
export function calculateUpStats(items, poolConfig = {}) {
  let upCount = 0;
  let sixStarCount = 0;
  for (const item of items) {
    if (!isDraw(item) || item.rarity !== 6) continue;
    if (isStatsExcluded(item.poolId)) continue;
    const upName = poolConfig[item.poolName];
    if (!upName) continue; // 无 UP 配置的池不参与命中率统计
    sixStarCount++;
    if (getItemName(item) === upName) upCount++;
  }
  return { upCount, sixStarCount };
}
