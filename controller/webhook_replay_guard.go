package controller

import (
	"sync"
	"time"
)

var (
	webhookReplayMu    sync.Mutex
	webhookReplayCache = make(map[string]int64)
)

// tryRecordWebhookEvent returns true when the event key is new or expired.
// It returns false when the same event key is seen again within ttl.
func tryRecordWebhookEvent(key string, ttl time.Duration) bool {
	if key == "" || ttl <= 0 {
		return true
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
		return false
	}

	webhookReplayCache[key] = expireAt
	return true
}
