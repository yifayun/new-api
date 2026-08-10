package service

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/samber/lo"
	"github.com/stretchr/testify/require"
)

func newClaudeConvertRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeNone,
		},
	}
}

func collectClaudeStreamEvents(info *relaycommon.RelayInfo, chunks []dto.ChatCompletionsStreamResponse) []dto.ClaudeResponse {
	var events []dto.ClaudeResponse
	for i, chunk := range chunks {
		info.SendResponseCount = i + 1
		for _, resp := range StreamResponseOpenAI2Claude(&chunk, info) {
			events = append(events, *resp)
		}
	}
	return events
}

func contentBlockIndicesByType(events []dto.ClaudeResponse, eventType string) []int {
	var indices []int
	for _, event := range events {
		if event.Type != eventType || event.Index == nil {
			continue
		}
		indices = append(indices, *event.Index)
	}
	return indices
}

func TestStreamResponseOpenAI2Claude_TextThenToolWithNonZeroUpstreamIndex(t *testing.T) {
	t.Parallel()

	info := newClaudeConvertRelayInfo()
	toolIndex := 1
	finishReason := "tool_calls"
	usage := &dto.Usage{PromptTokens: 100, CompletionTokens: 20}

	events := collectClaudeStreamEvents(info, []dto.ChatCompletionsStreamResponse{
		{
			Id:    "chatcmpl-1",
			Model: "claude-opus-4-8",
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Role:    "assistant",
					Content: lo.ToPtr("我来帮你拉取最新代码。"),
				},
			}},
		},
		{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Content: lo.ToPtr(""),
				},
			}},
		},
		{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{{
						Index: &toolIndex,
						ID:    "tooluse_abc",
						Type:  "function",
						Function: dto.FunctionResponse{
							Name:      "Bash",
							Arguments: `{"command":"git pull"}`,
						},
					}},
				},
				FinishReason: &finishReason,
			}},
			Usage: usage,
		},
	})

	startIndices := contentBlockIndicesByType(events, "content_block_start")
	stopIndices := contentBlockIndicesByType(events, "content_block_stop")
	require.Equal(t, []int{0, 1}, startIndices)
	require.Equal(t, startIndices, stopIndices)
	require.NotContains(t, stopIndices, 2)
	require.NotContains(t, startIndices, 2)
}

func TestStreamResponseOpenAI2Claude_ParallelToolsWithGapFilledUpstreamIndex(t *testing.T) {
	t.Parallel()

	info := newClaudeConvertRelayInfo()
	indexOne := 1
	indexThree := 3
	finishReason := "tool_calls"

	events := collectClaudeStreamEvents(info, []dto.ChatCompletionsStreamResponse{
		{
			Id:    "chatcmpl-2",
			Model: "claude-opus-4-8",
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Role: "assistant",
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: &indexOne,
							ID:    "tooluse_a",
							Type:  "function",
							Function: dto.FunctionResponse{
								Name:      "Bash",
								Arguments: `{"command":"a"}`,
							},
						},
						{
							Index: &indexThree,
							ID:    "tooluse_b",
							Type:  "function",
							Function: dto.FunctionResponse{
								Name:      "Bash",
								Arguments: `{"command":"b"}`,
							},
						},
					},
				},
				FinishReason: &finishReason,
			}},
			Usage: &dto.Usage{PromptTokens: 10, CompletionTokens: 5},
		},
	})

	startIndices := contentBlockIndicesByType(events, "content_block_start")
	stopIndices := contentBlockIndicesByType(events, "content_block_stop")
	require.Equal(t, []int{0, 1}, startIndices)
	require.Equal(t, startIndices, stopIndices)
}

func TestStreamResponseOpenAI2Claude_ToolArgumentDeltaReusesMappedIndex(t *testing.T) {
	t.Parallel()

	info := newClaudeConvertRelayInfo()
	toolIndex := 5
	finishReason := "tool_calls"

	events := collectClaudeStreamEvents(info, []dto.ChatCompletionsStreamResponse{
		{
			Id:    "chatcmpl-3",
			Model: "claude-opus-4-8",
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Role: "assistant",
					ToolCalls: []dto.ToolCallResponse{{
						Index: &toolIndex,
						ID:    "tooluse_x",
						Type:  "function",
						Function: dto.FunctionResponse{
							Name:      "Bash",
							Arguments: `{"command":`,
						},
					}},
				},
			}},
		},
		{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{{
						Index: &toolIndex,
						Function: dto.FunctionResponse{
							Arguments: `"git pull"}`,
						},
					}},
				},
				FinishReason: &finishReason,
			}},
			Usage: &dto.Usage{PromptTokens: 10, CompletionTokens: 5},
		},
	})

	startIndices := contentBlockIndicesByType(events, "content_block_start")
	deltaIndices := contentBlockIndicesByType(events, "content_block_delta")
	stopIndices := contentBlockIndicesByType(events, "content_block_stop")

	require.Equal(t, []int{0}, startIndices)
	require.Equal(t, []int{0, 0}, deltaIndices)
	require.Equal(t, []int{0}, stopIndices)
}
