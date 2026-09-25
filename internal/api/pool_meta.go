package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	"Go_Arknights_Gacha_App/internal/logger"
	"Go_Arknights_Gacha_App/internal/model"
	"Go_Arknights_Gacha_App/internal/storage"

	"go.uber.org/zap"
)

// fallbackCharPoolTypes 内置兜底的角色池类型，接口未返回时保证不漏抓。
// meta 接口返回的是玩家近 90 天内参与过的类型，长时间未抽的池不会出现
// （如 Joint 与 Beginner 实测均不在返回中），故需与本列表取并集。
var fallbackCharPoolTypes = []string{
	"E_CharacterGachaPoolType_Special",
	"E_CharacterGachaPoolType_Joint",
	"E_CharacterGachaPoolType_Rerun",
	"E_CharacterGachaPoolType_Standard",
	"E_CharacterGachaPoolType_Beginner",
}

// fetchCharPoolTypes 获取角色池类型列表。
// 以 meta 接口返回的 tabs 为主，并与内置兜底列表取并集，接口失败时退回兜底列表。
func fetchCharPoolTypes(ctx context.Context, sess *gachaSession) []string {
	poolTypes, err := requestCharPoolTypes(ctx, sess)
	if err != nil {
		logger.Log.Warn("Failed to fetch pool types, using fallback", zap.Error(err))
		return fallbackCharPoolTypes
	}

	// 并集去重，保持兜底列表的顺序在前，接口新增的追加在后
	seen := make(map[string]bool, len(poolTypes))
	merged := make([]string, 0, len(fallbackCharPoolTypes)+len(poolTypes))
	for _, pt := range fallbackCharPoolTypes {
		if !seen[pt] {
			seen[pt] = true
			merged = append(merged, pt)
		}
	}
	added := 0
	for _, pt := range poolTypes {
		if pt != "" && !seen[pt] {
			seen[pt] = true
			merged = append(merged, pt)
			added++
		}
	}
	if added > 0 {
		logger.Log.Info("Discovered new pool types from meta API", zap.Int("count", added))
	}
	if err := storage.SaveCharPoolTypes(merged); err != nil {
		logger.Log.Error("Failed to save pool types", zap.Error(err))
	}
	return merged
}

// requestCharPoolTypes 请求 meta 接口并解析出 poolType 列表
func requestCharPoolTypes(ctx context.Context, sess *gachaSession) ([]string, error) {
	params := url.Values{}
	params.Set("lang", sess.Lang)
	params.Set("token", sess.Token)
	params.Set("server_id", sess.ServerID)

	body, err := sess.get(ctx, BaseUrlCharMeta, params, "gacha_char")
	if err != nil {
		return nil, err
	}

	var resp model.CharPoolMetaResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("解析池类型响应失败: %v", err)
	}
	if resp.Code != 0 {
		return nil, fmt.Errorf("API Error: %s", resp.Msg)
	}

	types := make([]string, 0, len(resp.Data.Tabs))
	for _, tab := range resp.Data.Tabs {
		if tab.PoolType != "" {
			types = append(types, tab.PoolType)
		}
	}
	if len(types) == 0 {
		return nil, fmt.Errorf("meta 接口未返回任何池类型")
	}
	return types, nil
}
