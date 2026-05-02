# Prompt Vault v2

NovelAI プロンプト・画像管理 PWA。

## 作業開始前

1. `_STATUS.md` を読んで現在地を確認
2. 仕様書（指示書で指定されたファイル）を確認

## 構成ルール

- Vanilla JS / ES Modules。外部ライブラリなし
- 全モジュールは `state.js` 経由で状態共有。モジュール間の直接importは禁止（循環参照防止）
- IndexedDB スキーマ: prompts(keyPath:id), images(keyPath:id, index:promptId)
- CSS は index.html 内の `<style>` に集約。外部CSSファイルなし
- テーマは CSS変数で3種（classic/modern/dark）

## ファイル構成

```
index.html    HTML構造 + CSS（3テーマ）
manifest.json PWA マニフェスト
sw.js         Service Worker
icon.svg      アプリアイコン
js/app.js     初期化・モード切替
js/state.js   共有状態
js/db.js      IndexedDB操作
js/utils.js   toast / リサイズ / clipboard
js/prompts.js プロンプトCRUD・カード描画
js/viewer.js  スライドショー・カタログビューア
js/catalog.js グローバルカタログ
js/settings.js 設定モーダル・テーマ・入出力
js/dict.js    辞書（プレースホルダー）
```

## 禁止事項

- 新規ファイルの作成（指示書で明示されない限り）
- db.js の objectStore 構成の変更
- state.js を迂回するモジュール間の直接import
- 仕様書の原本の改変
