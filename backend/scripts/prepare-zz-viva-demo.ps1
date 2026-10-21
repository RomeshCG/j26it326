# ==============================================================================
# IMFS M4 - ZZ Viva Demo Preparation (A2 additive pack only)
# backend/scripts/prepare-zz-viva-demo.ps1
#
# Purpose:
#   Reuse existing ZZ audit history. Optionally add TWO genuine A2 breach rows
#   via POST /api/tenant/agent-actions/budget-threshold/evaluate, plus ONE
#   below-threshold evaluate that must create NO AgentAction.
#
# Honesty:
#   A2 v1 accepts source=manual_api_v1 only. These are caller-supplied synthetic
#   metrics / rules evaluation - NOT automated M2 ledger monitoring.
#
# Safety:
#   - Default mode is DRY-RUN (no evaluate writes).
#   - Write mode requires BOTH -Write AND env ALLOW_ZZ_VIVA_PREP_WRITE=1.
#   - Never approve/reject/override/delete. Protects fixed A1 pending id.
#   - No test-dispatch, A1 prepare, A3 dispatch, or A4 NLQ writes.
#   - Never deletes AgentAction rows. Manifest is append-only / update-in-place.
#
# PowerShell: Windows PowerShell 5.1 compatible (ASCII only).
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$Write,
    [string]$BaseUrl = "http://localhost:4000",
    [string]$CredentialsFile = "",
    [string]$ManifestPath = ""
)

$ErrorActionPreference = "Stop"

# ------------------------------------------------------------------------------
# Fixed ZZ tenant + protected SoD anchor
# ------------------------------------------------------------------------------
$script:ZzInstitutionId = "33b6545d-7c78-4354-a017-d0717efba3b8"
$script:ZzInstitutionName = "ZZ Test Org 1"
$script:ProtectedA1Id = "c68649d1-eed9-4724-a187-d57c0617ab2c"
$script:SeedTag = "zz-viva-prep-2026-10"
$script:HonestSource = "manual_api_v1"
$script:HonestLabel = "caller_supplied_threshold_rules_v1_not_m2_monitoring"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Split-Path -Parent $scriptRoot

if ([string]::IsNullOrWhiteSpace($CredentialsFile)) {
    $CredentialsFile = Join-Path $backendRoot ".zz-test-credentials.local"
}
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $scriptRoot ".zz-viva-prep-manifest.local.json"
}

# Deterministic A2 scenarios (metricName + periodKey drive soft dedupeKey).
# DedupeKey shape (server): a2-budget-v1|{source}|{periodKey}|{metricName}|{threshold}|{branch}
$script:Scenarios = @(
    [PSCustomObject]@{
        ScenarioId   = "N-A2-1"
        Kind         = "breach"
        MetricName   = "zz_viva_a2_opex_utilization_breach_v1"
        MetricValue  = 125
        Threshold    = 100
        PeriodKey    = $script:SeedTag
        Description  = "Synthetic opex utilization breach (manual_api_v1)"
    },
    [PSCustomObject]@{
        ScenarioId   = "N-A2-2"
        Kind         = "breach"
        MetricName   = "zz_viva_a2_branch_disbursement_cap_breach_v1"
        MetricValue  = 612000
        Threshold    = 500000
        PeriodKey    = $script:SeedTag
        Description  = "Synthetic disbursement-cap breach (manual_api_v1)"
    },
    [PSCustomObject]@{
        ScenarioId   = "N-A2-NB"
        Kind         = "no_breach"
        MetricName   = "zz_viva_a2_opex_utilization_ok_v1"
        MetricValue  = 72
        Threshold    = 100
        PeriodKey    = $script:SeedTag
        Description  = "Below-threshold control: must not create AgentAction"
    }
)

function Write-Info([string]$Message) {
    Write-Host $Message -ForegroundColor Cyan
}
function Write-Ok([string]$Message) {
    Write-Host $Message -ForegroundColor Green
}
function Write-WarnLine([string]$Message) {
    Write-Host $Message -ForegroundColor DarkYellow
}
function Write-ErrLine([string]$Message) {
    Write-Host $Message -ForegroundColor Red
}

function Get-PlainFromSecureString {
    param([System.Security.SecureString]$Secure)
    return [System.Net.NetworkCredential]::new("", $Secure).Password
}

function Invoke-JsonRequest {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = $null,
        [object]$Body = $null
    )

    $params = @{
        Uri             = $Url
        Method          = $Method
        ContentType     = "application/json"
        UseBasicParsing = $true
    }
    if ($null -ne $Headers) {
        $params["Headers"] = $Headers
    }
    if ($null -ne $Body) {
        $params["Body"] = ($Body | ConvertTo-Json -Depth 8 -Compress)
    }

    try {
        $resp = Invoke-WebRequest @params
        $obj = $null
        if ($resp.Content) {
            $obj = $resp.Content | ConvertFrom-Json
        }
        return @{
            Ok         = $true
            StatusCode = [int]$resp.StatusCode
            Body       = $obj
            Raw        = $resp.Content
        }
    }
    catch {
        $status = 0
        $bodyObj = $null
        $raw = ""
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode.value__
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $raw = $reader.ReadToEnd()
                    if ($raw) {
                        $bodyObj = $raw | ConvertFrom-Json
                    }
                }
            }
            catch {
                $raw = $_.Exception.Message
            }
        }
        else {
            throw
        }
        return @{
            Ok         = $false
            StatusCode = $status
            Body       = $bodyObj
            Raw        = $raw
            Error      = $_.Exception.Message
        }
    }
}

function Read-ZzCredentialsFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    $map = @{}
    $currentRole = $null
    $currentEmail = $null
    $currentPassword = $null

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trim = $line.Trim()
        if ($trim -eq "" -or $trim.StartsWith("#")) {
            continue
        }
        if ($trim -match '^role=(.+)$') {
            if ($currentRole -and $currentEmail -and $currentPassword) {
                $map[$currentRole] = @{
                    Email    = $currentEmail
                    Password = $currentPassword
                }
            }
            $currentRole = $Matches[1].Trim()
            $currentEmail = $null
            $currentPassword = $null
            continue
        }
        if ($trim -match '^email=(.+)$') {
            $currentEmail = $Matches[1].Trim()
            continue
        }
        if ($trim -match '^password=(.+)$') {
            $currentPassword = $Matches[1]
            continue
        }
    }
    if ($currentRole -and $currentEmail -and $currentPassword) {
        $map[$currentRole] = @{
            Email    = $currentEmail
            Password = $currentPassword
        }
    }
    return $map
}

function Get-RolePassword {
    param(
        [string]$Role,
        [string]$Email,
        [hashtable]$CredMap
    )

    if ($CredMap -and $CredMap.ContainsKey($Role) -and $CredMap[$Role].Password) {
        return $CredMap[$Role].Password
    }

    Write-WarnLine ("Password for {0} ({1}) not found in credentials file." -f $Role, $Email)
    $secure = Read-Host -Prompt ("Enter password for {0}" -f $Email) -AsSecureString
    if ($null -eq $secure -or $secure.Length -eq 0) {
        throw "Password cannot be empty."
    }
    return (Get-PlainFromSecureString -Secure $secure)
}

function Assert-ZzTenant {
    param(
        [object]$LoginUser,
        [object]$Me,
        [string]$ExpectedEmail
    )

    if ($LoginUser.email -ne $ExpectedEmail) {
        throw ("Login email mismatch: got '{0}', expected '{1}'" -f $LoginUser.email, $ExpectedEmail)
    }
    if ($LoginUser.institutionId -ne $script:ZzInstitutionId) {
        throw ("Login institutionId mismatch: got '{0}'" -f $LoginUser.institutionId)
    }
    if ($LoginUser.institutionName -ne $script:ZzInstitutionName) {
        throw ("Login institutionName mismatch: got '{0}', expected '{1}'" -f `
            $LoginUser.institutionName, $script:ZzInstitutionName)
    }
    if ($Me.institutionId -ne $script:ZzInstitutionId) {
        throw ("/auth/me institutionId mismatch: got '{0}'" -f $Me.institutionId)
    }
    if ($Me.email -ne $ExpectedEmail) {
        throw ("/auth/me email mismatch: got '{0}'" -f $Me.email)
    }
}

function Login-ZzRole {
    param(
        [string]$Role,
        [string]$Email,
        [string]$Password
    )

    $login = Invoke-JsonRequest -Method "POST" -Url ($BaseUrl.TrimEnd("/") + "/auth/login") -Body @{
        email    = $Email
        password = $Password
    }
    if (-not $login.Ok -or $login.StatusCode -ne 200 -or -not $login.Body.token) {
        throw ("Login failed for {0} HTTP {1}" -f $Role, $login.StatusCode)
    }

    $headers = @{ Authorization = ("Bearer {0}" -f $login.Body.token) }
    $me = Invoke-JsonRequest -Method "GET" -Url ($BaseUrl.TrimEnd("/") + "/auth/me") -Headers $headers
    if (-not $me.Ok -or $me.StatusCode -ne 200) {
        throw ("/auth/me failed for {0} HTTP {1}" -f $Role, $me.StatusCode)
    }

    Assert-ZzTenant -LoginUser $login.Body.user -Me $me.Body -ExpectedEmail $Email

    return @{
        Role    = $Role
        Email   = $Email
        Headers = $headers
        Login   = $login.Body
        Me      = $me.Body
    }
}

function Get-ActionTextMarker {
    param($Scenario)
    # Matches buildBudgetBreachActionText metricName + period fragment.
    return $Scenario.MetricName
}

function Find-ExistingBreachByMarker {
    param(
        [object[]]$A2Actions,
        $Scenario
    )

    $marker = Get-ActionTextMarker -Scenario $Scenario
    $periodHint = ("period={0}" -f $Scenario.PeriodKey)
    foreach ($row in $A2Actions) {
        if ($null -eq $row.action) { continue }
        $text = [string]$row.action
        if ($text.Contains($marker) -and $text.Contains($periodHint)) {
            return $row
        }
    }
    return $null
}

function Load-Manifest {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return @{
            schemaVersion   = 1
            institutionId   = $script:ZzInstitutionId
            institutionName = $script:ZzInstitutionName
            seedTag         = $script:SeedTag
            protectedA1Id   = $script:ProtectedA1Id
            honestSource    = $script:HonestSource
            honestLabel     = $script:HonestLabel
            scenarios       = @()
        }
    }
    $raw = Get-Content -LiteralPath $Path -Raw
    $obj = $raw | ConvertFrom-Json
    return $obj
}

function Save-Manifest {
    param(
        [string]$Path,
        [object]$Manifest
    )
    $json = $Manifest | ConvertTo-Json -Depth 8
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
    Set-Content -LiteralPath $Path -Value $json -Encoding UTF8
}

function Upsert-ManifestScenario {
    param(
        [object]$Manifest,
        [string]$ScenarioId,
        [hashtable]$Entry
    )

    $list = New-Object System.Collections.ArrayList
    if ($Manifest.scenarios) {
        foreach ($s in @($Manifest.scenarios)) {
            if ($s.scenarioId -ne $ScenarioId) {
                [void]$list.Add($s)
            }
        }
    }
    $Entry["scenarioId"] = $ScenarioId
    [void]$list.Add((New-Object PSObject -Property $Entry))
    $Manifest.scenarios = @($list.ToArray())
    return $Manifest
}

function Find-ManifestScenario {
    param(
        [object]$Manifest,
        [string]$ScenarioId
    )
    if (-not $Manifest.scenarios) { return $null }
    foreach ($s in @($Manifest.scenarios)) {
        if ($s.scenarioId -eq $ScenarioId) { return $s }
    }
    return $null
}

# ------------------------------------------------------------------------------
# Banner + mode gate
# ------------------------------------------------------------------------------
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "IMFS M4 ZZ Viva Prep - A2 additive pack (genuine evaluate API)" -ForegroundColor Cyan
Write-Host ("BaseUrl:     {0}" -f $BaseUrl) -ForegroundColor Cyan
Write-Host ("Institution: {0} ({1})" -f $script:ZzInstitutionName, $script:ZzInstitutionId) -ForegroundColor Cyan
Write-Host ("Protected A1 pending id: {0}" -f $script:ProtectedA1Id) -ForegroundColor Cyan
Write-Host ("Manifest:    {0}" -f $ManifestPath) -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: A2 metrics are caller-supplied (manual_api_v1)." -ForegroundColor DarkYellow
Write-Host "      Do NOT present results as automated M2 ledger monitoring." -ForegroundColor DarkYellow
Write-Host ""

$allowWriteEnv = [string]$env:ALLOW_ZZ_VIVA_PREP_WRITE
$writeMode = $false
if ($Write) {
    if ($allowWriteEnv -ne "1") {
        Write-ErrLine "Refusing write mode: set ALLOW_ZZ_VIVA_PREP_WRITE=1 and pass -Write."
        Write-ErrLine "Default remains dry-run (inventory + intended payloads only)."
        exit 2
    }
    $writeMode = $true
    Write-WarnLine "WRITE MODE ENABLED (ALLOW_ZZ_VIVA_PREP_WRITE=1 + -Write)."
}
else {
    Write-Ok "DRY-RUN mode (default). No budget-threshold evaluate writes will be sent."
}

# ------------------------------------------------------------------------------
# Credentials (gitignored file preferred; SecureString prompt fallback)
# ------------------------------------------------------------------------------
$credMap = Read-ZzCredentialsFile -Path $CredentialsFile
$financeEmail = "finance.officer@zz-test-org1.lk"
$executiveEmail = "executive@zz-test-org1.lk"
if ($credMap -and $credMap.ContainsKey("finance_officer") -and $credMap["finance_officer"].Email) {
    $financeEmail = $credMap["finance_officer"].Email
}
if ($credMap -and $credMap.ContainsKey("executive") -and $credMap["executive"].Email) {
    $executiveEmail = $credMap["executive"].Email
}

$financePassword = Get-RolePassword -Role "finance_officer" -Email $financeEmail -CredMap $credMap
$executivePassword = Get-RolePassword -Role "executive" -Email $executiveEmail -CredMap $credMap

# Dual-role: finance writes A2 (ledger domain + SoD); executive reads pending /
# override-rates (finance lacks agents:decide_tier3).
Write-Info "Logging in finance_officer (A2 evaluate actor)..."
$sessionFinance = Login-ZzRole -Role "finance_officer" -Email $financeEmail -Password $financePassword
Write-Ok ("Finance tenant guard OK: {0}" -f $sessionFinance.Login.user.institutionName)

Write-Info "Logging in executive (pending + dashboard verify actor)..."
$sessionExec = Login-ZzRole -Role "executive" -Email $executiveEmail -Password $executivePassword
Write-Ok ("Executive tenant guard OK: {0}" -f $sessionExec.Login.user.institutionName)

# Clear plaintext copies from local vars as soon as sessions exist.
$financePassword = $null
$executivePassword = $null

$apiActions = $BaseUrl.TrimEnd("/") + "/api/tenant/agent-actions"
$apiPending = $apiActions + "/pending"
$apiOverride = $apiActions + "/metrics/override-rates"
$apiEvaluate = $apiActions + "/budget-threshold/evaluate"

# ------------------------------------------------------------------------------
# Pre-write inventory (read-only)
# ------------------------------------------------------------------------------
Write-Info ""
Write-Info "=== Pre-write inventory ==="

$pending = Invoke-JsonRequest -Method "GET" -Url $apiPending -Headers $sessionExec.Headers
if (-not $pending.Ok -or $pending.StatusCode -ne 200) {
    throw ("GET pending failed HTTP {0}" -f $pending.StatusCode)
}

$pendingIds = @()
if ($pending.Body.data) {
    $pendingIds = @($pending.Body.data | ForEach-Object { $_.id })
}
Write-Host ("Pending count: {0}" -f $pending.Body.count)
foreach ($p in @($pending.Body.data)) {
    Write-Host ("  - {0} | {1} | T{2} | {3}" -f $p.id, $p.agentId, $p.tier, $p.action)
}

if ($pendingIds -notcontains $script:ProtectedA1Id) {
    Write-ErrLine ("FATAL: Protected A1 pending id not found: {0}" -f $script:ProtectedA1Id)
    Write-ErrLine "Refusing to continue (SoD demo anchor missing or already decided)."
    exit 3
}
Write-Ok ("Protected A1 pending present: {0}" -f $script:ProtectedA1Id)

$a2List = Invoke-JsonRequest -Method "GET" -Url ($apiActions + '?agentId=A2&limit=100') -Headers $sessionFinance.Headers
if (-not $a2List.Ok -or $a2List.StatusCode -ne 200) {
    throw ("GET agent-actions?agentId=A2 failed HTTP {0}" -f $a2List.StatusCode)
}
$a2Actions = @()
if ($a2List.Body.data) { $a2Actions = @($a2List.Body.data) }
Write-Host ("A2 actions visible (page): {0}" -f $a2Actions.Count)

$allList = Invoke-JsonRequest -Method "GET" -Url ($apiActions + "?limit=100") -Headers $sessionFinance.Headers
if (-not $allList.Ok -or $allList.StatusCode -ne 200) {
    throw ("GET agent-actions failed HTTP {0}" -f $allList.StatusCode)
}
Write-Host ("Agent Log page count (limit 100): {0}" -f $allList.Body.count)

$override = Invoke-JsonRequest -Method "GET" -Url $apiOverride -Headers $sessionExec.Headers
if ($override.Ok -and $override.StatusCode -eq 200) {
    Write-Host ("Override-rates totalActions (window): {0}" -f $override.Body.totalActions)
}
else {
    Write-WarnLine ("Override-rates not available HTTP {0} (non-fatal for inventory)" -f $override.StatusCode)
}

$manifest = Load-Manifest -Path $ManifestPath

Write-Info ""
Write-Info "=== Intended scenarios ==="
foreach ($sc in $script:Scenarios) {
    $bodyPreview = @{
        metricName  = $sc.MetricName
        metricValue = $sc.MetricValue
        threshold   = $sc.Threshold
        periodKey   = $sc.PeriodKey
        source      = $script:HonestSource
    }
    $existing = Find-ExistingBreachByMarker -A2Actions $a2Actions -Scenario $sc
    $manifestHit = Find-ManifestScenario -Manifest $manifest -ScenarioId $sc.ScenarioId
    Write-Host ("[{0}] kind={1} {2}" -f $sc.ScenarioId, $sc.Kind, $sc.Description)
    Write-Host ("     body={0}" -f ($bodyPreview | ConvertTo-Json -Compress))
    if ($sc.Kind -eq "breach" -and $existing) {
        Write-WarnLine ("     SKIP candidate: existing Agent Log row {0}" -f $existing.id)
    }
    elseif ($sc.Kind -eq "breach" -and $manifestHit -and $manifestHit.actionId) {
        Write-WarnLine ("     SKIP candidate: manifest already has actionId {0}" -f $manifestHit.actionId)
    }
    elseif ($sc.Kind -eq "no_breach") {
        Write-Host "     expect: breached=false dispatched=false (no AgentAction)"
    }
    else {
        Write-Host "     expect: breached=true dispatched=true (new T2 notified) OR soft-dedupe duplicate"
    }
}

if (-not $writeMode) {
    Write-Ok ""
    Write-Ok "Dry-run complete. No evaluate writes were sent. No manifest update written."
    Write-Ok "To write (after review):"
    Write-Ok '  $env:ALLOW_ZZ_VIVA_PREP_WRITE="1"'
    Write-Ok "  powershell -NoProfile -File .\scripts\prepare-zz-viva-demo.ps1 -Write"
    exit 0
}

# ------------------------------------------------------------------------------
# WRITE MODE: evaluate only; never touch approve/reject/override/delete
# ------------------------------------------------------------------------------
Write-WarnLine ""
Write-WarnLine "=== WRITE MODE: posting evaluate calls ==="

$createdIds = New-Object System.Collections.ArrayList
$a2CountBefore = $a2Actions.Count

foreach ($sc in $script:Scenarios) {
    Write-Info ("--- {0} ---" -f $sc.ScenarioId)

    if ($sc.Kind -eq "breach") {
        $existing = Find-ExistingBreachByMarker -A2Actions $a2Actions -Scenario $sc
        $manifestHit = Find-ManifestScenario -Manifest $manifest -ScenarioId $sc.ScenarioId
        if ($existing) {
            Write-WarnLine ("Idempotent skip: Agent Log already has {0}" -f $existing.id)
            $manifest = Upsert-ManifestScenario -Manifest $manifest -ScenarioId $sc.ScenarioId -Entry @{
                status      = "skipped_existing_action"
                actionId    = $existing.id
                source      = $script:HonestSource
                honestLabel = $script:HonestLabel
                kind        = $sc.Kind
                metricName  = $sc.MetricName
                periodKey   = $sc.PeriodKey
                updatedAt   = (Get-Date).ToUniversalTime().ToString("o")
            }
            continue
        }
        if ($manifestHit -and $manifestHit.actionId) {
            Write-WarnLine ("Idempotent skip: manifest actionId {0}" -f $manifestHit.actionId)
            continue
        }
    }

    $payload = @{
        metricName  = $sc.MetricName
        metricValue = $sc.MetricValue
        threshold   = $sc.Threshold
        periodKey   = $sc.PeriodKey
        source      = $script:HonestSource
    }

    $eval = Invoke-JsonRequest -Method "POST" -Url $apiEvaluate -Headers $sessionFinance.Headers -Body $payload
    if (-not $eval.Ok -and $eval.StatusCode -ge 400) {
        Write-ErrLine ("Evaluate failed HTTP {0}: {1}" -f $eval.StatusCode, $eval.Raw)
        throw ("Scenario {0} failed" -f $sc.ScenarioId)
    }

    if ($sc.Kind -eq "no_breach") {
        if ($eval.Body.breached -ne $false -or $eval.Body.dispatched -ne $false) {
            throw ("N-A2-NB expected breached=false dispatched=false; got breached={0} dispatched={1}" -f `
                $eval.Body.breached, $eval.Body.dispatched)
        }
        Write-Ok "Below-threshold OK: no AgentAction dispatched."
        $manifest = Upsert-ManifestScenario -Manifest $manifest -ScenarioId $sc.ScenarioId -Entry @{
            status      = "verified_no_action"
            actionId    = $null
            source      = $script:HonestSource
            honestLabel = $script:HonestLabel
            kind        = $sc.Kind
            metricName  = $sc.MetricName
            periodKey   = $sc.PeriodKey
            updatedAt   = (Get-Date).ToUniversalTime().ToString("o")
        }
        continue
    }

    # breach path
    if ($eval.Body.duplicate -eq $true) {
        Write-WarnLine ("Soft dedupe hit: existingActionId={0}" -f $eval.Body.existingActionId)
        $manifest = Upsert-ManifestScenario -Manifest $manifest -ScenarioId $sc.ScenarioId -Entry @{
            status      = "skipped_soft_dedupe"
            actionId    = $eval.Body.existingActionId
            source      = $script:HonestSource
            honestLabel = $script:HonestLabel
            kind        = $sc.Kind
            metricName  = $sc.MetricName
            periodKey   = $sc.PeriodKey
            updatedAt   = (Get-Date).ToUniversalTime().ToString("o")
        }
        continue
    }

    if ($eval.Body.breached -ne $true -or $eval.Body.dispatched -ne $true) {
        throw ("Expected breach dispatch for {0}; breached={1} dispatched={2}" -f `
            $sc.ScenarioId, $eval.Body.breached, $eval.Body.dispatched)
    }

    $newId = $null
    if ($eval.Body.dispatch -and $eval.Body.dispatch.actionId) {
        $newId = [string]$eval.Body.dispatch.actionId
    }
    if ([string]::IsNullOrWhiteSpace($newId)) {
        throw ("Missing dispatch.actionId for {0}" -f $sc.ScenarioId)
    }
    if ($eval.Body.dispatch.actionStatus -ne "notified" -or [int]$eval.Body.dispatch.tier -ne 2) {
        throw ("Unexpected dispatch status/tier for {0}: status={1} tier={2}" -f `
            $sc.ScenarioId, $eval.Body.dispatch.actionStatus, $eval.Body.dispatch.tier)
    }

    Write-Ok ("Created A2 T2 notified actionId={0}" -f $newId)
    [void]$createdIds.Add($newId)
    $manifest = Upsert-ManifestScenario -Manifest $manifest -ScenarioId $sc.ScenarioId -Entry @{
        status      = "created"
        actionId    = $newId
        source      = $script:HonestSource
        honestLabel = $script:HonestLabel
        kind        = $sc.Kind
        metricName  = $sc.MetricName
        periodKey   = $sc.PeriodKey
        updatedAt   = (Get-Date).ToUniversalTime().ToString("o")
    }
}

$manifest.updatedAt = (Get-Date).ToUniversalTime().ToString("o")
$manifest.institutionId = $script:ZzInstitutionId
$manifest.institutionName = $script:ZzInstitutionName
$manifest.protectedA1Id = $script:ProtectedA1Id
$manifest.seedTag = $script:SeedTag
$manifest.honestSource = $script:HonestSource
$manifest.honestLabel = $script:HonestLabel
Save-Manifest -Path $ManifestPath -Manifest $manifest
Write-Ok ("Manifest written: {0}" -f $ManifestPath)

# ------------------------------------------------------------------------------
# Post-write verification (Agent Log + pending protection + metrics)
# ------------------------------------------------------------------------------
Write-Info ""
Write-Info "=== Post-write verification ==="

$pending2 = Invoke-JsonRequest -Method "GET" -Url $apiPending -Headers $sessionExec.Headers
if (-not $pending2.Ok) { throw "GET pending (post) failed" }
$pendingIds2 = @($pending2.Body.data | ForEach-Object { $_.id })
if ($pendingIds2 -notcontains $script:ProtectedA1Id) {
    throw "FATAL: Protected A1 pending id missing after write - unexpected mutation."
}
Write-Ok "Protected A1 pending still present (no approve/reject performed)."

$a2List2 = Invoke-JsonRequest -Method "GET" -Url ($apiActions + '?agentId=A2&limit=100') -Headers $sessionFinance.Headers
$a2Actions2 = @()
if ($a2List2.Body.data) { $a2Actions2 = @($a2List2.Body.data) }
Write-Host ("A2 Agent Log count (page): before={0} after={1}" -f $a2CountBefore, $a2Actions2.Count)

foreach ($sc in $script:Scenarios) {
    if ($sc.Kind -ne "breach") { continue }
    $hit = Find-ExistingBreachByMarker -A2Actions $a2Actions2 -Scenario $sc
    if (-not $hit) {
        $m = Find-ManifestScenario -Manifest $manifest -ScenarioId $sc.ScenarioId
        if ($m -and $m.status -eq "skipped_soft_dedupe") {
            Write-WarnLine ("{0}: soft-dedupe path; verify existingActionId in manifest" -f $sc.ScenarioId)
        }
        else {
            throw ("Verification failed: {0} not visible in Agent Log list" -f $sc.ScenarioId)
        }
    }
    else {
        Write-Ok ("{0} visible in Agent Log as {1} (tier={2} status={3})" -f `
            $sc.ScenarioId, $hit.id, $hit.tier, $hit.status)
    }
}

# Confirm no-breach metric did not appear as an action text marker
$nb = $script:Scenarios | Where-Object { $_.ScenarioId -eq "N-A2-NB" } | Select-Object -First 1
$nbHit = Find-ExistingBreachByMarker -A2Actions $a2Actions2 -Scenario $nb
if ($nbHit) {
    throw ("N-A2-NB incorrectly created/found action {0}" -f $nbHit.id)
}
Write-Ok "N-A2-NB confirmed absent from A2 Agent Log markers."

$override2 = Invoke-JsonRequest -Method "GET" -Url $apiOverride -Headers $sessionExec.Headers
if ($override2.Ok -and $override2.StatusCode -eq 200) {
    Write-Ok ("Dashboard override-rates totalActions={0}" -f $override2.Body.totalActions)
}
else {
    Write-WarnLine "Override-rates verify skipped/failed (non-fatal)."
}

Write-Ok ""
Write-Ok "ZZ viva prep write mode finished."
Write-Ok ("Newly created action IDs this run: {0}" -f ($(if ($createdIds.Count -gt 0) { ($createdIds -join ", ") } else { "(none - skipped/deduped)" })))
Write-Host "Safety: audit rows were NOT deleted. Re-run is idempotent via markers + soft dedupe."
exit 0
