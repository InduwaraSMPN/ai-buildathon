//go:build windows

package device

import (
	"context"
	"fmt"
)

const resolverScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $servers=@{}; Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object IPEnabled | ForEach-Object { $servers[$_.Description]=@($_.DNSServerSearchOrder) }; $suffix=@((Get-DnsClientGlobalSetting).SuffixSearchList); $count=@(Get-DnsClientCache).Count; @{servers=$servers;suffix_search_list=$suffix;cached_entries=$count}|ConvertTo-Json -Compress -Depth 5`
const adaptersScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $items=@(Get-CimInstance Win32_NetworkAdapterConfiguration | ForEach-Object { $a=Get-CimAssociatedInstance $_ -ResultClassName Win32_NetworkAdapter | Select-Object -First 1; @{name=$_.Description;status=if($a.NetEnabled){'up'}else{'down'};ipv4=@($_.IPAddress|Where-Object{$_ -match '^\d+\.'})[0];gateway=@($_.DefaultIPGateway)[0];dhcp_enabled=[bool]$_.DHCPEnabled;lease_expiry=if($_.DHCPLeaseExpires){[Management.ManagementDateTimeConverter]::ToDateTime($_.DHCPLeaseExpires).ToString('o')}else{''}} }); @{adapters=$items}|ConvertTo-Json -Compress -Depth 5`
const reachabilityScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $addresses=@([Net.Dns]::GetHostAddresses($target)); $p=New-Object Net.NetworkInformation.Ping; $times=@(); 1..2|ForEach-Object{$r=$p.Send($target,3000);if($r.Status -eq 'Success'){$times+=$r.RoundtripTime}}; $mean=$null;if($times.Count){$mean=($times|Measure-Object -Average).Average}; @{target=$target;resolved_address=if($addresses.Count){$addresses[0].ToString()}else{''};packet_loss_percent=(2-$times.Count)*50;mean_latency_ms=$mean}|ConvertTo-Json -Compress`
const proxyScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $p=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'; @{enabled=([bool]$p.ProxyEnable);server=([string]$p.ProxyServer);override=([string]$p.ProxyOverride)}|ConvertTo-Json -Compress`
const identityScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $id=[Security.Principal.WindowsIdentity]::GetCurrent(); $tickets=@(& klist.exe 2>$null|Where-Object{$_ -match '^\s*#\d+>'}).Count; @{name=$id.Name;sid=$id.User.Value;kerberos_tickets=$tickets}|ConvertTo-Json -Compress`
const processesScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $names=@('notepad'); $items=@($names|ForEach-Object{$p=@(Get-Process -Name $_ -ErrorAction SilentlyContinue);if($p.Count){$p|ForEach-Object{@{name=$_.ProcessName;pid=$_.Id;running=$true}}}else{@{name=$_;pid=0;running=$false}}}); @{processes=$items}|ConvertTo-Json -Compress -Depth 4`

func facetCommand(name, target string) (commandSpec, error) {
	script := map[string]string{
		"resolver": resolverScript, "adapters": adaptersScript, "reachability": reachabilityScript,
		"proxy": proxyScript, "identity": identityScript, "processes": processesScript,
	}[name]
	if script == "" {
		return commandSpec{}, fmt.Errorf("unknown facet: %s", name)
	}
	args := []string{"-NoProfile", "-NonInteractive", "-Command"}
	if name == "reachability" {
		args = append(args, "& { param($target) "+script+" }", target)
	} else {
		args = append(args, script)
	}
	return commandSpec{name: "powershell.exe", args: args}, nil
}

func readFacet(ctx context.Context, name, target string) FacetResult {
	command, err := facetCommand(name, target)
	if err != nil {
		return FacetResult{Error: err.Error()}
	}
	result, err := runCommand(ctx, command.name, command.args...)
	if err != nil || !result.OK {
		return FacetResult{Raw: boundedRaw(result.Detail), Error: result.Detail}
	}
	data, err := parseFacet(name, result.Detail)
	if err != nil {
		return FacetResult{Raw: boundedRaw(result.Detail), Error: err.Error()}
	}
	return FacetResult{OK: true, Data: data, Raw: boundedRaw(result.Detail)}
}
