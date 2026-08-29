//go:build windows

package device

import (
	"golang.org/x/sys/windows/registry"
)

func osRelease() string {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows NT\CurrentVersion`, registry.QUERY_VALUE)
	if err != nil {
		return "windows"
	}
	defer key.Close()
	name, _, _ := key.GetStringValue("ProductName")
	build, _, _ := key.GetStringValue("CurrentBuildNumber")
	if name == "" {
		name = "Windows"
	}
	if build != "" {
		return name + " build " + build
	}
	return name
}
