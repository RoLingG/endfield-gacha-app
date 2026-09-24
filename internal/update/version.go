package update

import (
	"strconv"
	"strings"
)

// IsNewer 比较两个版本号，latest 大于 current 时返回 true
// 版本形如 v1.7.0 或 1.7.0，逐段按数值比较，避免 1.10.0 被误判为小于 1.9.0
func IsNewer(latest, current string) bool {
	l := parseSegments(latest)
	c := parseSegments(current)
	n := len(l)
	if len(c) > n {
		n = len(c)
	}
	for i := 0; i < n; i++ {
		var lv, cv int
		if i < len(l) {
			lv = l[i]
		}
		if i < len(c) {
			cv = c[i]
		}
		if lv != cv {
			return lv > cv
		}
	}
	return false
}

// parseSegments 剥离 v 前缀后按 . 切分并转数字，非数字段按 0 处理
func parseSegments(v string) []int {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ".")
	segments := make([]int, 0, len(parts))
	for _, p := range parts {
		// 容忍 1.7.0-beta 这类后缀，取数字前缀
		digit := p
		for i, r := range p {
			if r < '0' || r > '9' {
				digit = p[:i]
				break
			}
		}
		n, err := strconv.Atoi(digit)
		if err != nil {
			n = 0
		}
		segments = append(segments, n)
	}
	return segments
}
