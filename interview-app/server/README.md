# 面试提醒服务（极简，零依赖）

配合本地 app 实现「面试前一天微信提醒」。方案 A：**练习数据留本地，只有面试日程上云**。

## 部署（小服务器 / 海外 VPS）

```bash
# 1. 把 server/ 目录上传到服务器
scp -r server user@your-server:~/

# 2. 设置环境变量
cd ~/server
export PUSHPLUS_TOKEN="你的 PushPlus token"   # https://www.pushplus.plus 扫码获取
export AUTH_TOKEN="一个随机串"                 # 可选，用于 /sync 鉴权
export PORT=8787                              # 可选

# 3. 前台试运行
node reminder.mjs

# 4. 常驻（任选其一）
#    pm2：pm2 start reminder.mjs --name interview-reminder
#    systemd：写个 unit 指向 `node ~/server/reminder.mjs`
```

## 本地 app 侧配置

在 `.env` 里加：

```
REMINDER_SERVER_URL=https://你的服务器域名或IP:8787
REMINDER_AUTH_TOKEN=与服务端 AUTH_TOKEN 一致
```

之后在首页「面试日程」添加/删除日程时，会自动上报到本服务；服务每天每小时检查一次，发现「明天有面试」就通过 PushPlus 推到你微信。

## 接口

- `POST /sync`：接收 `{ "schedules": [{ "company", "role", "interviewAt" }] }`，全量覆盖（保留 reminded 标记）
- `GET /health`：健康检查
