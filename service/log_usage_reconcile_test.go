package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReconcileClaudeLogUsageCacheCreation(t *testing.T) {
	result, err := ReconcileClaudeLogUsage(LogUsageReconcileCandidate{
		LogID:            902110,
		PromptTokens:     507901,
		CompletionTokens: 60,
		Quota:            635251,
		Other: map[string]interface{}{
			"claude":               true,
			"model_ratio":          2.5,
			"group_ratio":          0.5,
			"completion_ratio":     5.0,
			"cache_ratio":          0.1,
			"cache_creation_ratio": 1.3,
		},
	})
	require.NoError(t, err)
	require.True(t, result.Applied)
	require.Equal(t, "cache_creation", result.Category)
	require.Equal(t, 69, result.PromptTokens)
	require.Equal(t, 507832, result.CacheCreationTokens)
	require.Equal(t, 825688, result.NewQuota)
}

func TestReconcileClaudeLogUsageCacheRead(t *testing.T) {
	result, err := ReconcileClaudeLogUsage(LogUsageReconcileCandidate{
		LogID:            902142,
		PromptTokens:     127287,
		CompletionTokens: 7,
		Quota:            159153,
		Other: map[string]interface{}{
			"claude":               true,
			"model_ratio":          2.5,
			"group_ratio":          0.5,
			"completion_ratio":     5.0,
			"cache_ratio":          0.1,
			"cache_creation_ratio": 1.3,
		},
	})
	require.NoError(t, err)
	require.True(t, result.Applied)
	require.Equal(t, "cache_read", result.Category)
	require.Equal(t, 58, result.PromptTokens)
	require.Equal(t, 127229, result.CacheReadTokens)
	require.Less(t, result.NewQuota, result.OldQuota)
}

func TestReconcileClaudeLogUsageCacheCreationWithExistingCacheReadField(t *testing.T) {
	result, err := ReconcileClaudeLogUsage(LogUsageReconcileCandidate{
		LogID:            902913,
		PromptTokens:     438093,
		CompletionTokens: 334,
		Quota:            303603,
		Other: map[string]interface{}{
			"claude":               true,
			"cache_tokens":         218756,
			"model_ratio":          2.5,
			"group_ratio":          0.5,
			"completion_ratio":     5.0,
			"cache_ratio":          0.1,
			"cache_creation_ratio": 1.3,
		},
	})
	require.NoError(t, err)
	require.True(t, result.Applied)
	require.Equal(t, "cache_creation", result.Category)
	require.Equal(t, 69, result.PromptTokens)
	require.Equal(t, 438024, result.CacheCreationTokens)
	require.Equal(t, 0, result.CacheReadTokens)
	require.Greater(t, result.NewQuota, result.OldQuota)
}

func TestReconcileClaudeLogUsageSkipsAlreadyReconciled(t *testing.T) {
	result, err := ReconcileClaudeLogUsage(LogUsageReconcileCandidate{
		LogID:        1,
		PromptTokens: 69,
		Other: map[string]interface{}{
			"claude":                true,
			"usage_reconciled":      true,
			"cache_creation_tokens": 507832,
		},
	})
	require.NoError(t, err)
	require.False(t, result.Applied)
}
