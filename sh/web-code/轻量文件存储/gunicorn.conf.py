# Gunicorn 配置文件
import multiprocessing

# 服务器套接字
bind = "127.0.0.1:5000"

# 工作进程数
workers = multiprocessing.cpu_count() * 2 + 1

# 工作进程类
worker_class = "sync"

# 工作进程超时时间（秒）
timeout = 30

# 重启工作进程前处理的请求数
max_requests = 1000
max_requests_jitter = 100

# 日志配置
accesslog = "/www/wwwroot/web/logs/gunicorn_access.log"
errorlog = "/www/wwwroot/web/logs/gunicorn_error.log"
loglevel = "info"

# 进程命名
proc_name = "jack-disk"

# 服务器机械资源
preload_app = True