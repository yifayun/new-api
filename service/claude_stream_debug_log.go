package service

import (
	"encoding/json"
	"os"
	"time"
)

const claudeStreamDebugLogPath = "/www/wwwroot/newapi/.cursor/debug-96342b.log"

// #region agent log
func writeClaudeStreamDebugLog(hypothesisId, location, message, runId string, data map[string]any) {
	payload := map[string]any{
		"sessionId":    "96342b",
		"hypothesisId": hypothesisId,
		"location":     location,
		"message":      message,
		"data":         data,
		"timestamp":    time.Now().UnixMilli(),
	}
	if runId != "" {
		payload["runId"] = runId
	}
	line, err := json.Marshal(payload)
	if err != nil {
		return
	}
	f, err := os.OpenFile(claudeStreamDebugLogPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	_, _ = f.Write(append(line, '\n'))
	_ = f.Close()
}

// #endregion
