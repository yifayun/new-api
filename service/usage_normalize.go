package service

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/tidwall/gjson"
)

// NormalizeAnthropicCompatibleUsage repairs OpenAI-style usage payloads for Claude
// client requests. Some OpenAI-compatible Claude upstreams report prompt_tokens as
// text input + cache read/creation while omitting the split fields.
func NormalizeAnthropicCompatibleUsage(relayInfo *relaycommon.RelayInfo, usage *dto.Usage, responseBody []byte) {
	if relayInfo == nil || usage == nil {
		return
	}
	if relayInfo.GetFinalRequestRelayFormat() != types.RelayFormatClaude {
		return
	}

	if usage.InputTokensDetails != nil && usage.PromptTokensDetails.CachedCreationTokens == 0 &&
		usage.InputTokensDetails.CachedCreationTokens > 0 {
		usage.PromptTokensDetails.CachedCreationTokens = usage.InputTokensDetails.CachedCreationTokens
	}
	if usage.InputTokensDetails != nil && usage.PromptTokensDetails.CachedTokens == 0 &&
		usage.InputTokensDetails.CachedTokens > 0 {
		usage.PromptTokensDetails.CachedTokens = usage.InputTokensDetails.CachedTokens
	}
	if usage.InputTokensDetails != nil && usage.PromptTokensDetails.TextTokens == 0 &&
		usage.InputTokensDetails.TextTokens > 0 {
		usage.PromptTokensDetails.TextTokens = usage.InputTokensDetails.TextTokens
	}

	if usage.PromptTokensDetails.CachedCreationTokens == 0 {
		if tokens, ok := extractCacheCreationTokensFromBody(responseBody); ok && tokens > 0 {
			usage.PromptTokensDetails.CachedCreationTokens = tokens
		}
	}
	if usage.PromptTokensDetails.CachedTokens == 0 {
		if tokens, ok := extractCacheReadTokensFromBody(responseBody); ok && tokens > 0 {
			usage.PromptTokensDetails.CachedTokens = tokens
		}
	}
	applyAnthropicUsageHintsFromJSON(usage, string(responseBody))
	if usage.ClaudeCacheCreation5mTokens == 0 && usage.ClaudeCacheCreation1hTokens == 0 {
		tokens5m, tokens1h, ok := extractClaudeCacheCreationSplitFromBody(responseBody)
		if ok {
			usage.ClaudeCacheCreation5mTokens = tokens5m
			usage.ClaudeCacheCreation1hTokens = tokens1h
			if usage.PromptTokensDetails.CachedCreationTokens == 0 {
				usage.PromptTokensDetails.CachedCreationTokens = tokens5m + tokens1h
			}
		}
	}

	if usage.PromptTokensDetails.CachedCreationTokens == 0 {
		textTokens := anthropicTextInputTokens(relayInfo, usage)
		if textTokens > 0 && usage.PromptTokens > textTokens+usage.PromptTokensDetails.CachedTokens {
			if usage.PromptTokensDetails.CachedTokens > 0 {
				usage.PromptTokensDetails.CachedCreationTokens = usage.PromptTokens - textTokens - usage.PromptTokensDetails.CachedTokens
			} else {
				usage.PromptTokensDetails.CachedCreationTokens = usage.PromptTokens - textTokens
			}
		}
	}
	if usage.PromptTokensDetails.CachedTokens == 0 && usage.PromptTokensDetails.CachedCreationTokens > 0 {
		textTokens := anthropicTextInputTokens(relayInfo, usage)
		if textTokens > 0 && usage.PromptTokens > textTokens+usage.PromptTokensDetails.CachedCreationTokens {
			usage.PromptTokensDetails.CachedTokens = usage.PromptTokens - textTokens - usage.PromptTokensDetails.CachedCreationTokens
		}
	}

	if usage.PromptTokensDetails.CachedCreationTokens > 0 || usage.PromptTokensDetails.CachedTokens > 0 {
		normalizeAnthropicPromptTokens(relayInfo, usage)
	}

	if usage.UsageSemantic == "" {
		usage.UsageSemantic = "anthropic"
	}
}

func anthropicTextInputTokens(relayInfo *relaycommon.RelayInfo, usage *dto.Usage) int {
	if usage == nil {
		return 0
	}
	if usage.PromptTokensDetails.TextTokens > 0 {
		return usage.PromptTokensDetails.TextTokens
	}
	if usage.InputTokensDetails != nil && usage.InputTokensDetails.TextTokens > 0 {
		return usage.InputTokensDetails.TextTokens
	}
	if usage.InputTokens > 0 && usage.InputTokens < usage.PromptTokens {
		return usage.InputTokens
	}
	if relayInfo != nil {
		if estimate := estimateClaudeNonCachedInputTokens(relayInfo); estimate > 0 &&
			(usage.PromptTokens == 0 || estimate < usage.PromptTokens) {
			return estimate
		}
	}
	return 0
}

func hasAnthropicCacheControl(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	s := strings.TrimSpace(string(raw))
	return s != "" && s != "null"
}

func estimateClaudeNonCachedInputTokens(relayInfo *relaycommon.RelayInfo) int {
	if relayInfo == nil || relayInfo.Request == nil {
		return 0
	}
	claudeReq, ok := relayInfo.Request.(*dto.ClaudeRequest)
	if !ok {
		return 0
	}

	model := relayInfo.OriginModelName
	total := 0
	addText := func(text string, cached bool) {
		if cached || text == "" {
			return
		}
		total += CountTextToken(text, model)
	}

	if claudeReq.System != nil {
		if claudeReq.IsStringSystem() {
			addText(claudeReq.GetStringSystem(), hasAnthropicCacheControl(claudeReq.CacheControl))
		} else {
			for _, media := range claudeReq.ParseSystem() {
				cached := hasAnthropicCacheControl(media.CacheControl) || hasAnthropicCacheControl(claudeReq.CacheControl)
				switch media.Type {
				case "text":
					addText(media.GetText(), cached)
				case "thinking":
					if media.Thinking != nil {
						addText(*media.Thinking, cached)
					}
				}
			}
		}
	}

	for _, message := range claudeReq.Messages {
		if message.IsStringContent() {
			addText(message.GetStringContent(), false)
			continue
		}
		blocks, err := message.ParseContent()
		if err != nil {
			continue
		}
		for _, block := range blocks {
			cached := hasAnthropicCacheControl(block.CacheControl)
			switch block.Type {
			case "text":
				addText(block.GetText(), cached)
			case "thinking":
				if block.Thinking != nil {
					addText(*block.Thinking, cached)
				}
			case "tool_use":
				if block.Name != "" {
					addText(block.Name, false)
				}
				if block.Input != nil {
					input, err := common.Marshal(block.Input)
					if err == nil {
						addText(string(input), false)
					}
				}
			case "tool_result":
				if block.Content != nil {
					switch content := block.Content.(type) {
					case string:
						addText(content, false)
					default:
						payload, err := common.Marshal(content)
						if err == nil {
							addText(string(payload), false)
						}
					}
				}
			}
		}
	}

	return total
}

func normalizeAnthropicPromptTokens(relayInfo *relaycommon.RelayInfo, usage *dto.Usage) {
	if usage == nil {
		return
	}
	textTokens := anthropicTextInputTokens(relayInfo, usage)
	if textTokens > 0 {
		usage.PromptTokens = textTokens
		return
	}
	if usage.PromptTokensDetails.CachedCreationTokens > 0 || usage.PromptTokensDetails.CachedTokens > 0 {
		remaining := usage.PromptTokens - usage.PromptTokensDetails.CachedCreationTokens - usage.PromptTokensDetails.CachedTokens
		if remaining >= 0 {
			usage.PromptTokens = remaining
		}
	}
}

func mergeOpenAIUsageFields(dst, src *dto.Usage) {
	MergeOpenAIUsageFields(dst, src)
}

func MergeOpenAIUsageFields(dst, src *dto.Usage) {
	if dst == nil || src == nil {
		return
	}
	if dst.PromptTokensDetails.CachedCreationTokens == 0 && src.PromptTokensDetails.CachedCreationTokens > 0 {
		dst.PromptTokensDetails.CachedCreationTokens = src.PromptTokensDetails.CachedCreationTokens
	}
	if dst.PromptTokensDetails.CachedTokens == 0 && src.PromptTokensDetails.CachedTokens > 0 {
		dst.PromptTokensDetails.CachedTokens = src.PromptTokensDetails.CachedTokens
	}
	if dst.PromptTokensDetails.TextTokens == 0 && src.PromptTokensDetails.TextTokens > 0 {
		dst.PromptTokensDetails.TextTokens = src.PromptTokensDetails.TextTokens
	}
	if dst.ClaudeCacheCreation5mTokens == 0 && src.ClaudeCacheCreation5mTokens > 0 {
		dst.ClaudeCacheCreation5mTokens = src.ClaudeCacheCreation5mTokens
	}
	if dst.ClaudeCacheCreation1hTokens == 0 && src.ClaudeCacheCreation1hTokens > 0 {
		dst.ClaudeCacheCreation1hTokens = src.ClaudeCacheCreation1hTokens
	}
	if dst.InputTokens == 0 && src.InputTokens > 0 {
		dst.InputTokens = src.InputTokens
	}
	if dst.InputTokensDetails == nil && src.InputTokensDetails != nil {
		dst.InputTokensDetails = src.InputTokensDetails
	}
	if dst.CompletionTokens == 0 && src.CompletionTokens > 0 {
		dst.CompletionTokens = src.CompletionTokens
	}
	if dst.PromptTokens == 0 && src.PromptTokens > 0 {
		dst.PromptTokens = src.PromptTokens
	}
}

func mergeClaudeUsageIntoOpenAIUsage(dst *dto.Usage, src *dto.ClaudeUsage) {
	if dst == nil || src == nil {
		return
	}
	if dst.PromptTokensDetails.CachedCreationTokens == 0 && src.CacheCreationInputTokens > 0 {
		dst.PromptTokensDetails.CachedCreationTokens = src.CacheCreationInputTokens
	}
	if dst.PromptTokensDetails.CachedTokens == 0 && src.CacheReadInputTokens > 0 {
		dst.PromptTokensDetails.CachedTokens = src.CacheReadInputTokens
	}
	if src.InputTokens > 0 && (dst.PromptTokensDetails.TextTokens == 0 || src.InputTokens < dst.PromptTokens) {
		if dst.InputTokens == 0 || src.InputTokens < dst.InputTokens {
			dst.InputTokens = src.InputTokens
		}
		if dst.PromptTokensDetails.TextTokens == 0 {
			dst.PromptTokensDetails.TextTokens = src.InputTokens
		}
	}
	if dst.CompletionTokens == 0 && src.OutputTokens > 0 {
		dst.CompletionTokens = src.OutputTokens
	}
	if dst.ClaudeCacheCreation5mTokens == 0 && src.GetCacheCreation5mTokens() > 0 {
		dst.ClaudeCacheCreation5mTokens = src.GetCacheCreation5mTokens()
	}
	if dst.ClaudeCacheCreation1hTokens == 0 && src.GetCacheCreation1hTokens() > 0 {
		dst.ClaudeCacheCreation1hTokens = src.GetCacheCreation1hTokens()
	}
}

func EnrichUsageFromStreamItems(usage *dto.Usage, streamItems []string) {
	if usage == nil || len(streamItems) == 0 {
		return
	}
	for _, item := range streamItems {
		applyAnthropicUsageHintsFromJSON(usage, item)

		var streamResponse dto.ChatCompletionsStreamResponse
		if err := common.Unmarshal(common.StringToByteSlice(item), &streamResponse); err == nil && streamResponse.Usage != nil {
			mergeOpenAIUsageFields(usage, streamResponse.Usage)
			continue
		}
		var claudeResponse dto.ClaudeResponse
		if err := common.UnmarshalJsonStr(item, &claudeResponse); err == nil {
			if claudeResponse.Message != nil && claudeResponse.Message.Usage != nil {
				mergeClaudeUsageIntoOpenAIUsage(usage, claudeResponse.Message.Usage)
			}
			if claudeResponse.Usage != nil {
				mergeClaudeUsageIntoOpenAIUsage(usage, claudeResponse.Usage)
			}
		}
	}
}

func applyAnthropicUsageHintsFromJSON(usage *dto.Usage, rawJSON string) {
	if usage == nil || rawJSON == "" {
		return
	}
	paths := []string{
		"message.usage.input_tokens",
		"message.usage.cache_creation_input_tokens",
		"message.usage.cache_read_input_tokens",
		"usage.input_tokens",
		"usage.cache_creation_input_tokens",
		"usage.cache_read_input_tokens",
		"usage.prompt_tokens_details.cached_creation_tokens",
		"usage.prompt_tokens_details.cached_tokens",
		"usage.prompt_tokens_details.text_tokens",
		"usage.input_tokens_details.cached_creation_tokens",
		"usage.input_tokens_details.cached_tokens",
		"usage.input_tokens_details.text_tokens",
	}
	for _, path := range paths {
		if !gjson.Get(rawJSON, path).Exists() {
			continue
		}
		value := int(gjson.Get(rawJSON, path).Int())
		switch path {
		case "message.usage.input_tokens", "usage.input_tokens":
			if value > 0 && (usage.PromptTokens == 0 || value < usage.PromptTokens) {
				if usage.InputTokens == 0 || value < usage.InputTokens {
					usage.InputTokens = value
				}
				if usage.PromptTokensDetails.TextTokens == 0 {
					usage.PromptTokensDetails.TextTokens = value
				}
			}
		case "usage.prompt_tokens_details.text_tokens", "usage.input_tokens_details.text_tokens":
			if value > 0 && usage.PromptTokensDetails.TextTokens == 0 {
				usage.PromptTokensDetails.TextTokens = value
			}
		case "message.usage.cache_creation_input_tokens", "usage.cache_creation_input_tokens", "usage.prompt_tokens_details.cached_creation_tokens", "usage.input_tokens_details.cached_creation_tokens":
			if value > 0 && usage.PromptTokensDetails.CachedCreationTokens == 0 {
				usage.PromptTokensDetails.CachedCreationTokens = value
			}
		case "message.usage.cache_read_input_tokens", "usage.cache_read_input_tokens", "usage.prompt_tokens_details.cached_tokens", "usage.input_tokens_details.cached_tokens":
			if value > 0 && usage.PromptTokensDetails.CachedTokens == 0 {
				usage.PromptTokensDetails.CachedTokens = value
			}
		}
	}
	cacheCreation5m := int(gjson.Get(rawJSON, "message.usage.cache_creation.ephemeral_5m_input_tokens").Int())
	cacheCreation1h := int(gjson.Get(rawJSON, "message.usage.cache_creation.ephemeral_1h_input_tokens").Int())
	if cacheCreation5m == 0 {
		cacheCreation5m = int(gjson.Get(rawJSON, "usage.cache_creation.ephemeral_5m_input_tokens").Int())
	}
	if cacheCreation1h == 0 {
		cacheCreation1h = int(gjson.Get(rawJSON, "usage.cache_creation.ephemeral_1h_input_tokens").Int())
	}
	if cacheCreation5m > 0 && usage.ClaudeCacheCreation5mTokens == 0 {
		usage.ClaudeCacheCreation5mTokens = cacheCreation5m
	}
	if cacheCreation1h > 0 && usage.ClaudeCacheCreation1hTokens == 0 {
		usage.ClaudeCacheCreation1hTokens = cacheCreation1h
	}
}

func extractCacheCreationTokensFromBody(body []byte) (int, bool) {
	if len(body) == 0 {
		return 0, false
	}

	var payload struct {
		OpenAIUsage struct {
			CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
			PromptTokensDetails      struct {
				CachedCreationTokens int `json:"cached_creation_tokens"`
			} `json:"prompt_tokens_details"`
			InputTokensDetails *dto.InputTokenDetails `json:"input_tokens_details"`
		} `json:"usage"`
		Message struct {
			Usage *dto.ClaudeUsage `json:"usage"`
		} `json:"message"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, false
	}

	if payload.OpenAIUsage.CacheCreationInputTokens > 0 {
		return payload.OpenAIUsage.CacheCreationInputTokens, true
	}
	if payload.OpenAIUsage.PromptTokensDetails.CachedCreationTokens > 0 {
		return payload.OpenAIUsage.PromptTokensDetails.CachedCreationTokens, true
	}
	if payload.OpenAIUsage.InputTokensDetails != nil && payload.OpenAIUsage.InputTokensDetails.CachedCreationTokens > 0 {
		return payload.OpenAIUsage.InputTokensDetails.CachedCreationTokens, true
	}
	if payload.Message.Usage != nil && payload.Message.Usage.CacheCreationInputTokens > 0 {
		return payload.Message.Usage.CacheCreationInputTokens, true
	}
	return 0, false
}

func extractCacheReadTokensFromBody(body []byte) (int, bool) {
	if len(body) == 0 {
		return 0, false
	}

	var payload struct {
		OpenAIUsage struct {
			CacheReadInputTokens int `json:"cache_read_input_tokens"`
			PromptCacheHitTokens int `json:"prompt_cache_hit_tokens"`
			PromptTokensDetails  struct {
				CachedTokens int `json:"cached_tokens"`
			} `json:"prompt_tokens_details"`
			CachedTokens       int                    `json:"cached_tokens"`
			InputTokensDetails *dto.InputTokenDetails `json:"input_tokens_details"`
		} `json:"usage"`
		Message struct {
			Usage *dto.ClaudeUsage `json:"usage"`
		} `json:"message"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, false
	}

	if payload.OpenAIUsage.CacheReadInputTokens > 0 {
		return payload.OpenAIUsage.CacheReadInputTokens, true
	}
	if payload.OpenAIUsage.PromptTokensDetails.CachedTokens > 0 {
		return payload.OpenAIUsage.PromptTokensDetails.CachedTokens, true
	}
	if payload.OpenAIUsage.CachedTokens > 0 {
		return payload.OpenAIUsage.CachedTokens, true
	}
	if payload.OpenAIUsage.PromptCacheHitTokens > 0 {
		return payload.OpenAIUsage.PromptCacheHitTokens, true
	}
	if payload.OpenAIUsage.InputTokensDetails != nil && payload.OpenAIUsage.InputTokensDetails.CachedTokens > 0 {
		return payload.OpenAIUsage.InputTokensDetails.CachedTokens, true
	}
	if payload.Message.Usage != nil && payload.Message.Usage.CacheReadInputTokens > 0 {
		return payload.Message.Usage.CacheReadInputTokens, true
	}
	return 0, false
}

func extractClaudeCacheCreationSplitFromBody(body []byte) (int, int, bool) {
	if len(body) == 0 {
		return 0, 0, false
	}

	var payload struct {
		OpenAIUsage struct {
			ClaudeCacheCreation5mTokens int `json:"claude_cache_creation_5_m_tokens"`
			ClaudeCacheCreation1hTokens int `json:"claude_cache_creation_1_h_tokens"`
			CacheCreation               *dto.ClaudeCacheCreationUsage `json:"cache_creation"`
		} `json:"usage"`
		Message struct {
			Usage *dto.ClaudeUsage `json:"usage"`
		} `json:"message"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, 0, false
	}

	tokens5m := payload.OpenAIUsage.ClaudeCacheCreation5mTokens
	tokens1h := payload.OpenAIUsage.ClaudeCacheCreation1hTokens
	if payload.OpenAIUsage.CacheCreation != nil {
		if tokens5m == 0 {
			tokens5m = payload.OpenAIUsage.CacheCreation.Ephemeral5mInputTokens
		}
		if tokens1h == 0 {
			tokens1h = payload.OpenAIUsage.CacheCreation.Ephemeral1hInputTokens
		}
	}
	if tokens5m == 0 && tokens1h == 0 && payload.Message.Usage != nil {
		tokens5m = payload.Message.Usage.GetCacheCreation5mTokens()
		tokens1h = payload.Message.Usage.GetCacheCreation1hTokens()
	}
	if tokens5m == 0 && tokens1h == 0 {
		return 0, 0, false
	}
	return tokens5m, tokens1h, true
}
