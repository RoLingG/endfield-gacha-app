package main

import (
	_ "embed"
	"encoding/json"
)

// wails.json 随二进制一同分发，作为版本号的唯一来源
// embed 指令无法跨目录引用，故版本读取放在根包，再由 App 传递给检测逻辑

//go:embed wails.json
var wailsConfig []byte

// appVersion 当前应用版本，取自 wails.json 的 info.productVersion
var appVersion = parseProductVersion(wailsConfig)

func parseProductVersion(raw []byte) string {
	var cfg struct {
		Info struct {
			ProductVersion string `json:"productVersion"`
		} `json:"info"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return ""
	}
	return cfg.Info.ProductVersion
}
