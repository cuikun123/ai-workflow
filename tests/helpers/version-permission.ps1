param([Parameter(Mandatory=$true)][string]$Target)
$ErrorActionPreference = 'Stop'
$original = Get-Acl -LiteralPath $Target
$originalSddl = $original.GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]::Access)
$parentPath = [System.IO.Path]::GetDirectoryName($Target)
$parentOriginal = Get-Acl -LiteralPath $parentPath
$parentSddl = $parentOriginal.GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]::Access)
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, [System.Security.AccessControl.FileSystemRights]::Delete, [System.Security.AccessControl.AccessControlType]::Deny)
$restricted = Get-Acl -LiteralPath $Target
$restricted.AddAccessRule($rule)
Set-Acl -LiteralPath $Target -AclObject $restricted
$parentRule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, ([System.Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor [System.Security.AccessControl.FileSystemRights]::CreateFiles), [System.Security.AccessControl.AccessControlType]::Deny)
$parentRestricted = Get-Acl -LiteralPath $parentPath
$parentRestricted.AddAccessRule($parentRule)
Set-Acl -LiteralPath $parentPath -AclObject $parentRestricted
try {
  [Console]::WriteLine('DELETE_DENIED')
  $null = [Console]::In.ReadLine()
} finally {
  $restore = Get-Acl -LiteralPath $Target
  $restore.RemoveAccessRuleSpecific($rule)
  Set-Acl -LiteralPath $Target -AclObject $restore
  $parentRestore = Get-Acl -LiteralPath $parentPath
  $parentRestore.RemoveAccessRuleSpecific($parentRule)
  Set-Acl -LiteralPath $parentPath -AclObject $parentRestore
  $final = Get-Acl -LiteralPath $Target
  if ($final.GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]::Access) -ne $originalSddl) { throw 'Test permission did not restore original DACL' }
  $parentFinal = Get-Acl -LiteralPath $parentPath
  if ($parentFinal.GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]::Access) -ne $parentSddl) { throw 'Parent directory DACL was not restored' }
  [Console]::WriteLine('DACL_RESTORED')
}
