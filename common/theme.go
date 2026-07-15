package common

import "sync"

var (
	themeMu       sync.RWMutex
	currentTheme  = "default"
)

func SetTheme(theme string) {
	if theme == "" {
		theme = "default"
	}
	themeMu.Lock()
	currentTheme = theme
	themeMu.Unlock()
}

func GetTheme() string {
	themeMu.RLock()
	defer themeMu.RUnlock()
	return currentTheme
}
