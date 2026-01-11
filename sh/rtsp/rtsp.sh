#!/bin/sh
# 定义源脚本路径和软链接目标路径
SCRIPT_SRC="/root/rtsp/rtsp.sh"
LINK_DST="/usr/local/bin/r"

# 检查软链接是否已存在，不存在则创建
if [ ! -L "${LINK_DST}" ]; then
    echo "正在创建软链接..."
    ln -s "${SCRIPT_SRC}" "${LINK_DST}"
    echo "软链接创建成功！直接输入 m 即可运行脚本"
else
    echo "软链接已存在，无需重复创建"
fi

# RTSP推流服务控制脚本
# 作者: RTSP Tools
# 版本: 1.1 (已移除自动配置生成模块，依赖外部配置文件)
# 颜色定义（使用基本shell语法）
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 全局变量（使用基本shell语法）
REAL_SCRIPT_PATH=$(readlink -f "$0")
SCRIPT_DIR=$(cd "$(dirname "$REAL_SCRIPT_PATH")" && pwd)
BASE_PATH="$SCRIPT_DIR"
VIDEO_PATH="${BASE_PATH}/4K"
LOG_DIR="${BASE_PATH}/logs"
FFMPEG_LOG_DIR="${LOG_DIR}/ffmpeg"
MEDIAMTX_LOG="${LOG_DIR}/mediamtx.log"
PID_FILE="${LOG_DIR}/rtsp_server.pid"
CONFIG_FILE="${BASE_PATH}/mediamtx.yml"

# 默认配置
DEFAULT_STREAM_COUNT=1
STREAM_LOOP="-1"  # -1表示无限循环
FFMPEG_THREADS=2  # FFmpeg线程数，默认2线程处理4K视频
FFMPEG_RESTART_ATTEMPTS=10  # FFmpeg进程重启尝试次数
FFMPEG_RESTART_DELAY=10  # 重启延迟（秒）

# 检查必要文件
check_required_files() {
    printf "${BLUE}检查必要文件...${NC}\n"
    
    # 检查MediaMTX
    if [ ! -f "${BASE_PATH}/mediamtx" ]; then
        printf "${RED}错误: 找不到MediaMTX可执行文件${NC}\n"
        return 1
    fi
    
    # 检查系统是否安装了ffmpeg命令
    if ! command -v ffmpeg >/dev/null 2>&1; then
        printf "${RED}错误: 系统未安装ffmpeg，请先安装ffmpeg${NC}\n"
        return 1
    fi
    
    # 检查配置文件是否存在 (重要: 脚本不再自动创建，必须依赖用户提供的配置文件)
    if [ ! -f "${CONFIG_FILE}" ]; then
        printf "${RED}错误: 找不到配置文件 %s，请确保配置文件已放置在同目录下。${NC}\n" "${CONFIG_FILE}"
        return 1
    fi
    
    # 验证配置文件
    validate_config
    
    # 检查视频目录
    if [ ! -d "${VIDEO_PATH}" ]; then
        printf "${YELLOW}创建视频目录: %s${NC}\n" "${VIDEO_PATH}"
        mkdir -p "${VIDEO_PATH}"
    fi
    
    # 检查日志目录
    if [ ! -d "${LOG_DIR}" ]; then
        printf "${YELLOW}创建日志目录: %s${NC}\n" "${LOG_DIR}"
        mkdir -p "${LOG_DIR}"
    fi
    
    if [ ! -d "${FFMPEG_LOG_DIR}" ]; then
        printf "${YELLOW}创建FFmpeg日志目录: %s${NC}\n" "${FFMPEG_LOG_DIR}"
        mkdir -p "${FFMPEG_LOG_DIR}"
    fi
    
    # 检查端口是否被占用
    if command -v netstat >/dev/null 2>&1; then
        if netstat -tuln | grep -q ":554 "; then
            printf "${YELLOW}警告: 端口554已被占用，可能影响MediaMTX服务器启动${NC}\n"
        fi
    elif command -v ss >/dev/null 2>&1; then
        if ss -tuln | grep -q ":554 "; then
            printf "${YELLOW}警告: 端口554已被占用，可能影响MediaMTX服务器启动${NC}\n"
        fi
    fi
    
    printf "${GREEN}必要文件检查完成${NC}\n"
    return 0
}

# --- 原始的 create_default_config() 函数已移除 ---

# 验证配置文件
validate_config() {
    if [ -f "${BASE_PATH}/mediamtx" ] && [ -f "${CONFIG_FILE}" ]; then
        printf "${BLUE}验证配置文件...${NC}\n"
        # 使用MediaMTX验证配置文件
        if "${BASE_PATH}/mediamtx" -h > /dev/null 2>&1; then
            printf "${GREEN}MediaMTX可执行文件正常${NC}\n"
        else
            printf "${YELLOW}警告: 无法验证MediaMTX可执行文件${NC}\n"
        fi
        
        # 验证日志配置
        validate_log_config
    fi
}

# 验证日志配置
validate_log_config() {
    if [ -f "${CONFIG_FILE}" ]; then
        printf "${BLUE}验证日志配置...${NC}\n"
        
        # 检查日志相关配置项
        if grep -q "logLevel:" "${CONFIG_FILE}"; then
            log_level=$(grep "logLevel:" "${CONFIG_FILE}" | cut -d' ' -f2)
            printf "${GREEN}日志级别: %s${NC}\n" "${log_level}"
        else
            printf "${YELLOW}未找到日志级别配置${NC}\n"
        fi
        
        if grep -q "logFile:" "${CONFIG_FILE}"; then
            log_file=$(grep "logFile:" "${CONFIG_FILE}" | cut -d' ' -f2)
            printf "${GREEN}日志文件: %s${NC}\n" "${log_file}"
            
            # 检查日志文件是否可写
            if [ -f "${log_file}" ]; then
                if [ -w "${log_file}" ]; then
                    printf "${GREEN}日志文件可写${NC}\n"
                else
                    printf "${YELLOW}日志文件不可写${NC}\n"
                fi
            else
                # 尝试创建日志文件
                mkdir -p "$(dirname "${log_file}")"
                if touch "${log_file}" 2>/dev/null; then
                    printf "${GREEN}已创建日志文件${NC}\n"
                else
                    printf "${RED}无法创建日志文件${NC}\n"
                fi
            fi
        else
            printf "${YELLOW}未找到日志文件配置${NC}\n"
        fi
    fi
}

# 清空所有日志文件
cleanup_all_logs() {
    printf "${BLUE}清空所有日志文件...${NC}\n"
    
    # 清空MediaMTX日志
    if [ -f "${MEDIAMTX_LOG}" ]; then
        > "${MEDIAMTX_LOG}"
        printf "${GREEN}已清空MediaMTX日志文件${NC}\n"
    fi
    
    # 清空FFmpeg日志
    if [ -d "${FFMPEG_LOG_DIR}" ]; then
        find "${FFMPEG_LOG_DIR}" -name "*.log" -type f -exec sh -c '> "{}"' \;
        printf "${GREEN}已清空所有FFmpeg日志文件${NC}\n"
    fi
}

# 检查并清理过大的日志文件
check_and_cleanup_logs() {
    # 检查MediaMTX日志文件大小（超过10MB时清空）
    if [ -f "${MEDIAMTX_LOG}" ]; then
        # 使用基本的shell语法获取文件大小
        size=$(stat -c %s "${MEDIAMTX_LOG}" 2>/dev/null || echo 0)
        if [ "$size" -gt 10485760 ]; then  # 10MB
            > "${MEDIAMTX_LOG}"
            printf "${YELLOW}MediaMTX日志文件已超过10MB，已清空文件${NC}\n"
        fi
    fi
    
    # 检查FFmpeg日志文件大小（超过5MB时清空）
    if [ -d "${FFMPEG_LOG_DIR}" ]; then
        # 使用基本的shell语法遍历日志文件
        find "${FFMPEG_LOG_DIR}" -name "*.log" -type f | while read logfile; do
            size=$(stat -c %s "$logfile" 2>/dev/null || echo 0)
            if [ "$size" -gt 5242880 ]; then  # 5MB
                > "$logfile"
                printf "${YELLOW}FFmpeg日志文件 %s 已超过5MB，已清空文件${NC}\n" "$(basename "$logfile")"
            fi
        done
    fi
}

# 启动日志监控线程
start_log_monitoring() {
    # 启动后台进程定期检查日志文件大小
    # 使用基本的shell语法
    (
        while true; do
            # 兼容OpenWRT的sleep命令
            if ! (sleep 30 2>/dev/null); then
                # 如果sleep命令有问题，使用替代方法
                read -t 30 -d '' dummy_variable < /dev/null 2>/dev/null || true
            fi
            check_and_cleanup_logs
        done
    ) &
    LOG_MONITOR_PID=$!
    echo "$LOG_MONITOR_PID" > "${LOG_DIR}/log_monitor.pid"
    printf "${GREEN}日志监控线程已启动${NC}\n"
}

# 停止日志监控线程
stop_log_monitoring() {
    if [ -f "${LOG_DIR}/log_monitor.pid" ]; then
        local pid=$(cat "${LOG_DIR}/log_monitor.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            printf "${GREEN}日志监控线程已停止${NC}\n"
        fi
        rm -f "${LOG_DIR}/log_monitor.pid"
    fi
}

# FFmpeg进程监控线程
start_ffmpeg_monitoring() {
    # 启动后台进程定期检查FFmpeg进程状态
    (
        while true; do
            # 兼容OpenWRT的sleep命令
            if ! (sleep 30 2>/dev/null); then
                # 如果sleep命令有问题，使用替代方法
                read -t 30 -d '' dummy_variable < /dev/null 2>/dev/null || true
            fi
            
            # 检查FFmpeg进程是否仍在运行
            if [ -f "${PID_FILE}" ]; then
                while IFS= read -r line; do
                    if echo "$line" | grep -q "ffmpeg_"; then
                        process_name=$(echo "$line" | cut -d':' -f1)
                        pid=$(echo "$line" | cut -d':' -f2)
                        
                        if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
                            printf "${YELLOW}检测到FFmpeg进程 %s (PID: %s) 已停止${NC}\n" "$process_name" "$pid"
                            # 尝试从活动流信息中恢复
                            if [ -f "${LOG_DIR}/active_streams.txt" ]; then
                                stream_info=$(grep "$process_name" "${LOG_DIR}/active_streams.txt" 2>/dev/null)
                                if [ -n "$stream_info" ]; then
                                    video_file=$(echo "$stream_info" | cut -d'|' -f2)
                                    if [ -f "$video_file" ]; then
                                        # 重启FFmpeg进程
                                        stream_id=$(echo "$process_name" | sed 's/ffmpeg_//')
                                        rtsp_url="rtsp://127.0.0.1:554/live/1/${stream_id}"
                                        log_file="${FFMPEG_LOG_DIR}/${stream_id}.log"
                                        
                                        printf "${YELLOW}尝试重启FFmpeg推流进程 %s${NC}\n" "$process_name"
                                        nohup ffmpeg -re -stream_loop "${STREAM_LOOP}" -i "$video_file" \
                                            -map 0:v:0 -an -c copy -payload_type 96 -threads ${FFMPEG_THREADS} -hide_banner -nostats \
                                            -f rtsp -rtsp_transport udp "$rtsp_url" > "$log_file" 2>&1 &
                                        NEW_FFMPEG_PID=$!
                                        
                                        # 更新PID文件中的PID
                                        # 兼容macOS和Linux的sed命令
                                        if sed -i.bak "s/${process_name}:${pid}/${process_name}:${NEW_FFMPEG_PID}/" "${PID_FILE}" 2>/dev/null; then
                                            rm -f "${PID_FILE}.bak"
                                        else
                                            # 如果上面的命令失败，尝试BSD sed格式
                                            sed -i "" "s/${process_name}:${pid}/${process_name}:${NEW_FFMPEG_PID}/" "${PID_FILE}"
                                        fi
                                        printf "${GREEN}FFmpeg推流 %s 已重启 (PID: %s)${NC}\n" "$process_name" "$NEW_FFMPEG_PID"
                                    fi
                                fi
                            fi
                        fi
                    fi
                done < "${PID_FILE}"
            fi
        done
    ) &
    FFMPEG_MONITOR_PID=$!
    echo "$FFMPEG_MONITOR_PID" > "${LOG_DIR}/ffmpeg_monitor.pid"
    printf "${GREEN}FFmpeg进程监控线程已启动${NC}\n"
}

# 停止FFmpeg进程监控线程
stop_ffmpeg_monitoring() {
    if [ -f "${LOG_DIR}/ffmpeg_monitor.pid" ]; then
        local pid=$(cat "${LOG_DIR}/ffmpeg_monitor.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            printf "${GREEN}FFmpeg进程监控线程已停止${NC}\n"
        fi
        rm -f "${LOG_DIR}/ffmpeg_monitor.pid"
    fi
}

# 获取视频文件列表
get_video_files() {
    file_type="$1"
    # 使用基本的shell语法
    video_files=""
    
    # 创建临时文件存储文件名和数字
    temp_file="/tmp/video_files_$$"
    
    if [ "$file_type" = "ts" ]; then
        # 只查找TS文件，按文件名中的数字顺序排序
        find "${VIDEO_PATH}" -name "*.ts" -type f | while read -r file; do
            basename_file=$(basename "$file")
            num=$(echo "$basename_file" | sed 's/[^0-9].*$//' | sed 's/^$/0/')
            echo "${num} ${file}" >> "${temp_file}"
        done
    else
        # 查找所有支持的视频文件，按文件名中的数字顺序排序
        find "${VIDEO_PATH}" -type f \( -name "*.ts" -o -name "*.mp4" -o -name "*.avi" -o -name "*.mkv" -o -name "*.mov" -o -name "*.flv" -o -name "*.wmv" \) | while read -r file; do
            basename_file=$(basename "$file")
            num=$(echo "$basename_file" | sed 's/[^0-9].*$//' | sed 's/^$/0/')
            echo "${num} ${file}" >> "${temp_file}"
        done
    fi
    
    # 检查临时文件是否存在且不为空
    if [ -f "${temp_file}" ] && [ -s "${temp_file}" ]; then
        # 按数字排序并提取文件路径
        sorted_files=$(sort -k1,1n "${temp_file}" | cut -d' ' -f2-)
        video_files="$sorted_files"
    fi
    
    # 清理临时文件
    rm -f "${temp_file}"
    
    # 返回文件列表
    echo "$video_files"
}

# 启动RTSP服务
start_service() {
    printf "${BLUE}正在启动RTSP推流服务...${NC}\n"
    
    # 检查并强制杀死已运行的进程
    kill_existing_processes
    
    # 检查必要文件
    if ! check_required_files; then
        printf "${RED}启动失败: 必要文件检查未通过${NC}\n"
        return 1
    fi
    
    # 用户点击开始后，立即清空所有日志文件
    cleanup_all_logs
    
    # 启动MediaMTX服务器
    printf "${BLUE}启动MediaMTX服务器...${NC}\n"
    echo "调试信息: BASE_PATH=${BASE_PATH}"
    echo "调试信息: CONFIG_FILE=${CONFIG_FILE}"
    echo "调试信息: MEDIAMTX_LOG=${MEDIAMTX_LOG}"

    # 检查配置文件是否存在
    if [ ! -f "${CONFIG_FILE}" ]; then
        # 理论上已经被 check_required_files 检查过
        printf "${RED}错误: 配置文件不存在: %s${NC}\n" "${CONFIG_FILE}"
        return 1
    fi

    # 显示配置文件内容用于调试
    printf "${YELLOW}配置文件内容:${NC}\n"
    cat "${CONFIG_FILE}"
    printf "${YELLOW}配置文件结束${NC}\n"

    # 检查MediaMTX可执行文件是否存在
    if [ ! -f "${BASE_PATH}/mediamtx" ]; then
        printf "${RED}错误: MediaMTX可执行文件不存在: %s/mediamtx${NC}\n" "${BASE_PATH}"
        return 1
    fi

    # 检查MediaMTX可执行文件是否有执行权限
    if [ ! -x "${BASE_PATH}/mediamtx" ]; then
        printf "${YELLOW}警告: MediaMTX可执行文件没有执行权限，尝试添加执行权限...${NC}\n"
        chmod +x "${BASE_PATH}/mediamtx"
    fi

    # 启动MediaMTX服务器并捕获错误输出
    printf "${BLUE}启动MediaMTX服务...${NC}\n"

    # 确保日志目录存在
    mkdir -p "$(dirname "${MEDIAMTX_LOG}")"

    # 确保日志文件存在
    touch "${MEDIAMTX_LOG}"

    # 启动MediaMTX服务器
    nohup "${BASE_PATH}/mediamtx" "${CONFIG_FILE}" >> "${MEDIAMTX_LOG}" 2>&1 &
    MEDIAMTX_PID=$!
    echo "$MEDIAMTX_PID" > "${PID_FILE}"
    echo "mediamtx:$MEDIAMTX_PID" >> "${PID_FILE}"

    # 等待服务器启动（兼容OpenWRT）
    if ! (sleep 3 2>/dev/null); then
        # 如果sleep命令有问题，使用替代方法
        read -t 3 -d '' dummy_variable < /dev/null 2>/dev/null || true
    fi

    # 检查MediaMTX是否成功启动
    if ! kill -0 "$MEDIAMTX_PID" 2>/dev/null; then
        printf "${RED}MediaMTX服务器启动失败${NC}\n"
        # 显示错误日志
        if [ -f /tmp/mediamtx_start.log ]; then
            printf "${YELLOW}错误日志:${NC}\n"
            cat /tmp/mediamtx_start.log
            rm -f /tmp/mediamtx_start.log
        fi
        rm -f "${PID_FILE}"
        return 1
    else
        # 清理临时日志文件
        rm -f /tmp/mediamtx_start.log
        
        # 检查日志文件是否正常创建
        printf "${BLUE}检查日志文件...${NC}\n"
        if [ -f "${MEDIAMTX_LOG}" ]; then
            printf "${GREEN}日志文件已创建: %s${NC}\n" "${MEDIAMTX_LOG}"
        else
            printf "${YELLOW}日志文件未创建${NC}\n"
        fi
    fi

    printf "${GREEN}MediaMTX服务器已启动 (PID: %s)${NC}\n" "$MEDIAMTX_PID"

    # 获取视频文件
    printf "${BLUE}查找视频文件...${NC}\n"
    file_type="all"  # 默认推送所有支持的视频文件格式

    # 使用基本的shell语法替代数组
    video_files_list=$(get_video_files "$file_type")

    if [ -z "$video_files_list" ]; then
        printf "${YELLOW}在目录 %s 中未找到视频文件${NC}\n" "${VIDEO_PATH}"
        # 停止已启动的服务
        stop_service
        return 1
    fi

    # 计算文件数量
    video_count=0
    for file in $video_files_list; do
        video_count=$((video_count + 1))
    done

    printf "${GREEN}找到 %s 个视频文件${NC}\n" "$video_count"

    # 启动FFmpeg推流进程
    stream_count=0
    active_streams=""  # 保存活动流信息
    for video_file in $video_files_list; do
        # 从文件名中提取数字部分作为流ID
        filename=$(basename "$video_file")
        # 使用正则表达式提取文件名开头的数字
        extracted_stream_id=$(echo "$filename" | sed -E 's/^([0-9]+).*/\1/' 2>/dev/null || echo "")
        
        # 如果无法从文件名提取有效数字，则使用递增计数器
        if [ -z "$extracted_stream_id" ] || [ "$extracted_stream_id" -le 0 ] 2>/dev/null; then
            extracted_stream_id=$((stream_count + 1))
        fi
        
        stream_id=$extracted_stream_id
        rtsp_url="rtsp://127.0.0.1:554/live/1/${stream_id}"
        log_file="${FFMPEG_LOG_DIR}/${stream_id}.log"
        
        # 检查视频文件是否存在
        if [ ! -f "$video_file" ]; then
            printf "${YELLOW}警告: 找不到视频文件 %s${NC}\n" "$video_file"
            continue
        fi
        
        # 启动FFmpeg推流进程
        printf "${BLUE}启动推流 %s: %s${NC}\n" "$stream_id" "$(basename "$video_file")"
        nohup ffmpeg -re -stream_loop "${STREAM_LOOP}" -i "$video_file" \
            -map 0:v:0 -an -c copy -payload_type 96 -threads ${FFMPEG_THREADS} -hide_banner -nostats \
            -f rtsp -rtsp_transport udp "$rtsp_url" > "$log_file" 2>&1 &
        FFMPEG_PID=$!
        
        # 保存FFmpeg进程PID
        echo "ffmpeg_${stream_id}:$FFMPEG_PID" >> "${PID_FILE}"
        
        printf "${GREEN}推流 %s 已启动 (PID: %s)${NC}\n" "$stream_id" "$FFMPEG_PID"
        printf "  RTSP地址: %s\n" "$rtsp_url"
        printf "  视频文件: %s\n" "$video_file"
        
        # 保存活动流信息
        if [ -z "$active_streams" ]; then
            active_streams="${rtsp_url}|${video_file}"
        else
            active_streams="${active_streams}
${rtsp_url}|${video_file}"
        fi
        
        stream_count=$((stream_count + 1))
        
        # 短暂间隔避免资源竞争（兼容OpenWRT）
        if [ $stream_count -lt $video_count ]; then
            # 检查系统是否支持小数睡眠
            if ! (sleep 0.1 2>/dev/null); then
                # 如果不支持小数，使用整数延迟
                sleep 1 2>/dev/null || true
            fi
        fi
    done
    
    # 启动定时日志监控和FFmpeg进程监控
    start_log_monitoring
    start_ffmpeg_monitoring

    printf "${GREEN}RTSP推流服务启动成功${NC}\n"
    printf "${GREEN}已启动 %s 个视频流${NC}\n" "$stream_count"

    # 显示所有访问地址
    # 注意：由于现在使用文件名中的数字作为流ID，实际流ID可能不连续
    printf "${BLUE}推流地址:${NC}\n"
    # 从活动流信息文件中读取实际的流地址
    if [ -f "${LOG_DIR}/active_streams.txt" ]; then
        while IFS= read -r line; do
            if [ -n "$line" ]; then
                rtsp_url=$(echo "$line" | cut -d'|' -f1)
                printf "  %s\n" "$rtsp_url"
            fi
        done < "${LOG_DIR}/active_streams.txt"
    fi

    # 保存活动流信息到文件
    if [ -n "$active_streams" ]; then
        echo "$active_streams" > "${LOG_DIR}/active_streams.txt"
    fi

    return 0
}

# 停止RTSP服务
stop_service() {
    printf "${BLUE}正在停止RTSP推流服务...${NC}\n"
    
    # 停止监控线程
    stop_ffmpeg_monitoring
    stop_log_monitoring
    
    # 检查PID文件是否存在
    if [ ! -f "${PID_FILE}" ]; then
        printf "${YELLOW}服务未在运行${NC}\n"
    else
        # 读取并终止所有进程
        printf "${BLUE}终止记录的进程...${NC}\n"
        while IFS= read -r line; do
            if echo "$line" | grep -q ":"; then
                process_name=$(echo "$line" | cut -d':' -f1)
                pid=$(echo "$line" | cut -d':' -f2)
                
                # 检查进程是否存在
                if kill -0 "$pid" 2>/dev/null; then
                    printf "${YELLOW}终止 %s (PID: %s)${NC}\n" "$process_name" "$pid"
                    # 终止进程
                    kill "$pid"
                    # 等待进程终止（兼容OpenWRT）
                    wait_count=0
                    while kill -0 "$pid" 2>/dev/null && [ $wait_count -lt 20 ]; do
                        # 兼容OpenWRT的sleep命令
                        if ! (sleep 0.5 2>/dev/null); then
                            # 如果sleep命令有问题，使用替代方法
                            read -t 1 -d '' dummy_variable < /dev/null 2>/dev/null || true
                        fi
                        wait_count=$((wait_count + 1))
                    done
                    
                    # 如果进程仍未终止，强制终止
                    if kill -0 "$pid" 2>/dev/null; then
                        printf "${RED}强制终止 %s (PID: %s)${NC}\n" "$process_name" "$pid"
                        kill -9 "$pid"
                    else
                        printf "${GREEN}已停止 %s (PID: %s)${NC}\n" "$process_name" "$pid"
                    fi
                else
                    printf "${YELLOW}%s (PID: %s) 未在运行${NC}\n" "$process_name" "$pid"
                fi
            fi
        done < "${PID_FILE}"
        
        # 删除PID文件和活动流信息文件
        rm -f "${PID_FILE}"
        rm -f "${LOG_DIR}/active_streams.txt"
    fi
    
    # 强制杀死所有相关的MediaMTX和FFmpeg进程（使用OpenWRT兼容方式）
    printf "${BLUE}强制终止所有相关进程...${NC}\n"
    
    # 使用pgrep检查进程（如果可用）
    if command -v pgrep >/dev/null 2>&1; then
        # 终止MediaMTX进程
        if pgrep -f "mediamtx" > /dev/null 2>&1; then
            printf "${YELLOW}终止MediaMTX进程...${NC}\n"
            for pid in $(pgrep -f "mediamtx"); do
                if kill -0 "$pid" 2>/dev/null; then
                    kill "$pid"
                    printf "${YELLOW}已发送终止信号到MediaMTX进程 (PID: %s)${NC}\n" "$pid"
                fi
            done
            # 兼容OpenWRT的sleep命令
            if ! (sleep 2 2>/dev/null); then
                read -t 2 -d '' dummy_variable < /dev/null 2>/dev/null || true
            fi
            
            # 如果还有进程运行，强制杀死
            if pgrep -f "mediamtx" > /dev/null 2>&1; then
                for pid in $(pgrep -f "mediamtx"); do
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止MediaMTX进程 (PID: %s)${NC}\n" "$pid"
                    fi
                done
            fi
        fi
        
        # 终止ffmpeg推流进程
        if pgrep -f "ffmpeg.*rtsp" > /dev/null 2>&1; then
            printf "${YELLOW}终止FFmpeg推流进程...${NC}\n"
            for pid in $(pgrep -f "ffmpeg.*rtsp"); do
                if kill -0 "$pid" 2>/dev/null; then
                    kill "$pid"
                    printf "${YELLOW}已发送终止信号到FFmpeg推流进程 (PID: %s)${NC}\n" "$pid"
                fi
            done
            # 兼容OpenWRT的sleep命令
            if ! (sleep 2 2>/dev/null); then
                read -t 2 -d '' dummy_variable < /dev/null 2>/dev/null || true
            fi
            
            # 如果还有进程运行，强制杀死
            if pgrep -f "ffmpeg.*rtsp" > /dev/null 2>&1; then
                for pid in $(pgrep -f "ffmpeg.*rtsp"); do
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止FFmpeg推流进程 (PID: %s)${NC}\n" "$pid"
                    fi
                done
            fi
        fi
        
        # 终止ffmpeg RTSP进程
        if pgrep -f "ffmpeg.*-rtsp_transport" > /dev/null 2>&1; then
            printf "${YELLOW}终止FFmpeg RTSP进程...${NC}\n"
            for pid in $(pgrep -f "ffmpeg.*-rtsp_transport"); do
                if kill -0 "$pid" 2>/dev/null; then
                    kill "$pid"
                    printf "${YELLOW}已发送终止信号到FFmpeg RTSP进程 (PID: %s)${NC}\n" "$pid"
                fi
            done
            # 兼容OpenWRT的sleep命令
            if ! (sleep 2 2>/dev/null); then
                read -t 2 -d '' dummy_variable < /dev/null 2>/dev/null || true
            fi
            
            # 如果还有进程运行，强制杀死
            if pgrep -f "ffmpeg.*-rtsp_transport" > /dev/null 2>&1; then
                for pid in $(pgrep -f "ffmpeg.*-rtsp_transport"); do
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止FFmpeg RTSP进程 (PID: %s)${NC}\n" "$pid"
                    fi
                done
            fi
        fi
    else
        # 如果没有pgrep命令，使用ps命令查找进程
        printf "${YELLOW}使用ps命令查找进程...${NC}\n"
        
        # 查找MediaMTX进程
        mediamtx_pids=$(ps | grep "mediamtx" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        if [ -n "$mediamtx_pids" ]; then
            printf "${YELLOW}终止MediaMTX进程...${NC}\n"
            for pid in $mediamtx_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    kill "$pid"
                    printf "${YELLOW}已发送终止信号到MediaMTX进程 (PID: %s)${NC}\n" "$pid"
                fi
            done
            # 兼容OpenWRT的sleep命令
            if ! (sleep 2 2>/dev/null); then
                read -t 2 -d '' dummy_variable < /dev/null 2>/dev/null || true
            fi
            
            # 如果还有进程运行，强制杀死
            mediamtx_pids=$(ps | grep "mediamtx" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
            if [ -n "$mediamtx_pids" ]; then
                for pid in $mediamtx_pids; do
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止MediaMTX进程 (PID: %s)${NC}\n" "$pid"
                    fi
                done
            fi
        fi
        
        # 查找FFmpeg推流进程
        ffmpeg_pids=$(ps | grep "ffmpeg.*rtsp" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        if [ -n "$ffmpeg_pids" ]; then
            printf "${YELLOW}终止FFmpeg推流进程...${NC}\n"
            for pid in $ffmpeg_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    kill "$pid"
                    printf "${YELLOW}已发送终止信号到FFmpeg推流进程 (PID: %s)${NC}\n" "$pid"
                fi
            done
            # 兼容OpenWRT的sleep命令
            if ! (sleep 2 2>/dev/null); then
                read -t 2 -d '' dummy_variable < /dev/null 2>/dev/null || true
            fi
            
            # 如果还有进程运行，强制杀死
            ffmpeg_pids=$(ps | grep "ffmpeg.*rtsp" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
            if [ -n "$ffmpeg_pids" ]; then
                for pid in $ffmpeg_pids; do
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止FFmpeg推流进程 (PID: %s)${NC}\n" "$pid"
                    fi
                done
            fi
        fi
        
        # 查找FFmpeg RTSP进程
        ffmpeg_rtsp_pids=$(ps | grep "ffmpeg.*-rtsp_transport" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        if [ -n "$ffmpeg_rtsp_pids" ]; then
            printf "${YELLOW}终止FFmpeg RTSP进程...${NC}\n"
            for pid in $ffmpeg_rtsp_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    kill "$pid"
                    printf "${YELLOW}已发送终止信号到FFmpeg RTSP进程 (PID: %s)${NC}\n" "$pid"
                fi
            done
            # 兼容OpenWRT的sleep命令
            if ! (sleep 2 2>/dev/null); then
                read -t 2 -d '' dummy_variable < /dev/null 2>/dev/null || true
            fi
            
            # 如果还有进程运行，强制杀死
            ffmpeg_rtsp_pids=$(ps | grep "ffmpeg.*-rtsp_transport" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
            if [ -n "$ffmpeg_rtsp_pids" ]; then
                for pid in $ffmpeg_rtsp_pids; do
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止FFmpeg RTSP进程 (PID: %s)${NC}\n" "$pid"
                    fi
                done
            fi
        fi
    fi
    
    # 等待进程完全终止
    # 兼容OpenWRT的sleep命令
    if ! (sleep 3 2>/dev/null); then
        read -t 3 -d '' dummy_variable < /dev/null 2>/dev/null || true
    fi
    
    # 最终验证
    if command -v pgrep >/dev/null 2>&1; then
        if pgrep -f "mediamtx" > /dev/null 2>&1; then
            mediamtx_pids=$(pgrep -f "mediamtx")
            printf "${RED}警告: 仍有MediaMTX进程在运行 (PID: %s)${NC}\n" "$mediamtx_pids"
        else
            printf "${GREEN}MediaMTX进程已全部终止${NC}\n"
        fi
        
        if pgrep -f "ffmpeg.*rtsp" > /dev/null 2>&1; then
            ffmpeg_pids=$(pgrep -f "ffmpeg.*rtsp")
            printf "${RED}警告: 仍有FFmpeg推流进程在运行 (PID: %s)${NC}\n" "$ffmpeg_pids"
        else
            printf "${GREEN}FFmpeg推流进程已全部终止${NC}\n"
        fi
    else
        # 使用ps命令验证
        mediamtx_pids=$(ps | grep "mediamtx" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        ffmpeg_pids=$(ps | grep "ffmpeg.*rtsp" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        
        if [ -n "$mediamtx_pids" ]; then
            printf "${RED}警告: 仍有MediaMTX进程在运行 (PID: %s)${NC}\n" "$mediamtx_pids"
        else
            printf "${GREEN}MediaMTX进程已全部终止${NC}\n"
        fi
        
        if [ -n "$ffmpeg_pids" ]; then
            printf "${RED}警告: 仍有FFmpeg推流进程在运行 (PID: %s)${NC}\n" "$ffmpeg_pids"
        else
            printf "${GREEN}FFmpeg推流进程已全部终止${NC}\n"
        fi
    fi
    
    printf "${GREEN}RTSP推流服务已停止${NC}\n"
    return 0
}

# 重启RTSP服务
restart_service() {
    printf "${BLUE}正在重启RTSP推流服务...${NC}\n"
    stop_service
    # 兼容OpenWRT的sleep命令
    if ! (sleep 2 2>/dev/null); then
        # 如果sleep命令有问题，使用替代方法
        read -t 2 -d '' dummy_variable < /dev/null 2>/dev/null || true
    fi
    start_service
}

# 检查服务状态
check_status() {
    printf "${BLUE}检查RTSP推流服务状态...${NC}\n"
    
    # 检查MediaMTX进程
    printf "${BLUE}检查MediaMTX进程...${NC}\n"
    if command -v pgrep >/dev/null 2>&1; then
        if pgrep -f "mediamtx" > /dev/null 2>&1; then
            mediamtx_pids=$(pgrep -f "mediamtx")
            mediamtx_count=$(echo "$mediamtx_pids" | wc -w)
            printf "${GREEN}MediaMTX进程正在运行 (PID: %s) - 共 %s 个进程${NC}\n" "$mediamtx_pids" "$mediamtx_count"
            
            # 显示进程详细信息
            for pid in $mediamtx_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    proc_info=$(ps -p "$pid" -o pid,ppid,cmd 2>/dev/null | tail -n +2 2>/dev/null || ps | grep "$pid" | grep "mediamtx" | grep -v "grep")
                    printf "  ${YELLOW}PID %s: %s${NC}\n" "$pid" "$proc_info"
                fi
            done
        else
            printf "${RED}MediaMTX进程未在运行${NC}\n"
        fi
    else
        # 使用ps命令检查
        mediamtx_pids=$(ps | grep "mediamtx" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        if [ -n "$mediamtx_pids" ]; then
            mediamtx_count=$(echo "$mediamtx_pids" | wc -w)
            printf "${GREEN}MediaMTX进程正在运行 (PID: %s) - 共 %s 个进程${NC}\n" "$mediamtx_pids" "$mediamtx_count"
            
            # 显示进程详细信息
            for pid in $mediamtx_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    proc_info=$(ps | grep "$pid" | grep "mediamtx" | grep -v "grep")
                    printf "  ${YELLOW}PID %s: %s${NC}\n" "$pid" "$proc_info"
                fi
            done
        else
            printf "${RED}MediaMTX进程未在运行${NC}\n"
        fi
    fi
    
    # 检查FFmpeg推流进程
    printf "${BLUE}检查FFmpeg推流进程...${NC}\n"
    if command -v pgrep >/dev/null 2>&1; then
        if pgrep -f "ffmpeg.*rtsp" > /dev/null 2>&1; then
            ffmpeg_pids=$(pgrep -f "ffmpeg.*rtsp")
            ffmpeg_count=$(echo "$ffmpeg_pids" | wc -w)
            printf "${GREEN}FFmpeg推流进程正在运行 (PID: %s) - 共 %s 个进程${NC}\n" "$ffmpeg_pids" "$ffmpeg_count"
            
            # 显示进程详细信息
            for pid in $ffmpeg_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    proc_info=$(ps -p "$pid" -o pid,ppid,cmd 2>/dev/null | tail -n +2 2>/dev/null || ps | grep "$pid" | grep "ffmpeg" | grep -v "grep")
                    printf "  ${YELLOW}PID %s: %s${NC}\n" "$pid" "$proc_info"
                fi
            done
        else
            printf "${RED}FFmpeg推流进程未在运行${NC}\n"
        fi
    else
        # 使用ps命令检查
        ffmpeg_pids=$(ps | grep "ffmpeg.*rtsp" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        if [ -n "$ffmpeg_pids" ]; then
            ffmpeg_count=$(echo "$ffmpeg_pids" | wc -w)
            printf "${GREEN}FFmpeg推流进程正在运行 (PID: %s) - 共 %s 个进程${NC}\n" "$ffmpeg_pids" "$ffmpeg_count"
            
            # 显示进程详细信息
            for pid in $ffmpeg_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    proc_info=$(ps | grep "$pid" | grep "ffmpeg" | grep -v "grep")
                    printf "  ${YELLOW}PID %s: %s${NC}\n" "$pid" "$proc_info"
                fi
            done
        else
            printf "${RED}FFmpeg推流进程未在运行${NC}\n"
        fi
    fi
    
    # 检查PID文件
    if [ ! -f "${PID_FILE}" ]; then
        printf "${YELLOW}PID文件不存在${NC}\n"
    else
        printf "${BLUE}检查PID文件记录的进程...${NC}\n"
        running_processes=0
        total_processes=0
        
        # 使用基本的shell语法读取PID文件
        while IFS= read -r line; do
            if echo "$line" | grep -q ":"; then
                process_name=$(echo "$line" | cut -d':' -f1)
                pid=$(echo "$line" | cut -d':' -f2)
                total_processes=$((total_processes + 1))
                
                if kill -0 "$pid" 2>/dev/null; then
                    printf "${GREEN}%s 正在运行 (PID: %s)${NC}\n" "$process_name" "$pid"
                    running_processes=$((running_processes + 1))
                else
                    printf "${RED}%s 已停止 (PID: %s)${NC}\n" "$process_name" "$pid"
                fi
            fi
        done < "${PID_FILE}"
        
        if [ $running_processes -eq $total_processes ] && [ $total_processes -gt 0 ]; then
            printf "${GREEN}服务正在运行 (%s/%s 进程)${NC}\n" "$running_processes" "$total_processes"
        elif [ $running_processes -gt 0 ]; then
            printf "${YELLOW}服务部分运行 (%s/%s 进程)${NC}\n" "$running_processes" "$total_processes"
        else
            printf "${RED}服务未在运行${NC}\n"
        fi
    fi
    
    # 显示活动的推流地址
    if [ -f "${LOG_DIR}/active_streams.txt" ]; then
        printf "${BLUE}已启动的推流地址:${NC}\n"
        while IFS= read -r line; do
            rtsp_url=$(echo "$line" | cut -d'|' -f1)
            video_file=$(echo "$line" | cut -d'|' -f2)
            printf "  %s -> %s\n" "$rtsp_url" "$video_file"
        done < "${LOG_DIR}/active_streams.txt"
    fi
    
    return 0
}

# 显示帮助信息
show_help() {
    echo "RTSP推流服务控制脚本"
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  start     启动RTSP推流服务"
    echo "  stop      停止RTSP推流服务"
    echo "  restart   重启RTSP推流服务"
    echo "  status    检查服务状态"
    echo "  help      显示此帮助信息"
    echo ""
    echo "交互式菜单:"
    echo "  不带参数运行脚本进入交互式菜单"
}

# 显示主菜单
show_menu() {
    clear
    echo "========================"
    echo "RTSP推流服务控制面板"
    echo "========================"
    echo "1. 启动推流服务"
    echo "2. 停止推流服务"
    echo "3. 重启推流服务"
    echo "4. 查看服务状态"
    echo "5. 查看Mediamtx日志"
    echo "6. 查看FFmpeg推流日志"
    echo "0. 退出脚本"
    echo "========================"
    printf "请选择操作 [0-6]: "
}

# 主程序
main() {
    # 检查命令行参数
    case "$1" in
        start)
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        status)
            check_status
            ;;
        help|--help|-h)
            show_help
            ;;
        "")
            # 交互式菜单
            while true; do
                show_menu
                read -r choice
                case $choice in
                    1)
                        start_service
                        echo ""
                        printf "按任意键继续..."
                        read -r unused_variable
                        ;;
                    2)
                        stop_service
                        echo ""
                        printf "按任意键继续..."
                        read -r unused_variable
                        ;;
                    3)
                        restart_service
                        echo ""
                        printf "按任意键继续..."
                        read -r unused_variable
                        ;;
                    4)
                        check_status
                        echo ""
                        printf "按任意键继续..."
                        read -r unused_variable
                        ;;
                    5)
                        # 查看Mediamtx日志（最近50条）
                        echo ""
                        if [ -f "${MEDIAMTX_LOG}" ]; then
                            echo "=== Mediamtx日志最后50行 ==="
                            tail -n 50 "${MEDIAMTX_LOG}" 2>/dev/null || echo "无法读取日志文件或文件为空"
                        else
                            echo "错误: 日志文件不存在 ${MEDIAMTX_LOG}"
                        fi
                        echo ""
                        printf "按任意键继续..."
                        read -r unused_variable
                        ;;
                    6)
                        # 查看FFmpeg日志（1.log，最近50条）
                        echo ""
                        ffmpeg_log_file="${FFMPEG_LOG_DIR}/1.log"
                        if [ -f "$ffmpeg_log_file" ]; then
                            echo "=== FFmpeg日志(1.log)最后50行 ==="
                            tail -n 50 "$ffmpeg_log_file" 2>/dev/null || echo "无法读取日志文件或文件为空"
                        else
                            echo "错误: 日志文件不存在 $ffmpeg_log_file"
                        fi
                        echo ""
                        printf "按任意键继续..."
                        read -r unused_variable
                        ;;
                    0)
                        printf "${GREEN}退出脚本${NC}\n"
                        exit 0
                        ;;
                    *)
                        printf "${RED}无效选择，请重新输入${NC}\n"
                        echo ""
                        printf "按任意键继续..."
                        read -r unused_variable
                        ;;
                esac
            done
            ;;
        *)
            printf "${RED}无效参数: %s${NC}\n" "$1"
            show_help
            exit 1
            ;;
    esac
}

# 检查并强制杀死已运行的进程
kill_existing_processes() {
    printf "${BLUE}检查并终止已运行的进程...${NC}\n"
    
    # 方式1: 检查PID文件中的进程
    if [ -f "${PID_FILE}" ]; then
        printf "${YELLOW}终止PID文件中记录的进程...${NC}\n"
        while IFS= read -r line; do
            if echo "$line" | grep -q ":"; then
                process_name=$(echo "$line" | cut -d':' -f1)
                pid=$(echo "$line" | cut -d':' -f2)
                
                if kill -0 "$pid" 2>/dev/null; then
                    printf "${YELLOW}终止 %s (PID: %s)${NC}\n" "$process_name" "$pid"
                    kill "$pid"
                    # 兼容OpenWRT的sleep命令
                    if ! (sleep 1 2>/dev/null); then
                        read -t 1 -d '' dummy_variable < /dev/null 2>/dev/null || true
                    fi
                    
                    # 如果进程仍在运行，强制终止
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止 %s (PID: %s)${NC}\n" "$process_name" "$pid"
                    fi
                fi
            fi
        done < "${PID_FILE}"
        rm -f "${PID_FILE}"
    fi
    
    # 方式2: 使用pgrep检查进程（如果可用）
    if command -v pgrep >/dev/null 2>&1; then
        # 检查MediaMTX进程
        if pgrep -f "mediamtx" > /dev/null 2>&1; then
            printf "${YELLOW}发现正在运行的MediaMTX进程，正在终止...${NC}\n"
            # 逐个终止进程
            for pid in $(pgrep -f "mediamtx"); do
                if kill -0 "$pid" 2>/dev/null; then
                    printf "${YELLOW}终止MediaMTX进程 (PID: %s)${NC}\n" "$pid"
                    kill "$pid"
                    # 兼容OpenWRT的sleep命令
                    if ! (sleep 1 2>/dev/null); then
                        read -t 1 -d '' dummy_variable < /dev/null 2>/dev/null || true
                    fi
                    
                    # 如果进程仍在运行，强制终止
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止MediaMTX进程 (PID: %s)${NC}\n" "$pid"
                    fi
                fi
            done
        fi
        
        # 检查FFmpeg推流进程
        if pgrep -f "ffmpeg.*rtsp" > /dev/null 2>&1; then
            printf "${YELLOW}发现正在运行的FFmpeg推流进程，正在终止...${NC}\n"
            # 逐个终止进程
            for pid in $(pgrep -f "ffmpeg.*rtsp"); do
                if kill -0 "$pid" 2>/dev/null; then
                    printf "${YELLOW}终止FFmpeg推流进程 (PID: %s)${NC}\n" "$pid"
                    kill "$pid"
                    # 兼容OpenWRT的sleep命令
                    if ! (sleep 1 2>/dev/null); then
                        read -t 1 -d '' dummy_variable < /dev/null 2>/dev/null || true
                    fi
                    
                    # 如果进程仍在运行，强制终止
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止FFmpeg推流进程 (PID: %s)${NC}\n" "$pid"
                    fi
                fi
            done
        fi
        
        # 检查FFmpeg RTSP进程
        if pgrep -f "ffmpeg.*-rtsp_transport" > /dev/null 2>&1; then
            printf "${YELLOW}发现正在运行的FFmpeg RTSP进程，正在终止...${NC}\n"
            # 逐个终止进程
            for pid in $(pgrep -f "ffmpeg.*-rtsp_transport"); do
                if kill -0 "$pid" 2>/dev/null; then
                    printf "${YELLOW}终止FFmpeg RTSP进程 (PID: %s)${NC}\n" "$pid"
                    kill "$pid"
                    # 兼容OpenWRT的sleep命令
                    if ! (sleep 1 2>/dev/null); then
                        read -t 1 -d '' dummy_variable < /dev/null 2>/dev/null || true
                    fi
                    
                    # 如果进程仍在运行，强制终止
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止FFmpeg RTSP进程 (PID: %s)${NC}\n" "$pid"
                    fi
                fi
            done
        fi
    else
        # 如果没有pgrep命令，使用ps命令查找进程
        printf "${YELLOW}使用ps命令查找进程...${NC}\n"
        
        # 查找MediaMTX进程
        mediamtx_pids=$(ps | grep "mediamtx" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        if [ -n "$mediamtx_pids" ]; then
            printf "${YELLOW}发现正在运行的MediaMTX进程，正在终止...${NC}\n"
            for pid in $mediamtx_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    printf "${YELLOW}终止MediaMTX进程 (PID: %s)${NC}\n" "$pid"
                    kill "$pid"
                    # 兼容OpenWRT的sleep命令
                    if ! (sleep 1 2>/dev/null); then
                        read -t 1 -d '' dummy_variable < /dev/null 2>/dev/null || true
                    fi
                    
                    # 如果进程仍在运行，强制终止
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止MediaMTX进程 (PID: %s)${NC}\n" "$pid"
                    fi
                fi
            done
        fi
        
        # 查找FFmpeg推流进程
        ffmpeg_pids=$(ps | grep "ffmpeg.*rtsp" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        if [ -n "$ffmpeg_pids" ]; then
            printf "${YELLOW}发现正在运行的FFmpeg推流进程，正在终止...${NC}\n"
            for pid in $ffmpeg_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    printf "${YELLOW}终止FFmpeg推流进程 (PID: %s)${NC}\n" "$pid"
                    kill "$pid"
                    # 兼容OpenWRT的sleep命令
                    if ! (sleep 1 2>/dev/null); then
                        read -t 1 -d '' dummy_variable < /dev/null 2>/dev/null || true
                    fi
                    
                    # 如果进程仍在运行，强制终止
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止FFmpeg推流进程 (PID: %s)${NC}\n" "$pid"
                    fi
                fi
            done
        fi
        
        # 查找FFmpeg RTSP进程
        ffmpeg_rtsp_pids=$(ps | grep "ffmpeg.*-rtsp_transport" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        if [ -n "$ffmpeg_rtsp_pids" ]; then
            printf "${YELLOW}发现正在运行的FFmpeg RTSP进程，正在终止...${NC}\n"
            for pid in $ffmpeg_rtsp_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    printf "${YELLOW}终止FFmpeg RTSP进程 (PID: %s)${NC}\n" "$pid"
                    kill "$pid"
                    # 兼容OpenWRT的sleep命令
                    if ! (sleep 1 2>/dev/null); then
                        read -t 1 -d '' dummy_variable < /dev/null 2>/dev/null || true
                    fi
                    
                    # 如果进程仍在运行，强制终止
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -9 "$pid"
                        printf "${RED}强制终止FFmpeg RTSP进程 (PID: %s)${NC}\n" "$pid"
                    fi
                fi
            done
        fi
    fi
    
    # 等待进程完全终止
    # 兼容OpenWRT的sleep命令
    if ! (sleep 3 2>/dev/null); then
        read -t 3 -d '' dummy_variable < /dev/null 2>/dev/null || true
    fi
    
    # 最终验证
    if command -v pgrep >/dev/null 2>&1; then
        if pgrep -f "mediamtx" > /dev/null 2>&1; then
            mediamtx_pids=$(pgrep -f "mediamtx")
            printf "${RED}警告: 仍有MediaMTX进程在运行 (PID: %s)${NC}\n" "$mediamtx_pids"
            # 尝试逐个杀死
            for pid in $mediamtx_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    kill -9 "$pid"
                    printf "${RED}强制终止MediaMTX进程 (PID: %s)${NC}\n" "$pid"
                fi
            done
        else
            printf "${GREEN}MediaMTX进程已全部终止${NC}\n"
        fi
        
        if pgrep -f "ffmpeg.*rtsp" > /dev/null 2>&1; then
            ffmpeg_pids=$(pgrep -f "ffmpeg.*rtsp")
            printf "${RED}警告: 仍有FFmpeg推流进程在运行 (PID: %s)${NC}\n" "$ffmpeg_pids"
            # 尝试逐个杀死
            for pid in $ffmpeg_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    kill -9 "$pid"
                    printf "${RED}强制终止FFmpeg推流进程 (PID: %s)${NC}\n" "$pid"
                fi
            done
        else
            printf "${GREEN}FFmpeg推流进程已全部终止${NC}\n"
        fi
    else
        # 使用ps命令验证
        mediamtx_pids=$(ps | grep "mediamtx" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        ffmpeg_pids=$(ps | grep "ffmpeg.*rtsp" | grep -v "grep" | awk '{print $1}' 2>/dev/null)
        
        if [ -n "$mediamtx_pids" ]; then
            printf "${RED}警告: 仍有MediaMTX进程在运行 (PID: %s)${NC}\n" "$mediamtx_pids"
            for pid in $mediamtx_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    kill -9 "$pid"
                    printf "${RED}强制终止MediaMTX进程 (PID: %s)${NC}\n" "$pid"
                fi
            done
        else
            printf "${GREEN}MediaMTX进程已全部终止${NC}\n"
        fi
        
        if [ -n "$ffmpeg_pids" ]; then
            printf "${RED}警告: 仍有FFmpeg推流进程在运行 (PID: %s)${NC}\n" "$ffmpeg_pids"
            for pid in $ffmpeg_pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    kill -9 "$pid"
                    printf "${RED}强制终止FFmpeg推流进程 (PID: %s)${NC}\n" "$pid"
                fi
            done
        else
            printf "${GREEN}FFmpeg推流进程已全部终止${NC}\n"
        fi
    fi
    
    # 清理旧的PID文件
    if [ -f "${PID_FILE}" ]; then
        printf "${YELLOW}清理旧的PID文件...${NC}\n"
        rm -f "${PID_FILE}"
    fi
    
    printf "${GREEN}已终止所有相关进程${NC}\n"
}

# 脚本入口点
main "$@"
