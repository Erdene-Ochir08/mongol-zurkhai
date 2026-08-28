$port = 8080
$prefix = "http://127.0.0.1:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

# Load environment variables from .env.local or .env
$envPath = Join-Path $PSScriptRoot ".env.local"
if (-not (Test-Path $envPath)) {
    $envPath = Join-Path $PSScriptRoot ".env"
}

$envVars = @{
    "QPAY_USERNAME"     = "MONGOL_ZURKHAI"
    "QPAY_PASSWORD"     = ""
    "QPAY_INVOICE_CODE" = "MONGOL_ZURKHAI_INVOICE"
    "QPAY_BASE_URL"     = "https://merchant.qpay.mn"
}

if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $envVars[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
}

# Cache QPay token locally
$script:cachedToken = $null
$script:tokenExpiresAt = 0

function Get-LocalQPayToken {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($script:cachedToken -and $now -lt ($script:tokenExpiresAt - 60000)) {
        return $script:cachedToken
    }

    $username = $envVars["QPAY_USERNAME"]
    $password = $envVars["QPAY_PASSWORD"]
    $baseUrl  = $envVars["QPAY_BASE_URL"]

    if (-not $password -or $password -eq "your_qpay_password_here") {
        return $null
    }

    $authStr = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$($username):$($password)"))
    $headers = @{
        "Authorization" = "Basic $authStr"
        "Content-Type"  = "application/json"
    }

    try {
        $authRes = Invoke-RestMethod -Uri "$baseUrl/v2/auth/token" -Method Post -Headers $headers -TimeoutSec 10
        $script:cachedToken = $authRes.access_token
        $expiresIn = if ($authRes.expires_in) { [int]$authRes.expires_in } else { 3600 }
        $script:tokenExpiresAt = $now + ($expiresIn * 1000)
        return $script:cachedToken
    } catch {
        Write-Host "QPay Auth Error: $_" -ForegroundColor Red
        return $null
    }
}

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " Mongol Zurkhai Сервер & QPay API амжилттай аслаа!" -ForegroundColor Green
    Write-Host " Вэб хаяг: $prefix" -ForegroundColor Yellow
    if ($envVars["QPAY_PASSWORD"] -and $envVars["QPAY_PASSWORD"] -ne "your_qpay_password_here") {
        Write-Host " QPay горим: БОДИТ ХОЛБОЛТ (Live Merchant)" -ForegroundColor Green
    } else {
        Write-Host " QPay горим: ТЕСТ / ДУУРАЙМАЛ (.env.local-д нууц үг хийнэ)" -ForegroundColor DarkYellow
    }
    Write-Host " Серверийг зогсоох бол энэ цонхыг хаана уу." -ForegroundColor Gray
    Write-Host "==========================================================" -ForegroundColor Cyan

    $root = $PSScriptRoot
    if (-not $root) { $root = Get-Location }

    $mimeTypes = @{
        ".html" = "text/html; charset=utf-8"
        ".htm"  = "text/html; charset=utf-8"
        ".js"   = "application/javascript; charset=utf-8"
        ".css"  = "text/css; charset=utf-8"
        ".json" = "application/json; charset=utf-8"
        ".png"  = "image/png"
        ".jpg"  = "image/jpeg"
        ".jpeg" = "image/jpeg"
        ".svg"  = "image/svg+xml"
        ".mp4"  = "video/mp4"
        ".mp3"  = "audio/mpeg"
        ".ico"  = "image/x-icon"
    }

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS Headers
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)

        # ----------------------------------------------------
        # 1. API: /api/qpay/create-invoice
        # ----------------------------------------------------
        if ($urlPath -eq "/api/qpay/create-invoice") {
            $response.ContentType = "application/json; charset=utf-8"
            $token = Get-LocalQPayToken

            if (-not $token) {
                # Mock response for testing
                $mockId = "MOCK-INV-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                $jsonResponse = @{
                    isMock        = $true
                    message       = "QPAY_PASSWORD тохируулаагүй тул Тест горимоор ажиллаж байна."
                    invoice_id    = $mockId
                    qr_text       = "qpay://mock/$mockId"
                    qr_image      = ""
                    qPay_shortUrl = "https://qpay.mn/mock"
                    urls          = @(
                        @{ name = "Хаан Банк"; description = "Khan Bank"; logo = "https://qpay.mn/qpay_v2/icons/khanbank.png"; link = "#" },
                        @{ name = "SocialPay / Голомт"; description = "SocialPay"; logo = "https://qpay.mn/qpay_v2/icons/socialpay.png"; link = "#" },
                        @{ name = "Хас Банк"; description = "XacBank"; logo = "https://qpay.mn/qpay_v2/icons/xacbank.png"; link = "#" },
                        @{ name = "Төрийн Банк"; description = "State Bank"; logo = "https://qpay.mn/qpay_v2/icons/statebank.png"; link = "#" },
                        @{ name = "ХХБ (TDB)"; description = "TDB"; logo = "https://qpay.mn/qpay_v2/icons/tdb.png"; link = "#" },
                        @{ name = "Most Money"; description = "Most Money"; logo = "https://qpay.mn/qpay_v2/icons/mostmoney.png"; link = "#" },
                        @{ name = "М Банк"; description = "M Bank"; logo = "https://qpay.mn/qpay_v2/icons/mbank.png"; link = "#" }
                    )
                } | ConvertTo-Json -Depth 5
            } else {
                # Live QPay Invoice Creation
                $baseUrl = $envVars["QPAY_BASE_URL"]
                $invoiceCode = $envVars["QPAY_INVOICE_CODE"]
                $senderInvoiceNo = "MZ-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + "-" + (Get-Random -Minimum 100 -Maximum 999)

                $body = @{
                    invoice_code          = $invoiceCode
                    sender_invoice_no     = $senderInvoiceNo
                    invoice_receiver_code = "terminal"
                    invoice_description   = "Монгол Зурхай - 4 бүлэг нээх эрх"
                    amount                = 9900
                    callback_url          = "http://127.0.0.1:$port/api/qpay/callback?inv=$senderInvoiceNo"
                } | ConvertTo-Json

                $headers = @{
                    "Authorization" = "Bearer $token"
                    "Content-Type"  = "application/json"
                }

                try {
                    $qpayRes = Invoke-RestMethod -Uri "$baseUrl/v2/invoice" -Method Post -Headers $headers -Body $body -TimeoutSec 10
                    $jsonResponse = @{
                        success       = $true
                        invoice_id    = $qpayRes.invoice_id
                        qr_text       = $qpayRes.qr_text
                        qr_image      = $qpayRes.qr_image
                        qPay_shortUrl = $qpayRes.qPay_shortUrl
                        urls          = $qpayRes.urls
                    } | ConvertTo-Json -Depth 5
                } catch {
                    $response.StatusCode = 500
                    $jsonResponse = @{ error = "Failed to create QPay invoice"; details = $_.ToString() } | ConvertTo-Json
                }
            }

            $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonResponse)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # ----------------------------------------------------
        # 2. API: /api/qpay/check-payment
        # ----------------------------------------------------
        if ($urlPath -eq "/api/qpay/check-payment") {
            $response.ContentType = "application/json; charset=utf-8"
            $invoiceId = $request.QueryString["invoice_id"]
            $token = Get-LocalQPayToken

            if (-not $token -or $invoiceId -like "MOCK-INV-*") {
                $jsonResponse = @{ paid = $false; isMock = $true } | ConvertTo-Json
            } else {
                $baseUrl = $envVars["QPAY_BASE_URL"]
                $headers = @{
                    "Authorization" = "Bearer $token"
                    "Content-Type"  = "application/json"
                }
                $body = @{
                    object_type = "INVOICE"
                    object_id   = $invoiceId
                    offset      = @{ page_number = 1; page_limit = 10 }
                } | ConvertTo-Json

                try {
                    $checkRes = Invoke-RestMethod -Uri "$baseUrl/v2/payment/check" -Method Post -Headers $headers -Body $body -TimeoutSec 10
                    $isPaid = ($checkRes.count -gt 0 -and $checkRes.paid_amount -gt 0)
                    $jsonResponse = @{
                        paid        = $isPaid
                        count       = $checkRes.count
                        paid_amount = $checkRes.paid_amount
                        rows        = $checkRes.rows
                    } | ConvertTo-Json -Depth 5
                } catch {
                    $jsonResponse = @{ paid = $false; error = $_.ToString() } | ConvertTo-Json
                }
            }

            $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonResponse)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # ----------------------------------------------------
        # 3. Static Files
        # ----------------------------------------------------
        if ($urlPath -eq "/" -or [string]::IsNullOrEmpty($urlPath)) {
            $urlPath = "/index.html"
        }

        $localFilePath = Join-Path $root ($urlPath.TrimStart('/').Replace('/', '\'))

        if (Test-Path $localFilePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localFilePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $response.ContentType = $contentType
            
            $bytes = [System.IO.File]::ReadAllBytes($localFilePath)
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}