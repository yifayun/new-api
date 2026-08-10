package service

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

type claudeStreamValidator struct {
	started map[int]struct{}
	open    map[int]struct{}
	stopped map[int]struct{}
}

func getClaudeStreamValidator(c *gin.Context) *claudeStreamValidator {
	if c == nil {
		return &claudeStreamValidator{
			started: make(map[int]struct{}),
			open:    make(map[int]struct{}),
			stopped: make(map[int]struct{}),
		}
	}
	key := string(constant.ContextKeyClaudeStreamSanitizer) + "_validator"
	if value, ok := c.Get(key); ok {
		if validator, ok := value.(*claudeStreamValidator); ok && validator != nil {
			return validator
		}
	}
	validator := &claudeStreamValidator{
		started: make(map[int]struct{}),
		open:    make(map[int]struct{}),
		stopped: make(map[int]struct{}),
	}
	c.Set(key, validator)
	return validator
}

func observeClaudeStreamOutput(c *gin.Context, resp dto.ClaudeResponse, runId string) {
	v := getClaudeStreamValidator(c)
	idx := resp.GetIndex()

	switch resp.Type {
	case "content_block_start":
		if _, ok := v.started[idx]; ok {
			// #region agent log
			writeClaudeStreamDebugLog("E", "claude_stream_validator.go:start", "duplicate content_block_start", runId, map[string]any{
				"index": idx, "type": resp.Type,
			})
			// #endregion
		}
		v.started[idx] = struct{}{}
		v.open[idx] = struct{}{}
	case "content_block_delta":
		if _, ok := v.started[idx]; !ok {
			// #region agent log
			writeClaudeStreamDebugLog("C", "claude_stream_validator.go:delta", "delta without prior start", runId, map[string]any{
				"index": idx, "deltaType": deltaType(resp),
			})
			// #endregion
		}
	case "content_block_stop":
		if _, ok := v.started[idx]; !ok {
			// #region agent log
			writeClaudeStreamDebugLog("B", "claude_stream_validator.go:stop", "orphan content_block_stop emitted", runId, map[string]any{
				"index": idx,
			})
			// #endregion
		}
		delete(v.open, idx)
		v.stopped[idx] = struct{}{}
	case "message_stop":
		for openIdx := range v.open {
			// #region agent log
			writeClaudeStreamDebugLog("D", "claude_stream_validator.go:message_stop", "open block at message_stop", runId, map[string]any{
				"openIndex": openIdx,
			})
			// #endregion
		}
	}
}

func deltaType(resp dto.ClaudeResponse) string {
	if resp.Delta == nil {
		return ""
	}
	return resp.Delta.Type
}

func summarizeClaudeStreamValidator(c *gin.Context, runId string) map[string]any {
	v := getClaudeStreamValidator(c)
	openIndices := make([]int, 0, len(v.open))
	for idx := range v.open {
		openIndices = append(openIndices, idx)
	}
	summary := map[string]any{
		"startedCount": len(v.started),
		"stoppedCount": len(v.stopped),
		"openCount":    len(v.open),
		"openIndices":  openIndices,
	}
	// #region agent log
	writeClaudeStreamDebugLog("ALL", "claude_stream_validator.go:summary", "stream validation summary", runId, summary)
	// #endregion
	return summary
}

func WriteClaudeStreamDebugLogPublic(hypothesisId, location, message, runId string, data map[string]any) {
	writeClaudeStreamDebugLog(hypothesisId, location, message, runId, data)
}

func ObserveClaudeStreamOutputPublic(c *gin.Context, resp dto.ClaudeResponse, runId string) {
	observeClaudeStreamOutput(c, resp, runId)
}

func SummarizeClaudeStreamValidatorPublic(c *gin.Context, runId string) map[string]any {
	return summarizeClaudeStreamValidator(c, runId)
}
