package service

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func claudeTextPtr(s string) *string {
	return &s
}

func TestNormalizeAnthropicCompatibleUsageInfersCacheCreationFromTextTokens(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
	}
	usage := &dto.Usage{
		PromptTokens:     344271,
		CompletionTokens: 2371,
		PromptTokensDetails: dto.InputTokenDetails{
			TextTokens: 58,
		},
	}

	NormalizeAnthropicCompatibleUsage(relayInfo, usage, nil)

	require.Equal(t, 58, usage.PromptTokens)
	require.Equal(t, 344213, usage.PromptTokensDetails.CachedCreationTokens)
	require.Equal(t, "anthropic", usage.UsageSemantic)
}

func TestNormalizeAnthropicCompatibleUsageExtractsCacheCreationFromBody(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
	}
	usage := &dto.Usage{
		PromptTokens:     344271,
		CompletionTokens: 2371,
	}
	body := []byte(`{"usage":{"cache_creation_input_tokens":344213,"prompt_tokens":344271}}`)

	NormalizeAnthropicCompatibleUsage(relayInfo, usage, body)

	require.Equal(t, 344213, usage.PromptTokensDetails.CachedCreationTokens)
	require.Equal(t, 58, usage.PromptTokens)
}

func TestNormalizeAnthropicCompatibleUsageUsesInputTokensAsText(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
	}
	usage := &dto.Usage{
		PromptTokens:     344271,
		InputTokens:      58,
		CompletionTokens: 2371,
	}

	NormalizeAnthropicCompatibleUsage(relayInfo, usage, nil)

	require.Equal(t, 58, usage.PromptTokens)
	require.Equal(t, 344213, usage.PromptTokensDetails.CachedCreationTokens)
}

func TestEnrichUsageFromStreamItemsMergesClaudeMessageStartUsage(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     344271,
		CompletionTokens: 2371,
	}
	streamItems := []string{
		`{"type":"message_start","message":{"usage":{"input_tokens":58,"cache_creation_input_tokens":344213,"output_tokens":0}}}`,
	}

	EnrichUsageFromStreamItems(usage, streamItems)

	require.Equal(t, 58, usage.PromptTokens)
	require.Equal(t, 344213, usage.PromptTokensDetails.CachedCreationTokens)
}

func TestNormalizeAnthropicCompatibleUsageInfersCacheReadWhenCreationKnown(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
	}
	usage := &dto.Usage{
		PromptTokens:     344329,
		CompletionTokens: 500,
		PromptTokensDetails: dto.InputTokenDetails{
			TextTokens:           58,
			CachedCreationTokens: 344213,
		},
	}

	NormalizeAnthropicCompatibleUsage(relayInfo, usage, nil)

	require.Equal(t, 58, usage.PromptTokens)
	require.Equal(t, 344213, usage.PromptTokensDetails.CachedCreationTokens)
	require.Equal(t, 58, usage.PromptTokensDetails.CachedTokens)
}

func TestNormalizeAnthropicCompatibleUsageExtractsCacheReadFromBody(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
	}
	usage := &dto.Usage{
		PromptTokens:     100058,
		CompletionTokens: 500,
	}
	body := []byte(`{"usage":{"cache_read_input_tokens":100000,"prompt_tokens":100058}}`)

	NormalizeAnthropicCompatibleUsage(relayInfo, usage, body)

	require.Equal(t, 100000, usage.PromptTokensDetails.CachedTokens)
	require.Equal(t, 58, usage.PromptTokens)
}

func TestNormalizeAnthropicCompatibleUsageInfersCacheCreationFromRequest(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatClaude,
		OriginModelName: "claude-opus-4-8",
		Request: &dto.ClaudeRequest{
			System: []dto.ClaudeMediaMessage{{
				Type:         "text",
				Text:         claudeTextPtr("cached system prompt"),
				CacheControl: json.RawMessage(`{"type":"ephemeral"}`),
			}},
			Messages: []dto.ClaudeMessage{{
				Role:    "user",
				Content: "new user turn",
			}},
		},
	}
	usage := &dto.Usage{
		PromptTokens:     507901,
		CompletionTokens: 60,
	}

	NormalizeAnthropicCompatibleUsage(relayInfo, usage, nil)

	require.Greater(t, usage.PromptTokensDetails.CachedCreationTokens, 0)
	require.Less(t, usage.PromptTokens, usage.PromptTokensDetails.CachedCreationTokens)
	require.Equal(t, "anthropic", usage.UsageSemantic)
}

func TestEnrichUsageFromStreamItemsMergesClaudeCacheReadUsage(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     100058,
		CompletionTokens: 500,
	}
	streamItems := []string{
		`{"type":"message_start","message":{"usage":{"input_tokens":58,"cache_read_input_tokens":100000,"output_tokens":0}}}`,
	}

	EnrichUsageFromStreamItems(usage, streamItems)

	require.Equal(t, 58, usage.PromptTokens)
	require.Equal(t, 100000, usage.PromptTokensDetails.CachedTokens)
}

func TestEstimateClaudeNonCachedInputTokensIgnoresCachedBlocks(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-opus-4-8",
		Request: &dto.ClaudeRequest{
			System: []dto.ClaudeMediaMessage{{
				Type:         "text",
				Text:         claudeTextPtr("this should not count as fresh input"),
				CacheControl: json.RawMessage(`{"type":"ephemeral"}`),
			}},
			Messages: []dto.ClaudeMessage{{
				Role:    "user",
				Content: "hello",
			}},
		},
	}

	estimate := estimateClaudeNonCachedInputTokens(relayInfo)

	require.Greater(t, estimate, 0)
	require.Less(t, estimate, 100)
}
