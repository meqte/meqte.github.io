#!/bin/bash
# auto_deploy_rtsp.sh - 一键部署RTSP推流服务（Debian 13）

# ========== 配置区（替换为你的GitHub仓库信息） ==========
GITHUB_REPO="https://raw.githubusercontent.com/meqte/meqte.github.io/main/rtsp/"
TARGET_DIR="/root/rtsp"  # 目标部署目录
FILES=(
  "rtsp.sh"        # 核心控制脚本
  "mediamtx"       # RTSP服务器可执行文件
  "mediamtx.yml"   # 配置文件
)
# ========== 配置结束 ==========


# 1. 检查是否为root用户（部署需要root权限）
if [ "$(id -u)" -ne 0 ]; then
  echo "❌ 请用root用户执行（sudo -i 后再运行）"
  exit 1
fi



# 3. 创建目标目录
echo "📂 创建部署目录：$TARGET_DIR"
mkdir -p "$TARGET_DIR/4K" "$TARGET_DIR/logs"  # 同时创建4K和logs子目录


# 4. 下载所有文件
echo "📥 下载RTSP相关文件..."
for FILE in "${FILES[@]}"; do
  DOWNLOAD_URL="$GITHUB_REPO/$FILE"
  SAVE_PATH="$TARGET_DIR/$FILE"
  
  # 下载文件
  if wget -q -O "$SAVE_PATH" "$DOWNLOAD_URL"; then
    echo "✅ 成功下载：$FILE"
  else
    echo "❌ 下载失败：$FILE（链接：$DOWNLOAD_URL）"
    exit 1
  fi
done


# 5. 配置执行权限
echo "🔑 配置文件执行权限..."
chmod +x "$TARGET_DIR/rtsp.sh" "$TARGET_DIR/mediamtx"


# 6. 创建软链接（全局调用：输入m即可运行脚本）
echo "🔗 创建全局软链接..."
ln -sf "$TARGET_DIR/rtsp.sh" /usr/local/bin/m


# 7. 部署完成提示
echo -e "\n🎉 RTSP服务部署完成！"
echo "📁 部署目录：$TARGET_DIR"
echo "🔧 常用命令："
echo "   - 启动服务：m start"
echo "   - 停止服务：m stop"
echo "   - 查看状态：m status"
echo "   - 交互式菜单：m"
echo "💡 请将视频文件放到 $TARGET_DIR/4K/ 目录后，再启动服务！"