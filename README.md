# Mr.Jack - Tools 工具箱

<p align="center">
  <img src="./img/images/logos.ico" alt="Logo" width="100" height="100">
</p>

<h3 align="center">精选实用工具集合</h3>
<p align="center">
  包含图片排列、在线秒表、RTSP推流、文件存储等多功能工具平台
  <br/>
  <a href="https://meqte.github.io"><strong>🌐 访问网站 »</strong></a>
  <br/>
  <br/>
  <a href="https://github.com/meqte/meqte.github.io/issues">报告Bug</a>
  ·
  <a href="https://github.com/meqte/meqte.github.io/issues">请求功能</a>
</p>

---

## 📋 项目概述

这是一个个人工具集合网站，包含了多种实用的在线工具和服务。项目采用静态网页技术构建，结合了多个独立的功能模块，旨在为用户提供便捷的在线工具服务。

## 🚀 功能特色

### 🎯 主要工具
- **图片排列工具** - 支持图片网格排列、拖拽排序、文件名显示
- **在线秒表** - 精确计时工具，支持毫秒级精度
- **临时云存储** - 轻量级文件存储服务
- **RTSP推流服务** - 视频流媒体服务器部署工具

### 🔧 系统工具
- **Mjack SH脚本** - Linux系统通用脚本集合
- **SB VV脚本** - 国际VPS服务器优化脚本
- **RTSP推流部署** - 一键部署RTSP视频流服务
- **Kejilion脚本** - 通用运维脚本工具

### 📥 实用工具下载
- Mr.Jack专用工具箱（RTSP压测、批量截图等）
- RustDesk远程桌面客户端
- Ping网络检测工具
- 视频格式转换工具
- RTSP服务器搭建工具

## 🏗️ 项目结构

```
meqte.github.io/
├── index.html              # 主页入口文件
├── _config.yml            # Jekyll配置文件
├── ico.ico               # 网站图标
├── img/                  # 静态资源目录
│   ├── css/             # 样式文件
│   │   ├── bootstrap.css
│   │   ├── xenon-core.css
│   │   ├── xenon-components.css
│   │   └── ...
│   └── js/              # JavaScript文件
│       ├── jquery-1.11.1.min.js
│       ├── xenon-api.js
│       └── ...
├── index/               # 工具页面目录
│   ├── pailie.html     # 图片排列工具
│   └── time.html       # 在线秒表工具
├── sh/                 # Shell脚本目录
│   ├── mjack.sh       # 主工具脚本
│   ├── index.html     # 脚本安装入口
│   ├── rtsp/          # RTSP相关脚本
│   │   ├── rtsp.sh    # RTSP服务脚本
│   │   ├── mediamtx   # MediaMTX服务程序
│   │   └── ...
│   ├── sb/            # SB VV脚本
│   │   ├── sb.sh      # SB安装脚本
│   │   └── README.md  # 使用说明
│   └── web-code/      # Web应用代码
│       └── 轻量文件存储/
│           ├── app.py         # Flask应用主文件
│           ├── index.html     # 前端页面
│           └── README.md      # 详细说明
└── download/          # 工具下载目录
    ├── jack.zip      # Mr.Jack工具箱
    ├── rustdesk.zip  # RustDesk客户端
    └── ping.zip      # Ping工具
```

## 🛠️ 技术栈

### 前端技术
- **HTML5/CSS3** - 现代网页标准
- **JavaScript (ES6+)** - 前端交互逻辑
- **jQuery 1.11.1** - DOM操作和事件处理
- **Bootstrap** - 响应式布局框架
- **Xenon UI** - 现代化UI组件库
- **Lozad.js** - 图片懒加载库

### 后端技术
- **Python Flask** - Web应用框架
- **APScheduler** - 定时任务调度
- **Werkzeug** - WSGI工具集

### 运维工具
- **Shell Script** - Linux系统脚本
- **MediaMTX** - RTSP流媒体服务器
- **FFmpeg** - 音视频处理工具

## 🔧 快速开始

### 网站部署
```bash
# 克隆项目
git clone https://github.com/meqte/meqte.github.io.git

# 进入项目目录
cd meqte.github.io

# 启动本地服务器（任选其一）
# Python 3
python -m http.server 8000

# Node.js (需要安装http-server)
npm install -g http-server
http-server -p 8000

# 访问地址
http://localhost:8000
```

### 脚本工具安装
```bash
# 一键安装Mjack工具箱
bash <(curl -sL meqte.github.io/sh)

# 安装SB VV脚本
bash <(curl -sL meqte.github.io/sh/sb/sb.sh)

# 部署RTSP推流服务
bash <(curl -sL meqte.github.io/sh/rtsp)

# 安装Kejilion运维脚本
bash <(curl -sL kejilion.sh)
```

### 文件存储服务部署
```bash
# 进入文件存储目录
cd sh/web-code/轻量文件存储

# 安装依赖
pip install -r requirements.txt

# 设置环境变量
export TEMPSTORE_ADMIN_PASSWORD="your_password"
export TEMPSTORE_MAX_STORAGE="20GB"

# 启动服务
python app.py
```

## 📖 使用指南

### 图片排列工具
1. 访问 `index/pailie.html`
2. 点击"上传"按钮选择图片文件
3. 支持拖拽排序和文件名显示切换
4. 可切换9×6或4×2布局模式
5. 点击图片可放大预览

### 在线秒表
1. 访问 `index/time.html`
2. 点击"开始"按钮启动计时
3. 支持暂停/继续功能
4. 空格键快捷控制
5. 精确到毫秒级显示

### RTSP推流服务
```bash
# 安装后使用快捷命令
r  # 启动RTSP服务管理

# 主要功能：
# - 一键部署RTSP服务器
# - 支持4K视频推流
# - 自动循环播放
# - 多路流并发推送
# - 实时日志监控
```

## ⚙️ 配置说明

### 环境变量配置
```bash
# 文件存储服务配置
TEMPSTORE_ADMIN_PASSWORD=admin     # 管理员密码
TEMPSTORE_UPLOAD_DIR=./uploads     # 上传目录
TEMPSTORE_MAX_STORAGE=20GB         # 最大存储空间
TEMPSTORE_MAX_FILE_SIZE=1GB        # 单文件最大大小
TEMPSTORE_FILE_EXPIRE_HOURS=24     # 文件过期时间
```

### 系统要求
- **操作系统**: Linux/Unix (脚本工具)
- **浏览器**: Chrome/Firefox/Safari/Edge (现代浏览器)
- **Python**: 3.8+ (文件存储服务)
- **内存**: 1GB+ (推荐2GB以上)

## 🔒 安全说明

### 已实施的安全措施
- 文件名安全过滤
- 路径注入防护
- 文件大小限制
- 会话管理机制
- 错误信息脱敏

### 生产环境建议
- 使用HTTPS加密传输
- 配置反向代理(Nginx)
- 设置防火墙规则
- 定期备份重要数据
- 监控系统日志

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进项目！

### 开发流程
1. Fork项目到您的GitHub账户
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

### 代码规范
- 遵循现有的代码风格
- 添加必要的注释说明
- 确保功能测试通过
- 更新相关文档

## 📝 更新日志

### v2026.01.02
- 重构主页UI界面
- 优化图片排列工具性能
- 增强RTSP脚本稳定性
- 改进文件存储安全性

### v2025.05
- 新增在线秒表工具
- 完善工具箱功能模块
- 优化移动端适配
- 增加更多实用工具

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👥 作者信息

**Mr.Jack**

- GitHub: [@meqte](https://github.com/meqte)
- 项目主页: [https://meqte.github.io](https://meqte.github.io)
- 联系邮箱: meqte@outlook.com

## 🙏 致谢

感谢以下开源项目的支持：
- [Xenon UI](https://github.com/Laboratoria/Xenon) - UI组件库
- [MediaMTX](https://github.com/bluenviron/mediamtx) - RTSP服务器
- [Flask](https://github.com/pallets/flask) - Web框架
- [Bootstrap](https://getbootstrap.com/) - CSS框架

---
<p align="center">
  Made with ❤️ by Mr.Jack
</p>