package update

import (
	"fmt"
	"testing"
)

func TestIsNewer(t *testing.T) {
	cases := []struct {
		latest  string
		current string
		want    bool
	}{
		// 常规升级
		{"v1.8.0", "1.7.0", true},
		{"1.8.0", "1.7.0", true},
		{"v1.7.1", "1.7.0", true},
		// 数值比较而非字符串比较
		{"v1.10.0", "1.9.0", true},
		{"v1.9.0", "1.10.0", false},
		// 相同版本
		{"v1.7.0", "1.7.0", false},
		{"1.7.0", "v1.7.0", false},
		// 降级（不应提示更新）
		{"v1.6.0", "1.7.0", false},
		// 段数不一致
		{"v1.7", "1.7.0", false},
		{"v1.7.0.1", "1.7.0", true},
		{"v2", "1.7.0", true},
		// 预发布后缀按数字前缀处理
		{"v1.7.0-beta", "1.7.0", false},
		{"v1.8.0-beta", "1.7.0", true},
		// 容错
		{"", "1.7.0", false},
		{"v1.7.0", "", true},
		{"v", "1.7.0", false},
	}

	for _, c := range cases {
		if got := IsNewer(c.latest, c.current); got != c.want {
			t.Errorf("IsNewer(%q, %q) = %v, want %v", c.latest, c.current, got, c.want)
		}
	}
}

func TestParseSegments(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"v1.7.0", "[1 7 0]"},
		{"1.7.0", "[1 7 0]"},
		{"V1.7.0", "[1 7 0]"},
		{"  v1.7.0  ", "[1 7 0]"},
		{"v1.7.0-beta", "[1 7 0]"},
		{"", "[]"},
		{"v", "[]"},
		{"v1.x.0", "[1 0 0]"},
	}

	for _, c := range cases {
		got := fmt.Sprint(parseSegments(c.in))
		if got != c.want {
			t.Errorf("parseSegments(%q) = %s, want %s", c.in, got, c.want)
		}
	}
}
