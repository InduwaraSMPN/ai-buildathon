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
