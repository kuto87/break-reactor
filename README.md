# Break Reactor

Break Reactor は、ブラウザだけで遊べるエンドレス型のブロック崩しです。ビルド不要、外部ライブラリ不要で、GitHub Pages にそのまま置けます。

## 起動方法

`index.html` を開くか、静的サーバーで配信します。

```bash
python -m http.server 4173 --bind 127.0.0.1
```

起動後、`http://127.0.0.1:4173/` を開きます。

## 操作

- マウス / タッチ: パドル移動
- クリック / タップ / Space: ボール発射
- `P` / `Esc`: 一時停止
- `R`: リスタート
- `Shift+W`: 開発用のWAVEジャンプ
- `Shift+C`: 開発用にコイン+100

## 遊びの要素

- WAVE 10000 まで表示と速度が破綻しないように調整しています。
- 青ブロックはガラス風の通常ブロックです。
- WAVE が進むと木、石、金属ブロックが段階的に混ざります。
- 5 WAVE ごとにボスが出ます。後半のボスは横に動きます。
- ミッションを達成するとコインとスコアがもらえます。
- 背景はじんわり動き、ボス接近・被弾・ミッション達成に反応します。
- マルチアイテムは重ねがけできます。上限は最大30ボールです。

## 開発用デバッグ

URL パラメータ:

```text
?debug=1&wave=50&coins=200
#debug=1&wave=50&coins=200
```

ブラウザコンソール:

```js
BreakReactorDebug.jumpToWave(100);
BreakReactorDebug.giveCoins(500);
BreakReactorDebug.clearStage();
BreakReactorDebug.state;
```

## 仕様書

[SPEC.md](./SPEC.md) にゲーム仕様、調整方針、デバッグ方法を書いています。新しい機能を足す前にここへ仕様を書き、実装後に実際の挙動とずれていないか確認する使い方を想定しています。

## ファイル構成

```text
index.html
style.css
main.js
README.md
SPEC.md
```
