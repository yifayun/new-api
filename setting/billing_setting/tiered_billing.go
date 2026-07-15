package billing_setting

import (
	"encoding/json"
	"fmt"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	BillingModeRatio      = "ratio"
	BillingModeTieredExpr = "tiered_expr"
	BillingModeField      = "billing_mode"
	BillingExprField      = "billing_expr"
)

// BillingSetting is managed by config.GlobalConfig.Register.
// DB keys: billing_setting.billing_mode, billing_setting.billing_expr
type BillingSetting struct {
	BillingMode map[string]string `json:"billing_mode"`
	BillingExpr map[string]string `json:"billing_expr"`
}

var billingSetting = BillingSetting{
	BillingMode: make(map[string]string),
	BillingExpr: make(map[string]string),
}

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
}

// ---------------------------------------------------------------------------
// Read accessors (hot path, must be fast)
// ---------------------------------------------------------------------------

func GetBillingMode(model string) string {
	if mode, ok := billingSetting.BillingMode[model]; ok {
		return mode
	}
	return BillingModeRatio
}

func GetBillingExpr(model string) (string, bool) {
	expr, ok := billingSetting.BillingExpr[model]
	return expr, ok
}

func BillingMode2JSONString() string {
	data, err := json.Marshal(billingSetting.BillingMode)
	if err != nil {
		return "{}"
	}
	return string(data)
}

func BillingExpr2JSONString() string {
	data, err := json.Marshal(billingSetting.BillingExpr)
	if err != nil {
		return "{}"
	}
	return string(data)
}

func UpdateBillingModeByJSONString(value string) error {
	next := make(map[string]string)
	if value != "" {
		if err := json.Unmarshal([]byte(value), &next); err != nil {
			return err
		}
	}
	billingSetting.BillingMode = next
	billingexpr.InvalidateCache()
	return nil
}

func UpdateBillingExprByJSONString(value string) error {
	next := make(map[string]string)
	if value != "" {
		if err := json.Unmarshal([]byte(value), &next); err != nil {
			return err
		}
	}
	billingSetting.BillingExpr = next
	billingexpr.InvalidateCache()
	return nil
}

func GetPricingSyncData(base map[string]any) map[string]any {
	if base == nil {
		base = make(map[string]any)
	}
	mode := make(map[string]string, len(billingSetting.BillingMode))
	for key, value := range billingSetting.BillingMode {
		mode[key] = value
	}
	expr := make(map[string]string, len(billingSetting.BillingExpr))
	for key, value := range billingSetting.BillingExpr {
		expr[key] = value
	}
	base[BillingModeField] = mode
	base[BillingExprField] = expr
	return base
}

// ---------------------------------------------------------------------------
// Smoke test (called externally for validation before save)
// ---------------------------------------------------------------------------

func SmokeTestExpr(exprStr string) error {
	return smokeTestExpr(exprStr)
}

func smokeTestExpr(exprStr string) error {
	vectors := []billingexpr.TokenParams{
		{P: 0, C: 0, Len: 0},
		{P: 1000, C: 1000, Len: 1000},
		{P: 100000, C: 100000, Len: 100000},
		{P: 1000000, C: 1000000, Len: 1000000},
	}
	requests := []billingexpr.RequestInput{
		{},
		{
			Headers: map[string]string{
				"anthropic-beta": "fast-mode-2026-02-01",
			},
			Body: []byte(`{"service_tier":"fast","stream_options":{"include_usage":true},"messages":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}`),
		},
	}

	for _, v := range vectors {
		for _, request := range requests {
			result, _, err := billingexpr.RunExprWithRequest(exprStr, v, request)
			if err != nil {
				return fmt.Errorf("vector {p=%g, c=%g}: run failed: %w", v.P, v.C, err)
			}
			if result < 0 {
				return fmt.Errorf("vector {p=%g, c=%g}: result %f < 0", v.P, v.C, result)
			}
		}
	}
	return nil
}
