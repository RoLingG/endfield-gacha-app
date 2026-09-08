package api

import (
	"net/http"
	"time"
)

// 全局复用 Client，设置超时防止挂死
var httpClient = &http.Client{
	Timeout: 15 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        10,               // 总空闲连接上限
		MaxIdleConnsPerHost: 5,                // 单 host 空闲连接数，底层默认为 2
		IdleConnTimeout:     90 * time.Second, // 空闲连接存活时间
	},
}
