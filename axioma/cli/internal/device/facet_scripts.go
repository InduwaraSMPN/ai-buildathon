package device

import (
	"fmt"
	"sort"
	"strings"
)

// Facet collection scripts live outside the build-tagged files so the vocabulary
// they cover can be asserted on any platform, including CI. Every script is a
// constant: none of them interpolates caller input. The only value that reaches
// a script from outside this package is the reachability target, which arrives
// as a separate argv element bound to a param block.

const resolverScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $servers=@{}; Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object IPEnabled | ForEach-Object { $servers[$_.Description]=@($_.DNSServerSearchOrder) }; $suffix=@((Get-DnsClientGlobalSetting).SuffixSearchList); $count=@(Get-DnsClientCache).Count; @{servers=$servers;suffix_search_list=$suffix;cached_entries=$count}|ConvertTo-Json -Compress -Depth 5`

// The DHCP lease is read through a try/catch because a Windows adapter that has
// never held one reports the DMTF zero date, and ToDateTime throws on it —
// under $ErrorActionPreference='Stop' that took down the whole facet with
// "Specified argument was out of the range of valid values. Parameter name:
// dmtfDate", so a machine with one loopback or VPN adapter could not enumerate
// any of its real ones.
const adaptersScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $items=@(Get-CimInstance Win32_NetworkAdapterConfiguration | ForEach-Object { $a=Get-CimAssociatedInstance $_ -ResultClassName Win32_NetworkAdapter | Select-Object -First 1; $lease=''; if($_.DHCPLeaseExpires){try{$lease=[Management.ManagementDateTimeConverter]::ToDateTime($_.DHCPLeaseExpires).ToString('o')}catch{$lease=''}}; @{name=$_.Description;status=if($a.NetEnabled){'up'}else{'down'};ipv4=@($_.IPAddress|Where-Object{$_ -match '^\d+\.'})[0];gateway=@($_.DefaultIPGateway)[0];dhcp_enabled=[bool]$_.DHCPEnabled;lease_expiry=$lease} }); @{adapters=$items}|ConvertTo-Json -Compress -Depth 5`

// A name that will not resolve and a host that will not answer are findings,
// not failures of the probe: they are the whole reason the facet was read. With
// $ErrorActionPreference='Stop' the exception from GetHostAddresses escaped
// instead, the daemon reported the command as failed, and the agent was told
// only "the platform could not complete the call" — losing the one piece of
// evidence it had asked for. Both are caught and reported as data now, with
// full packet loss and the resolver's own message.
const reachabilityScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $resolveError=''; $addresses=@(); try{$addresses=@([Net.Dns]::GetHostAddresses($target))}catch{$resolveError=$_.Exception.GetBaseException().Message}; $times=@(); $probes=0; if($addresses.Count){$p=New-Object Net.NetworkInformation.Ping; $probes=2; 1..2|ForEach-Object{try{$r=$p.Send($target,3000);if($r.Status -eq 'Success'){$times+=$r.RoundtripTime}}catch{}}}; $mean=$null;if($times.Count){$mean=($times|Measure-Object -Average).Average}; @{target=$target;resolved=($addresses.Count -gt 0);resolve_error=$resolveError;resolved_address=if($addresses.Count){$addresses[0].ToString()}else{''};packet_loss_percent=if($probes){[int]((($probes-$times.Count)/$probes)*100)}else{100};mean_latency_ms=$mean}|ConvertTo-Json -Compress`

const proxyScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $p=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'; @{enabled=([bool]$p.ProxyEnable);server=([string]$p.ProxyServer);override=([string]$p.ProxyOverride)}|ConvertTo-Json -Compress`

const identityScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $id=[Security.Principal.WindowsIdentity]::GetCurrent(); $tickets=@(& klist.exe 2>$null|Where-Object{$_ -match '^\s*#\d+>'}).Count; @{name=$id.Name;sid=$id.User.Value;kerberos_tickets=$tickets}|ConvertTo-Json -Compress`

const certificatesScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $now=Get-Date; $all=@(Get-ChildItem Cert:\CurrentUser\My); $items=@($all|Sort-Object NotAfter|Select-Object -First 25|ForEach-Object{@{subject=[string]$_.Subject;issuer=[string]$_.Issuer;thumbprint=[string]$_.Thumbprint;not_after=$_.NotAfter.ToString('o');expired=($_.NotAfter -lt $now)}}); @{store='CurrentUser\My';count=$all.Count;certificates=$items}|ConvertTo-Json -Compress -Depth 4`

// Live free space and the user temp footprint. Distinct from the disks
// inventory, which is a hardware register and never a diagnostic facet.
const storageScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $disk=Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID='"+$env:SystemDrive+"'"); $files=@(Get-ChildItem -LiteralPath $env:TEMP -Recurse -Force -File -ErrorAction SilentlyContinue); @{system_drive=[string]$env:SystemDrive;free_bytes=[int64]$disk.FreeSpace;total_bytes=[int64]$disk.Size;temp_path=[string]$env:TEMP;temp_bytes=[int64](($files|Measure-Object -Property Length -Sum).Sum);temp_files=$files.Count}|ConvertTo-Json -Compress`

const appCacheScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $targets=[ordered]@{outlook_roamcache=(Join-Path $env:LOCALAPPDATA 'Microsoft\Outlook\RoamCache');teams_cache=(Join-Path $env:LOCALAPPDATA 'Packages\MSTeams_8wekyb3d8bbwe\LocalCache');icon_cache=(Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Explorer')}; $items=@($targets.Keys|ForEach-Object{$name=$_;$path=$targets[$_];$files=@(Get-ChildItem -LiteralPath $path -Recurse -Force -File -ErrorAction SilentlyContinue);@{name=[string]$name;path=[string]$path;exists=(Test-Path -LiteralPath $path);bytes=[int64](($files|Measure-Object -Property Length -Sum).Sum);files=$files.Count}}); @{caches=$items}|ConvertTo-Json -Compress -Depth 4`

// CIM rather than the PrintManagement cmdlets: Get-Printer piped into
// Get-PrintJob per printer measured at fifty seconds on a six-printer machine,
// which does not fit the read budget. This form measures at three.
const printingScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $states=@{1='other';2='unknown';3='idle';4='printing';5='warmup';6='stopped';7='offline'}; $jobs=@{}; Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue|ForEach-Object{$n=($_.Name -split ',')[0];$jobs[$n]=[int]$jobs[$n]+1}; $default=''; $items=@(Get-CimInstance Win32_Printer|ForEach-Object{if($_.Default){$default=[string]$_.Name};@{name=[string]$_.Name;status=[string]$states[[int]$_.PrinterStatus];jobs=[int]$jobs[[string]$_.Name]}}); @{printers=$items;default_printer=$default;queued_jobs=[int](($items|ForEach-Object{$_.jobs}|Measure-Object -Sum).Sum)}|ConvertTo-Json -Compress -Depth 4`

// Control names are not truncated: a name is the address a gui_ step uses to
// reach a control, so shortening one here would enumerate something that can
// never be named again. The payload is bounded by the control cap instead.
//
// The accessibility tree, not a screenshot. Measured on a real machine: a
// browser window is roughly three seconds and under three kilobytes of text,
// where the same look as pixels would cost thousands of vision tokens and give
// coordinates instead of names. A cached request is what makes it that fast —
// every uncached property read is a separate call into the target process, and
// the uncached form of this script measured twenty-one seconds.
const screenScript = `$target=$env:AXIOMA_GUI_TARGET; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes | Out-Null; $AE=[Windows.Automation.AutomationElement]; $cr=New-Object Windows.Automation.CacheRequest; foreach($p in $AE::NameProperty,$AE::ControlTypeProperty,$AE::IsEnabledProperty,$AE::IsOffscreenProperty,$AE::IsInvokePatternAvailableProperty,$AE::IsValuePatternAvailableProperty,$AE::IsTogglePatternAvailableProperty,$AE::IsSelectionItemPatternAvailableProperty,$AE::IsExpandCollapsePatternAvailableProperty){ $cr.Add($p) }; $cr.AutomationElementMode=[Windows.Automation.AutomationElementMode]::None; if($target){ $win=@($AE::RootElement.FindAll([Windows.Automation.TreeScope]::Children,[Windows.Automation.Condition]::TrueCondition)|Where-Object{[string]$_.Current.Name -and ([string]$_.Current.Name).IndexOf($target,[StringComparison]::OrdinalIgnoreCase) -ge 0})[0] } else { $win=$AE::FocusedElement; $walker=[Windows.Automation.TreeWalker]::ControlViewWalker; while($win -and [string]$win.Current.ControlType.ProgrammaticName -ne 'ControlType.Window'){ $win=$walker.GetParent($win) } }; if(-not $win){ throw 'window not found' }; $name=[string]$win.Current.Name; $act=$cr.Activate(); try{ $all=$win.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition) } finally { $act.Dispose() }; $map=@{InvokePattern=$AE::IsInvokePatternAvailableProperty;ValuePattern=$AE::IsValuePatternAvailableProperty;TogglePattern=$AE::IsTogglePatternAvailableProperty;SelectionItemPattern=$AE::IsSelectionItemPatternAvailableProperty;ExpandCollapsePattern=$AE::IsExpandCollapsePatternAvailableProperty}; $order='InvokePattern','ValuePattern','TogglePattern','SelectionItemPattern','ExpandCollapsePattern'; $items=@(); $more=$false; foreach($e in $all){ if($items.Count -ge 30){ $more=$true; break }; $n=[string]$e.GetCachedPropertyValue($AE::NameProperty); if(-not $n){continue}; if([bool]$e.GetCachedPropertyValue($AE::IsOffscreenProperty)){continue}; $acts=@($order|Where-Object{[bool]$e.GetCachedPropertyValue($map[$_])}); if(-not $acts.Count){continue}; $items+=@{name=$n;role=([string]([Windows.Automation.ControlType]$e.GetCachedPropertyValue($AE::ControlTypeProperty)).ProgrammaticName -replace 'ControlType\.','');enabled=[bool]$e.GetCachedPropertyValue($AE::IsEnabledProperty);actions=$acts} }; @{window=$name;controls=$items;truncated=$more}|ConvertTo-Json -Compress -Depth 5`

// processesScript reports one row per allowlisted application, keyed by the same
// string restart_user_process accepts, so the facet observes exactly what the
// action can restart. Both halves of each pair are constants from actions.go.
// One Get-Process call and an in-memory index: eight separate -Name lookups
// measured at twenty-five seconds, this at under one.
func processesScript() string {
	pairs := make([]string, 0, len(userProcesses))
	for _, key := range userProcessNames() {
		pairs = append(pairs, fmt.Sprintf("@{key='%s';process='%s'}", key, strings.TrimSuffix(userProcesses[key].image, ".exe")))
	}
	return `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $names=@(` +
		strings.Join(pairs, ",") +
		`); $running=@{}; Get-Process -ErrorAction SilentlyContinue|ForEach-Object{$n=$_.ProcessName.ToLower();if(-not $running.ContainsKey($n)){$running[$n]=@()};$running[$n]+=[int]$_.Id}; $items=@($names|ForEach-Object{$key=$_.key;$found=$running[$_.process.ToLower()];if($found){$found|ForEach-Object{@{name=$key;pid=$_;running=$true}}}else{@{name=$key;pid=0;running=$false}}}); @{processes=$items}|ConvertTo-Json -Compress -Depth 4`
}

// facetScript returns the collection script for a facet, or "" when the facet
// cannot be collected. Kept beside knownFacets so no facet can be admitted
// without a way to read it.
func facetScript(name string) string {
	switch name {
	case "resolver":
		return resolverScript
	case "adapters":
		return adaptersScript
	case "reachability":
		return reachabilityScript
	case "proxy":
		return proxyScript
	case "identity":
		return identityScript
	case "processes":
		return processesScript()
	case "certificates":
		return certificatesScript
	case "storage":
		return storageScript
	case "app_cache":
		return appCacheScript
	case "printing":
		return printingScript
	case "screen":
		return screenScript
	default:
		return ""
	}
}

// facetNames returns every admitted facet in a stable order.
func facetNames() []string {
	names := make([]string, 0, len(knownFacets))
	for name := range knownFacets {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// guiStepScript drives one UI Automation pattern on one named control. It reads
// its inputs from the environment because a value bound through
// powershell.exe -Command is re-split on spaces, and control names are full of
// them. It refuses a control that is missing, ambiguous, disabled, or that does
// not support the requested pattern.
const guiStepScript = `$step=$env:AXIOMA_GUI_STEP; $window=$env:AXIOMA_GUI_WINDOW; $control=$env:AXIOMA_GUI_CONTROL; $value=$env:AXIOMA_GUI_VALUE; if([string]::IsNullOrEmpty($value)){ $value=$null }; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes | Out-Null; $AE=[Windows.Automation.AutomationElement]; if(-not $control){ throw 'control is required' }; if($window){ $win=@($AE::RootElement.FindAll([Windows.Automation.TreeScope]::Children,[Windows.Automation.Condition]::TrueCondition)|Where-Object{[string]$_.Current.Name -and ([string]$_.Current.Name).IndexOf($window,[StringComparison]::OrdinalIgnoreCase) -ge 0})[0] } else { $win=$AE::FocusedElement; $walker=[Windows.Automation.TreeWalker]::ControlViewWalker; while($win -and [string]$win.Current.ControlType.ProgrammaticName -ne 'ControlType.Window'){ $win=$walker.GetParent($win) } }; if(-not $win){ throw 'window not found' }; $match=@($win.FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition($AE::NameProperty,$control)))|Where-Object{-not $_.Current.IsOffscreen}); if(-not $match.Count){ throw "control not found: $control" }; if($match.Count -gt 1){ throw "control name is ambiguous: $control" }; $el=$match[0]; if(-not $el.Current.IsEnabled){ throw "control is disabled: $control" }; $need=@{invoke_control=[Windows.Automation.InvokePattern]::Pattern;set_control_value=[Windows.Automation.ValuePattern]::Pattern;toggle_control=[Windows.Automation.TogglePattern]::Pattern;select_item=[Windows.Automation.SelectionItemPattern]::Pattern;expand_control=[Windows.Automation.ExpandCollapsePattern]::Pattern}[$step]; if(-not $need){ throw "unknown step: $step" }; $pat=$null; if(-not $el.TryGetCurrentPattern($need,[ref]$pat)){ throw "control does not support $step" }; switch($step){ 'invoke_control' { $pat.Invoke() } 'set_control_value' { if($null -eq $value){ throw 'value is required' }; if($pat.Current.IsReadOnly){ throw "control is read only: $control" }; $pat.SetValue([string]$value) } 'toggle_control' { $pat.Toggle() } 'select_item' { $pat.Select() } 'expand_control' { if($pat.Current.ExpandCollapseState -eq [Windows.Automation.ExpandCollapseState]::Expanded){ $pat.Collapse() } else { $pat.Expand() } } }; @{ok=$true;step=$step;window=([string]$win.Current.Name);control=$control}|ConvertTo-Json -Compress`
