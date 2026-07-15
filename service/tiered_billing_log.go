package service

import (
	"encoding/base64"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// InjectTieredBillingInfo appends tiered billing metadata into usage log "other".
func InjectTieredBillingInfo(other map[string]interface{}, relayInfo *relaycommon.RelayInfo, tieredResult *billingexpr.TieredResult) {
	if other == nil || relayInfo == nil || relayInfo.TieredBillingSnapshot == nil {
		return
	}
	snap := relayInfo.TieredBillingSnapshot
	other["billing_mode"] = snap.BillingMode
	other["expr_b64"] = base64.StdEncoding.EncodeToString([]byte(snap.ExprString))
	other["matched_tier"] = snap.EstimatedTier
	if tieredResult != nil {
		if tieredResult.MatchedTier != "" {
			other["matched_tier"] = tieredResult.MatchedTier
		}
		other["crossed_tier"] = tieredResult.CrossedTier
	}
}
