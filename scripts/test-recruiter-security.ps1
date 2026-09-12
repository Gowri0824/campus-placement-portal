param(
    [switch]$IncludeMigration,
    [ValidateSet('company', 'applicants', 'decisions')][string]$Suite = 'company'
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testName = if ($Suite -in @('applicants', 'decisions')) { 'recruiter_applicant_security' } else { 'recruiter_company_security' }
$migrationVersion = if ($Suite -eq 'applicants') { '20260908150000' } else { '20260908120000' }
$migrationName = if ($Suite -eq 'decisions') { '20260912120000_recruiter_applicant_decisions' } else { "${migrationVersion}_$testName" }
$tests = Get-Content -Raw -LiteralPath (Join-Path $root "supabase/tests/$testName.sql")
$sql = $tests

if ($IncludeMigration) {
    $migration = Get-Content -Raw -LiteralPath (Join-Path $root "supabase/migrations/$migrationName.sql")
    if ([regex]::Matches($migration, '(?m)^commit;\r?$').Count -ne 1 -or
        [regex]::Matches($tests, '(?m)^begin;\r?$').Count -ne 1 -or
        [regex]::Matches($tests, '(?m)^rollback;\r?$').Count -ne 1) {
        throw 'Unexpected transaction boundaries; refusing to assemble a migration dry run.'
    }
    $sql = ($migration -replace '(?m)^commit;\r?$', '') + "`n" + ($tests -replace '(?m)^begin;\r?$', '')
}

# The generated file is never a migration and never enters the worktree.
$temporaryFile = New-TemporaryFile
try {
    Set-Content -LiteralPath $temporaryFile.FullName -Value $sql -Encoding utf8
    & npx --yes --fetch-timeout=30000 --fetch-retries=0 supabase db query --linked --workdir $root --file $temporaryFile.FullName --output json
    $result = $LASTEXITCODE
} finally {
    Remove-Item -LiteralPath $temporaryFile.FullName
}
exit $result
