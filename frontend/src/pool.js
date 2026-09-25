import { GetPoolConfig, UpdatePoolConfig } from "../wailsjs/go/main/App";
import {
  FALLBACK_CHAR_POOL_CONFIG,
  FALLBACK_WEAPON_POOL_CONFIG,
  FALLBACK_POOL_ORDER,
  SNACKBAR_AUTO_CLOSE,
} from './constants.js';
import {
  getGlobalPoolConfig, setGlobalPoolConfig,
  getGlobalCharPoolOrder, setGlobalCharPoolOrder,
  getGlobalWeaponPoolOrder, setGlobalWeaponPoolOrder,
  getCurrentPool, setCurrentPool,
} from './state.js';
import { showAppSnackbar } from './utils.js';
import { parsePoolKey, formatPoolLabel } from './data.js';
import { t } from './i18n.js';

// 追踪当前的 click-outside handler，避免重复绑定
let currentOutsideClickHandler = null;

// 加载卡池配置
export async function loadPoolConfig() {
  if (getGlobalPoolConfig()) return getGlobalPoolConfig();
  try {
    const config = await GetPoolConfig();
    if (config && (config.charPools?.length > 0 || config.weaponPools?.length > 0)) {
      const poolConfig = {};
      const charPoolOrder = [];
      const weaponPoolOrder = [];
      // 加载角色池配置
      if (config.charPools) {
        config.charPools.forEach(pool => {
          poolConfig[pool.poolName] = pool.up6Name;
          charPoolOrder.push(pool.poolName);
        });
      }
      // 加载武器池配置
      if (config.weaponPools) {
        config.weaponPools.forEach(pool => {
          poolConfig[pool.poolName] = pool.up6Name;
          weaponPoolOrder.push(pool.poolName);
        });
      }
      setGlobalPoolConfig(poolConfig);
      setGlobalCharPoolOrder(charPoolOrder);
      setGlobalWeaponPoolOrder(weaponPoolOrder);
    } else {
      // 接口正常返回但配置为空：不落入 catch，需在此显式兜底
      // 否则全局 config 保持 null，所有 UP 判定会静默失效（歪率显示 100%）
      console.warn("Pool config is empty, using fallback");
      setGlobalPoolConfig({ ...FALLBACK_CHAR_POOL_CONFIG, ...FALLBACK_WEAPON_POOL_CONFIG });
      setGlobalCharPoolOrder([...FALLBACK_POOL_ORDER]);
      setGlobalWeaponPoolOrder([]);
      showAppSnackbar({
        message: t('snackbar.emptyPools'),
        type: "warning",
        autoCloseDelay: SNACKBAR_AUTO_CLOSE,
      });
    }
  } catch (err) {
    console.warn("Failed to load pool config, using fallback:", err);
    setGlobalPoolConfig({ ...FALLBACK_CHAR_POOL_CONFIG, ...FALLBACK_WEAPON_POOL_CONFIG });
    setGlobalCharPoolOrder([...FALLBACK_POOL_ORDER]);
    setGlobalWeaponPoolOrder([]);
  }
  return getGlobalPoolConfig();
}

// 更新卡池配置
export async function updatePoolConfigHandler() {
  try {
    let msg = await UpdatePoolConfig();
    setGlobalPoolConfig(null);
    await loadPoolConfig();
    showAppSnackbar({
      message: "[SUCCESS] " + msg,
      type: "success"
    });
  } catch (err) {
    console.error("Failed to update pool config:", err);
    showAppSnackbar({
      message: t('snackbar.updateFailed') + err,
      type: "error",
      autoCloseDelay: SNACKBAR_AUTO_CLOSE,
    });
  }
}

// 关闭当前展开的池子下拉菜单，并等过渡结束后回落 wrapper 层级
// 供 Esc 等外部关闭路径复用，避免各处重复实现层级时序
export function closePoolMenu() {
  document.querySelectorAll('.pool-menu.show').forEach(menu => {
    menu.classList.remove('show');
    const wrapper = menu.closest('.pool-selector-wrapper');
    if (!wrapper) return;
    menu.addEventListener('transitionend', function handler(e) {
      if (e.propertyName !== 'max-height') return;
      if (!menu.classList.contains('show')) {
        wrapper.classList.remove('pool-selector-wrapper--open');
      }
    }, { once: true });
  });
}

export function createPoolButtons(dataMap, onPoolChange, type = 'char') {
  if (!dataMap || typeof dataMap !== 'object' || Object.keys(dataMap).length === 0) {
    showAppSnackbar({
      message: t('snackbar.emptyPools'),
      type: "warning",
      autoCloseDelay: SNACKBAR_AUTO_CLOSE,
    })
    if (type === "weapon") {
      dataMap = { ...FALLBACK_WEAPON_POOL_CONFIG }
    } else {
      dataMap = { ...FALLBACK_CHAR_POOL_CONFIG }
    }
  }
  const poolSelectorWrapper = document.getElementById('poolSelectorWrapper');
  if (!poolSelectorWrapper) {
    console.warn('poolSelectorWrapper element not found');
    return;
  }
  poolSelectorWrapper.innerHTML = '';
  // 重建时清掉上一轮的展开态层级，避免残留
  poolSelectorWrapper.classList.remove('pool-selector-wrapper--open');

  // 移除上一次绑定的 click-outside handler，避免泄漏
  if (currentOutsideClickHandler) {
    document.removeEventListener('click', currentOutsideClickHandler);
    currentOutsideClickHandler = null;
  }

  const container = document.createElement('div');
  container.className = 'pool-select-container';

  const label = document.createElement('label');
  label.className = 'pool-select-label';
  label.textContent = t('pool.select');
  container.appendChild(label);

  const dropdown = document.createElement('div');
  dropdown.className = 'pool-dropdown-wrapper';

  // 按对应类型的 poolOrder 顺序排列 dataMap 中存在的卡池。
  // poolOrder 里是原始池名（不含 #期数），而 dataMap 的 key 对复刻池带期数后缀，
  // 故先按原始池名分组，同名的各期相邻排列
  const poolOrder = (type === 'weapon') ? getGlobalWeaponPoolOrder() : getGlobalCharPoolOrder();
  const dataKeys = Object.keys(dataMap);
  const pools = [];
  for (const orderName of poolOrder) {
    const matched = dataKeys.filter(k => parsePoolKey(k).name === orderName);
    // 期数升序，保证 #1 → #2 依次排列
    matched.sort((a, b) => parsePoolKey(a).version - parsePoolKey(b).version);
    pools.push(...matched);
  }
  // 再补上 poolOrder 中未列出的池（配置缺失或新池）
  dataKeys.forEach(k => {
    if (!pools.includes(k)) pools.push(k);
  });
  // 优先保留该类型下用户做过的已有选择；仅当它不在当前池列表时才回落到默认（最新池）
  const previousPool = getCurrentPool(type);
  const initialPool = pools.includes(previousPool) ? previousPool : pools[pools.length - 1];
  setCurrentPool(initialPool, type);

  const display = document.createElement('div');
  display.className = 'pool-display';
  display.textContent = formatPoolLabel(getCurrentPool());
  display.addEventListener('click', () => {
    setMenuOpen(!menu.classList.contains('show'));
  });
  dropdown.appendChild(display);

  const menu = document.createElement('div');
  menu.className = 'pool-menu';

  // 菜单展开时提升 wrapper 层级以压住下方卡片，收起时恢复，否则会与卡片内 popover 的层级互相冲突
  function setMenuOpen(open) {
    if (open) {
      poolSelectorWrapper.classList.add('pool-selector-wrapper--open');
      menu.classList.add('show');
      return;
    }
    closePoolMenu(); // 由它在过渡结束后降层级
  }

  pools.reverse().forEach((poolKey) => {
    const item = document.createElement('div');
    item.className = 'pool-menu-item';
    item.textContent = formatPoolLabel(poolKey);
    if (poolKey === getCurrentPool(type)) {
      item.classList.add('active');
    }
    item.addEventListener('click', () => {
      display.textContent = formatPoolLabel(poolKey);
      setCurrentPool(poolKey, type);
      document.querySelectorAll('.pool-menu-item').forEach(i => {
        i.classList.remove('active');
      });
      item.classList.add('active');
      setMenuOpen(false);
      onPoolChange(dataMap, poolKey);
    });
    menu.appendChild(item);
  });

  dropdown.appendChild(menu);
  container.appendChild(dropdown);
  poolSelectorWrapper.appendChild(container);

  // 全局 currentOutsideClickHandler 绑定 click handler，方便处理重复绑定问题
  currentOutsideClickHandler = (e) => {
    if (!dropdown.contains(e.target)) {
      setMenuOpen(false);
    }
  };
  document.addEventListener('click', currentOutsideClickHandler);
}
