#!/usr/bin/env bash
set -eu

# 配置参数
APP_SCRIPT="app.py"
DEFAULT_PORT=5000
BACKUP_PORT=5001
MIN_PYTHON_VERSION="3.8"

echo "Starting Jack-Disk - 临时文件存储工具"
echo

# 检查 app.py 是否存在
if [ ! -f "$APP_SCRIPT" ]; then
    echo "错误: 未找到应用文件 $APP_SCRIPT"
    exit 1
fi

# 检查 Python3 安装
if ! command -v python3 &> /dev/null; then
    echo "错误: Python3 未安装"
    echo "请先安装 Python $MIN_PYTHON_VERSION 或更高版本"
    exit 1
fi

# 检查 Python 版本（简化版检查）
PYTHON_VERSION=$(python3 -c 'import sys; print(sys.version_info[0]*10 + sys.version_info[1])')
if [ "$PYTHON_VERSION" -lt 38 ]; then
    echo "错误: Python 版本过低，需要至少 $MIN_PYTHON_VERSION"
    exit 1
fi

# 检查并安装 Flask 依赖
if ! python3 -c "import flask" &> /dev/null; then
    echo "正在安装依赖包..."
    pip3 install flask || python3 -m pip install flask
    if [ $? -ne 0 ]; then
        echo "错误: 依赖包安装失败"
        exit 1
    fi
fi

# 设置环境变量
export TEMPSTORE_MAX_STORAGE="20GB"
export TEMPSTORE_MAX_FILE_SIZE="1GB"
export TEMPSTORE_FILE_EXPIRE_HOURS="24"

# 检查端口占用（简化版，不依赖 lsof）
if python3 -c "import socket; s=socket.socket(); s.bind(('localhost', $DEFAULT_PORT))" &> /dev/null; then
    PORT_TO_USE=$DEFAULT_PORT
else
    echo "警告: 端口 $DEFAULT_PORT 已被占用，尝试使用 $BACKUP_PORT"
    if python3 -c "import socket; s=socket.socket(); s.bind(('localhost', $BACKUP_PORT))" &> /dev/null; then
        PORT_TO_USE=$BACKUP_PORT
    else
        echo "错误: 备用端口 $BACKUP_PORT 也被占用"
        exit 1
    fi
fi

# 启动信息
echo
echo "Jack-Disk 服务启动中..."
echo "管理员密码: 使用默认密码或环境变量设置的密码"
echo "访问地址: http://localhost:$PORT_TO_USE"
echo "按 Ctrl+C 停止服务"
echo

# 启动服务
if [ "$PORT_TO_USE" -eq "$DEFAULT_PORT" ]; then
    python3 "$APP_SCRIPT"
else
    python3 "$APP_SCRIPT" "$PORT_TO_USE"
fi