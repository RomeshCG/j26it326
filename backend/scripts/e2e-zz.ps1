# ==============================================================================
# IMFS - Graduated Trust Engine End-to-End Test for ZZ Test Org 1
# backend/scripts/e2e-zz.ps1
#
# Target: http://localhost:4000 (ZZ Test Org 1 tenant database only)
# Constraints: Windows PowerShell 5.1 compatible, pure ASCII only,
#              no secrets logged or printed
# ==============================================================================

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Fixed configuration
$baseUrl = "http://localhost:4000"
$adminEmail = "admin@zz-test-org1.lk"

# Results collection for final summary table
$stepResults = New-Object System.Collections.ArrayList

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "IMFS Graduated Trust: ZZ Test Org 1 E2E Verification Suite" -ForegroundColor Cyan
Write-Host "Target Base URL: $baseUrl" -ForegroundColor Cyan
Write-Host "Target Admin:    $adminEmail" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Prompt for password securely
$securePassword = Read-Host -Prompt "Enter password for $adminEmail" -AsSecureString
if ($null -eq $securePassword -or $securePassword.Length -eq 0) {
    Write-Host "[FATAL] Password cannot be empty." -ForegroundColor Red
    exit 1
}

$plainPassword = $null

# ------------------------------------------------------------------------------
# Helper: Invoke-ApiStep (Windows PowerShell 5.1 compatible, ASCII only)
# ------------------------------------------------------------------------------
function Invoke-ApiStep {
    param(
        [string]$StepNumber,
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = $null,
        [object]$Body = $null,
        [int]$ExpectedStatus,
        [string]$Description
    )

    $uri = "$baseUrl$Path"
    $actualStatus = 0
    $responseObj = $null
    $errorText = ""

    try {
        $params = @{
            Uri             = $uri
            Method          = $Method
            ContentType     = "application/json"
            UseBasicParsing = $true
        }
        if ($null -ne $Headers) {
            $params["Headers"] = $Headers
        }
        if ($null -ne $Body) {
            $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
        }

        $resp = Invoke-WebRequest @params
        $actualStatus = [int]$resp.StatusCode
        if ($resp.Content) {
            $responseObj = $resp.Content | ConvertFrom-Json
        }
    }
    catch {
        if ($_.Exception.Response) {
            $actualStatus = [int]$_.Exception.Response.StatusCode.value__
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $rawText = $reader.ReadToEnd()
                    if ($rawText) {
                        $responseObj = $rawText | ConvertFrom-Json
                        if ($responseObj.error) {
                            $errorText = $responseObj.error
                        } else {
                            $errorText = $rawText
                        }
                    }
                }
            }
            catch {
                $errorText = $_.Exception.Message
            }
        }
        else {
            Write-Host ("[FATAL] Network error on step {0} ({1} {2}): {3}" -f $StepNumber, $Method, $Path, $_.Exception.Message) -ForegroundColor Red
            exit 1
        }
    }

    if ($actualStatus -eq $ExpectedStatus) {
        Write-Host ("[{0,2}] {1,-6} {2,-50} -> HTTP {3} ({4}) - PASS" -f $StepNumber, $Method, $Path, $actualStatus, $Description) -ForegroundColor Green
        $null = $stepResults.Add([PSCustomObject]@{
            Step        = $StepNumber
            Method      = $Method
            Path        = $Path
            Expected    = $ExpectedStatus
            Actual      = $actualStatus
            Status      = "PASS"
            Description = $Description
        })
        return $responseObj
    }
    else {
        Write-Host ("[{0,2}] {1,-6} {2,-50} -> HTTP {3} (Expected {4}) - FAIL" -f $StepNumber, $Method, $Path, $actualStatus, $ExpectedStatus) -ForegroundColor Red
        if ($errorText) {
            Write-Host ("       Response error: {0}" -f $errorText) -ForegroundColor DarkYellow
        }
        $null = $stepResults.Add([PSCustomObject]@{
            Step        = $StepNumber
            Method      = $Method
            Path        = $Path
            Expected    = $ExpectedStatus
            Actual      = $actualStatus
            Status      = "FAIL"
            Description = $Description
        })
        Write-Host ("[FATAL] Step {0} failed with unexpected HTTP status. Terminating execution." -f $StepNumber) -ForegroundColor Red
        exit 1
    }
}

# ------------------------------------------------------------------------------
# Test Execution
# ------------------------------------------------------------------------------
try {
    $plainPassword = [System.Net.NetworkCredential]::new("", $securePassword).Password

    # --------------------------------------------------------------------------
    # Step 1: Login
    # --------------------------------------------------------------------------
    $loginPayload = @{
        email    = $adminEmail
        password = $plainPassword
    }
    $loginResp = Invoke-ApiStep -StepNumber "01" -Method "POST" -Path "/auth/login" `
        -Body $loginPayload -ExpectedStatus 200 -Description "Login as ZZ Test Org 1 admin"

    $token = $loginResp.token
    $authHeaders = @{ Authorization = "Bearer $token" }

    # --------------------------------------------------------------------------
    # Step 2: GET /auth/me & Tenant Guard
    # --------------------------------------------------------------------------
    $meResp = Invoke-ApiStep -StepNumber "02" -Method "GET" -Path "/auth/me" `
        -Headers $authHeaders -ExpectedStatus 200 -Description "Fetch caller profile and capabilities"

    # Multi-point Tenant Guard
    $loginEmail    = $loginResp.user.email
    $loginInstName = $loginResp.user.institutionName
    $loginInstId   = $loginResp.user.institutionId
    $meEmail       = $meResp.email
    $meInstId      = $meResp.institutionId

    $guardFailed = $false
    if ($loginEmail -ne "admin@zz-test-org1.lk") { $guardFailed = $true }
    if ($loginInstName -ne "ZZ Test Org 1") { $guardFailed = $true }
    if ($meEmail -ne "admin@zz-test-org1.lk") { $guardFailed = $true }
    if ($meInstId -ne $loginInstId) { $guardFailed = $true }

    if ($guardFailed) {
        Write-Host "[FATAL] Tenant Guard Failed! Cross-tenant boundary protection triggered." -ForegroundColor Red
        Write-Host ("       Login Email:            '{0}' (expected admin@zz-test-org1.lk)" -f $loginEmail)
        Write-Host ("       Login Institution Name: '{0}' (expected 'ZZ Test Org 1')" -f $loginInstName)
        Write-Host ("       Auth/me Email:          '{0}' (expected admin@zz-test-org1.lk)" -f $meEmail)
        Write-Host ("       Auth/me Institution ID: '{0}' (expected {1})" -f $meInstId, $loginInstId)
        exit 1
    }

    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Cyan
    Write-Host ("TENANT GUARD VERIFIED: Institution '{0}' ({1})" -f $loginInstName, $loginInstId) -ForegroundColor Cyan
    Write-Host "All write requests strictly isolated to ZZ Test Org 1 database." -ForegroundColor Cyan
    Write-Host "==================================================================" -ForegroundColor Cyan
    Write-Host ""

    # --------------------------------------------------------------------------
    # Step 2b: Policy Pre-check: GET /api/tenant/agent-policies
    # --------------------------------------------------------------------------
    $prePolicyResp = Invoke-ApiStep -StepNumber "2b" -Method "GET" -Path "/api/tenant/agent-policies" `
        -Headers $authHeaders -ExpectedStatus 200 -Description "Check existing agent policies"
    
    $existingTypes = @()
    if ($prePolicyResp.data) {
        $existingTypes = @($prePolicyResp.data | ForEach-Object { $_.actionType })
    }

    if ($existingTypes.Count -gt 0) {
        Write-Host ("NOTE: Tenant already has {0} policy/policies configured. SQL counts hold strictly for one clean first run." -f $existingTypes.Count) -ForegroundColor Yellow
    }

    # --------------------------------------------------------------------------
    # Steps 3-6: Create the 4 Default Agent Policies
    # --------------------------------------------------------------------------
    # Step 3: Tier 1 (nlq_query)
    $p1 = @{
        actionType  = "nlq_query"
        agentId     = "A4"
        agentName   = "NLQ"
        tier        = 1
        description = "Answer natural-language queries automatically"
    }
    if ($p1.actionType -in $existingTypes) {
        Write-Host ("[{0,2}] Policy '{1}' already exists, skipping POST" -f "03", $p1.actionType) -ForegroundColor Yellow
        $null = $stepResults.Add([PSCustomObject]@{
            Step        = "03"
            Method      = "POST"
            Path        = "/api/tenant/agent-policies"
            Expected    = 201
            Actual      = "-"
            Status      = "SKIPPED"
            Description = "Policy nlq_query already exists (skipped)"
        })
    } else {
        $null = Invoke-ApiStep -StepNumber "03" -Method "POST" -Path "/api/tenant/agent-policies" `
            -Headers $authHeaders -Body $p1 -ExpectedStatus 201 -Description "Seed Tier 1 policy (nlq_query -> A4)"
    }

    # Step 4: Tier 2 (budget_threshold_alert)
    $p2 = @{
        actionType  = "budget_threshold_alert"
        agentId     = "A2"
        agentName   = "Workflow"
        tier        = 2
        description = "Execute alert and notify manager"
    }
    if ($p2.actionType -in $existingTypes) {
        Write-Host ("[{0,2}] Policy '{1}' already exists, skipping POST" -f "04", $p2.actionType) -ForegroundColor Yellow
        $null = $stepResults.Add([PSCustomObject]@{
            Step        = "04"
            Method      = "POST"
            Path        = "/api/tenant/agent-policies"
            Expected    = 201
            Actual      = "-"
            Status      = "SKIPPED"
            Description = "Policy budget_threshold_alert already exists (skipped)"
        })
    } else {
        $null = Invoke-ApiStep -StepNumber "04" -Method "POST" -Path "/api/tenant/agent-policies" `
            -Headers $authHeaders -Body $p2 -ExpectedStatus 201 -Description "Seed Tier 2 policy (budget_threshold_alert -> A2)"
    }

    # Step 5: Tier 3 (generate_cbsl_report)
    $p3 = @{
        actionType  = "generate_cbsl_report"
        agentId     = "A1"
        agentName   = "Compliance"
        tier        = 3
        description = "Prepare CBSL report; human approval required"
    }
    if ($p3.actionType -in $existingTypes) {
        Write-Host ("[{0,2}] Policy '{1}' already exists, skipping POST" -f "05", $p3.actionType) -ForegroundColor Yellow
        $null = $stepResults.Add([PSCustomObject]@{
            Step        = "05"
            Method      = "POST"
            Path        = "/api/tenant/agent-policies"
            Expected    = 201
            Actual      = "-"
            Status      = "SKIPPED"
            Description = "Policy generate_cbsl_report already exists (skipped)"
        })
    } else {
        $null = Invoke-ApiStep -StepNumber "05" -Method "POST" -Path "/api/tenant/agent-policies" `
            -Headers $authHeaders -Body $p3 -ExpectedStatus 201 -Description "Seed Tier 3 policy (generate_cbsl_report -> A1)"
    }

    # Step 6: Tier 4 (volume_spike_alert)
    $p4 = @{
        actionType  = "volume_spike_alert"
        agentId     = "A3"
        agentName   = "Anomaly"
        tier        = 4
        description = "Alert only - human decides next steps"
    }
    if ($p4.actionType -in $existingTypes) {
        Write-Host ("[{0,2}] Policy '{1}' already exists, skipping POST" -f "06", $p4.actionType) -ForegroundColor Yellow
        $null = $stepResults.Add([PSCustomObject]@{
            Step        = "06"
            Method      = "POST"
            Path        = "/api/tenant/agent-policies"
            Expected    = 201
            Actual      = "-"
            Status      = "SKIPPED"
            Description = "Policy volume_spike_alert already exists (skipped)"
        })
    } else {
        $null = Invoke-ApiStep -StepNumber "06" -Method "POST" -Path "/api/tenant/agent-policies" `
            -Headers $authHeaders -Body $p4 -ExpectedStatus 201 -Description "Seed Tier 4 policy (volume_spike_alert -> A3)"
    }

    # --------------------------------------------------------------------------
    # Steps 7-11: Test-Dispatch Actions Across Tiers (with PII Secret Marker)
    # --------------------------------------------------------------------------
    # Step 7: Tier 1 Dispatch (nlq_query) -> auto-executes
    $t1Body = @{
        actionType   = "nlq_query"
        action       = "Answer borrower repayment schedule inquiry"
        reason       = "Automated customer inquiry response"
        inputPayload = @{
            secretMarker = "ZZ-MARKER-SECRET-12345"
            loanId       = "ZZ-LN-1001"
            query        = "What is my next repayment amount?"
        }
    }
    $t1Resp = Invoke-ApiStep -StepNumber "07" -Method "POST" -Path "/api/tenant/agent-actions/test-dispatch" `
        -Headers $authHeaders -Body $t1Body -ExpectedStatus 200 -Description "Dispatch Tier 1 action (nlq_query)"
    $actionIdT1 = $t1Resp.actionId

    if ([string]::IsNullOrWhiteSpace($actionIdT1) -or $t1Resp.actionStatus -ne "executed" -or $t1Resp.tier -ne 1) {
        Write-Host ("[FATAL] Step 7 assertion failed: expected non-empty actionId, actionStatus 'executed', tier 1. Got actionId='{0}', actionStatus='{1}', tier={2}" -f `
            $actionIdT1, $t1Resp.actionStatus, $t1Resp.tier) -ForegroundColor Red
        exit 1
    }

    # Step 8: Tier 2 Dispatch (budget_threshold_alert) -> notifies
    $t2Body = @{
        actionType   = "budget_threshold_alert"
        action       = "Notify branch manager of budget threshold exceedance"
        reason       = "Branch disbursements exceeded weekly allocation by 15%"
        inputPayload = @{
            secretMarker             = "ZZ-MARKER-SECRET-12345"
            branchId                 = "ZZ-BR-01"
            thresholdExceededPercent = 15
        }
    }
    $t2Resp = Invoke-ApiStep -StepNumber "08" -Method "POST" -Path "/api/tenant/agent-actions/test-dispatch" `
        -Headers $authHeaders -Body $t2Body -ExpectedStatus 200 -Description "Dispatch Tier 2 action (budget_threshold_alert)"
    $actionIdT2 = $t2Resp.actionId

    if ([string]::IsNullOrWhiteSpace($actionIdT2) -or $t2Resp.actionStatus -ne "notified" -or $t2Resp.tier -ne 2) {
        Write-Host ("[FATAL] Step 8 assertion failed: expected non-empty actionId, actionStatus 'notified', tier 2. Got actionId='{0}', actionStatus='{1}', tier={2}" -f `
            $actionIdT2, $t2Resp.actionStatus, $t2Resp.tier) -ForegroundColor Red
        exit 1
    }

    # Step 9: Tier 3 Dispatch #1 (generate_cbsl_report) -> pending approval (to approve)
    $t3ApproveBody = @{
        actionType   = "generate_cbsl_report"
        action       = "Generate CBSL Quarterly Return Q3"
        reason       = "Quarterly regulatory compliance filing draft"
        inputPayload = @{
            secretMarker = "ZZ-MARKER-SECRET-12345"
            quarter      = "Q3-2026"
            institution  = "ZZ Test Org 1"
        }
    }
    $t3ApproveResp = Invoke-ApiStep -StepNumber "09" -Method "POST" -Path "/api/tenant/agent-actions/test-dispatch" `
        -Headers $authHeaders -Body $t3ApproveBody -ExpectedStatus 200 -Description "Dispatch Tier 3 action #1 (to approve)"
    $actionIdT3Approve = $t3ApproveResp.actionId

    if ([string]::IsNullOrWhiteSpace($actionIdT3Approve) -or $t3ApproveResp.actionStatus -ne "pending_approval" -or $t3ApproveResp.tier -ne 3) {
        Write-Host ("[FATAL] Step 9 assertion failed: expected non-empty actionId, actionStatus 'pending_approval', tier 3. Got actionId='{0}', actionStatus='{1}', tier={2}" -f `
            $actionIdT3Approve, $t3ApproveResp.actionStatus, $t3ApproveResp.tier) -ForegroundColor Red
        exit 1
    }

    # Step 10: Tier 3 Dispatch #2 (generate_cbsl_report) -> pending approval (to reject)
    $t3RejectBody = @{
        actionType   = "generate_cbsl_report"
        action       = "Generate CBSL ad-hoc liquidity disclosure"
        reason       = "Ad-hoc compliance disclosure generated by agent"
        inputPayload = @{
            secretMarker   = "ZZ-MARKER-SECRET-12345"
            disclosureType = "liquidity_stress"
            flaggedCount   = 2
        }
    }
    $t3RejectResp = Invoke-ApiStep -StepNumber "10" -Method "POST" -Path "/api/tenant/agent-actions/test-dispatch" `
        -Headers $authHeaders -Body $t3RejectBody -ExpectedStatus 200 -Description "Dispatch Tier 3 action #2 (to reject)"
    $actionIdT3Reject = $t3RejectResp.actionId

    if ([string]::IsNullOrWhiteSpace($actionIdT3Reject) -or $t3RejectResp.actionStatus -ne "pending_approval" -or $t3RejectResp.tier -ne 3) {
        Write-Host ("[FATAL] Step 10 assertion failed: expected non-empty actionId, actionStatus 'pending_approval', tier 3. Got actionId='{0}', actionStatus='{1}', tier={2}" -f `
            $actionIdT3Reject, $t3RejectResp.actionStatus, $t3RejectResp.tier) -ForegroundColor Red
        exit 1
    }

    # Step 11: Tier 4 Dispatch (volume_spike_alert) -> alert_only
    $t4Body = @{
        actionType   = "volume_spike_alert"
        action       = "Flag abnormal transaction surge"
        reason       = "Surge: 500 transactions detected within 3 minutes"
        inputPayload = @{
            secretMarker  = "ZZ-MARKER-SECRET-12345"
            anomalyScore  = 0.98
            windowMinutes = 3
        }
    }
    $t4Resp = Invoke-ApiStep -StepNumber "11" -Method "POST" -Path "/api/tenant/agent-actions/test-dispatch" `
        -Headers $authHeaders -Body $t4Body -ExpectedStatus 200 -Description "Dispatch Tier 4 action (volume_spike_alert)"
    $actionIdT4 = $t4Resp.actionId

    if ([string]::IsNullOrWhiteSpace($actionIdT4) -or $t4Resp.actionStatus -ne "alert_only" -or $t4Resp.tier -ne 4) {
        Write-Host ("[FATAL] Step 11 assertion failed: expected non-empty actionId, actionStatus 'alert_only', tier 4. Got actionId='{0}', actionStatus='{1}', tier={2}" -f `
            $actionIdT4, $t4Resp.actionStatus, $t4Resp.tier) -ForegroundColor Red
        exit 1
    }

    # --------------------------------------------------------------------------
    # Step 12: Approve Tier 3 Action #1
    # --------------------------------------------------------------------------
    $approveBody = @{
        reason = "Verified Q3 CBSL figures against general ledger; approved for submission"
    }
    $approveResp = Invoke-ApiStep -StepNumber "12" -Method "POST" -Path "/api/tenant/agent-actions/$actionIdT3Approve/approve" `
        -Headers $authHeaders -Body $approveBody -ExpectedStatus 200 -Description "Approve Tier 3 action #1"

    if ($approveResp.actionStatus -ne "executed") {
        Write-Host ("[FATAL] Step 12 assertion failed: expected actionStatus 'executed', got '{0}'" -f $approveResp.actionStatus) -ForegroundColor Red
        exit 1
    }

    # --------------------------------------------------------------------------
    # Step 13: Reject Tier 3 Action #2
    # --------------------------------------------------------------------------
    $rejectBody = @{
        reason = "Ad-hoc liquidity numbers contain unverified entries; rejected for revision"
    }
    $rejectResp = Invoke-ApiStep -StepNumber "13" -Method "POST" -Path "/api/tenant/agent-actions/$actionIdT3Reject/reject" `
        -Headers $authHeaders -Body $rejectBody -ExpectedStatus 200 -Description "Reject Tier 3 action #2"

    if ($rejectResp.actionStatus -ne "rejected") {
        Write-Host ("[FATAL] Step 13 assertion failed: expected actionStatus 'rejected', got '{0}'" -f $rejectResp.actionStatus) -ForegroundColor Red
        exit 1
    }

    # --------------------------------------------------------------------------
    # Step 14: Try to Approve the Rejected Action (Expect HTTP 409 Conflict)
    # --------------------------------------------------------------------------
    $illegalApproveBody = @{
        reason = "Attempting illegal approve on previously rejected regulatory action"
    }
    $null = Invoke-ApiStep -StepNumber "14" -Method "POST" -Path "/api/tenant/agent-actions/$actionIdT3Reject/approve" `
        -Headers $authHeaders -Body $illegalApproveBody -ExpectedStatus 409 -Description "Refuse approval of rejected Tier 3 action (HTTP 409)"

    # --------------------------------------------------------------------------
    # Step 15: Override the Tier 1 Action
    # --------------------------------------------------------------------------
    $overrideBody = @{
        reason = "Customer repayment dispute received; manual loan officer recalculation required"
    }
    $overrideResp = Invoke-ApiStep -StepNumber "15" -Method "POST" -Path "/api/tenant/agent-actions/$actionIdT1/override" `
        -Headers $authHeaders -Body $overrideBody -ExpectedStatus 200 -Description "Human override of executed Tier 1 action"

    if ($overrideResp.status -ne "ok") {
        Write-Host ("[FATAL] Step 15 assertion failed: expected status 'ok', got '{0}'" -f $overrideResp.status) -ForegroundColor Red
        exit 1
    }

    # --------------------------------------------------------------------------
    # Step 16: GET Override-Rates Metrics
    # --------------------------------------------------------------------------
    $metricsResp = Invoke-ApiStep -StepNumber "16" -Method "GET" -Path "/api/tenant/agent-actions/metrics/override-rates" `
        -Headers $authHeaders -ExpectedStatus 200 -Description "Query override rate metrics"

    $metricsData  = $metricsResp.data
    $totalActions = $metricsData.totalActions
    $isCapped     = $metricsData.capped
    $t3Decided    = $metricsData.tiers.tier3.decided
    $t3Approved   = $metricsData.tiers.tier3.approved
    $t3Rejected   = $metricsData.tiers.tier3.rejected

    Write-Host ("       Metrics: totalActions={0}, capped={1}, tier3.decided={2}, tier3.approved={3}, tier3.rejected={4}" -f `
        $totalActions, $isCapped, $t3Decided, $t3Approved, $t3Rejected) -ForegroundColor Cyan

    if ($totalActions -ne 5 -or $isCapped -ne $false -or $t3Decided -ne 2 -or $t3Approved -ne 1 -or $t3Rejected -ne 1) {
        Write-Host ("[FATAL] Step 16 assertion failed! Expected totalActions=5, capped=false, tier3.decided=2, tier3.approved=1, tier3.rejected=1. Got: totalActions={0}, capped={1}, tier3.decided={2}, tier3.approved={3}, tier3.rejected={4}" -f `
            $totalActions, $isCapped, $t3Decided, $t3Approved, $t3Rejected) -ForegroundColor Red
        exit 1
    }

    # --------------------------------------------------------------------------
    # Step 17: GET /api/tenant/agent-actions & Verify Lightweight Projection
    # --------------------------------------------------------------------------
    $listResp = Invoke-ApiStep -StepNumber "17" -Method "GET" -Path "/api/tenant/agent-actions?limit=10" `
        -Headers $authHeaders -ExpectedStatus 200 -Description "List agent actions and verify lightweight projection"

    $actionsList = @($listResp.data)
    if ($actionsList.Count -eq 0) {
        Write-Host "[FATAL] Step 17: Expected at least 1 agent action in list, got 0" -ForegroundColor Red
        exit 1
    }

    foreach ($item in $actionsList) {
        $propNames = @($item.PSObject.Properties.Name)
        if ($propNames -contains "inputPayload") {
            Write-Host ("[FATAL] Step 17: Action {0} leaked 'inputPayload' property!" -f $item.id) -ForegroundColor Red
            exit 1
        }
        if ($propNames -contains "outputPayload") {
            Write-Host ("[FATAL] Step 17: Action {0} leaked 'outputPayload' property!" -f $item.id) -ForegroundColor Red
            exit 1
        }
    }
    Write-Host ("       Projection Verified: All {0} actions strictly omit inputPayload and outputPayload properties." -f $actionsList.Count) -ForegroundColor Green

    # --------------------------------------------------------------------------
    # Summary Table
    # --------------------------------------------------------------------------
    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Cyan
    Write-Host "E2E VERIFICATION COMPLETE: ALL STEPS PASSED" -ForegroundColor Cyan
    Write-Host "==================================================================" -ForegroundColor Cyan
    Write-Host ""
    $stepResults | Format-Table -Property Step, Method, Path, Expected, Actual, Status, Description -AutoSize

}
finally {
    # Strictly wipe plain-text password from memory
    if ($null -ne $plainPassword) {
        $plainPassword = $null
    }
    $securePassword = $null
    [System.GC]::Collect()
}
