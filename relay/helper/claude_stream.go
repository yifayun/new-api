package helper

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func EmitClaudeStreamChunk(c *gin.Context, resp dto.ClaudeResponse, rawData string) {
	chunks := service.SanitizeClaudeStreamChunk(c, &resp, rawData)
	// #region agent log
	if len(chunks) == 0 && (resp.Type == "content_block_start" || resp.Type == "content_block_delta" || resp.Type == "content_block_stop") {
		service.WriteClaudeStreamDebugLogPublic("A", "claude_stream.go:EmitClaudeStreamChunk", "event dropped after sanitize", "runtime", map[string]any{
			"eventType": resp.Type, "upstreamIndex": resp.GetIndex(),
		})
	}
	// #endregion
	for _, chunk := range chunks {
		service.ObserveClaudeStreamOutputPublic(c, chunk.Resp, "runtime")
		ClaudeChunkData(c, chunk.Resp, chunk.Data)
	}
	if resp.Type == "message_stop" {
		service.SummarizeClaudeStreamValidatorPublic(c, "runtime")
	}
}

func EmitClaudeStreamEvent(c *gin.Context, resp dto.ClaudeResponse) {
	rawData, err := common.Marshal(resp)
	if err != nil {
		// #region agent log
		service.WriteClaudeStreamDebugLogPublic("A", "claude_stream.go:EmitClaudeStreamEvent", "marshal failed bypass sanitizer", "runtime", map[string]any{
			"eventType": resp.Type,
		})
		// #endregion
		ClaudeData(c, resp)
		return
	}
	EmitClaudeStreamChunk(c, resp, string(rawData))
}
