マニュアル
https://motoki-design.co.jp/wordpress/xserver-vps-auto-renew/

Manual
https://motoki-design.co.jp/wordpress/xserver-vps-auto-renew/

手册
https://motoki-design.co.jp/wordpress/xserver-vps-auto-renew/

![Clipchamp6-ezgif com-video-to-gif-converter](https://github.com/user-attachments/assets/03674e4a-6633-46da-910d-06d433757632)

如果不起作用，请设置 GitHub Actions 的 Secrets 环境变量。

```env
EMAIL=your@gmail.com
PASSWORD=yourpassword
PROXY_SERVER=http://user:password@example.com:8888
```

<details><summary>安装代理服务器</summary>

```bash
apt update
apt install -y tinyproxy
echo Allow 0.0.0.0/0 >> /etc/tinyproxy/tinyproxy.conf
echo BasicAuth user password >> /etc/tinyproxy/tinyproxy.conf
systemctl restart tinyproxy
systemctl status tinyproxy
```
</details>

我想去西門町，和大家一起喝珍珠奶茶。
