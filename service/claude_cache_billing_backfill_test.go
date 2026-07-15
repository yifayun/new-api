package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEstimateAnthropicTextInputFromAggregatedPrompt(t *testing.T) {
	require.Equal(t, 68, EstimateAnthropicTextInputFromAggregatedPrompt(344271))
	require.Equal(t, 101, EstimateAnthropicTextInputFromAggregatedPrompt(507901))
	require.Equal(t, 26, EstimateAnthropicTextInputFromAggregatedPrompt(130188))
}

func TestRecalculateClaudeCacheBillingFromAggregatedPrompt(t *testing.T) {
	result := RecalculateClaudeCacheBillingFromAggregatedPrompt(
		507901,
		60,
		635251,
		ClaudeCacheBillingBackfillRatios{
			ModelRatio:         2.5,
			GroupRatio:         0.5,
			CompletionRatio:    5,
			CacheCreationRatio: 1.3,
		},
	)

	require.Equal(t, 101, result.TextInputTokens)
	require.Equal(t, 507800, result.CacheCreationTokens)
	require.Greater(t, result.Quota, 635251)
	require.Greater(t, result.QuotaDelta, 0)
}

func TestShouldBackfillClaudeCacheBillingLog(t *testing.T) {
	other := ClaudeCacheBillingBackfillLogOther{
		Claude:             true,
		CacheCreationRatio: 1.3,
	}
	require.True(t, ShouldBackfillClaudeCacheBillingLog(130188, other, "claude-opus-4-8"))
	require.False(t, ShouldBackfillClaudeCacheBillingLog(130188, other, "gpt-4o"))
	require.False(t, ShouldBackfillClaudeCacheBillingLog(69, other, "claude-opus-4-8"))
}
