import { getGachaChartInstance, setGachaChartInstance, setIsFetching, getComingFromStats } from './state.js';
import { destroyStatsCharts } from './render/chart.js';
import { SNACKBAR_AUTO_CLOSE, JADE_PER_PULL, JADE_PER_STONE, WEAPON_QUOTA_PER_TEN,
         WEAPON_QUOTA_6STAR, WEAPON_QUOTA_5STAR, WEAPON_QUOTA_4STAR } from './constants.js';

// Snackbar 通知封装
// action 可选，形如 { label, onClick }，传入时在文案右侧渲染一个可点按钮
export function showAppSnackbar({
  message = "",
  type = "info",
  autoCloseDelay = SNACKBAR_AUTO_CLOSE,
  closeable = false,
  action = null,
} = {}) {
  const el = document.createElement("div");
  el.className = `app-snackbar app-snackbar--${type}`;

  if (action?.label && typeof action.onClick === "function") {
    const text = document.createElement("span");
    text.textContent = message;
    const btn = document.createElement("button");
    btn.className = "app-snackbar__action";
    btn.type = "button";
    btn.textContent = action.label;
    el.append(text, btn);
    // 按钮点击不触发外层的关闭逻辑
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      action.onClick();
    });
  } else {
    el.textContent = message;
  }

  // 关闭函数，先播放退场动画，动画结束后移除 DOM
  const dismiss = () => {
    el.classList.add("app-snackbar--out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };

  const timer = setTimeout(dismiss, autoCloseDelay);
  if (closeable) {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      clearTimeout(timer);
      dismiss();
    });
  }

  document.body.appendChild(el);
  return el;
}

export function setFetchingState(fetching) {
  setIsFetching(fetching);
  const btn = document.getElementById("btnCancelFetch");
  if (btn) btn.style.display = fetching ? "inline-block" : "none";
}

export function resetButton(btn, text) {
  btn.textContent = text;
  btn.disabled = false;
}

export function setPoolSelectorVisibility(el, visible) {
  // 切换方向前摘掉上一轮的收尾监听，避免它在新动画中途触发
  if (el._poolSelEnd) {
    el.removeEventListener("transitionend", el._poolSelEnd);
    el._poolSelEnd = null;
  }

  if (visible) {
    const h = el.scrollHeight;
    el.style.transition = "height .25s ease-out, opacity .20s ease-out, margin-bottom .25s ease-in";
    el.style.height = "0px";
    el.style.marginBottom = "20px"
    el._poolSelRaf = requestAnimationFrame(() => {
      el._poolSelRaf = null;
      el.style.height = h + "px";
      el.style.opacity = "1";
    });
    // 展开事件处理函数。收尾时校验方向，已被收起打断则跳过，避免覆盖收起结果
    el._poolSelEnd = function handler(e) {
      if (e.propertyName !== "height") return;
      if (el.dataset.poolSelState !== 'shown') return;
      el.style.height = "";
      el.style.overflow = "";
      el.style.transition = "";
      el.removeEventListener("transitionend", handler);
      el._poolSelEnd = null;
    };
    el.dataset.poolSelState = 'shown';
    el.addEventListener("transitionend", el._poolSelEnd);
  } else {
    el.dataset.poolSelState = 'hidden';
    // 禁用 pool-menu 的 max-height transition，避免和 wrapper 的 collapse 冲突
    const menu = el.querySelector('.pool-menu');
    if (menu) {
      menu.style.transition = 'none';
      menu.classList.remove('show');
    }
    el.style.transition = "height .25s ease-in, opacity .20s ease-out, margin-bottom .25s ease-in";
    // 用 offsetHeight 作过渡初值：height 为空时 scrollHeight 不可靠
    el.style.height = el.offsetHeight + "px";
    el._poolSelRaf = requestAnimationFrame(() => {
      el._poolSelRaf = null;
      el.style.height = "0px";
      el.style.opacity = "0";
      el.style.marginBottom = "0";
    });
  }
}

export function showLoadingState(mainText, subText) {
  const loadingOverlay = document.getElementById("loadingOverlay");
  document.querySelector('.loading-text').textContent = mainText;
  document.querySelector('.loading-subtext').textContent = subText;
  const analyzeContainer = document.getElementById("analyzeContainer");
  analyzeContainer.style.opacity = "0";
  analyzeContainer.style.display = "none";
  requestAnimationFrame(() => {
    loadingOverlay.classList.add("show");
  });
}

export function updateSummaryStripVisibility(visible) {
  const summaryStrip = document.getElementById('summaryStrip');
  if (!summaryStrip) return;
  summaryStrip.style.display = visible ? 'flex' : 'none';
  if (visible && getComingFromStats()) {
    summaryStrip.style.animation = 'statsChartFadeIn 0.4s ease-out';
    summaryStrip.addEventListener('animationend', () => {
      summaryStrip.style.animation = '';
    }, { once: true });
  }
}

export function clearDisplay() {
  const chartInstance = getGachaChartInstance();
  if (chartInstance) {
    chartInstance.destroy();
    setGachaChartInstance(null);
  }
  destroyStatsCharts();
  const chartContainer = document.getElementById("chartContainer");
  chartContainer.querySelectorAll("canvas, .chart-no-data").forEach(el => el.remove());
  document.getElementById("rareCharsContainer").innerHTML = "";
  document.getElementById("summaryStrip").innerHTML = "";
  document.getElementById("historyTableBody").innerHTML = "";
  const currencyInfo = document.getElementById('currencyInfo');
  if (currencyInfo) {
    currencyInfo.style.display = 'none';
    document.getElementById('jadeValue').textContent = '0';
    document.getElementById('stoneValue').textContent = '0';
    document.getElementById('weaponQuotaFromCharValue').textContent = '0';
  }
}

export function updateCurrencyDisplay(notFreeTotal, type, starCounts = {}) {
  const currencyInfo = document.getElementById('currencyInfo');
  const charCurrency = document.getElementById('charCurrency');
  const weaponCurrency = document.getElementById('weaponCurrency');
  if (!currencyInfo) return;

  currencyInfo.style.display = 'flex';
  if (type === 'char') {
    charCurrency.style.display = 'inline';
    weaponCurrency.style.display = 'none';
    const jadeVal = notFreeTotal * JADE_PER_PULL;
    const stoneVal = Math.floor(jadeVal / JADE_PER_STONE);
    document.getElementById('jadeValue').textContent = jadeVal.toLocaleString();
    document.getElementById('stoneValue').textContent = stoneVal.toLocaleString();
    const weaponQuota = (starCounts.six || 0) * WEAPON_QUOTA_6STAR
                      + (starCounts.five || 0) * WEAPON_QUOTA_5STAR
                      + (starCounts.four || 0) * WEAPON_QUOTA_4STAR;
    document.getElementById('weaponQuotaFromCharValue').textContent = weaponQuota.toLocaleString();
  } else {
    charCurrency.style.display = 'none';
    weaponCurrency.style.display = 'inline';
    const tenPulls = Math.floor(notFreeTotal / 10);
    const weaponQuota = tenPulls * WEAPON_QUOTA_PER_TEN;
    document.getElementById('weaponQuotaValue').textContent = weaponQuota.toLocaleString();
  }
}
