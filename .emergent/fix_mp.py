#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, re, os

fp = 'C:/Users/user/Desktop/PROJE/MobilePreview.html'
log_fp = 'C:/Users/user/Desktop/PROJE/.emergent/fix_log.txt'

log_lines = []
def log(msg):
    log_lines.append(str(msg))

try:
    with open(fp, 'r', encoding='utf-8') as f:
        c = f.read()
    log(f"Loaded {len(c)} chars, {c.count(chr(10))} lines")
except Exception as e:
    log(f"ERROR loading: {e}")
    with open(log_fp, 'w') as lf: lf.write('\n'.join(log_lines))
    sys.exit(1)

fixes = []

# ==================== FIX 1a: MiniPlayer signature ====================
old = '({track, isPlaying, onToggle, onClose, onExpand, onPrev, onNext})'
new = '({track, isPlaying, onToggle, onClose, onExpand, onPrev, onNext, progress})'
cnt = c.count(old)
log(f"FIX1a: pattern count={cnt}")
if cnt > 0:
    c = c.replace(old, new, 1)
    fixes.append('FIX1a: MiniPlayer sig updated')
else:
    # Try to find similar patterns
    for variant in ['onPrev, onNext})', 'onExpand, onPrev']:
        idx = c.find(variant)
        if idx != -1:
            log(f"  Found variant {variant!r} at {idx}, ctx len: nearby 80 chars")

# ==================== FIX 1b: MiniPlayer 37% progress bar ====================
# Find the MiniPlayer function and its 37% bar
idx_mini = c.find('function MiniPlayer(')
if idx_mini == -1:
    idx_mini = c.find('MiniPlayer = (')
    if idx_mini == -1:
        idx_mini = c.find('const MiniPlayer')
log(f"FIX1b: MiniPlayer function at {idx_mini}")

# Find '37%' occurrences
idxs_37 = []
s = 0
while True:
    idx = c.find("'37%'", s)
    if idx == -1: break
    idxs_37.append(idx)
    s = idx + 1
log(f"FIX1b: 37% occurrences at: {idxs_37}")

for idx in idxs_37:
    ctx = c[max(0,idx-100):idx+150]
    log(f"  37% context (no angle brackets shown): {repr(ctx[:80]).replace('<','LT').replace('>','GT')}")

# The first 37% occurrence (at lesser index) should be in MiniPlayer (height:2)
# The second should be in FullPlayer (height:4)
# Replace height:2 version
old1b = "height:2,width:'37%',background:`linear-gradient(90deg,${A.primaryDeep},${A.primary})`,borderRadius:1}}/>"
new1b = "height:2,width:`${Math.round((progress||0)*100)}%`,background:`linear-gradient(90deg,${A.primaryDeep},${A.primary})`,borderRadius:1,transition:'width 0.5s linear'}}/>"
cnt1b = c.count(old1b)
log(f"FIX1b exact: count={cnt1b}")
if cnt1b > 0:
    c = c.replace(old1b, new1b, 1)
    fixes.append('FIX1b: MiniPlayer 37% -> progress')
else:
    # Try simpler pattern
    old1b2 = "height:2,width:'37%'"
    cnt1b2 = c.count(old1b2)
    log(f"FIX1b simple: count={cnt1b2}")
    if cnt1b2 > 0:
        c = c.replace(old1b2, "height:2,width:`${Math.round((progress||0)*100)}%`", 1)
        fixes.append('FIX1b: MiniPlayer 37% (simple) -> progress')

# ==================== FIX 2a: FullPlayerScreen signature ====================
old2a = '({track, isPlaying, onClose, onToggle, onPrev, onNext, onShare})'
new2a = '({track, isPlaying, onClose, onToggle, onPrev, onNext, onShare, progress, posMs, fmtTime})'
cnt2a = c.count(old2a)
log(f"FIX2a: count={cnt2a}")
if cnt2a > 0:
    c = c.replace(old2a, new2a, 1)
    fixes.append('FIX2a: FullPlayerScreen sig')
else:
    log(f"  Not found, checking variations...")

# ==================== FIX 2b: FullPlayer 37% progress bar ====================
# After FIX1b, the remaining 37% should be in FullPlayer
old2b = "height:4,width:'37%'"
cnt2b = c.count(old2b)
log(f"FIX2b height:4 37%: count={cnt2b}")
if cnt2b > 0:
    c = c.replace(old2b, "height:4,width:`${Math.round((progress||0)*100)}%`", 1)
    fixes.append('FIX2b: FullPlayer 37% -> progress')
else:
    # Try any remaining 37%
    cnt_rem = c.count("'37%'")
    log(f"FIX2b: remaining 37% count={cnt_rem}")
    if cnt_rem > 0:
        c = c.replace("width:'37%'", "width:`${Math.round((progress||0)*100)}%`", 1)
        fixes.append('FIX2b: FullPlayer 37% (fallback) -> progress')

# ==================== FIX 2c: Time '1:24' ====================
old2c = "'1:24'"
cnt2c = c.count(old2c)
log(f"FIX2c 1:24: count={cnt2c}")
if cnt2c > 0:
    c = c.replace(old2c, "{fmtTime&&fmtTime(posMs||0)}", 1)
    fixes.append('FIX2c: 1:24 -> fmtTime(posMs)')

# ==================== FIX 2d: Time '3:53' ====================
old2d = "'3:53'"
cnt2d = c.count(old2d)
log(f"FIX2d 3:53: count={cnt2d}")
if cnt2d > 0:
    c = c.replace(old2d, "{track.dur||'3:53'}", 1)
    fixes.append('FIX2d: 3:53 -> track.dur')

# ==================== FIX 3a: Pass progress to MiniPlayer render ====================
# Find onPrev={playPrev} onNext={playNext} in render
patterns_3a = [
    ("onPrev={playPrev} onNext={playNext}/>", "onPrev={playPrev} onNext={playNext} progress={progress}/>"),
    ("onPrev={playPrev} onNext={playNext} />", "onPrev={playPrev} onNext={playNext} progress={progress} />"),
]
found3a = False
for old, new in patterns_3a:
    cnt = c.count(old)
    log(f"FIX3a: {old!r[:50]} count={cnt}")
    if cnt > 0:
        c = c.replace(old, new, 1)
        fixes.append('FIX3a: progress passed to MiniPlayer')
        found3a = True
        break
if not found3a:
    log("FIX3a: not found any pattern")

# ==================== FIX 3b: Pass progress/posMs/fmtTime to FullPlayer render ====================
# Find the FullPlayerScreen render closing tag
# Pattern: after onShare={...} there should be a />
# Try different patterns for the closing
old3b_patterns = [
    "navigator.clipboard.writeText(u);}}/>"
]
found3b = False
for old3b in old3b_patterns:
    cnt = c.count(old3b)
    log(f"FIX3b: {old3b!r[:50]} count={cnt}")
    if cnt > 0:
        new3b = old3b.replace("/>", " progress={progress} posMs={posMs} fmtTime={fmtTime}/>")
        c = c.replace(old3b, new3b, 1)
        fixes.append('FIX3b: progress/posMs/fmtTime passed to FullPlayer')
        found3b = True
        break
if not found3b:
    # Try looking for the FullPlayerScreen component usage and its closing
    idx_fps_use = c.find('isPlaying={isPlaying}')
    if idx_fps_use != -1:
        log(f"FIX3b: found isPlaying= at {idx_fps_use}")

# ==================== FIX 4: Settings toggles - make functional ====================
old4_marker = "if (type === 'settingPage') {"
idx_sp = c.find(old4_marker)
log(f"FIX4: settingPage at {idx_sp}")

if idx_sp != -1:
    # Find the next if (type === block to know where this block ends
    idx_next = c.find("if (type === '", idx_sp + len(old4_marker))
    log(f"FIX4: next type check at {idx_next}")

    if idx_next == -1:
        # Find return null; as fallback
        idx_rn = c.find("return null;", idx_sp)
        log(f"FIX4: return null at {idx_rn}")
        end_idx = idx_rn
    else:
        end_idx = idx_next

    if end_idx != -1:
        old4_block = c[idx_sp:end_idx]
        log(f"FIX4: block len={len(old4_block)}, starts={old4_block[:50].replace(chr(60),'LT')}")

        new4_block = """if (type === 'settingPage') {
  const {title, items: pageItems} = data;
  const [toggleStates, setToggleStates] = useState(() => {
    const s = {};
    pageItems.forEach((item, i) => { if (item.toggle !== undefined) s[i] = item.toggle; });
    return s;
  });
  const flipToggle = i => setToggleStates(p => ({...p, [i]: !p[i]}));
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [selectedLang, setSelectedLang] = useState('tr');
  if (showLangPicker) {
    const filteredLangs = LANGUAGES.filter(l => l.name.toLowerCase().includes(langSearch.toLowerCase()) || l.code.includes(langSearch.toLowerCase()));
    return (
      <Backdrop full>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'52px 20px 16px',borderBottom:`1px solid ${A.border}`,flexShrink:0}}>
          <button onClick={()=>setShowLangPicker(false)} style={{background:A.surface,border:`1px solid ${A.border}`,borderRadius:'50%',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Ico n="back" s={16} c={A.textSec}/>
          </button>
          <div style={{flex:1,color:A.text,fontSize:18,fontWeight:800,letterSpacing:-0.5}}>Dil Se\u00e7imi</div>
          <button onClick={()=>setShowLangPicker(false)} style={{color:A.primary,fontWeight:700,fontSize:15,background:'none',border:'none',cursor:'pointer'}}>Tamam</button>
        </div>
        <div style={{padding:'12px 20px',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10,background:A.inputBg,borderRadius:12,border:`1px solid ${A.border}`,padding:'10px 14px'}}>
            <Ico n="search" s={16} c={A.textMut}/>
            <input value={langSearch} onChange={e=>setLangSearch(e.target.value)} placeholder="Dil ara..."
              style={{flex:1,background:'none',border:'none',outline:'none',color:A.text,fontSize:14}}/>
          </div>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'0 20px 16px'}}>
          {filteredLangs.map(l => (
            <div key={l.code} onClick={()=>setSelectedLang(l.code)}
              style={{display:'flex',alignItems:'center',gap:14,padding:'13px 16px',borderRadius:12,cursor:'pointer',marginBottom:4,
                background:selectedLang===l.code?A.primaryGlow:'transparent',
                border:`1px solid ${selectedLang===l.code?A.primary:A.borderLight}`}}>
              <span style={{fontSize:22}}>{l.flag}</span>
              <span style={{color:A.text,fontSize:15,fontWeight:selectedLang===l.code?700:500,flex:1}}>{l.name}</span>
              {selectedLang===l.code && <Ico n="heart" s={18} c={A.primary}/>}
            </div>
          ))}
        </div>
      </Backdrop>
    );
  }
  return (
    <Backdrop full>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'52px 20px 16px',borderBottom:`1px solid ${A.border}`,flexShrink:0}}>
        <button onClick={onClose} style={{background:A.surface,border:`1px solid ${A.border}`,borderRadius:'50%',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Ico n="back" s={16} c={A.textSec}/>
        </button>
        <div style={{color:A.text,fontSize:18,fontWeight:800,letterSpacing:-0.5}}>{title}</div>
      </div>
      <div style={{overflowY:'auto',padding:'12px 20px',display:'flex',flexDirection:'column',gap:8}}>
        {pageItems.map((item,i)=>{
          const isToggle = item.toggle !== undefined;
          const togVal = isToggle ? (toggleStates[i] !== undefined ? toggleStates[i] : item.toggle) : false;
          return (
            <div key={i} onClick={isToggle?()=>flipToggle(i):item.isLang?()=>setShowLangPicker(true):undefined}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',
                background:A.card,borderRadius:14,border:`1px solid ${A.border}`,cursor:isToggle||item.isLang?'pointer':'default'}}>
              <span style={{color:A.text,fontSize:14,fontWeight:600}}>{item.label}</span>
              {isToggle
                ? <div style={{width:46,height:26,borderRadius:13,background:togVal?A.primary:A.borderLight,position:'relative',transition:'background 0.25s',flexShrink:0}}>
                    <div style={{position:'absolute',top:3,left:togVal?23:3,width:20,height:20,borderRadius:10,background:'#fff',transition:'left 0.25s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
                  </div>
                : <span style={{color:A.textMut,fontSize:13}}>{item.val||'\u203a'}</span>}
            </div>
          );
        })}
      </div>
    </Backdrop>
  );
}
"""
        c = c[:idx_sp] + new4_block + "\n  " + c[end_idx:]
        fixes.append('FIX4: Settings toggles made functional with lang picker')
    else:
        log("FIX4: Could not find block boundary")
else:
    log("FIX4: settingPage not found")

# ==================== FIX 5: Language modal (standalone in ModalSystem) ====================
# Add language modal BEFORE the final return null
new5_block = """if (type === 'language') {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(data.current || 'tr');
  const filtered = LANGUAGES.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.code.includes(search.toLowerCase()));
  return (
    <Backdrop full>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'52px 20px 16px',borderBottom:`1px solid ${A.border}`,flexShrink:0}}>
        <button onClick={onClose} style={{background:A.surface,border:`1px solid ${A.border}`,borderRadius:'50%',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Ico n="back" s={16} c={A.textSec}/>
        </button>
        <div style={{flex:1,color:A.text,fontSize:18,fontWeight:800,letterSpacing:-0.5}}>Dil Se\u00e7imi</div>
        <button onClick={()=>{data.onSelect&&data.onSelect(selected);onClose();}}
          style={{color:A.primary,fontWeight:700,fontSize:15,background:'none',border:'none',cursor:'pointer'}}>Tamam</button>
      </div>
      <div style={{padding:'12px 20px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,background:A.inputBg,borderRadius:12,border:`1px solid ${A.border}`,padding:'10px 14px'}}>
          <Ico n="search" s={16} c={A.textMut}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Dil ara..."
            style={{flex:1,background:'none',border:'none',outline:'none',color:A.text,fontSize:14,fontFamily:"'Inter',system-ui,sans-serif"}}/>
        </div>
      </div>
      <div style={{overflowY:'auto',flex:1,padding:'0 20px 16px'}}>
        {filtered.map(l => (
          <div key={l.code} onClick={()=>setSelected(l.code)}
            style={{display:'flex',alignItems:'center',gap:14,padding:'13px 16px',borderRadius:12,cursor:'pointer',marginBottom:4,
              background:selected===l.code?A.primaryGlow:'transparent',
              border:`1px solid ${selected===l.code?A.primary:A.borderLight}`}}>
            <span style={{fontSize:22}}>{l.flag}</span>
            <span style={{color:A.text,fontSize:15,fontWeight:selected===l.code?700:500,flex:1}}>{l.name}</span>
            {selected===l.code && <Ico n="heart" s={18} c={A.primary}/>}
          </div>
        ))}
      </div>
    </Backdrop>
  );
}
"""
# Insert before last "return null;"
idx_last_rn = c.rfind("return null;")
log(f"FIX5: last return null at {idx_last_rn}")
if idx_last_rn != -1:
    c = c[:idx_last_rn] + new5_block + "\n  " + c[idx_last_rn:]
    fixes.append('FIX5: Language modal added to ModalSystem')

# ==================== FIX 6: Wire Dil item ====================
old6 = "{label:'Dil',val:'T\u00fcrk\u00e7e'}"
new6 = "{label:'Dil',val:'T\u00fcrk\u00e7e',isLang:true}"
cnt6 = c.count(old6)
log(f"FIX6: Dil pattern count={cnt6}")
if cnt6 > 0:
    c = c.replace(old6, new6, 1)
    fixes.append('FIX6: Dil item wired with isLang:true')
else:
    # Try without special chars
    idx_dil = c.find("label:'Dil'")
    log(f"FIX6: label:Dil at {idx_dil}")
    if idx_dil != -1:
        ctx = c[max(0,idx_dil-5):idx_dil+60]
        log(f"  Dil ctx: {ctx.replace(chr(60),'LT').replace(chr(62),'GT')!r}")

# ==================== FIX 7: Playlist play button ====================
idx_pl = c.find("type === 'playlist'")
log(f"FIX7: playlist type at {idx_pl}")
if idx_pl != -1:
    # Search forward within playlist block
    pl_section = c[idx_pl:idx_pl+4000]
    # Find Ico n="play" or similar
    idx_play_ico = pl_section.find('n="play"')
    log(f"FIX7: play ico at {idx_play_ico} within playlist section")
    if idx_play_ico != -1:
        # Find the button start before it
        btn_start = pl_section.rfind('<button', 0, idx_play_ico)
        log(f"FIX7: button start at {btn_start}")
        if btn_start != -1:
            btn_text = pl_section[btn_start:btn_start+200]
            # Check if it has onClick
            btn_end_tag = btn_text.find('>')
            has_onclick = 'onClick' in btn_text[:btn_end_tag] if btn_end_tag != -1 else False
            log(f"FIX7: has onClick={has_onclick}, btn: {btn_text[:100].replace(chr(60),'LT').replace(chr(62),'GT')!r}")
            if not has_onclick:
                # Add onClick before style= in the button tag
                old7 = pl_section[btn_start:btn_start+btn_end_tag+1]
                new7 = old7.replace('<button style=', '<button onClick={()=>{onPlayTrack(TRACKS[0]);onClose();}} style=', 1)
                if new7 != old7:
                    c = c.replace(c[idx_pl + btn_start:idx_pl + btn_start + len(old7)], new7, 1)
                    fixes.append('FIX7: Playlist play button onClick added')
                else:
                    log("FIX7: replace failed")
            else:
                log("FIX7: button already has onClick")
    else:
        log("FIX7: no play icon found in playlist section")
else:
    log("FIX7: playlist type not found")

# ==================== FIX 8: Story auto-advance ====================
old8 = "const [si, setSi] = useState(initIdx||0);"
new8 = """const [si, setSi] = useState(initIdx||0);
  useEffect(() => {
    const t = setTimeout(() => {
      if (si < users.length - 1) setSi(si + 1);
      else onClose();
    }, 4000);
    return () => clearTimeout(t);
  }, [si]);"""
cnt8 = c.count(old8)
log(f"FIX8: story useState count={cnt8}")
if cnt8 > 0:
    c = c.replace(old8, new8, 1)
    fixes.append('FIX8: Story auto-advance timer added')
else:
    log("FIX8: not found, searching for story section...")
    idx_story = c.find("type === 'story'")
    log(f"FIX8: story type at {idx_story}")

# ==================== Write output ====================
log(f"Applied {len(fixes)} fixes: {fixes}")

with open(log_fp, 'w', encoding='utf-8') as lf:
    lf.write('\n'.join(log_lines))

if fixes:
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(c)
    log("File written!")
    with open(log_fp, 'a', encoding='utf-8') as lf:
        lf.write('\nFile written successfully!\n')
else:
    with open(log_fp, 'a', encoding='utf-8') as lf:
        lf.write('\nNo fixes applied - file NOT written\n')

print("SCRIPT_DONE")
