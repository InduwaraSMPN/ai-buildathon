$ErrorActionPreference = "Stop"

$deploy = Split-Path $PSScriptRoot -Parent
$chart = Join-Path $deploy "helm/axioma"
$examples = Join-Path $deploy "examples"
$placeholders = @(
    "--set-string", "secrets.betterAuthSecret=01234567890123456789012345678901",
    "--set-string", "secrets.llmKey=not-a-real-key",
    "--set-string", "postgresql.auth.password=not-a-real-password",
    "--set-string", "agent.model.name=openai/not-a-real-model",
    "--set-string", "agent.model.apiBase=https://example.invalid/v1",
    "--set-string", "api.config.llm.apiBase=https://example.invalid/v1",
    "--set-string", "api.config.llm.embeddingModel=not-a-real-model"
)

function Invoke-Helm([string[]] $Arguments, [switch] $ExpectFailure) {
    $output = (& helm @Arguments 2>&1 | Out-String)
    $exitCode = $LASTEXITCODE
    if ($ExpectFailure) {
        if ($exitCode -eq 0) { throw "Expected helm $($Arguments[0]) to fail, but it succeeded." }
    } elseif ($exitCode -ne 0) {
        throw "helm $($Arguments -join ' ') failed:`n$output"
    }
    return $output
}

$cases = @(
    @{ Name = "defaults"; Values = @(); Extra = $placeholders },
    @{ Name = "minimal example"; Values = @("-f", (Join-Path $examples "values-minimal.yaml")); Extra = @() },
    @{ Name = "full example"; Values = @("-f", (Join-Path $examples "values-full.yaml")); Extra = @() }
)

foreach ($case in $cases) {
    Write-Host "Verifying $($case.Name)..."
    $arguments = @($chart) + $case.Values + $case.Extra
    Invoke-Helm (@("lint") + $arguments) | Write-Host
    Invoke-Helm (@("template", "verify") + $arguments + @("--namespace", "verify")) | Out-Null
}

$full = @("-f", (Join-Path $examples "values-full.yaml"))
function Show-Only([string] $Template) {
    return Invoke-Helm (@(
        "template", "verify", $chart, "--namespace", "verify", "--show-only", $Template
    ) + $full)
}

# images.web is its own entry and nothing else falls back to it, so an example
# that omits it renders the default axioma/web:dev with IfNotPresent while every
# other workload takes the registry image — an ImagePullBackOff on one pod.
$web = Show-Only "templates/web.yaml"
if ($web -notmatch "(?m)^\s+image: registry\.example\.com/axioma/web:0\.1\.0\s*$") {
    throw "The full example does not override images.web.`n$web"
}
if ($web -notmatch "(?m)^\s+imagePullPolicy: Always\s*$") {
    throw "The full example does not override images.web.pullPolicy.`n$web"
}

# An address in extraSans has to reach the certificate's IP SANs. Emitted as a
# DNS name it renders identically and fails every device that dials by address
# with "doesn't contain any IP SANs" — and the certificate is generated once, so
# no upgrade repairs it.
$secret = Show-Only "templates/grpc-tls-secret.yaml"
$encoded = ($secret | Select-String -Pattern "(?m)^\s+tls\.crt:\s+(\S+)\s*$").Matches[0].Groups[1].Value
$certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    [Convert]::FromBase64String($encoded)
)
$extension = $certificate.Extensions | Where-Object { $_.Oid.Value -eq "2.5.29.17" }
$sans = [System.Security.Cryptography.X509Certificates.X509SubjectAlternativeNameExtension]::new(
    $extension.RawData, $extension.Critical
)
$addresses = @($sans.EnumerateIPAddresses() | ForEach-Object { $_.ToString() })
$names = @($sans.EnumerateDnsNames())
if ($addresses -notcontains "10.0.0.50" -or $names -contains "10.0.0.50") {
    throw "The gRPC certificate must carry 10.0.0.50 as an IP SAN, not a DNS one.`nIPs: $($addresses -join ', ')`nDNS: $($names -join ', ')"
}
if ($names -notcontains "devices.axioma.internal") {
    throw "The gRPC certificate lost a DNS SAN in the split.`nDNS: $($names -join ', ')"
}

# secrets.embeddingKey is set in the full example and llm.embeddingApiBase is
# not, which is the shape that used to write the credential into the Secret and
# never pass it to the pod.
$api = Show-Only "templates/api.yaml"
if ($api -notmatch "(?m)^\s+- name: AXIOMA_EMBEDDING_KEY\s*$") {
    throw "secrets.embeddingKey is set but AXIOMA_EMBEDDING_KEY does not reach the API container."
}

$failure = Invoke-Helm @(
    "template", "verify", $chart, "--namespace", "verify",
    "--set-string", "secrets.betterAuthSecret=01234567890123456789012345678901",
    "--set-string", "postgresql.auth.existingSecret=database-credentials",
    "--set-string", "secrets.databaseUrl=",
    "--set", "agent.enabled=false"
) -ExpectFailure
if ($failure -notmatch "postgresql\.auth\.existingSecret is set, so the chart cannot compose a DSN.+Set secrets\.databaseUrl") {
    throw "Bundled Postgres existingSecret failure was not explanatory:`n$failure"
}

$rbac = Invoke-Helm (@(
    "template", "verify", $chart, "--namespace", "verify", "--show-only", "templates/rbac.yaml"
) + $placeholders)
$documents = $rbac -split "(?m)^---\s*$"
$roles = @($documents | Where-Object { $_ -match "(?m)^kind: Role\s*$" })
if ($roles.Count -ne 1 -or $rbac -match "(?m)^kind: ClusterRole(?:Binding)?\s*$") {
    throw "Default RBAC must render exactly one namespace-scoped Role and no ClusterRole."
}
if ($roles[0] -notmatch "(?m)^  namespace: verify\s*$") {
    throw "Default Role is not scoped to the release namespace."
}
$rules = @(($roles[0] -split "`r?`n") | Where-Object { $_ -notmatch "^\s*(#|$)" })
$rules = @($rules[([Array]::IndexOf($rules, "rules:"))..($rules.Count - 1)] | ForEach-Object { $_.Trim() })
$expectedRules = @(
    "rules:",
    '- apiGroups: [""]',
    'resources: ["pods"]',
    'verbs: ["get", "list"]',
    '- apiGroups: ["apps"]',
    'resources: ["deployments"]',
    'verbs: ["get", "patch"]'
)
if (($rules -join "`n") -cne ($expectedRules -join "`n")) {
    throw "Default Role grants changed. Expected only get/list pods and get/patch deployments.`nRendered:`n$($rules -join "`n")"
}

Write-Host "Chart verification passed."
