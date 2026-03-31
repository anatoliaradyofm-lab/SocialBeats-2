$fp = 'C:\Users\user\Desktop\PROJE\MobilePreview.html'
$c = Get-Content $fp -Raw -Encoding UTF8
"Loaded $($c.Length) chars" | Out-File -FilePath 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt' -Encoding UTF8

$fixes = @()

# FIX 1a: MiniPlayer signature
$old = '({track, isPlaying, onToggle, onClose, onExpand, onPrev, onNext})'
$new = '({track, isPlaying, onToggle, onClose, onExpand, onPrev, onNext, progress})'
if ($c.Contains($old)) { $c = $c.Replace($old, $new); $fixes += 'FIX1a: MiniPlayer sig' }
else { "NOT FOUND: FIX1a: $old" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt' }

# FIX 1b: MiniPlayer progress bar static 37%
$old = "style={{height:2,width:'37%',background:`$`"+"linear-gradient(90deg,`${A.primaryDeep},`${A.primary})`",borderRadius:1}}/>"
# Use a simpler search - find width:'37%' in context of MiniPlayer (height:2)
$old = "height:2,width:'37%',background:"
if ($c.Contains($old)) {
    $idx = $c.IndexOf($old)
    "Found height:2,width:37% at $idx" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
}

# Search for all occurrences of 37%
$idxAll = @()
$startSearch = 0
while ($true) {
    $idx = $c.IndexOf("'37%'", $startSearch)
    if ($idx -eq -1) { break }
    $idxAll += $idx
    $startSearch = $idx + 1
}
"37% occurrences at: $($idxAll -join ', ')" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
foreach ($idx in $idxAll) {
    $ctx = $c.Substring([Math]::Max(0,$idx-80), [Math]::Min(200, $c.Length - [Math]::Max(0,$idx-80)))
    "  ctx: $($ctx.Substring(0,[Math]::Min(150,$ctx.Length)))" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
}

# FIX 2a: FullPlayerScreen signature
$old = '({track, isPlaying, onClose, onToggle, onPrev, onNext, onShare})'
$new = '({track, isPlaying, onClose, onToggle, onPrev, onNext, onShare, progress, posMs, fmtTime})'
if ($c.Contains($old)) { $c = $c.Replace($old, $new); $fixes += 'FIX2a: FullPlayer sig' }
else { "NOT FOUND: FIX2a" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt' }

# Find '1:24' context
$idx124 = $c.IndexOf("'1:24'")
if ($idx124 -ne -1) {
    "Found 1:24 at $idx124, ctx: $($c.Substring([Math]::Max(0,$idx124-50),[Math]::Min(150,$c.Length-[Math]::Max(0,$idx124-50))))" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
}

# Find '3:53' context
$idx353 = $c.IndexOf("'3:53'")
if ($idx353 -ne -1) {
    "Found 3:53 at $idx353, ctx: $($c.Substring([Math]::Max(0,$idx353-50),[Math]::Min(150,$c.Length-[Math]::Max(0,$idx353-50))))" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
}

# Find MiniPlayer render (onPrev/onNext)
$idxPP = $c.IndexOf("onPrev={playPrev}")
if ($idxPP -ne -1) {
    "Found onPrev at $idxPP, ctx: $($c.Substring([Math]::Max(0,$idxPP-100),[Math]::Min(200,$c.Length-[Math]::Max(0,$idxPP-100))))" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
}

# Find FullPlayer render (onShare)
$idxShare = $c.IndexOf("onShare={()=>{const u=")
if ($idxShare -ne -1) {
    "Found onShare at $idxShare, ctx: $($c.Substring([Math]::Max(0,$idxShare-50),[Math]::Min(300,$c.Length-[Math]::Max(0,$idxShare-50))))" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
}

# Find settingPage
$idxSP = $c.IndexOf("if (type === 'settingPage')")
if ($idxSP -eq -1) { $idxSP = $c.IndexOf("type === 'settingPage'") }
"settingPage at: $idxSP" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
if ($idxSP -ne -1) {
    $spCtx = $c.Substring($idxSP, [Math]::Min(500, $c.Length - $idxSP))
    "settingPage ctx: $spCtx" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
}

# Find story useState
$idxSi = $c.IndexOf("const [si, setSi] = useState(initIdx||0);")
"story si at: $idxSi" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'

# Find playlist type
$idxPl = $c.IndexOf("type === 'playlist'")
"playlist at: $idxPl" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'

# Find Dil item
$idxDil = $c.IndexOf("label:'Dil'")
"Dil at: $idxDil" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
if ($idxDil -ne -1) {
    $dilCtx = $c.Substring([Math]::Max(0,$idxDil-10), [Math]::Min(80, $c.Length - [Math]::Max(0,$idxDil-10)))
    "Dil ctx: $dilCtx" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
}

# Find return null
$idxRN = $c.LastIndexOf("return null;")
"return null (last) at: $idxRN" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'

"Applied fixes: $($fixes -join ', ')" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
"Done diagnostic" | Add-Content 'C:\Users\user\Desktop\PROJE\.emergent\diag.txt'
