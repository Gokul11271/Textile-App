
$items = Get-ChildItem -Path . -Directory
foreach ($item in $items) {
    $size = (Get-ChildItem -Path $item.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Output ("{0,10:N2} MB  {1}" -f $size, $item.Name)
}
