#!/bin/bash
############################################
#  Mjack Tools 一键安装脚本 (Debian 13 优化版)
#  修复了 sudo 权限下的描述符报错与路径硬编码问题
############################################

# 1. 获取真实的执行用户和路径
# 即使通过 sudo 运行，也能准确定位 jack 的家目录
REAL_USER=${SUDO_USER:-$USER}
REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)

# 2. 配置变量
M_URL="https://raw.githubusercontent.com/meqte/meqte.github.io/main/sh/mjack.sh"
# 动态安装到当前用户的家目录
INSTALL_PATH="${REAL_HOME}/mjack.sh"
SHORTCUT_PATH="/usr/local/bin/m"
VERSION="2026.03.12"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}>>> 正在为用户 ${REAL_USER} 准备安装环境...${NC}"

# 3. 检查系统依赖
if ! command -v curl &> /dev/null; then
    echo -e "${YELLOW}正在安装 curl...${NC}"
    sudo apt-get update && sudo apt-get install -y curl
fi

# 4. 下载主脚本
echo -e "${GREEN}正在从 GitHub 获取 Mjack Tools...${NC}"
if curl -sL "$M_URL" -o "$INSTALL_PATH"; then
    # 关键：确保文件所有权属于 jack，防止后续运行权限报错
    chown "$REAL_USER":"$REAL_USER" "$INSTALL_PATH" 2>/dev/null
    chmod +x "$INSTALL_PATH"
    echo -e "${GREEN}✓ 脚本下载成功：$INSTALL_PATH${NC}"
else
    echo -e "${RED}✗ 下载失败，请检查网络连接${NC}"
    exit 1
fi

# 5. 创建全局快捷方式
echo -e "${GREEN}正在创建快捷命令 'm'...${NC}"
# 强制创建软链接到系统 bin 目录
sudo ln -sf "$INSTALL_PATH" "$SHORTCUT_PATH"
hash -r 2>/dev/null

# 6. 验证安装并退出
if [ -f "$INSTALL_PATH" ]; then
    echo -e "${GREEN}✓ Mjack Tools 安装成功！${NC}"
    echo -e "${YELLOW}==========================================${NC}"
    echo -e "${YELLOW}  请现在输入命令启动工具: m               ${NC}"
    echo -e "${YELLOW}==========================================${NC}"
    
    # 【注意】这里不再使用 exec "$SHORTCUT_PATH"，防止安装环境与运行环境冲突导致闪屏
else
    echo -e "${RED}✗ 安装验证失败${NC}"
    exit 1
fi
