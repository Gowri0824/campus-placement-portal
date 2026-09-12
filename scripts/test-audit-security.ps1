param(
    [switch]$IncludeMigration,
    [ValidateSet('audit', 'company', 'applicants', 'provisioning')][string]$Suite = 'audit'
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$files = @{
    audit = 'privileged_audit_security.sql'
    company = 'recruiter_company_security.sql'
    applicants = 'recruiter_applicant_security.sql'
    provisioning = 'recruiter_invitation_provisioning.sql'
}
$tests = Get-Content -Raw -LiteralPath (Join-Path $root ('supabase/tests/' + $files[$Suite]))
$sql = $tests
if ($IncludeMigration) {
    $migration = Get-Content -Raw -LiteralPath (Join-Path $root 'supabase/migrations/20260912150000_privileged_audit_logs.sql')
    if ([regex]::Matches($migration, '(?m)^commit;\r?$').Count -ne 1 -or
        [regex]::Matches($tests, '(?m)^begin;\r?$').Count -ne 1 -or
        [regex]::Matches($tests, '(?m)^rollback;\r?$').Count -ne 1) {
        throw 'Unexpected transaction boundaries; refusing migration dry run.'
    }
    $sql = ($migration -replace '(?m)^commit;\r?$', '') + "`n" + ($tests -replace '(?m)^begin;\r?$', '')
}
$temporaryFile = New-TemporaryFile
try {
    Set-Content -LiteralPath $temporaryFile.FullName -Value $sql -Encoding utf8
    & npx --offline supabase db query --linked --workdir $root --file $temporaryFile.FullName --output json
    $result = $LASTEXITCODE
} finally {
    Remove-Item -LiteralPath $temporaryFile.FullName
}
exit $result
