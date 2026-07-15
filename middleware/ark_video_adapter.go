package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
)

// ArkVideoRequestConvert adapts Volcengine Ark video API requests:
// POST /api/v3/contents/generations/tasks
// GET  /api/v3/contents/generations/tasks/:task_id
// into the unified task endpoints used internally.
func ArkVideoRequestConvert() func(c *gin.Context) {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodGet {
			taskID := c.Param("task_id")
			if strings.TrimSpace(taskID) == "" {
				abortWithOpenAiMessage(c, http.StatusBadRequest, "task_id is required")
				return
			}
			c.Request.URL.Path = "/v1/video/generations/" + taskID
			c.Set("task_id", taskID)
			c.Set("relay_mode", relayconstant.RelayModeVideoFetchByID)
			c.Next()
			return
		}

		var originalReq map[string]interface{}
		if err := common.UnmarshalBodyReusable(c, &originalReq); err != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, "Invalid request body")
			return
		}

		model, _ := originalReq["model"].(string)
		prompt := extractArkPrompt(originalReq["content"])
		if strings.TrimSpace(prompt) == "" {
			prompt, _ = originalReq["prompt"].(string)
		}
		if strings.TrimSpace(prompt) == "" {
			abortWithOpenAiMessage(c, http.StatusBadRequest, "prompt is required")
			return
		}

		unifiedReq := map[string]interface{}{
			"model":    model,
			"prompt":   prompt,
			"metadata": originalReq,
		}

		jsonData, err := json.Marshal(unifiedReq)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "Failed to marshal request body")
			return
		}

		c.Request.Body = io.NopCloser(bytes.NewBuffer(jsonData))
		c.Set(common.KeyRequestBody, jsonData)
		c.Request.URL.Path = "/v1/video/generations"

		if !hasArkImageContent(originalReq["content"]) {
			c.Set("action", constant.TaskActionTextGenerate)
		}
		c.Next()
	}
}

func extractArkPrompt(contentAny interface{}) string {
	content, ok := contentAny.([]interface{})
	if !ok {
		return ""
	}
	for _, item := range content {
		entry, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if t, _ := entry["type"].(string); t == "text" {
			if text, _ := entry["text"].(string); strings.TrimSpace(text) != "" {
				return text
			}
		}
	}
	return ""
}

func hasArkImageContent(contentAny interface{}) bool {
	content, ok := contentAny.([]interface{})
	if !ok {
		return false
	}
	for _, item := range content {
		entry, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if t, _ := entry["type"].(string); t == "image_url" {
			return true
		}
		if _, exists := entry["image_url"]; exists {
			return true
		}
	}
	return false
}
