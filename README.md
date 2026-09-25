# Resole 顧客管理（gym-crm）

パーソナルトレーニングジム Resole のトレーナー専用の顧客管理Webアプリです。お客様1人ずつの体重・目標・トレーニング記録・食事メモ・問診票・セッションごとの手書きメモを記録し、グラフで確認できます。主に iPad で使う前提で作っています（お客様向けの画面はありません）。

**デモ：https://resole-gym-crm.netlify.app** （「デモを見る（ログイン不要）」から、架空のお客様のデータで操作できます）

機能・フォルダ構成・開発の状態の詳しい説明は [ABOUT.md](ABOUT.md) にあります。

## 主な機能

- 顧客台帳と問診票
- 1人1ページの顧客ページ（基準日＝来店日を起点に、直近1週間・1ヶ月などを表示）
- 体重・体脂肪率の記録と目標管理（進捗・予定ペースとの差・減量予測）
- トレーニング記録（前回値の表示、総負荷量・推定1RMの自動計算、部位別・種目別のグラフ）
- セッションごとの手書きメモ（Apple Pencil・指で書ける。自動保存）
- 食事メモ（7日×朝・昼・夕・間食）
- 計算式・減量ペース・種目マスタ・スタッフを設定画面で変更（全画面の計算に同じように反映）
- 体験シミュレーター（入会前のお客様に目標と達成見込みを見せる）

## 動かし方（Mac）

Node.js 22 が必要です（`nvm use` で切り替え）。データベースは `npm install` で入る開発用の PostgreSQL をプロジェクト内で動かすので、別にインストールするものはありません。

```bash
git clone https://github.com/kagami-fit/gym-crm.git
cd gym-crm
nvm use
npm install
cp .env.example .env    # BETTER_AUTH_SECRET と DEV_OWNER_PASSWORD を書き換える
npm run setup           # 初回だけ：DBの作成・テーブル作成・初期データ（設定・種目マスタ・デモ顧客）
npm run dev             # http://localhost:3020
```

- `BETTER_AUTH_SECRET` は `openssl rand -base64 32` で作った値に、`DEV_OWNER_PASSWORD` は10文字以上に置き換えてください
- ログイン画面の「開発用オーナーでログイン」から入れます（開発中、その Mac で開いたときだけ表示）
- 同じWi-Fiの iPad からも開けます（`npm run dev` の表示にある「iPad で開く」のアドレス）。手順は ABOUT.md の「iPad で開く」を参照
- チェック：`npm run typecheck` / `npm run lint` / `npm test` / `npm run build`

## 技術

Next.js 16 / TypeScript / Prisma 6 / PostgreSQL / Better Auth / Tailwind CSS 4 / Recharts / perfect-freehand
