package service

import (
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/sjson"
)

type ClaudeStreamChunk struct {
	Resp dto.ClaudeResponse
	Data string
}

type ClaudeStreamSanitizer struct {
	nextBlockIndex        int
	upstreamToRemapped    map[int]int
	startedUpstream       map[int]struct{}
	openRemapped          map[int]struct{}
}

func NewClaudeStreamSanitizer() *ClaudeStreamSanitizer {
	return &ClaudeStreamSanitizer{
		upstreamToRemapped: make(map[int]int),
		startedUpstream:    make(map[int]struct{}),
		openRemapped:       make(map[int]struct{}),
	}
}

func GetClaudeStreamSanitizer(c *gin.Context) *ClaudeStreamSanitizer {
	if c == nil {
		return NewClaudeStreamSanitizer()
	}
	if value, ok := c.Get(string(constant.ContextKeyClaudeStreamSanitizer)); ok {
		if sanitizer, ok := value.(*ClaudeStreamSanitizer); ok && sanitizer != nil {
			return sanitizer
		}
	}
	sanitizer := NewClaudeStreamSanitizer()
	c.Set(string(constant.ContextKeyClaudeStreamSanitizer), sanitizer)
	return sanitizer
}

func SanitizeClaudeStreamChunk(c *gin.Context, resp *dto.ClaudeResponse, rawData string) []ClaudeStreamChunk {
	if resp == nil {
		return nil
	}
	return GetClaudeStreamSanitizer(c).Process(resp, rawData)
}

func (s *ClaudeStreamSanitizer) Process(resp *dto.ClaudeResponse, rawData string) []ClaudeStreamChunk {
	switch resp.Type {
	case "content_block_start":
		chunks := s.processStart(resp, rawData)
		// #region agent log
		writeClaudeStreamDebugLog("B", "claude_stream_sanitize.go:Process", "sanitizer start", "selfcheck", map[string]any{
			"upstreamIndex": resp.GetIndex(), "outCount": len(chunks), "action": sanitizeAction(len(chunks), "start"),
		})
		// #endregion
		return chunks
	case "content_block_delta":
		chunks := s.processDelta(resp, rawData)
		// #region agent log
		writeClaudeStreamDebugLog("C", "claude_stream_sanitize.go:Process", "sanitizer delta", "selfcheck", map[string]any{
			"upstreamIndex": resp.GetIndex(), "outCount": len(chunks), "action": sanitizeAction(len(chunks), "delta"),
		})
		// #endregion
		return chunks
	case "content_block_stop":
		chunks := s.processStop(resp, rawData)
		// #region agent log
		writeClaudeStreamDebugLog("B", "claude_stream_sanitize.go:Process", "sanitizer stop", "selfcheck", map[string]any{
			"upstreamIndex": resp.GetIndex(), "outCount": len(chunks), "action": sanitizeAction(len(chunks), "stop"),
		})
		// #endregion
		return chunks
	case "message_stop":
		chunks := s.processMessageStop(resp, rawData)
		// #region agent log
		writeClaudeStreamDebugLog("D", "claude_stream_sanitize.go:Process", "sanitizer message_stop", "selfcheck", map[string]any{
			"outCount": len(chunks), "autoClosed": len(chunks) - 1,
		})
		// #endregion
		return chunks
	default:
		return []ClaudeStreamChunk{{Resp: *resp, Data: rawData}}
	}
}

func sanitizeAction(outCount int, eventType string) string {
	if outCount == 0 {
		return "drop"
	}
	if outCount > 1 {
		return "expand"
	}
	return "pass_" + eventType
}

func (s *ClaudeStreamSanitizer) processStart(resp *dto.ClaudeResponse, rawData string) []ClaudeStreamChunk {
	upstreamIndex := resp.GetIndex()
	if _, started := s.startedUpstream[upstreamIndex]; started {
		return nil
	}

	remappedIndex := s.assignRemappedIndex(upstreamIndex)
	s.startedUpstream[upstreamIndex] = struct{}{}
	s.openRemapped[remappedIndex] = struct{}{}

	out := *resp
	out.SetIndex(remappedIndex)
	return []ClaudeStreamChunk{{
		Resp: out,
		Data: patchClaudeStreamChunkIndex(rawData, remappedIndex),
	}}
}

func (s *ClaudeStreamSanitizer) processDelta(resp *dto.ClaudeResponse, rawData string) []ClaudeStreamChunk {
	upstreamIndex := resp.GetIndex()
	remappedIndex, ok := s.upstreamToRemapped[upstreamIndex]
	if !ok {
		startChunk := s.buildSyntheticStart(upstreamIndex, resp)
		if startChunk == nil {
			return nil
		}
		deltaChunk := s.remapChunk(resp, rawData, upstreamIndex)
		if deltaChunk == nil {
			return []ClaudeStreamChunk{*startChunk}
		}
		return []ClaudeStreamChunk{*startChunk, *deltaChunk}
	}
	if _, open := s.openRemapped[remappedIndex]; !open {
		return nil
	}

	out := *resp
	out.SetIndex(remappedIndex)
	return []ClaudeStreamChunk{{
		Resp: out,
		Data: patchClaudeStreamChunkIndex(rawData, remappedIndex),
	}}
}

func (s *ClaudeStreamSanitizer) processStop(resp *dto.ClaudeResponse, rawData string) []ClaudeStreamChunk {
	upstreamIndex := resp.GetIndex()
	if _, started := s.startedUpstream[upstreamIndex]; !started {
		return nil
	}

	remappedIndex, ok := s.upstreamToRemapped[upstreamIndex]
	if !ok {
		return nil
	}
	if _, open := s.openRemapped[remappedIndex]; !open {
		return nil
	}
	delete(s.openRemapped, remappedIndex)

	out := *resp
	out.SetIndex(remappedIndex)
	return []ClaudeStreamChunk{{
		Resp: out,
		Data: patchClaudeStreamChunkIndex(rawData, remappedIndex),
	}}
}

func (s *ClaudeStreamSanitizer) processMessageStop(resp *dto.ClaudeResponse, rawData string) []ClaudeStreamChunk {
	openRemapped := make([]int, 0, len(s.openRemapped))
	for remappedIndex := range s.openRemapped {
		openRemapped = append(openRemapped, remappedIndex)
	}
	sort.Ints(openRemapped)

	chunks := make([]ClaudeStreamChunk, 0, len(openRemapped)+1)
	for _, remappedIndex := range openRemapped {
		// #region agent log
		writeClaudeStreamDebugLog("D", "claude_stream_sanitize.go:processMessageStop", "auto-close open block", "selfcheck", map[string]any{
			"remappedIndex": remappedIndex,
		})
		// #endregion
		stopBlock := generateStopBlock(remappedIndex)
		stopData, err := common.Marshal(stopBlock)
		if err != nil {
			continue
		}
		chunks = append(chunks, ClaudeStreamChunk{Resp: *stopBlock, Data: string(stopData)})
	}
	s.openRemapped = make(map[int]struct{})
	chunks = append(chunks, ClaudeStreamChunk{Resp: *resp, Data: rawData})
	return chunks
}

func (s *ClaudeStreamSanitizer) assignRemappedIndex(upstreamIndex int) int {
	if remappedIndex, ok := s.upstreamToRemapped[upstreamIndex]; ok {
		return remappedIndex
	}
	remappedIndex := s.nextBlockIndex
	s.nextBlockIndex++
	s.upstreamToRemapped[upstreamIndex] = remappedIndex
	return remappedIndex
}

func (s *ClaudeStreamSanitizer) buildSyntheticStart(upstreamIndex int, resp *dto.ClaudeResponse) *ClaudeStreamChunk {
	if resp == nil || resp.Delta == nil {
		return nil
	}

	contentBlock := syntheticContentBlockFromDelta(resp.Delta)
	if contentBlock == nil {
		return nil
	}

	remappedIndex := s.assignRemappedIndex(upstreamIndex)
	s.startedUpstream[upstreamIndex] = struct{}{}
	s.openRemapped[remappedIndex] = struct{}{}

	startResp := dto.ClaudeResponse{
		Type:         "content_block_start",
		ContentBlock: contentBlock,
	}
	startResp.SetIndex(remappedIndex)

	startData, err := common.Marshal(startResp)
	if err != nil {
		return nil
	}
	return &ClaudeStreamChunk{
		Resp: startResp,
		Data: string(startData),
	}
}

func (s *ClaudeStreamSanitizer) remapChunk(resp *dto.ClaudeResponse, rawData string, upstreamIndex int) *ClaudeStreamChunk {
	remappedIndex, ok := s.upstreamToRemapped[upstreamIndex]
	if !ok {
		return nil
	}
	if _, open := s.openRemapped[remappedIndex]; !open {
		return nil
	}

	out := *resp
	out.SetIndex(remappedIndex)
	return &ClaudeStreamChunk{
		Resp: out,
		Data: patchClaudeStreamChunkIndex(rawData, remappedIndex),
	}
}

func syntheticContentBlockFromDelta(delta *dto.ClaudeMediaMessage) *dto.ClaudeMediaMessage {
	if delta == nil {
		return nil
	}
	switch delta.Type {
	case "text_delta":
		return &dto.ClaudeMediaMessage{
			Type: "text",
			Text: common.GetPointer(""),
		}
	case "input_json_delta":
		return &dto.ClaudeMediaMessage{
			Type:  "tool_use",
			Input: map[string]any{},
		}
	case "thinking_delta":
		return &dto.ClaudeMediaMessage{
			Type:     "thinking",
			Thinking: common.GetPointer(""),
		}
	default:
		return nil
	}
}

func generateStopBlock(index int) *dto.ClaudeResponse {
	return &dto.ClaudeResponse{
		Type:  "content_block_stop",
		Index: common.GetPointer[int](index),
	}
}

func patchClaudeStreamChunkIndex(rawData string, index int) string {
	if rawData == "" {
		return rawData
	}
	patched, err := sjson.Set(rawData, "index", index)
	if err != nil {
		return rawData
	}
	return patched
}
