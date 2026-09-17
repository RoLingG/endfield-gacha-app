import { SPARK_TIER1, SPARK_TIER2, PITY_BOOST_START, CHAR_BASE_RATE, CHAR_HARD_PITY, CHAR_PITY_MU, CHAR_PITY_SIGMA, WEAPON_PITY_MU, WEAPON_PITY_SIGMA, WEAPON_BASE_RATE, WEAPON_PULLS_PER_CLAIM, WEAPON_CLAIM_HARD_PITY, CHAR_UP_RATE, WEAPON_UP_RATE } from './constants.js';
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

export function groupDataByPool(flatList) {
  const grouped = {};
  if (!flatList || flatList.length === 0) return grouped;
  flatList.forEach(item => {
    const pool = item.poolName || "UNKNOWN";
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

  // allItems 用于计算 pityCounter（跨池继承），items 决定显示哪些池子
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
  // pityCounter：跨池累加（排除池冻结），用于继承水位角标
  // poolPity：当前池内计数，用于 pityText 显示
  const allDetails = [];
  let pityCounter = 0;
  for (const key of poolOrder) {
    const firstItem = pools[key][0];
    const isExcluded = isPityExcluded(firstItem?.poolId);

    if (isExcluded) {
      // 排除池，冻结 pityCounter，用独立 poolPity 计数
      const saved = pityCounter;
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
          if (item.poolName) detail.poolName = item.poolName;
          details.push(detail);
          if (!item.isFree) poolPity = 0;
        } else {
          if (!item.isFree) poolPity++;
        }
      });
      if (reverse) details.reverse();
      allDetails.push(...details);
      pityCounter = saved;
    } else {
      // 非排除池，pityCounter 跨池累加，poolPity 当前池内计数
      const details = [];
      const inheritedPity = pityCounter;
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
            if (item.poolName) detail.poolName = item.poolName;
            if (!item.isFree && firstSixStar && inheritedPity > 0) {
              detail.inheritedPity = inheritedPity;
            }
            details.push(detail);
          } else {
            if (!item.isFree) poolPity++;
          }
          firstSixStar = false;
          if (!item.isFree) { pityCounter = 0; poolPity = 0; }
        } else {
          if (!item.isFree) { pityCounter++; poolPity++; }
        }
      });
      if (reverse) details.reverse();
      allDetails.push(...details);
    }
  }
  return allDetails;
}

// 计算卡池大保底信息
export function calculateSparkInfo(reversed, targetUp) {
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

  let targetLimit, rightCornerSub;
  if (sparkCount >= SPARK_TIER2) {
    targetLimit = SPARK_TIER2;
    rightCornerSub = "MAX SPARK REACHED";
  } else if (sparkCount > SPARK_TIER1) {
    targetLimit = SPARK_TIER2;
    rightCornerSub = `NEXT TARGET: ${SPARK_TIER2}`;
  } else {
    targetLimit = sparkConsumed ? SPARK_TIER2 : SPARK_TIER1;
    if (sparkCount < 60) {
      rightCornerSub = `INTEL BOOK: ${sparkCount} / 60`;
    } else if (sparkConsumed) {
      rightCornerSub = `${SPARK_TIER1} CONSUMED -> TARGET ${SPARK_TIER2}`;
    } else {
      rightCornerSub = "INTEL BOOK OBTAINED";
    }
  }

  return { sparkCount, targetLimit, rightCornerSub };
}

// 不参与跨池水位继承的特殊卡池（基础寻访、启程寻访与武器池，均无继承规则）
const EXCLUDED_FROM_PITY = ['standard', 'beginner'];

function isWeaponPool(poolId) {
  return poolId?.startsWith('weaponbox_') || poolId?.startsWith('weponbox_');
}

function isPityExcluded(poolId) {
  return EXCLUDED_FROM_PITY.includes(poolId) || isWeaponPool(poolId);
}

// 不参与欧非统计的卡池。仅基础寻访与启程寻访，其保底水位不被继承链承认，
// 且出货水位普遍极低，计入会拉低均值使评级偏欧；武器池有独立的期望基准，
// 需正常统计，故不可复用 isPityExcluded
function isStatsExcluded(poolId) {
  return EXCLUDED_FROM_PITY.includes(poolId);
}

// 计算每个池子各自的水位（保底计数跨池继承，出 6★ 归零）
// 返回 { poolName: pity } 的对象，pity 为该池子结束时的累计水位
// 基础寻访和启程寻访不参与继承链，不出现在返回值中
export function calculatePerPoolPity(dataMap, poolOrder) {
  const perPoolPity = {};
  let pity = 0;

  // 按配置顺序逐池遍历
  const allPoolNames = [...poolOrder];
  for (const poolName in dataMap) {
    if (!allPoolNames.includes(poolName)) {
      allPoolNames.push(poolName);
    }
  }

  for (const poolName of allPoolNames) {
    if (!dataMap[poolName]) continue;
    // 跳过特殊卡池，不参与跨池水位继承
    if (isPityExcluded(dataMap[poolName][0]?.poolId)) continue;
    // 池内按时间升序排序，同时间戳按 seqId 升序（保证十连批次内顺序正确）
    const items = [...dataMap[poolName]].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));

    for (const item of items) {
      if (!isDraw(item)) continue; // 跳过寻访情报书等非抽卡条目
      if (item.isFree) continue;
      pity++;
      if (item.rarity === 6) { pity = 0; }
    }
    perPoolPity[poolName] = pity;
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
  const poolOrderSet = new Set(poolOrder);
  const merged = [];
  // 新池→旧池遍历（反转配置顺序），保持池内顺序不变
  for (let i = poolOrder.length - 1; i >= 0; i--) {
    if (dataMap[poolOrder[i]]) {
      merged.push(...dataMap[poolOrder[i]]);
    }
  }
  // 再把 dataMap 中有但 poolOrder 没有的池子加进去（保底）
  for (const poolName in dataMap) {
    if (!poolOrderSet.has(poolName)) {
      merged.push(...dataMap[poolName]);
    }
  }
  return merged;
}

// 平均出货抽数（排除免费抽与非继承池的出货，保底跨池继承，出 6★ 归零）
// 口径需与欧非判定所用理论模型（μ=CHAR_PITY_MU，按特许寻访规则推导）一致
export function calculateAvgPity(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_AVG_PITY;

  const sorted = [...items].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));
  let pity = 0;
  let sixCount = 0;
  const pityList = [];
  let lastPoolId = '';
  let savedPity = 0;
  for (const item of sorted) {
    if (!isDraw(item)) continue; // 跳过寻访情报书等非抽卡条目
    if (item.isFree) continue;
    if (item.poolId !== lastPoolId) {
      const wasExcluded = isPityExcluded(lastPoolId);
      const nowExcluded = isPityExcluded(item.poolId);
      if (nowExcluded && !wasExcluded) {
        savedPity = pity;  // 进入排除池，保存
        pity = 0;
      } else if (!nowExcluded && wasExcluded) {
        pity = savedPity;  // 离开排除池，恢复
      }
      lastPoolId = item.poolId;
    }
    pity++;
    if (item.rarity === 6) {
      // 标准/启程寻访的出货不参与平均
      if (!isStatsExcluded(item.poolId)) {
        pityList.push(pity);
        sixCount++;
      }
      pity = 0;
    }
  }
  // 最后未出6★的抽数不计入平均（没有出货就不计入平均水位）
  const avgPity = pityList.length > 0
    ? +(pityList.reduce((a, b) => a + b, 0) / pityList.length).toFixed(1)
    : 0;
  return { avgPity, sixStarCount: sixCount };
}

// 最长不出货记录（排除免费抽与非继承池，保底跨池继承）
export function calculateMaxDrought(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_MAX_DROUGHT;

  const sorted = [...items].sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));
  let maxDrought = 0;
  let currentStreak = 0;
  let lastPoolId = '';
  let savedStreak = 0;
  for (const item of sorted) {
    if (!isDraw(item)) continue; // 跳过寻访情报书等非抽卡条目
    if (item.isFree) continue;
    const excluded = isPityExcluded(item.poolId);
    if (item.poolId !== lastPoolId) {
      const wasExcluded = isPityExcluded(lastPoolId);
      if (excluded && !wasExcluded) {
        savedStreak = currentStreak;
        currentStreak = 0;
      } else if (!excluded && wasExcluded) {
        currentStreak = savedStreak;
      }
      lastPoolId = item.poolId;
    }
    if (isStatsExcluded(item.poolId)) continue; // 标准/启程寻访不参与连续未出货统计
    if (item.rarity === 6) {
      if (currentStreak > maxDrought) maxDrought = currentStreak;
      currentStreak = 0;
    } else {
      currentStreak++;
    }
  }
  return { maxDrought, currentDrought: currentStreak };
}

// 按月统计抽数和出货数（排除免费抽与非继承池，与其它统计口径一致）
export function calculateMonthlyStats(items, poolConfig = {}) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_MONTHLY_STATS;

  const monthMap = new Map();
  for (const item of items) {
    if (!isDraw(item)) continue; // 跳过寻访情报书等非抽卡条目
    if (item.isFree) continue;
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
  let streak = 0;
  let lastPoolId = '';
  let savedStreak = 0;
  for (const item of sorted) {
    if (!isDraw(item)) continue; // 跳过寻访情报书等非抽卡条目
    if (item.isFree) continue;
    const excluded = isPityExcluded(item.poolId);
    if (item.poolId !== lastPoolId) {
      const wasExcluded = isPityExcluded(lastPoolId);
      if (excluded && !wasExcluded) {
        savedStreak = streak;
        streak = 0;
      } else if (!excluded && wasExcluded) {
        streak = savedStreak;
      }
      lastPoolId = item.poolId;
    }
    streak++;
    if (item.rarity === 6) {
      // 标准/启程寻访的出货不进分桶
      if (!isStatsExcluded(item.poolId)) {
        const bucketIndex = Math.min(Math.floor((streak - 1) / 10), 7);
        buckets[bucketIndex]++;
        const upName = poolConfig[item.poolName];
        if (upName && getItemName(item) === upName) {
          upBuckets[bucketIndex]++;
        } else {
          offBuckets[bucketIndex]++;
        }
      }
      streak = 0;
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

// 计算生涯总歪率（仅统计真实抽卡 6★，UP 判定复用 calculateUpCount 单一口径）
export function calculateOffRate(items, poolConfig = {}) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_OFF_RATE;

  const drawItems = items.filter(isDraw);
  const sixStarCount = drawItems.filter(i => i.rarity === 6).length;
  const upCount = calculateUpCount(drawItems, poolConfig);
  const offCount = sixStarCount - upCount;
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

  const poolNames = [...poolOrder];
  for (const poolName in dataMap) {
    if (!poolNames.includes(poolName)) poolNames.push(poolName);
  }

  for (const poolName of poolNames) {
    const items = dataMap[poolName];
    if (!items || items.length === 0) continue;

    const drawItems = items.filter(isDraw).filter(i => !i.isFree);
    const total = drawItems.length;
    if (total === 0) continue;

    const sorted = drawItems.sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));
    const upName = poolConfig[poolName];

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

  const poolNames = [...poolOrder];
  for (const poolName in dataMap) {
    if (!poolNames.includes(poolName)) poolNames.push(poolName);
  }

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

// UP 抽卡命中数据，按 UP 目标聚合本类型全部 UP 池命中记录（歪池计入所属 UP 行，无配置池不参与）
// 每行含：抽数 / 6★ 数 / 出货率 / 均水位 / 歪率 / 最深水位
export function calculateUpHitRecords(items, poolConfig = {}) {
  if (!items || !Array.isArray(items) || items.length === 0) return DEFAULT_ARRAY;

  const sorted = [...items]
    .filter(item => isDraw(item) && !item.isFree)
    .sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));

  // 水位（跨池继承口径）
  const recordMap = new Map();
  // 出货前即建行，使抽数能从周期起点开始累计
  const ensureRow = upName => {
    if (!recordMap.has(upName)) {
      recordMap.set(upName, {
        upName, pools: new Set(), sixStarCount: 0, upCount: 0, offCount: 0,
        deepest: 0, pulls: 0, pitySum: 0
      });
    }
    return recordMap.get(upName);
  };

  let streak = 0;
  let lastPoolId = '';
  let savedStreak = 0;
  let currentUp = null;

  for (const item of sorted) {
    if (item.poolId !== lastPoolId) {
      const wasExcluded = isPityExcluded(lastPoolId);
      const nowExcluded = isPityExcluded(item.poolId);
      if (nowExcluded && !wasExcluded) {
        savedStreak = streak;
        streak = 0;
      } else if (!nowExcluded && wasExcluded) {
        streak = savedStreak;
      }
      lastPoolId = item.poolId;
      currentUp = poolConfig[item.poolName] || null;
      // 池名随抽数一并累计（不能等出货才记，否则未出 6★ 的池名会丢失）
      if (currentUp) ensureRow(currentUp).pools.add(item.poolName);
    }
    streak++;
    if (currentUp) ensureRow(currentUp).pulls++;

    if (item.rarity === 6) {
      const upName = poolConfig[item.poolName];
      if (!upName) {
        streak = 0;
        continue; // 常驻池无 UP 配置，不参与命中记录表
      }
      const rec = ensureRow(upName);
      rec.sixStarCount++;
      rec.pitySum += streak;
      const isUp = getItemName(item) === upName;
      if (isUp) rec.upCount++; else rec.offCount++;
      if (streak > rec.deepest) rec.deepest = streak;
      streak = 0;
    }
  }

  return [...recordMap.values()].map(rec => ({
    upName: rec.upName,
    pools: rec.pools,
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
export function calculateCumulativeCurve(items) {
  const empty = { points: [], totalPulls: 0, sixStarCount: 0, tailPulls: 0 };
  if (!items || !Array.isArray(items) || items.length === 0) return empty;

  const sorted = [...items]
    .filter(item => isDraw(item) && !item.isFree && !isStatsExcluded(item.poolId))
    .sort((a, b) => Number(a.gachaTs) - Number(b.gachaTs) || Number(a.seqId) - Number(b.seqId));

  const points = [{ pull: 0, six: 0 }];
  let cum = 0;
  let six = 0;
  let streak = 0;
  let lastPoolId = '';
  let savedStreak = 0;
  let tailPulls = 0;

  for (const item of sorted) {
    if (item.poolId !== lastPoolId) {
      const wasExcluded = isPityExcluded(lastPoolId);
      const nowExcluded = isPityExcluded(item.poolId);
      if (nowExcluded && !wasExcluded) {
        savedStreak = streak;
        streak = 0;
      } else if (!nowExcluded && wasExcluded) {
        streak = savedStreak;
      }
      lastPoolId = item.poolId;
      if (wasExcluded) tailPulls += savedStreak;
    }
    streak++;
    if (item.rarity === 6) {
      cum += streak;
      six++;
      points.push({ pull: cum, six });
      streak = 0;
    }
  }
  tailPulls += streak;

  return { points, totalPulls: cum, sixStarCount: six, tailPulls };
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

// 统计命中 UP 的 6★ 数量（用于 UP 命中率欧非）
export function calculateUpCount(items, poolConfig = {}) {
  let upCount = 0;
  for (const item of items) {
    if (!isDraw(item) || item.rarity !== 6) continue;
    const upName = poolConfig[item.poolName];
    if (upName && getItemName(item) === upName) upCount++;
  }
  return upCount;
}
