package middleware

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const ContextHostResellerKey = "host_reseller"
const ContextHostResellerIDKey = "host_reseller_id"

func HostReseller() gin.HandlerFunc {
	return func(c *gin.Context) {
		host := strings.TrimSpace(c.Request.Host)
		if host != "" {
			if reseller, err := model.GetResellerByHost(host); err == nil && reseller != nil {
				c.Set(ContextHostResellerKey, reseller)
				c.Set(ContextHostResellerIDKey, reseller.Id)
			}
		}
		c.Next()
	}
}
