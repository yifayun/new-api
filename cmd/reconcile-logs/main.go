package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/joho/godotenv"
)

func main() {
	apply := flag.Bool("apply", false, "write reconciled usage back to logs table")
	batchSize := flag.Int("batch", 500, "batch size per scan")
	flag.Parse()

	_ = godotenv.Load(".env")
	common.InitEnv()
	ratio_setting.InitRatioSettings()
	service.InitTokenEncoders()
	if err := model.InitDB(); err != nil {
		fmt.Fprintf(os.Stderr, "init db failed: %v\n", err)
		os.Exit(1)
	}
	if err := model.InitLogDB(); err != nil {
		fmt.Fprintf(os.Stderr, "init log db failed: %v\n", err)
		os.Exit(1)
	}
	model.InitOptionMap()
	model.GetPricing()

	mode := "dry-run"
	if *apply {
		mode = "apply"
	}
	fmt.Printf("reconcile claude logs (%s), batch=%d\n", mode, *batchSize)

	summary, err := service.RunClaudeLogUsageReconcile(*apply, *batchSize)
	if err != nil {
		fmt.Fprintf(os.Stderr, "reconcile failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("scanned=%d applied=%d skipped=%d failed=%d\n", summary.Scanned, summary.Applied, summary.Skipped, summary.Failed)
	fmt.Printf("cache_creation=%d cache_read=%d\n", summary.CreationCount, summary.CacheReadCount)
	fmt.Printf("old_quota=%d new_quota=%d delta=%d\n", summary.OldQuotaTotal, summary.NewQuotaTotal, summary.QuotaDelta)
	fmt.Printf("user_charge_delta=%d users_affected=%d\n", summary.UserChargeDelta, len(summary.UserDeltas))
	for userID, delta := range summary.UserDeltas {
		if delta == 0 {
			continue
		}
		fmt.Printf("  user %d charge delta: %d\n", userID, delta)
	}
	for _, failure := range summary.Failures {
		fmt.Println("failure:", failure)
	}
	if summary.Failed > 0 {
		os.Exit(2)
	}
}
