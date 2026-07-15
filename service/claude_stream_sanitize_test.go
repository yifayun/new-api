package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/samber/lo"
	"github.com/stretchr/testify/require"
)

func collectSanitizedEvents(t *testing.T, sanitizer *ClaudeStreamSanitizer, events []dto.ClaudeResponse) []dto.ClaudeResponse {
	t.Helper()

	var out []dto.ClaudeResponse
	for _, event := range events {
		raw, err := common.Marshal(event)
		require.NoError(t, err)
		for _, chunk := range sanitizer.Process(&event, string(raw)) {
			out = append(out, chunk.Resp)
		}
	}
	return out
}

func indicesByType(events []dto.ClaudeResponse, eventType string) []int {
	var indices []int
	for _, event := range events {
		if event.Type != eventType || event.Index == nil {
			continue
		}
		indices = append(indices, *event.Index)
	}
	return indices
}

func TestClaudeStreamSanitizer_UserReportedOrphanStop(t *testing.T) {
	t.Parallel()

	sanitizer := NewClaudeStreamSanitizer()
	rawEvents := []dto.ClaudeResponse{
		{Type: "message_start", Message: &dto.ClaudeMediaMessage{Type: "message"}},
		{Type: "content_block_start", ContentBlock: &dto.ClaudeMediaMessage{Type: "text", Text: lo.ToPtr("")}},
		{Type: "content_block_delta", Delta: &dto.ClaudeMediaMessage{Type: "text_delta", Text: lo.ToPtr("hello")}},
		{Type: "content_block_stop"},
		{Type: "content_block_start", ContentBlock: &dto.ClaudeMediaMessage{Type: "tool_use", Id: "tooluse_x", Name: "Bash", Input: map[string]any{}}},
		{Type: "content_block_delta", Delta: &dto.ClaudeMediaMessage{Type: "input_json_delta", PartialJson: lo.ToPtr(`{}`)}},
		{Type: "content_block_stop"},
		{Type: "content_block_stop"},
		{Type: "message_stop"},
	}
	rawEvents[1].SetIndex(0)
	rawEvents[2].SetIndex(0)
	rawEvents[3].SetIndex(0)
	rawEvents[4].SetIndex(2)
	rawEvents[5].SetIndex(2)
	rawEvents[6].SetIndex(1)
	rawEvents[7].SetIndex(2)

	out := collectSanitizedEvents(t, sanitizer, rawEvents)
	startIndices := indicesByType(out, "content_block_start")
	stopIndices := indicesByType(out, "content_block_stop")

	require.Equal(t, []int{0, 1}, startIndices)
	require.Equal(t, startIndices, stopIndices)
	require.NotContains(t, stopIndices, 2)
}

func TestClaudeStreamSanitizer_SyntheticStartForDeltaOnly(t *testing.T) {
	t.Parallel()

	sanitizer := NewClaudeStreamSanitizer()
	delta := dto.ClaudeResponse{
		Type:  "content_block_delta",
		Delta: &dto.ClaudeMediaMessage{Type: "text_delta", Text: lo.ToPtr("hi")},
	}
	delta.SetIndex(3)

	raw, err := common.Marshal(delta)
	require.NoError(t, err)

	chunks := sanitizer.Process(&delta, string(raw))
	require.Len(t, chunks, 2)
	require.Equal(t, "content_block_start", chunks[0].Resp.Type)
	require.Equal(t, 0, chunks[0].Resp.GetIndex())
	require.Equal(t, "content_block_delta", chunks[1].Resp.Type)
	require.Equal(t, 0, chunks[1].Resp.GetIndex())
}

func TestClaudeStreamSanitizer_PatchesRawIndex(t *testing.T) {
	t.Parallel()

	sanitizer := NewClaudeStreamSanitizer()
	start := dto.ClaudeResponse{
		Type:         "content_block_start",
		ContentBlock: &dto.ClaudeMediaMessage{Type: "text", Text: lo.ToPtr("")},
	}
	start.SetIndex(5)

	chunks := sanitizer.Process(&start, `{"type":"content_block_start","index":5,"content_block":{"type":"text","text":""}}`)
	require.Len(t, chunks, 1)
	require.Contains(t, chunks[0].Data, `"index":0`)
	require.NotContains(t, chunks[0].Data, `"index":5`)
}

func TestClaudeStreamSanitizer_SkipsDuplicateStop(t *testing.T) {
	t.Parallel()

	sanitizer := NewClaudeStreamSanitizer()
	start := dto.ClaudeResponse{
		Type:         "content_block_start",
		ContentBlock: &dto.ClaudeMediaMessage{Type: "text", Text: lo.ToPtr("")},
	}
	start.SetIndex(0)
	stop := dto.ClaudeResponse{Type: "content_block_stop"}
	stop.SetIndex(0)

	startRaw, err := common.Marshal(start)
	require.NoError(t, err)
	stopRaw, err := common.Marshal(stop)
	require.NoError(t, err)

	require.Len(t, sanitizer.Process(&start, string(startRaw)), 1)
	require.Len(t, sanitizer.Process(&stop, string(stopRaw)), 1)
	require.Len(t, sanitizer.Process(&stop, string(stopRaw)), 0)
}
