#!/bin/bash
############################################
#  Mjack Tools 一键安装脚本 (彻底修复版)
############################################

# 1. 获取执行环境
# 即使 sudo 运行，也能准确定位 jack 的家目录
REAL_USER=${SUDO_USER:-$USER}
REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)

# 2. 配置变量
M_URL="https://raw.githubusercontent.com/meqte/meqte.github.io/main/sh/mjack.sh"
INSTALL_PATH="${REAL_HOME}/mjack.sh"
SHORTCUT_PATH="/usr/local/bin/m"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 3. 核心安装逻辑
echo -e "${GREEN}>>> 正在为用户 ${REAL_USER} 安装工具...${NC}"

# 下载主脚本
if curl -sL "$M_URL" -o "$INSTALL_PATH"; then
    # 确保文件归属于 jack，这样以后运行工具生成的日志/配置不会报权限错误
    chown "$REAL_USER":"$REAL_USER" "$INSTALL_PATH" 2>/dev/null
    chmod +x "$INSTALL_PATH"
    echo -e "${GREEN}✓ 下载成功: $INSTALL_PATH${NC}"
else
    echo -e "${RED}✗ 下载失败，请检查网络${NC}"
    exit 1
fi

# 4. 创建快捷方式
echo -e "${GREEN}正在创建快捷命令 'm'...${NC}"
sudo ln -sf "$INSTALL_PATH" "$SHORTCUT_PATH"
hash -r 2>/dev/null

# 5. 关键：安装完成即停止
echo -e "${GREEN}✓ 安装完成！${NC}"
echo -e "${YELLOW}==========================================${NC}"
echo -e "${YELLOW}  请执行以下步骤启动工具：                 ${NC}"
echo -e "${YELLOW}  1. 输入 'm' 并回车                       ${NC}"
echo -e "${YELLOW}==========================================${NC}"

# 严禁在此处添加 exec 或自动运行逻辑，防止递归
exit 0
