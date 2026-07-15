package controller

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
)

var (
	webhookReplayMu    sync.Mutex
	webhookReplayCache = make(map[string]int64)
	webhookReplayHits  uint64
	webhookReplayMiss  uint64
)

func buildWebhookReplayKey(provider string, eventID string, orderID string, eventType string) string {
	normalize := func(s string) string {
		s = strings.TrimSpace(strings.ToLower(s))
		if s == "" {
			return "-"
		}
		return s
	}
	return fmt.Sprintf("%s:%s:%s:%s", normalize(provider), normalize(eventType), normalize(eventID), normalize(orderID))
}

// tryRecordWebhookEvent returns true when the event key is new or expired.
// It returns false when the same event key is seen again within ttl.
func tryRecordWebhookEvent(key string, ttl time.Duration) bool {
	if key == "" || ttl <= 0 {
		return true
	}

	// Redis-backed guard for multi-instance deployments.
	if common.RedisEnabled && common.RDB != nil {
		ok, err := common.RDB.SetNX(context.Background(), "webhook:replay:"+key, "1", ttl).Result()
		if err == nil {
			if ok {
				atomic.AddUint64(&webhookReplayMiss, 1)
			} else {
				atomic.AddUint64(&webhookReplayHits, 1)
			}
			return ok
		}
		common.SysError("webhook replay guard redis fallback: " + err.Error())
	}

	now := time.Now().Unix()
	expireAt := now + int64(ttl.Seconds())

	webhookReplayMu.Lock()
	defer webhookReplayMu.Unlock()

	// Opportunistic cleanup to keep the cache bounded.
	if len(webhookReplayCache) > 0 {
		for k, exp := range webhookReplayCache {
			if exp <= now {
				delete(webhookReplayCache, k)
			}
		}
	}

	if existingExpireAt, ok := webhookReplayCache[key]; ok && existingExpireAt > now {
		atomic.AddUint64(&webhookReplayHits, 1)
		return false
	}

	webhookReplayCache[key] = expireAt
	atomic.AddUint64(&webhookReplayMiss, 1)
	return true
}

func getWebhookReplayStats() map[string]uint64 {
	return map[string]uint64{
		"duplicate_hits": atomic.LoadUint64(&webhookReplayHits),
		"new_records":    atomic.LoadUint64(&webhookReplayMiss),
	}
}
