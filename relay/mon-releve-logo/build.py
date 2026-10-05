# Rebuilds the kit. Needs: pip install fonttools uharfbuzz cairosvg, and Inter 4.1 (github.com/rsms/inter);
# set REG and SEMI below to Inter-Regular.ttf and Inter-SemiBold.ttf, and OUT to where the kit should go.
import os, cairosvg, uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

BRAND="#173B63"; OUT="/mnt/user-data/outputs/mon-releve-logo"
REG="/home/claude/inter/extras/ttf/Inter-Regular.ttf"; SEMI="/home/claude/inter/extras/ttf/Inter-SemiBold.ttf"
# geometry in a 192 box: (x, y, w, h, r)
LARGE=dict(track=(32,84,128,24,12), fill=(32,84,40,24,12), tick=(78,60,10,72,5))
SMALL=dict(track=(24,76,144,40,20), fill=(24,76,40,40,20), tick=(74,48,16,96,8))

def rr(x,y,w,h,r,fill,op=None):
    o=f' opacity="{op}"' if op is not None else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"{o}/>'

def mark(g, tile, glyph, track_op, rounded=True):
    t=f'<rect width="192" height="192" rx="{44 if rounded else 0}" fill="{tile}"/>' if tile else ''
    return t+rr(*g["track"],glyph,track_op)+rr(*g["fill"],glyph)+rr(*g["tick"],glyph)

def svg(w,h,body,vb=None):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb or f"0 0 {w} {h}"}">{body}</svg>\n'

def words(fs, x0, baseline, color, tracking=-0.01):
    out=[]; x=x0
    for path,text in ((REG,"Mon "),(SEMI,"Relevé")):
        face=hb.Face(hb.Blob.from_file_path(path)); font=hb.Font(face); upm=face.upem
        buf=hb.Buffer(); buf.add_str(text); buf.guess_segment_properties(); hb.shape(font,buf,{"kern":True})
        tt=TTFont(path); gs=tt.getGlyphSet(); order=tt.getGlyphOrder(); s=fs/upm
        for info,pos in zip(buf.glyph_infos,buf.glyph_positions):
            pen=SVGPathPen(gs)
            gs[order[info.codepoint]].draw(TransformPen(pen,(s,0,0,-s,x+pos.x_offset*s,baseline-pos.y_offset*s)))
            c=pen.getCommands()
            if c: out.append(c)
            x+=pos.x_advance*s+tracking*fs
    return f'<path fill="{color}" d="{" ".join(out)}"/>', x

def lockup(tile, glyph, track_op, word_color):
    H=96; s=H/192
    cap=TTFont(SEMI)["OS/2"].sCapHeight/TTFont(SEMI)["head"].unitsPerEm*64
    w,end=words(64, H+28, H/2+cap/2, word_color)
    body=f'<g transform="scale({s})">{mark(LARGE,tile,glyph,track_op)}</g>'+w
    W=round(end+1); return svg(W,H,body)

def write(rel, text):
    p=os.path.join(OUT,rel); os.makedirs(os.path.dirname(p),exist_ok=True); open(p,"w").write(text); return p

def png(rel, svgtext, size):
    p=os.path.join(OUT,rel); os.makedirs(os.path.dirname(p),exist_ok=True)
    cairosvg.svg2png(bytestring=svgtext.encode(),write_to=p,output_width=size,output_height=size)

# ---- web: vector
mark_l=svg(192,192,mark(LARGE,BRAND,"#FFFFFF",0.28))
mark_s=svg(192,192,mark(SMALL,BRAND,"#FFFFFF",0.28))
write("web/logo-mark.svg",mark_l); write("web/logo-mark-small.svg",mark_s); write("web/favicon.svg",mark_s)
write("web/logo-lockup.svg",lockup(BRAND,"#FFFFFF",0.28,BRAND))
write("web/logo-lockup-dark.svg",lockup("#FFFFFF",BRAND,0.25,"#FFFFFF"))
write("print/logo-black.svg",lockup("#000000","#FFFFFF",0.35,"#000000"))
write("print/logo-white.svg",lockup("#FFFFFF","#000000",0.3,"#FFFFFF"))
# ---- web: raster
png("web/favicon-16.png",mark_s,16); png("web/favicon-32.png",mark_s,32)
png("web/icon-192.png",mark_l,192); png("web/icon-512.png",mark_l,512)
bleed=svg(192,192,mark(LARGE,BRAND,"#FFFFFF",0.28,rounded=False))
png("web/apple-touch-icon.png",bleed,180); png("web/icon-maskable-512.png",bleed,512)
# ---- play store: full square, Play applies its own mask
png("play/play-store-512.png",bleed,512)

# ---- android adaptive icon (108 dp canvas, visible 72 dp, safe circle 66 dp)
def p_rr(x,y,w,h,r):
    return (f"M{x+r:.3f},{y:.3f}H{x+w-r:.3f}A{r:.3f},{r:.3f} 0 0 1 {x+w:.3f},{y+r:.3f}V{y+h-r:.3f}"
            f"A{r:.3f},{r:.3f} 0 0 1 {x+w-r:.3f},{y+h:.3f}H{x+r:.3f}A{r:.3f},{r:.3f} 0 0 1 {x:.3f},{y+h-r:.3f}"
            f"V{y+r:.3f}A{r:.3f},{r:.3f} 0 0 1 {x+r:.3f},{y:.3f}Z")
def to108(b): k=72/192; x,y,w,h,r=b; return (18+x*k,18+y*k,w*k,h*k,r*k)
def vd(paths):
    body="".join(f'\n    <path android:fillColor="{c}"{f" android:fillAlpha=\"{a}\"" if a is not None else ""} android:pathData="{d}"/>' for c,a,d in paths)
    return ('<?xml version="1.0" encoding="utf-8"?>\n<!-- Mon Releve - the rail mark. Generated; do not edit by hand. -->\n'
            '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="108dp" android:height="108dp"\n'
            f'    android:viewportWidth="108" android:viewportHeight="108">{body}\n</vector>\n')
glyph=lambda col,a: [(col,a,p_rr(*to108(LARGE["track"]))),(col,None,p_rr(*to108(LARGE["fill"]))),(col,None,p_rr(*to108(LARGE["tick"])))]
write("android/res/drawable/ic_launcher_background.xml",vd([(BRAND,None,"M0,0h108v108h-108z")]))
write("android/res/drawable/ic_launcher_foreground.xml",vd(glyph("#FFFFFF",0.28)))
write("android/res/drawable/ic_launcher_monochrome.xml",vd(glyph("#FFFFFF",0.3)))
adaptive=('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
          '    <background android:drawable="@drawable/ic_launcher_background"/>\n'
          '    <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n'
          '    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>\n</adaptive-icon>\n')
write("android/res/mipmap-anydpi-v26/ic_launcher.xml",adaptive); write("android/res/mipmap-anydpi-v26/ic_launcher_round.xml",adaptive)
# preview sheet of the PNGs at real size, for a quick look
print("built")
