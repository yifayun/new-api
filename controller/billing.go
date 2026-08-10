package controller

import (
	"encoding/csv"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

func GetUserModelBilling(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	keyword := c.Query("keyword")
	resp, err := model.GetUserModelBillingSummary(
		startTimestamp,
		endTimestamp,
		keyword,
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"page":         pageInfo.Page,
			"page_size":    pageInfo.PageSize,
			"total":        resp.Total,
			"user_count":   resp.UserCount,
			"items":        resp.Items,
			"grand_total":  resp.GrandTotal,
		},
	})
}

func ExportUserModelBillingCSV(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	keyword := c.Query("keyword")

	resp, err := model.GetAllUserModelBillingItems(startTimestamp, endTimestamp, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=billing.csv")
	writer := csv.NewWriter(c.Writer)
	_ = writer.Write([]string{
		"user_id", "username", "model_name", "request_count",
		"prompt_tokens", "completion_tokens", "cache_read_tokens",
		"prompt_cost", "completion_cost", "cache_read_cost",
		"consumed_quota", "estimated_cost", "cost_currency",
	})
	for _, row := range resp {
		_ = writer.Write([]string{
			strconv.Itoa(row.UserId),
			row.Username,
			row.ModelName,
			strconv.Itoa(row.RequestCount),
			strconv.FormatInt(row.PromptTokens, 10),
			strconv.FormatInt(row.CompletionTokens, 10),
			strconv.FormatInt(row.CacheReadTokens, 10),
			strconv.FormatFloat(row.PromptCost, 'f', 6, 64),
			strconv.FormatFloat(row.CompletionCost, 'f', 6, 64),
			strconv.FormatFloat(row.CacheReadCost, 'f', 6, 64),
			strconv.FormatInt(row.ConsumedQuota, 10),
			strconv.FormatFloat(row.EstimatedCost, 'f', 6, 64),
			row.CostCurrency,
		})
	}
	writer.Flush()
}
