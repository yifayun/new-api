package main

import (
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/joho/godotenv"
)

func main() {
	apply := flag.Bool("apply", false, "apply updates to database (default dry-run)")
	since := flag.String("since", "2026-07-01", "only process logs created on/after this date (YYYY-MM-DD)")
	limit := flag.Int("limit", 0, "max logs to process (0 = all)")
	requestID := flag.String("request-id", "", "only process a single request_id")
	flag.Parse()

	_ = godotenv.Load(".env")
	common.InitEnv()
	if err := model.InitDB(); err != nil {
		fmt.Fprintf(os.Stderr, "init db failed: %v\n", err)
		os.Exit(1)
	}
	if err := model.InitLogDB(); err != nil {
		fmt.Fprintf(os.Stderr, "init log db failed: %v\n", err)
		os.Exit(1)
	}
	defer model.CloseDB()

	sinceTime, err := time.ParseInLocation("2006-01-02", *since, time.Local)
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid since date: %v\n", err)
		os.Exit(1)
	}

	opts := service.DefaultLogCacheBackfillOptions()
	opts.SinceUnix = sinceTime.Unix()
	opts.Limit = *limit
	opts.DryRun = !*apply

	result, err := service.RunClaudeCacheLogBackfill(opts, *requestID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "backfill failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("mode: %s\n", map[bool]string{true: "DRY-RUN", false: "APPLY"}[*apply])
	fmt.Printf("since: %s\n", sinceTime.Format("2006-01-02"))
	fmt.Printf("scanned: %d\n", result.Scanned)
	fmt.Printf("updated: %d\n", result.Updated)
	fmt.Printf("skipped: %d\n", result.Skipped)
	fmt.Printf("old_quota_sum: %d (≈$%.2f)\n", result.OldQuotaSum, float64(result.OldQuotaSum)/common.QuotaPerUnit)
	fmt.Printf("new_quota_sum: %d (≈$%.2f)\n", result.NewQuotaSum, float64(result.NewQuotaSum)/common.QuotaPerUnit)
	fmt.Printf("quota_delta_sum: %d (≈$%.2f)\n", result.QuotaDeltaSum, float64(result.QuotaDeltaSum)/common.QuotaPerUnit)
	fmt.Printf("users_adjusted: %d\n", len(result.UserDeltas))
	for userID, delta := range result.UserDeltas {
		if delta == 0 {
			continue
		}
		fmt.Printf("  user %d quota delta: %d (≈$%.4f)\n", userID, delta, float64(delta)/common.QuotaPerUnit)
	}
	if len(result.Samples) > 0 {
		fmt.Println("samples:")
		for _, s := range result.Samples {
			fmt.Printf("  log=%d request=%s prompt %d->%d cache_create=%d quota %d->%d (+%d)\n",
				s.LogID, s.RequestID, s.OldPromptTokens, s.NewPromptTokens, s.CacheCreation, s.OldQuota, s.NewQuota, s.QuotaDelta)
		}
	}
	if !*apply {
		fmt.Println("dry-run only; re-run with -apply to persist changes")
	}
}
