マニュアル
https://motoki-design.co.jp/wordpress/xserver-vps-auto-renew/

Manual
https://motoki-design.co.jp/wordpress/xserver-vps-auto-renew/

手册 https://motoki-design.co.jp/wordpress/xserver-vps-auto-renew/

# リトライについて

main.mjsでエラーが発生すると後続処理の動画のアップロードができなくなるため、cronで複数回実行するようにお願いします。

```yaml
- cron: 0 15,16,17 * * *
```

# About retries

If an error occurs in main.mjs, subsequent video uploads won’t run, so please set it up to execute multiple times via cron.

```yaml
- cron: 0 15,16,17 * * *
```

# 关于重试

由于 main.mjs 出现错误时，会导致后续处理的视频无法上传，所以请通过 cron 多次执行。

```yaml
- cron: 0 15,16,17 * * *
```
