#!/usr/bin/env python3
"""
デモ用の手書きメモ（見本）を作る。出力は prisma/seed-data/demo-memos.json（npm run db:seed / prod:seed が読む）。

手書き風フォント Klee One（SIL Open Font License）で書いた文字の「線の真ん中」をたどって、
Apple Pencil で書いたときと同じ形式（点の並び＋筆圧）の線にする。行ごとに少し傾けたり、
太さ（筆圧）を変えたりして、手で書いたように見せる。赤ペン・下線・丸囲み・マーカーも足す。

使い方（1回だけ・開発用。できた JSON をリポジトリに入れるので、ふだんは不要）:
  python3 -m venv .venv && .venv/bin/pip install pillow numpy scikit-image
  curl -L -o KleeOne-Regular.ttf https://github.com/fontworks-fonts/Klee/raw/master/fonts/ttf/KleeOne-Regular.ttf
  .venv/bin/python scripts/gen-demo-memos.py KleeOne-Regular.ttf
"""
import json
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from skimage.morphology import skeletonize

PX = 96  # 文字を描く大きさ（ピクセル）
CHAR_UNITS = 50  # 1文字の大きさ（ページの座標。ページは幅1000×高さ1300、罫線は65ごと）
SCALE = CHAR_UNITS / PX
FIRST_BASELINE = 140  # 1行目の文字の下端（罫線 150 のすぐ上）
LINE_GAP = 65
PEN = 6  # 「中」より少し細め（ボールペンで書いたくらい）

# 見本のメモ。match：その回の種目が下半身（lower）か上半身（upper）か（any はどちらでも）
# 行の頭に書く記号：! 赤ペンの行／_ 赤の下線／~ マーカー／( ) の中の文字を赤丸で囲む
MEMOS = [
    {'client': 'デモ 太郎', 'match': 'upper', 'lines': [
        '上半身の日',
        '体重 前回より -0.4kg',
        'ベンチ ラスト2回は補助',
        '~ラット 背中に効く感覚◎',
        '肩の痛み なし',
        '_沖縄旅行まで あと4週！',
    ]},
    {'client': 'デモ 太郎', 'match': 'lower', 'lines': [
        '脚の日　睡眠5h',
        'スクワット 深さOK',
        '→ 次回 +2.5kg',
        '!RDL 腰が丸まりやすい',
        '(宿題)：ヒップヒンジ 10回×2',
        '右ひざ 違和感なし',
    ]},
    {'client': 'デモ 太郎', 'match': 'upper', 'lines': [
        '仕事がいそがしく 疲れ気味',
        'ショルダープレス 左右差あり',
        '→ 次回は左から',
        '~夜のラーメン 週2回',
        '→ スープを残す から',
    ]},
    {'client': 'デモ 太郎', 'match': 'lower', 'lines': [
        '!右ひざに少し違和感',
        'スクワットは浅めで様子見',
        'ブルガリアン → 自重に変更',
        '!痛み 2/10 → 終わり 1/10',
    ]},
    {'client': 'デモ 花子', 'match': 'any', 'lines': [
        '夜勤明けで眠そう',
        '首・肩こり 3/10（前回4）',
        '猫背 → 胸をひらく ◎',
        '甘いもの 夜勤中に2回',
        '~体脂肪 下がってきた！',
    ]},
    {'client': 'デモ 花子', 'match': 'any', 'lines': [
        '_階段を使うようになった！',
        'ヒップリフト お尻に効く◎',
        'サイドレイズ 肩がすくむ',
        '→ 軽めで回数多めに',
        '次回：(背中)を多めに',
    ]},
    {'client': 'デモ 美咲', 'match': 'any', 'lines': [
        '繁忙期で 来月から(休会)',
        '再開したら 背中・脚から',
        '在宅で歩数 3,000歩',
        '→ 散歩を習慣に',
    ]},
    {'client': 'デモ 美咲', 'match': 'any', 'lines': [
        'ゴブレット 深くしゃがめた',
        'ロウイング 肩が上がる',
        '→ 胸を張って引く',
        '_疲れにくくなった！',
    ]},
]


def neighbors(sk, y, x):
    """骨格の点のとなり（斜めは、あいだの縦横の点がないときだけ）"""
    h, w = sk.shape
    out = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            ny, nx = y + dy, x + dx
            if not (0 <= ny < h and 0 <= nx < w) or not sk[ny, nx]:
                continue
            if dy and dx and (sk[y, nx] or sk[ny, x]):
                continue
            out.append((ny, nx))
    return out


def trace(sk):
    """骨格（1ピクセル幅の線）を、つながった点の並び（線）に分ける"""
    pts = list(zip(*np.nonzero(sk)))
    nb = {p: neighbors(sk, *p) for p in pts}
    deg = {p: len(nb[p]) for p in pts}
    seen = set()
    key = lambda a, b: (a, b) if a < b else (b, a)

    def walk(a, b):
        path = [a, b]
        seen.add(key(a, b))
        prev, cur = a, b
        while deg[cur] == 2:
            nxt = [q for q in nb[cur] if q != prev and key(cur, q) not in seen]
            if not nxt:
                break
            seen.add(key(cur, nxt[0]))
            path.append(nxt[0])
            prev, cur = cur, nxt[0]
        return path

    strokes = []
    for p in pts:
        if deg[p] != 2:
            for q in nb[p]:
                if key(p, q) not in seen:
                    strokes.append(walk(p, q))
    for p in pts:  # 輪（「0」「〇」など）
        for q in nb[p]:
            if key(p, q) not in seen:
                strokes.append(walk(p, q))
    strokes += [[p] for p in pts if deg[p] == 0]
    # 分かれ目から出た短いひげ（骨格にしたときのゴミ）を捨てる
    out = []
    for s in strokes:
        ends = [deg[s[0]], deg[s[-1]]]
        if len(s) < 6 and max(ends) >= 3 and min(ends) == 1:
            continue
        out.append(s)
    return out


def rdp(points, eps):
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy)
    far, idx = -1.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        # 輪（始まりと終わりが同じ点）は、始まりの点からの距離で測る（「の」「O」「0」が消えないように）
        d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm if norm > 1e-6 else math.hypot(px - x1, py - y1)
        if d > far:
            far, idx = d, i
    if far > eps:
        return rdp(points[: idx + 1], eps)[:-1] + rdp(points[idx:], eps)
    return [points[0], points[-1]]


def resample(points, step):
    if len(points) < 2:
        return points
    out = [points[0]]
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        d = math.hypot(x2 - x1, y2 - y1)
        n = max(1, int(d // step))
        for k in range(1, n + 1):
            t = k / n
            out.append((x1 + (x2 - x1) * t, y1 + (y2 - y1) * t))
    return out


def pen_stroke(points, color='ink', size=PEN, rnd=random):
    """点の並び → 保存形式の線（筆圧は書き始めと終わりを少し弱く）"""
    n = len(points)
    p = []
    for i, (x, y) in enumerate(points):
        t = i / (n - 1) if n > 1 else 0.5
        pr = 0.36 + 0.2 * math.sin(math.pi * t) + rnd.uniform(-0.04, 0.04)
        p += [round(x, 1), round(y, 1), round(min(1, max(0.1, pr)), 2)]
    return {'c': color, 's': size, 'p': p, 'pen': True}


def render_line(font, text, rnd, baseline, left):
    """1行を書いて、線（ページ座標）と、文字ごとの左端の位置を返す"""
    ascent, descent = font.getmetrics()
    width = int(font.getlength(text)) + PX
    img = Image.new('L', (width, PX * 2), 0)
    ImageDraw.Draw(img).text((PX // 2, PX // 2), text, font=font, fill=255)
    sk = skeletonize(np.array(img) > 110)
    slope = math.radians(rnd.uniform(-0.8, 0.8))
    squeeze = rnd.uniform(0.96, 1.03)
    base_px = PX // 2 + ascent

    def to_page(y, x):
        u = (x - PX // 2) * SCALE * squeeze
        v = (y - base_px) * SCALE
        return (left + u * math.cos(slope) - v * math.sin(slope), baseline + u * math.sin(slope) + v * math.cos(slope))

    strokes = []
    for path in trace(sk):
        pts = [to_page(y, x) for (y, x) in path]
        ox, oy = rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5)
        pts = [(x + ox, y + oy) for (x, y) in pts]
        pts = resample(rdp(pts, 0.45), 4.5) if len(pts) > 1 else pts
        strokes.append(pts)
    x_of = lambda i: left + font.getlength(text[:i]) * SCALE * squeeze
    return strokes, x_of


def ellipse(cx, cy, rx, ry, rnd):
    start = rnd.uniform(0, math.pi * 2)
    pts = []
    for k in range(46):
        a = start + k / 40 * math.pi * 2  # 少し重ねて閉じる
        pts.append((cx + (rx + rnd.uniform(-1.5, 1.5)) * math.cos(a), cy + (ry + rnd.uniform(-1.5, 1.5)) * math.sin(a)))
    return pts


def build(font, memo, seed):
    rnd = random.Random(seed)
    under, over = [], []  # マーカーは文字の下に描く
    for i, raw in enumerate(memo['lines']):
        mark = raw[0] if raw[0] in '!_~' else ''
        text = raw[1:] if mark else raw
        circle = None
        if '(' in text and ')' in text:
            a = text.index('(')
            b = text.index(')')
            circle = (a, b - 1)
            text = text.replace('(', '').replace(')', '')
        baseline = FIRST_BASELINE + LINE_GAP * i + rnd.uniform(-3, 3)
        left = rnd.uniform(58, 72)
        strokes, x_of = render_line(font, text, rnd, baseline, left)
        color = 'red' if mark == '!' else 'ink'
        over += [pen_stroke(s, color, rnd=rnd) for s in strokes]
        x_end = x_of(len(text))
        if mark == '_':
            pts = [(x, baseline + 9 + 1.5 * math.sin(x / 37)) for x in np.linspace(left - 4, x_end + 4, 40)]
            over.append(pen_stroke(pts, 'red', 4, rnd))
        if mark == '~':
            pts = [(x, baseline - 19 + rnd.uniform(-1, 1)) for x in np.linspace(left - 6, x_end + 6, 12)]
            under.append({'c': 'marker', 's': 30, 'p': sum([[round(x, 1), round(y, 1), 0.5] for x, y in pts], []), 'pen': True})
        if circle:
            x1, x2 = x_of(circle[0]), x_of(circle[1] + 1)
            over.append(pen_stroke(ellipse((x1 + x2) / 2, baseline - 19, (x2 - x1) / 2 + 12, 30, rnd), 'red', 4, rnd))
    return {'client': memo['client'], 'match': memo['match'], 'data': {'v': 1, 'pages': [under + over]}}


def main():
    font = ImageFont.truetype(sys.argv[1] if len(sys.argv) > 1 else 'KleeOne-Regular.ttf', PX)
    memos = [build(font, m, 100 + i) for i, m in enumerate(MEMOS)]
    out = Path(__file__).resolve().parent.parent / 'prisma' / 'seed-data' / 'demo-memos.json'
    out.write_text(json.dumps(memos, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    strokes = sum(len(m['data']['pages'][0]) for m in memos)
    print(f'{out.name}: {len(memos)}件・{strokes}本・{out.stat().st_size // 1024}KB')


if __name__ == '__main__':
    main()
