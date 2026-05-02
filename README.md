# Prompt Vault v2.3

NovelAI で生成した画像とプロンプトを紐づけて管理する PWA ツール。  
センシティブな画像を安全に扱うことを前提とし、Android ホーム画面からスタンドアロン起動できる。

## デプロイ

GitHub Pages: `https://misfortunemate-png.github.io/prompt-vault-v2/`

## ファイル構成

```
prompt-vault-v2/
  index.html         シェル（HTML構造 + CSS 3テーマ）
  manifest.json      PWA マニフェスト
  sw.js              Service Worker
  icon.svg           アプリアイコン
  js/
    app.js           初期化・モード切替・マイグレーション
    state.js         共有状態（循環参照防止の中継モジュール）
    db.js            IndexedDB 操作
    utils.js         toast / 画像リサイズ / clipboard / エラー表示
    prompts.js       プロンプト CRUD・カード描画・検索・タグ
    viewer.js        スライドショー・カタログビューア（共通）
    catalog.js       グローバルカタログ（全画像グリッド）
    settings.js      設定モーダル・テーマ切替・入出力
    dict.js          辞書（プレースホルダー）
```

## モジュール設計

全モジュールは `state.js` を通じて状態を共有する。互いを直接 import しないため循環参照が発生しない。

新しいモードを追加する場合：
1. `js/newmode.js` を作成（`init()` / `show()` / `hide()` を export）
2. `state.js` の `registerMode()` で登録
3. `index.html` にタブ 1 個 + ビュー div 1 個を追加
4. `app.js` の動的 import 配列に 1 行追加
5. `sw.js` のキャッシュ対象に追加

## 実装済み機能

### プロンプト管理
- CRUD（タイトル・プロンプト本文・タグ・メモ）
- タグ絞り込み・テキスト検索
- 画像の複数紐づけ（800px・JPEG 75% に自動縮小）
- カードにサムネイル表示（代表 1 枚 + 枚数バッジ）
- プロンプトのワンタップコピー（Clipboard API + フォールバック）

### ビューア
- スライドショー（前後移動・スワイプ・キーボード操作）
- カタログビュー（グリッド一覧、スライドショーと切替可能）
- 画像ダウンロード
- **縦向き固定**（PWA 起動時）
- **ビューア表示中のみ横向き許可**（Screen Orientation API）
- **横向き時は左サイドバーに操作部を自動切替**（CSS `orientation: landscape` メディアクエリ）

### グローバルカタログ
- 全プロンプトの全画像をフラットなグリッド表示（Intersection Observer 遅延読み込み）
- タグフィルタリング（複数タグ AND 条件）
- ソート（作成日 / 更新日 / タイトル、昇降切替）
- タップで横断スライドショー（フィルタ・ソート適用済みの全画像をプロンプト境界を超えて連続閲覧）
- ビューア内四象限タップ（左上:閉じる / 右上:カタログ / 左下:前 / 右下:次）

### 設定
- 画面方向（常時縦固定 / ビューア時のみ横許可 / 常時自由回転）
- 画像品質（リサイズ上限 800px・1200px・元サイズ、JPEG 品質 75%・85%・95%）
- ブラウザストレージ使用量表示
- 設定は localStorage に永続化

### テーマ
- Classic（古紙調・IM Fell English・角丸なし・ハードシャドウ）
- Modern（白背景・インディゴアクセント・角丸 12px・ソフトシャドウ）
- Dark（深い黒背景・紫寄りインディゴ・角丸 12px）
- 日本語フォント: BIZ UDGothic に統一

### ストレージ
- IndexedDB（メタデータ + 400px サムネイルと 800px フル画像を分離保存）
- `navigator.storage.persist()` による永続化保証
- 画像は IndexedDB 内のためギャラリー・ファイルマネージャーから不可視

### PWA
- Service Worker によるオフラインキャッシュ
- Android ホーム画面追加でスタンドアロン起動
- `manifest.json` の `orientation: portrait` により縦向き固定起動

### インポート / エクスポート
- プロンプトのみ書き出し（軽量 JSON、PC 編集向き）
- 画像込み書き出し（完全バックアップ）
- JSON 読み込み（マージ：同一 ID は上書き、新規は追加）

### エラーチェック
- 各モジュールのロード・初期化を個別に try-catch
- 失敗時は画面上部に赤い帯でモジュール名とエラー内容を表示
- グローバル onerror / unhandledrejection ハンドラ

## 優先目標の達成状況

| 優先度 | 目標 | 状態 |
|--------|------|------|
| P1 | PC・Android 間のリアルタイム同期 | **未着手** — インポート/エクスポートで代替中 |
| P2 | 大量画像への耐性 | **達成** — IndexedDB 分離保存 |
| P3 | 画像のアクセス制御 | **達成** — IndexedDB はギャラリーから不可視 |
| P4 | 画像のストレージ | **達成** — 端末ローカル、外部クラウド不使用 |

## 残タスク

### ワード辞典機能（dict.js に実装予定）
- NovelAI プロンプトワードを単語単位で管理する辞書
- ワンタップコピー
- 強調記法トグル（`word` → `{word}` → `{{word}}`、逆方向も可）
- 日本語訳・意味の表示
- Danbooru への検索リンク
- タグによる分類・絞り込み

### リアルタイム同期（P1・棚上げ中）
候補：
- PouchDB + CouchDB on Tailscale（自前ネットワーク内完結）
- Cloudflare R2 + Workers（サーバーレス、コンテンツスキャンなし）

### その他の改善候補
- 一括タグ編集
- リポジトリの Private 化 + Cloudflare Pages デプロイ

## 技術スタック
- Vanilla JS（ES Modules、外部ライブラリなし）
- IndexedDB（raw API）
- Service Worker（Cache First）
- Google Fonts: IM Fell English + Noto Sans JP + BIZ UDGothic

## 変更履歴

### v2.3（2026-05-02）
- カタログ全画像フラット表示（Intersection Observer 遅延読み込み）
- カタログにタグフィルタ追加（複数タグ AND 条件）
- カタログにソート機能追加（作成日 / 更新日 / タイトル、昇降切替）
- カタログからのプロンプト横断スライドショー（`pv:openViewerBatch` イベント）
- ビューア内四象限タップ操作（左上:閉じる / 右上:カタログ / 左下:前 / 右下:次）
- 設定：画面方向（常時縦固定 / ビューア時のみ横許可 / 常時自由回転）
- 設定：画像品質（リサイズ上限・JPEG 品質）
- 設定：ブラウザストレージ使用量表示
- 設定の localStorage 永続化（`pv-settings` キー）
- Service Worker キャッシュバージョンを `pv-v2.2` → `pv-v2.3` に更新

### v2.2（2026-04-25）
- ビューア操作部を上部1行バーに統合（旧：viewer-top + slide-controls の2段構成）
- 横向き時に操作部が左サイドバーへ自動切替（CSS メディアクエリのみ、JS不要）
- ビューア表示中のみ横向きを許可、閉じると縦向きに復帰（Screen Orientation API）
- `manifest.json` の `orientation` を `any` → `portrait` に変更
- Service Worker キャッシュバージョンを `pv-v2.1` → `pv-v2.2` に更新

### v2.1
- 初期リリース
