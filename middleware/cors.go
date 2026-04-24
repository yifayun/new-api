package middleware

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"strings"
)

func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()
	strictMode := common.SecurityL3StrictEnabled()
	origins := strings.TrimSpace(common.GetEnvOrDefaultString("CORS_ALLOW_ORIGINS", ""))
	if origins == "" || origins == "*" {
		if strictMode {
			// In L3 strict mode we intentionally do not open wildcard origins.
			// Startup baseline check already enforces explicit CORS_ALLOW_ORIGINS.
			config.AllowOrigins = []string{}
			config.AllowCredentials = false
		} else {
			config.AllowAllOrigins = true
			config.AllowCredentials = false
		}
	} else {
		config.AllowOrigins = splitAndTrim(origins)
		config.AllowCredentials = true
	}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	if strictMode {
		config.AllowHeaders = []string{
			"Authorization",
			"Content-Type",
			"Accept",
			"X-Requested-With",
			"New-Api-User",
			"X-Request-Id",
		}
	} else {
		config.AllowHeaders = []string{"*"}
	}
	return cors.New(config)
}

func splitAndTrim(items string) []string {
	raw := strings.Split(items, ",")
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		s := strings.TrimSpace(item)
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}

func PoweredBy() gin.HandlerFunc {
	enableVersionHeader := common.GetEnvOrDefaultBool("EXPOSE_VERSION_HEADER", false)
	return func(c *gin.Context) {
		if enableVersionHeader {
			c.Header("X-New-Api-Version", common.Version)
		}
		c.Next()
	}
}
