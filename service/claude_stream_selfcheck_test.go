package service

import (
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/stretchr/testify/require"
)

func TestClaudeStreamSelfCheck_AllScenarios(t *testing.T) {
	gin.SetMode(gin.TestMode)
	_ = os.Remove(claudeStreamDebugLogPath)

	t.Run("pass_through_orphan_stop", func(t *testing.T) {
		out := runSanitizerPipeline(t, buildUserReportedPassThroughEvents())
		assertValidBlockSequence(t, out)
	})

	t.Run("convert_nonzero_tool_index", func(t *testing.T) {
		toolIndex := 1
		finishReason := "tool_calls"
		out := runConvertPipeline(t, []dto.ChatCompletionsStreamResponse{
			{
				Id: "c1", Model: "claude-opus-4-8",
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
						Role: "assistant", Content: lo.ToPtr("text"),
					},
				}},
			},
			{
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
						ToolCalls: []dto.ToolCallResponse{{
							Index: &toolIndex, ID: "t1", Type: "function",
							Function: dto.FunctionResponse{Name: "Bash", Arguments: `{}`},
						}},
					},
					FinishReason: &finishReason,
				}},
				Usage: &dto.Usage{PromptTokens: 1, CompletionTokens: 1},
			},
		})
		assertValidBlockSequence(t, out)
	})

	t.Run("nil_index_stop_does_not_orphan", func(t *testing.T) {
		events := []dto.ClaudeResponse{
			{Type: "content_block_start", ContentBlock: &dto.ClaudeMediaMessage{Type: "text", Text: lo.ToPtr("")}},
			{Type: "content_block_delta", Delta: &dto.ClaudeMediaMessage{Type: "text_delta", Text: lo.ToPtr("x")}},
			{Type: "content_block_stop"},
			{Type: "message_stop"},
		}
		events[0].SetIndex(0)
		events[1].SetIndex(0)
		// events[2] intentionally has nil index -> defaults to 0

		out := runSanitizerPipeline(t, events)
		assertValidBlockSequence(t, out)
	})

	t.Run("thinking_then_tool", func(t *testing.T) {
		toolIndex := 0
		finishReason := "tool_calls"
		out := runConvertPipeline(t, []dto.ChatCompletionsStreamResponse{
			{
				Id: "c2", Model: "claude-opus-4-8",
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
						Role: "assistant", ReasoningContent: lo.ToPtr("think"),
					},
				}},
			},
			{
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
						Content: lo.ToPtr("answer"),
					},
				}},
			},
			{
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
						ToolCalls: []dto.ToolCallResponse{{
							Index: &toolIndex, ID: "t2", Type: "function",
							Function: dto.FunctionResponse{Name: "Bash", Arguments: `{}`},
						}},
					},
					FinishReason: &finishReason,
				}},
				Usage: &dto.Usage{PromptTokens: 1, CompletionTokens: 1},
			},
		})
		assertValidBlockSequence(t, out)
	})

	t.Run("unclosed_block_auto_closed", func(t *testing.T) {
		events := []dto.ClaudeResponse{
			{Type: "content_block_start", ContentBlock: &dto.ClaudeMediaMessage{Type: "text", Text: lo.ToPtr("")}},
			{Type: "content_block_delta", Delta: &dto.ClaudeMediaMessage{Type: "text_delta", Text: lo.ToPtr("x")}},
			{Type: "message_stop"},
		}
		events[0].SetIndex(0)
		events[1].SetIndex(0)

		out := runSanitizerPipeline(t, events)
		assertValidBlockSequence(t, out)
		require.Contains(t, indicesByType(out, "content_block_stop"), 0)
	})

	summarizeSelfCheckLog(t)
}

func buildUserReportedPassThroughEvents() []dto.ClaudeResponse {
	events := []dto.ClaudeResponse{
		{Type: "message_start", Message: &dto.ClaudeMediaMessage{Type: "message"}},
		{Type: "content_block_start", ContentBlock: &dto.ClaudeMediaMessage{Type: "text", Text: lo.ToPtr("")}},
		{Type: "content_block_delta", Delta: &dto.ClaudeMediaMessage{Type: "text_delta", Text: lo.ToPtr("hello")}},
		{Type: "content_block_stop"},
		{Type: "content_block_start", ContentBlock: &dto.ClaudeMediaMessage{Type: "tool_use", Id: "tool_x", Name: "Bash", Input: map[string]any{}}},
		{Type: "content_block_delta", Delta: &dto.ClaudeMediaMessage{Type: "input_json_delta", PartialJson: lo.ToPtr(`{}`)}},
		{Type: "content_block_stop"},
		{Type: "content_block_stop"},
		{Type: "message_stop"},
	}
	events[1].SetIndex(0)
	events[2].SetIndex(0)
	events[3].SetIndex(0)
	events[4].SetIndex(2)
	events[5].SetIndex(2)
	events[6].SetIndex(1)
	events[7].SetIndex(2)
	return events
}

func runSanitizerPipeline(t *testing.T, events []dto.ClaudeResponse) []dto.ClaudeResponse {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	var out []dto.ClaudeResponse
	for _, event := range events {
		raw, err := common.Marshal(event)
		require.NoError(t, err)
		for _, chunk := range SanitizeClaudeStreamChunk(c, &event, string(raw)) {
			observeClaudeStreamOutput(c, chunk.Resp, "selfcheck")
			out = append(out, chunk.Resp)
		}
	}
	if len(events) > 0 && events[len(events)-1].Type != "message_stop" {
		msgStop := dto.ClaudeResponse{Type: "message_stop"}
		observeClaudeStreamOutput(c, msgStop, "selfcheck")
		out = append(out, msgStop)
	}
	summarizeClaudeStreamValidator(c, "selfcheck")
	return out
}

func runConvertPipeline(t *testing.T, chunks []dto.ChatCompletionsStreamResponse) []dto.ClaudeResponse {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{LastMessagesType: relaycommon.LastMessageTypeNone},
	}
	var out []dto.ClaudeResponse
	for i, chunk := range chunks {
		info.SendResponseCount = i + 1
		for _, resp := range StreamResponseOpenAI2Claude(&chunk, info) {
			raw, err := common.Marshal(resp)
			require.NoError(t, err)
			for _, sanitized := range SanitizeClaudeStreamChunk(c, resp, string(raw)) {
				observeClaudeStreamOutput(c, sanitized.Resp, "selfcheck")
				out = append(out, sanitized.Resp)
			}
		}
	}
	stop := dto.ClaudeResponse{Type: "message_stop"}
	observeClaudeStreamOutput(c, stop, "selfcheck")
	out = append(out, stop)
	summarizeClaudeStreamValidator(c, "selfcheck")
	return out
}

func assertValidBlockSequence(t *testing.T, events []dto.ClaudeResponse) {
	t.Helper()
	started := map[int]struct{}{}
	open := map[int]struct{}{}

	for _, event := range events {
		idx := event.GetIndex()
		switch event.Type {
		case "content_block_start":
			require.NotContains(t, started, idx, "duplicate start at %d", idx)
			started[idx] = struct{}{}
			open[idx] = struct{}{}
		case "content_block_delta":
			require.Contains(t, started, idx, "delta without start at %d", idx)
		case "content_block_stop":
			require.Contains(t, started, idx, "orphan stop at %d", idx)
			require.Contains(t, open, idx, "stop on closed block at %d", idx)
			delete(open, idx)
		case "message_stop":
			require.Empty(t, open, "open blocks at message_stop: %v", open)
		}
	}
}

func summarizeSelfCheckLog(t *testing.T) {
	t.Helper()
	data, err := os.ReadFile(claudeStreamDebugLogPath)
	if err != nil {
		t.Logf("debug log not written: %v", err)
		return
	}
	t.Logf("selfcheck debug log bytes: %d", len(data))
}
