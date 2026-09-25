package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"Go_Arknights_Gacha_App/internal/logger"

	"go.uber.org/zap"
)

const poolTypesFileName = "pool_types.json"

// PoolTypes 已发现的卡池类型列表。
// 与 pool_config.json 分开存放：两者来源接口不同、更新时机独立，
// 共用时间戳会导致语义互相覆盖
type PoolTypes struct {
	CharPoolTypes []string `json:"charPoolTypes"`
	DiscoveredAt  string   `json:"discoveredAt"`
}

// SaveCharPoolTypes 保存角色池类型列表，内容无变化时不写盘
func SaveCharPoolTypes(poolTypes []string) error {
	if len(poolTypes) == 0 {
		return nil
	}

	existing, err := LoadPoolTypes()
	if err != nil {
		return fmt.Errorf("加载现有池类型失败: %v", err)
	}
	if isSameStrings(existing.CharPoolTypes, poolTypes) {
		return nil // 无变化，不写盘
	}

	data := PoolTypes{
		CharPoolTypes: poolTypes,
		DiscoveredAt:  time.Now().Format(time.DateTime),
	}

	configDir, err := getPoolConfigDir()
	if err != nil {
		return fmt.Errorf("获取配置目录失败: %v", err)
	}
	configPath := filepath.Join(configDir, poolTypesFileName)

	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化失败: %v", err)
	}
	if err := os.WriteFile(configPath, raw, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %v", err)
	}

	logger.Log.Info("Pool types saved",
		zap.Int("count", len(poolTypes)),
		zap.String("path", configPath))
	return nil
}

// LoadPoolTypes 加载卡池类型列表，文件不存在时返回空列表
func LoadPoolTypes() (*PoolTypes, error) {
	configDir, err := getPoolConfigDir()
	if err != nil {
		return nil, fmt.Errorf("获取配置目录失败: %v", err)
	}
	configPath := filepath.Join(configDir, poolTypesFileName)

	raw, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &PoolTypes{CharPoolTypes: []string{}}, nil
		}
		return nil, fmt.Errorf("读取文件失败: %v", err)
	}

	var result PoolTypes
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("解析文件失败: %v", err)
	}
	if result.CharPoolTypes == nil {
		result.CharPoolTypes = []string{}
	}
	return &result, nil
}

// isSameStrings 判断两个字符串切片内容是否完全一致（顺序敏感）
func isSameStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
