package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEstimateAggregatedClaudeTextInputKnownCases(t *testing.T) {
	text, ok := EstimateAggregatedClaudeTextInput(507901, 60, 50, 500)
	require.True(t, ok)
	require.Equal(t, 50, text)

	text, ok = EstimateAggregatedClaudeTextInput(344271, 2371, 50, 500)
	require.True(t, ok)
	require.Equal(t, 237, text)
}

func TestBuildLogCacheBackfillCandidateKnownLog(t *testing.T) {
	other := `{"claude":true,"cache_creation_tokens":0,"cache_tokens":0,"model_ratio":2.5,"group_ratio":0.5,"completion_ratio":5,"cache_ratio":0.1,"cache_creation_ratio":1.3,"usage_semantic":"anthropic"}`
	opts := DefaultLogCacheBackfillOptions()

	candidate := BuildLogCacheBackfillCandidate(902110, 1, "req", "claude-opus-4-8", 507901, 60, 635251, other, opts)
	require.False(t, candidate.Skipped)
	require.Equal(t, 101, candidate.TextTokens)
	require.Equal(t, 507800, candidate.CacheCreation)
	require.Equal(t, 101, candidate.NewPromptTokens)
	require.Greater(t, candidate.NewQuota, candidate.OldQuota)
	require.InDelta(t, 825688, candidate.NewQuota, 2000)
}

func TestBuildLogCacheBackfillCandidateSkipsAlreadyFixed(t *testing.T) {
	other := `{"claude":true,"cache_creation_tokens":100,"cache_tokens":0}`
	opts := DefaultLogCacheBackfillOptions()
	candidate := BuildLogCacheBackfillCandidate(1, 1, "", "claude-opus-4-8", 1000, 10, 100, other, opts)
	require.True(t, candidate.Skipped)
	require.Equal(t, "cache_creation_already_set", candidate.SkipReason)
}
