param([Parameter(Mandatory=$true)][string]$Target)
$stream = [System.IO.File]::Open($Target, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
try {
  [Console]::WriteLine('FILE_LOCKED')
  $null = [Console]::In.ReadLine()
} finally {
  $stream.Dispose()
}
