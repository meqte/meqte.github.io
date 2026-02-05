#!/usr/bin/env python3
"""
Jack-Disk - 轻量临时文件存储工具（优化版）
基于Python Flask框架，提供安全、高效的临时文件存储服务
"""

import os
import sys
import json
import time
import uuid
import hashlib
import logging
import threading
from datetime import datetime, timedelta
from pathlib import Path
from functools import wraps
from typing import Dict, List, Optional, Any
from logging.handlers import RotatingFileHandler

from flask import Flask, request, jsonify, send_file, render_template, session
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

# 配置日志系统 - 使用RotatingFileHandler来限制日志文件大小
# 创建自定义日志过滤器，只记录关键信息
class KeyInfoFilter(logging.Filter):
    def filter(self, record):
        # 只记录包含关键信息的日志
        key_messages = [
            '文件上传成功', '文件下载', '删除文件', '清理了', '保存元数据失败',
            '加载元数据失败', '上传失败', '下载失败', '删除失败', '清理过期文件失败',
            '检查存储空间失败', '初始化分片上传失败', '上传分片失败', '完成分片上传失败',
            '获取上传状态失败', '获取文件列表失败', '文件预览失败', '批量删除失败',
            '获取统计信息失败', '管理员登录', '定时任务已启动', '配置已更新', '清空所有文件',
            '清空文件失败', '更新配置失败', '获取配置失败', '管理员登录失败'
        ]
        
        # 如果是ERROR或CRITICAL级别的日志，总是记录
        if record.levelno >= logging.ERROR:
            return True
            
        # 检查是否包含关键信息
        for msg in key_messages:
            if msg in record.getMessage():
                return True
        
        return False

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler('jack-disk.log', maxBytes=10*1024*1024, backupCount=0),  # 10MB限制，超过后自动清空
        logging.StreamHandler()
    ]
)

# 为文件处理器添加过滤器，只记录关键信息到文件
file_handler = None
for handler in logging.getLogger().handlers:
    if isinstance(handler, RotatingFileHandler):
        file_handler = handler
        break

if file_handler:
    file_handler.addFilter(KeyInfoFilter())

logger = logging.getLogger(__name__)

class JackDiskConfig:
    """配置管理类"""
    
    def __init__(self):
        # 基础配置
        self.admin_password = os.getenv('TEMPSTORE_ADMIN_PASSWORD', 'admin')  # 默认密码为admin
        self.upload_dir = os.getenv('TEMPSTORE_UPLOAD_DIR', './uploads')
        self.log_level = os.getenv('TEMPSTORE_LOG_LEVEL', 'INFO')
        self.max_storage = self._parse_size(os.getenv('TEMPSTORE_MAX_STORAGE', '20GB'))
        
        # 高级配置
        # 修改：将清理间隔从15分钟改为5分钟，确保文件过期后能更及时被清理
        self.clean_interval = int(os.getenv('TEMPSTORE_CLEAN_INTERVAL', '3600'))  # 60分钟
        self.session_timeout = int(os.getenv('TEMPSTORE_SESSION_TIMEOUT', '1800'))  # 30分钟
        self.max_file_size = self._parse_size(os.getenv('TEMPSTORE_MAX_FILE_SIZE', '1GB'))
        self.max_files_per_upload = int(os.getenv('TEMPSTORE_MAX_FILES_PER_UPLOAD', '10'))
        self.file_expire_hours = int(os.getenv('TEMPSTORE_FILE_EXPIRE_HOURS', '24'))
        
        # 安全配置
        self.allowed_extensions = set()
        self.blocked_extensions = {'.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js'}
        
    def _parse_size(self, size_str: str) -> int:
        """解析文件大小字符串"""
        size_str = size_str.upper()
        if size_str.endswith('GB'):
            return int(size_str[:-2]) * 1024 * 1024 * 1024
        elif size_str.endswith('MB'):
            return int(size_str[:-2]) * 1024 * 1024
        elif size_str.endswith('KB'):
            return int(size_str[:-2]) * 1024
        else:
            return int(size_str)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'max_file_size': self.max_file_size,
            'max_storage': self.max_storage,
            'file_expire_hours': self.file_expire_hours,
            'max_files_per_upload': self.max_files_per_upload,
            'clean_interval': self.clean_interval
        }

class FileMetadata:
    """文件元数据管理"""
    
    def __init__(self, file_id: str, original_name: str, file_size: int, 
                 file_type: str, upload_time: int, expire_time: int,
                 md5_hash: str = "", download_count: int = 0, is_deleted: bool = False):
        self.file_id = file_id
        self.original_name = original_name
        self.file_size = file_size
        self.file_type = file_type
        self.upload_time = upload_time
        self.expire_time = expire_time
        self.md5_hash = md5_hash
        self.download_count = download_count
        self.is_deleted = is_deleted
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'file_id': self.file_id,
            'original_name': self.original_name,
            'file_size': self.file_size,
            'file_type': self.file_type,
            'upload_time': self.upload_time,
            'expire_time': self.expire_time,
            'md5_hash': self.md5_hash,
            'download_count': self.download_count,
            'is_deleted': self.is_deleted
        }

class JackDisk:
    """Jack-Disk核心类"""
    
    def __init__(self):
        self.config = JackDiskConfig()
        # 修改Flask应用初始化，指定模板目录
        self.app = Flask(__name__, 
                        template_folder='.')  # 使用当前目录作为模板目录
        self.app.secret_key = os.getenv('SECRET_KEY', 'jack-disk-secret-key-2024')
        
        # 设置最大内容长度限制（略小于配置的最大文件大小，留出一些余量）
        self.app.config['MAX_CONTENT_LENGTH'] = self.config.max_file_size + 100 * 1024 * 1024  # 增加100MB余量
        
        # 初始化上传目录
        Path(self.config.upload_dir).mkdir(exist_ok=True)
        
        # 文件元数据缓存
        self.file_metadata: Dict[str, FileMetadata] = {}
        self.metadata_file = Path(self.config.upload_dir) / 'metadata.json'
        
        # 加载元数据
        self._load_metadata()
        
        # 初始化定时任务
        self.scheduler = BackgroundScheduler()
        self._init_scheduler()
        
        # 注册路由
        self._register_routes()
        
        # 统计信息
        self.stats = {
            'total_uploads': 0,
            'total_downloads': 0,
            'total_files': 0,
            'storage_used': 0
        }
    
    def _load_metadata(self):
        """加载文件元数据"""
        try:
            if self.metadata_file.exists():
                with open(self.metadata_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for file_id, meta in data.items():
                        self.file_metadata[file_id] = FileMetadata(**meta)
                logger.info(f"加载了 {len(self.file_metadata)} 个文件的元数据")
        except Exception as e:
            logger.error(f"加载元数据失败: {e}")
    
    def _save_metadata(self):
        """保存文件元数据"""
        try:
            data = {file_id: meta.to_dict() for file_id, meta in self.file_metadata.items()}
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存元数据失败: {e}")
    
    def _init_scheduler(self):
        """初始化定时任务"""
        # 清理过期文件任务
        self.scheduler.add_job(
            func=self._cleanup_expired_files,
            trigger=IntervalTrigger(seconds=self.config.clean_interval),
            id='cleanup_expired_files',
            name='清理过期文件',
            replace_existing=True
        )
        
        # 保存元数据任务
        self.scheduler.add_job(
            func=self._save_metadata,
            trigger=IntervalTrigger(seconds=600),  # 10分钟保存一次
            id='save_metadata',
            name='保存元数据',
            replace_existing=True
        )
        
        # 清理临时文件任务
        self.scheduler.add_job(
            func=self._cleanup_temp_files,
            trigger=IntervalTrigger(seconds=3600),  # 1小时清理一次临时文件
            id='cleanup_temp_files',
            name='清理临时文件',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info("定时任务已启动")
    
    def _cleanup_expired_files(self):
        """清理过期文件"""
        try:
            current_time = int(time.time())
            expired_files = []
            
            # 找出过期文件
            for file_id, metadata in self.file_metadata.items():
                if metadata.expire_time < current_time and not metadata.is_deleted:
                    expired_files.append(file_id)
            
            # 删除过期文件
            for file_id in expired_files:
                self._delete_file(file_id)
            
            # 检查存储空间
            self._check_storage_limit()
            
            if expired_files:
                logger.info(f"清理了 {len(expired_files)} 个过期文件")
                
        except Exception as e:
            logger.error(f"清理过期文件失败: {e}")
    
    def _check_storage_limit(self):
        """检查存储空间限制"""
        try:
            total_size = self._get_total_storage_size()
            if total_size > self.config.max_storage:
                # 需要清理文件
                files_to_clean = []
                
                # 按过期时间排序，优先清理快过期的文件
                sorted_files = sorted(
                    [(file_id, meta) for file_id, meta in self.file_metadata.items() 
                     if not meta.is_deleted],
                    key=lambda x: x[1].expire_time
                )
                
                # 清理文件直到满足存储限制
                for file_id, metadata in sorted_files:
                    if total_size <= self.config.max_storage:
                        break
                    
                    files_to_clean.append(file_id)
                    total_size -= metadata.file_size
                
                # 执行清理
                for file_id in files_to_clean:
                    self._delete_file(file_id)
                
                logger.info(f"存储空间超限，清理了 {len(files_to_clean)} 个文件")
                
        except Exception as e:
            logger.error(f"检查存储空间失败: {e}")
    
    def _get_total_storage_size(self) -> int:
        """获取总存储大小"""
        total_size = 0
        for metadata in self.file_metadata.values():
            if not metadata.is_deleted:
                total_size += metadata.file_size
        return total_size
    
    def _get_actual_disk_usage(self) -> int:
        """获取实际磁盘使用量"""
        total_size = 0
        upload_path = Path(self.config.upload_dir)
        
        # 遍历上传目录下的所有文件
        for file_path in upload_path.rglob('*'):
            if file_path.is_file():
                total_size += file_path.stat().st_size
        
        return total_size
    
    def _delete_file(self, file_id: str):
        """删除文件"""
        try:
            if file_id in self.file_metadata:
                metadata = self.file_metadata[file_id]
                
                # 删除物理文件
                file_path = self._get_file_path(file_id, metadata.upload_time)
                if file_path.exists():
                    file_path.unlink()
                
                # 标记为已删除
                metadata.is_deleted = True
                
                logger.info(f"删除文件: {file_id} - {metadata.original_name}")
                
        except Exception as e:
            logger.error(f"删除文件失败 {file_id}: {e}")
    
    def _get_file_path(self, file_id: str, upload_time: int) -> Path:
        """获取文件路径"""
        upload_date = datetime.fromtimestamp(upload_time)
        date_dir = Path(self.config.upload_dir) / upload_date.strftime('%Y%m%d')
        date_dir.mkdir(exist_ok=True)
        
        return date_dir / f"{file_id}_{upload_time}"
    
    def _generate_file_id(self) -> str:
        """生成文件ID"""
        return uuid.uuid4().hex[:8]
    
    def _secure_filename(self, filename: str) -> str:
        """安全的文件名处理，保留中文字符"""
        # 使用更宽松的文件名处理方式
        # 只移除危险字符，保留中文、英文、数字和其他安全字符
        
        # 定义危险字符
        dangerous_chars = '<>:"/\\|?*'
        
        # 移除危险字符
        safe_name = filename
        for char in dangerous_chars:
            safe_name = safe_name.replace(char, '_')
        
        # 移除控制字符
        safe_name = ''.join(char for char in safe_name if ord(char) >= 32)
        
        # 如果处理后为空或以点开头，使用默认名称
        if not safe_name or safe_name.startswith('.'):
            safe_name = f"file_{int(time.time())}"
        
        # 检查扩展名
        ext = Path(safe_name).suffix.lower()
        if ext in self.config.blocked_extensions:
            safe_name = f"{Path(safe_name).stem}.txt"
        
        return safe_name
    
    def _calculate_md5(self, file_path: Path) -> str:
        """计算文件MD5"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def _get_file_type(self, file_path: Path) -> str:
        """获取文件MIME类型"""
        import mimetypes
        # 根据文件扩展名猜测MIME类型
        mime_type, _ = mimetypes.guess_type(str(file_path))
        return mime_type or 'application/octet-stream'
    
    def _require_admin_auth(self, f):
        """管理员认证装饰器"""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'admin_authenticated' not in session:
                return jsonify({'status': 'error', 'message': '需要管理员权限'}), 403
            
            # 检查会话是否过期
            if 'auth_time' in session:
                if time.time() - session['auth_time'] > self.config.session_timeout:
                    session.pop('admin_authenticated', None)
                    session.pop('auth_time', None)
                    return jsonify({'status': 'error', 'message': '会话已过期'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    
    def _register_routes(self):
        """注册路由"""
        
        @self.app.route('/')
        def index():
            """首页"""
            return render_template('index.html')
        
        # 添加静态文件路由
        @self.app.route('/<path:filename>')
        def static_files(filename):
            """提供静态文件服务"""
            # 检查请求的文件是否存在
            if Path(filename).exists() and filename in ['tailwind.css', 'main.js']:
                return send_file(filename)
            else:
                # 如果不是静态文件，返回404
                return jsonify({'status': 'error', 'message': '文件不存在'}), 404
        
        @self.app.route('/api/upload', methods=['POST'])
        def upload_file():
            """文件上传"""
            try:
                if 'files' not in request.files:
                    return jsonify({'status': 'error', 'message': '没有文件'}), 400
                
                files = request.files.getlist('files')
                if len(files) > self.config.max_files_per_upload:
                    return jsonify({'status': 'error', 'message': f'单次上传文件数不能超过{self.config.max_files_per_upload}个'}), 400
                
                uploaded_files = []
                
                for file in files:
                    if file.filename == '':
                        continue
                    
                    # 检查文件大小
                    file.seek(0, 2)  # 移动到文件末尾
                    file_size = file.tell()
                    file.seek(0)  # 重置文件指针
                    
                    if file_size > self.config.max_file_size:
                        return jsonify({
                            'status': 'error', 
                            'message': f'文件过大（最大{self.config.max_file_size // 1024 // 1024}MB）'
                        }), 400
                    
                    # 生成文件ID和元数据
                    file_id = self._generate_file_id()
                    original_name = self._secure_filename(file.filename or '')
                    file_type = file.content_type or 'application/octet-stream'
                    upload_time = int(time.time())
                    expire_time = upload_time + (self.config.file_expire_hours * 3600)
                    
                    # 创建文件元数据
                    metadata = FileMetadata(
                        file_id=file_id,
                        original_name=original_name,
                        file_size=file_size,
                        file_type=file_type,
                        upload_time=upload_time,
                        expire_time=expire_time
                    )
                    
                    # 保存文件
                    file_path = self._get_file_path(file_id, upload_time)
                    file.save(file_path)
                    
                    # 计算MD5
                    metadata.md5_hash = self._calculate_md5(file_path)
                    
                    # 保存元数据
                    self.file_metadata[file_id] = metadata
                    
                    # 检查存储空间限制
                    self._check_storage_limit()
                    
                    uploaded_files.append({
                        'file_id': file_id,
                        'original_name': original_name,
                        'file_size': file_size,
                        'file_size_formatted': self._format_file_size(file_size),
                        'file_type': file_type
                    })
                    
                    # 更新统计
                    self.stats['total_uploads'] += 1
                    self.stats['total_files'] += 1
                    
                    logger.info(f"文件上传成功: {file_id} - {original_name} ({file_size} bytes)")
                
                return jsonify({
                    'status': 'success',
                    'files': uploaded_files,
                    'message': f'成功上传{len(uploaded_files)}个文件'
                })
                
            except Exception as e:
                logger.error(f"文件上传失败: {e}")
                return jsonify({'status': 'error', 'message': '上传失败'}), 500
        
        @self.app.route('/api/upload/init', methods=['POST'])
        def init_chunked_upload():
            """初始化分片上传"""
            try:
                data = request.get_json()
                filename = data.get('filename')
                file_size = data.get('file_size')
                chunk_size = data.get('chunk_size', 1024 * 1024)  # 默认1MB
                
                if not filename or not file_size:
                    return jsonify({'status': 'error', 'message': '缺少必要参数'}), 400
                
                # 检查文件大小
                if file_size > self.config.max_file_size:
                    return jsonify({
                        'status': 'error', 
                        'message': f'文件过大（最大{self.config.max_file_size // 1024 // 1024}MB）'
                    }), 400
                
                # 检查是否已经存在相同文件的上传任务
                existing_upload_id = None
                temp_base_dir = Path(self.config.upload_dir) / 'temp'
                if temp_base_dir.exists():
                    for upload_dir in temp_base_dir.iterdir():
                        if upload_dir.is_dir():
                            info_file = upload_dir / 'upload_info.json'
                            if info_file.exists():
                                try:
                                    with open(info_file, 'r', encoding='utf-8') as f:
                                        existing_info = json.load(f)
                                    # 检查是否为相同文件（文件名和大小相同）
                                    if (existing_info.get('filename') == filename and 
                                        existing_info.get('file_size') == file_size):
                                        existing_upload_id = existing_info.get('upload_id')
                                        break
                                except Exception as e:
                                    logger.warning(f"读取现有上传信息失败: {e}")
                
                # 如果存在相同文件的上传任务，使用现有的
                if existing_upload_id:
                    upload_id = existing_upload_id
                    temp_dir = temp_base_dir / upload_id
                    info_file = temp_dir / 'upload_info.json'
                    
                    # 读取现有上传信息
                    with open(info_file, 'r', encoding='utf-8') as f:
                        upload_info = json.load(f)
                    
                    logger.info(f"继续分片上传: {upload_id} - {filename} (已上传 {len(upload_info.get('uploaded_chunks', []))}/{upload_info.get('chunk_count', 0)} 个分片)")
                else:
                    # 生成新的上传ID
                    upload_id = self._generate_file_id()
                    
                    # 创建临时目录
                    temp_dir = temp_base_dir / upload_id
                    temp_dir.mkdir(parents=True, exist_ok=True)
                    
                    # 保存上传信息
                    upload_info = {
                        'upload_id': upload_id,
                        'filename': filename,
                        'file_size': file_size,
                        'chunk_size': chunk_size,
                        'chunk_count': (file_size + chunk_size - 1) // chunk_size,
                        'uploaded_chunks': [],
                        'created_time': int(time.time())
                    }
                    
                    # 保存上传信息到临时文件
                    info_file = temp_dir / 'upload_info.json'
                    with open(info_file, 'w', encoding='utf-8') as f:
                        json.dump(upload_info, f, ensure_ascii=False, indent=2)
                    
                    logger.info(f"初始化分片上传: {upload_id} - {filename}")
                
                return jsonify({
                    'status': 'success',
                    'upload_id': upload_id,
                    'chunk_count': upload_info['chunk_count'],
                    'uploaded_chunks': upload_info.get('uploaded_chunks', [])
                })
                
            except Exception as e:
                logger.error(f"初始化分片上传失败: {e}")
                return jsonify({'status': 'error', 'message': '初始化失败'}), 500
        
        @self.app.route('/api/upload/chunk', methods=['POST'])
        def upload_chunk():
            """上传分片"""
            try:
                # 获取参数
                upload_id = request.form.get('upload_id')
                chunk_index = int(request.form.get('chunk_index', 0))
                chunk_data = request.files.get('chunk')
                
                if not upload_id or not chunk_data:
                    return jsonify({'status': 'error', 'message': '缺少必要参数'}), 400
                
                # 检查临时目录
                temp_dir = Path(self.config.upload_dir) / 'temp' / upload_id
                if not temp_dir.exists():
                    return jsonify({'status': 'error', 'message': '上传ID无效'}), 400
                
                # 读取上传信息
                info_file = temp_dir / 'upload_info.json'
                if not info_file.exists():
                    return jsonify({'status': 'error', 'message': '上传信息不存在'}), 400
                
                with open(info_file, 'r', encoding='utf-8') as f:
                    upload_info = json.load(f)
                
                # 保存分片
                chunk_file = temp_dir / f'chunk_{chunk_index}'
                chunk_data.save(chunk_file)
                
                # 更新已上传分片列表
                if chunk_index not in upload_info['uploaded_chunks']:
                    upload_info['uploaded_chunks'].append(chunk_index)
                    upload_info['uploaded_chunks'].sort()
                
                # 更新上传信息
                with open(info_file, 'w', encoding='utf-8') as f:
                    json.dump(upload_info, f, ensure_ascii=False, indent=2)
                
                # 不再记录每个分片的上传信息，避免日志过多
                
                return jsonify({
                    'status': 'success',
                    'uploaded_chunks': upload_info['uploaded_chunks']
                })
                
            except Exception as e:
                logger.error(f"上传分片失败: {e}")
                return jsonify({'status': 'error', 'message': '上传分片失败'}), 500
        
        @self.app.route('/api/upload/complete', methods=['POST'])
        def complete_chunked_upload():
            """完成分片上传"""
            try:
                data = request.get_json()
                upload_id = data.get('upload_id')
                
                if not upload_id:
                    return jsonify({'status': 'error', 'message': '缺少上传ID'}), 400
                
                # 检查临时目录
                temp_dir = Path(self.config.upload_dir) / 'temp' / upload_id
                if not temp_dir.exists():
                    return jsonify({'status': 'error', 'message': '上传ID无效'}), 400
                
                # 读取上传信息
                info_file = temp_dir / 'upload_info.json'
                if not info_file.exists():
                    return jsonify({'status': 'error', 'message': '上传信息不存在'}), 400
                
                with open(info_file, 'r', encoding='utf-8') as f:
                    upload_info = json.load(f)
                
                # 检查是否所有分片都已上传
                expected_chunks = list(range(upload_info['chunk_count']))
                if sorted(upload_info['uploaded_chunks']) != expected_chunks:
                    missing_chunks = [i for i in expected_chunks if i not in upload_info['uploaded_chunks']]
                    return jsonify({
                        'status': 'error', 
                        'message': '分片不完整',
                        'missing_chunks': missing_chunks
                    }), 400
                
                # 合并分片
                filename = upload_info['filename']
                file_id = self._generate_file_id()
                upload_time = int(time.time())
                expire_time = upload_time + (self.config.file_expire_hours * 3600)
                
                # 创建文件元数据
                metadata = FileMetadata(
                    file_id=file_id,
                    original_name=self._secure_filename(filename),
                    file_size=upload_info['file_size'],
                    file_type='application/octet-stream',  # 后续会更新
                    upload_time=upload_time,
                    expire_time=expire_time
                )
                
                # 合并文件
                file_path = self._get_file_path(file_id, upload_time)
                with open(file_path, 'wb') as outfile:
                    for i in range(upload_info['chunk_count']):
                        chunk_file = temp_dir / f'chunk_{i}'
                        with open(chunk_file, 'rb') as infile:
                            outfile.write(infile.read())
                
                # 获取文件类型和大小
                metadata.file_type = self._get_file_type(file_path)
                metadata.file_size = file_path.stat().st_size
                
                # 计算MD5
                metadata.md5_hash = self._calculate_md5(file_path)
                
                # 保存元数据
                self.file_metadata[file_id] = metadata
                
                # 删除临时文件
                import shutil
                shutil.rmtree(temp_dir)
                
                # 检查存储空间限制
                self._check_storage_limit()
                
                # 更新统计
                self.stats['total_uploads'] += 1
                self.stats['total_files'] += 1
                
                logger.info(f"完成分片上传: {file_id} - {filename} ({metadata.file_size} bytes)")
                
                return jsonify({
                    'status': 'success',
                    'file_id': file_id,
                    'original_name': metadata.original_name,
                    'file_size': metadata.file_size,
                    'file_size_formatted': self._format_file_size(metadata.file_size),
                    'file_type': metadata.file_type
                })
                
            except Exception as e:
                logger.error(f"完成分片上传失败: {e}")
                return jsonify({'status': 'error', 'message': '完成上传失败'}), 500
        
        @self.app.route('/api/upload/status/<upload_id>', methods=['GET'])
        def get_upload_status(upload_id):
            """获取上传状态"""
            try:
                # 检查临时目录
                temp_dir = Path(self.config.upload_dir) / 'temp' / upload_id
                if not temp_dir.exists():
                    return jsonify({'status': 'error', 'message': '上传ID无效'}), 400
                
                # 读取上传信息
                info_file = temp_dir / 'upload_info.json'
                if not info_file.exists():
                    return jsonify({'status': 'error', 'message': '上传信息不存在'}), 400
                
                with open(info_file, 'r', encoding='utf-8') as f:
                    upload_info = json.load(f)
                
                return jsonify({
                    'status': 'success',
                    'upload_id': upload_id,
                    'filename': upload_info['filename'],
                    'file_size': upload_info['file_size'],
                    'uploaded_chunks': upload_info['uploaded_chunks'],
                    'chunk_count': upload_info['chunk_count'],
                    'progress': len(upload_info['uploaded_chunks']) / upload_info['chunk_count'] if upload_info['chunk_count'] > 0 else 0
                })
                
            except Exception as e:
                logger.error(f"获取上传状态失败: {e}")
                return jsonify({'status': 'error', 'message': '获取状态失败'}), 500
        
        @self.app.route('/api/files')
        def get_files():
            """获取文件列表"""
            try:
                # 获取查询参数
                sort_by = request.args.get('sort', 'upload_time')
                search = request.args.get('search', '').lower()
                page = int(request.args.get('page', 1))
                per_page = int(request.args.get('per_page', 50))
                
                current_time = int(time.time())
                
                # 筛选未过期文件
                active_files = []
                for file_id, metadata in self.file_metadata.items():
                    if not metadata.is_deleted and metadata.expire_time > current_time:
                        # 搜索过滤
                        if search and search not in metadata.original_name.lower():
                            continue
                        
                        active_files.append({
                            'file_id': file_id,
                            'original_name': metadata.original_name,
                            'file_size': metadata.file_size,
                            'file_size_formatted': self._format_file_size(metadata.file_size),
                            'file_type': metadata.file_type,
                            'upload_time': metadata.upload_time,
                            'upload_time_formatted': self._format_time(metadata.upload_time),
                            'expire_time_formatted': self._format_expire_time(metadata.expire_time),
                            'download_count': metadata.download_count
                        })
                
                # 排序 - 默认按上传时间倒序（最新的在前面）
                if sort_by == 'name':
                    active_files.sort(key=lambda x: x['original_name'])
                elif sort_by == 'size':
                    active_files.sort(key=lambda x: x['file_size'], reverse=True)
                else:  # upload_time - 最新的文件排在前面
                    active_files.sort(key=lambda x: x['upload_time'], reverse=True)
                
                # 分页
                total_files = len(active_files)
                total_pages = (total_files + per_page - 1) // per_page
                start_idx = (page - 1) * per_page
                end_idx = min(start_idx + per_page, total_files)
                
                files_page = active_files[start_idx:end_idx]
                
                return jsonify({
                    'status': 'success',
                    'files': files_page,
                    'pagination': {
                        'page': page,
                        'per_page': per_page,
                        'total_files': total_files,
                        'total_pages': total_pages
                    }
                })
                
            except Exception as e:
                logger.error(f"获取文件列表失败: {e}")
                return jsonify({'status': 'error', 'message': '获取文件列表失败'}), 500
        
        @self.app.route('/api/download/<file_id>')
        def download_file(file_id: str):
            """文件下载"""
            try:
                if file_id not in self.file_metadata:
                    return jsonify({'status': 'error', 'message': '文件不存在'}), 404
                
                metadata = self.file_metadata[file_id]
                
                if metadata.is_deleted:
                    return jsonify({'status': 'error', 'message': '文件已被删除'}), 404
                
                current_time = int(time.time())
                if metadata.expire_time <= current_time:
                    return jsonify({'status': 'error', 'message': '文件已过期'}), 404
                
                # 获取文件路径
                file_path = self._get_file_path(file_id, metadata.upload_time)
                if not file_path.exists():
                    return jsonify({'status': 'error', 'message': '文件不存在'}), 404
                
                # 更新下载计数
                metadata.download_count += 1
                self.stats['total_downloads'] += 1
                
                logger.info(f"文件下载: {file_id} - {metadata.original_name}")
                
                return send_file(
                    file_path,
                    as_attachment=True,
                    download_name=metadata.original_name,
                    mimetype=metadata.file_type
                )
                
            except Exception as e:
                logger.error(f"文件下载失败 {file_id}: {e}")
                return jsonify({'status': 'error', 'message': '下载失败'}), 500
        
        @self.app.route('/api/preview/<file_id>')
        def preview_file(file_id: str):
            """文件预览"""
            try:
                if file_id not in self.file_metadata:
                    return jsonify({'status': 'error', 'message': '文件不存在'}), 404
                
                metadata = self.file_metadata[file_id]
                
                if metadata.is_deleted:
                    return jsonify({'status': 'error', 'message': '文件已被删除'}), 404
                
                current_time = int(time.time())
                if metadata.expire_time <= current_time:
                    return jsonify({'status': 'error', 'message': '文件已过期'}), 404
                
                # 获取文件路径
                file_path = self._get_file_path(file_id, metadata.upload_time)
                if not file_path.exists():
                    return jsonify({'status': 'error', 'message': '文件不存在'}), 404
                
                # 检查文件类型是否支持预览
                preview_types = ['text/', 'application/json', 'application/javascript', 'text/css', 'text/html']
                if not any(metadata.file_type.startswith(t) for t in preview_types):
                    return jsonify({'status': 'error', 'message': '该文件类型不支持预览'}), 400
                
                # 读取文件内容
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                return content, 200, {'Content-Type': 'text/plain; charset=utf-8'}
                
            except Exception as e:
                logger.error(f"文件预览失败 {file_id}: {e}")
                return jsonify({'status': 'error', 'message': '预览失败'}), 500
        
        @self.app.route('/api/batch/delete', methods=['POST'])
        @self._require_admin_auth  # 添加管理员权限验证
        def batch_delete_files():
            """批量删除文件"""
            try:
                data = request.get_json()
                if not data or 'file_ids' not in data:
                    return jsonify({'status': 'error', 'message': '缺少文件ID列表'}), 400
                
                file_ids = data['file_ids']
                if not isinstance(file_ids, list):
                    return jsonify({'status': 'error', 'message': 'file_ids必须是数组'}), 400
                
                deleted_count = 0
                errors = []
                
                for file_id in file_ids:
                    if file_id in self.file_metadata:
                        try:
                            self._delete_file(file_id)
                            deleted_count += 1
                        except Exception as e:
                            errors.append({'file_id': file_id, 'error': str(e)})
                    else:
                        errors.append({'file_id': file_id, 'error': '文件不存在'})
                
                return jsonify({
                    'status': 'success',
                    'deleted_count': deleted_count,
                    'errors': errors,
                    'message': f'成功删除{deleted_count}个文件'
                })
                
            except Exception as e:
                logger.error(f"批量删除失败: {e}")
                return jsonify({'status': 'error', 'message': '批量删除失败'}), 500
        
        @self.app.route('/api/stats')
        def get_stats():
            """获取统计信息"""
            try:
                current_time = int(time.time())
                
                # 计算活跃文件数
                active_files = sum(1 for meta in self.file_metadata.values() 
                                 if not meta.is_deleted and meta.expire_time > current_time)
                
                # 计算今日上传数
                today_start = int(datetime.now().replace(hour=0, minute=0, second=0).timestamp())
                today_uploads = sum(1 for meta in self.file_metadata.values() 
                                  if meta.upload_time >= today_start)
                
                # 存储使用情况
                storage_used = self._get_total_storage_size()
                actual_disk_usage = self._get_actual_disk_usage()
                storage_usage_percent = (storage_used / self.config.max_storage * 100) if self.config.max_storage > 0 else 0
                
                stats = {
                    'total_uploads': self.stats['total_uploads'],
                    'total_downloads': self.stats['total_downloads'],
                    'active_files': active_files,
                    'today_uploads': today_uploads,
                    'storage_used': storage_used,
                    'actual_disk_usage': actual_disk_usage,
                    'storage_used_formatted': self._format_file_size(storage_used),
                    'actual_disk_usage_formatted': self._format_file_size(actual_disk_usage),
                    'storage_total_formatted': self._format_file_size(self.config.max_storage),
                    'storage_usage_percent': round(storage_usage_percent, 2)
                }
                
                return jsonify({'status': 'success', 'stats': stats})
                
            except Exception as e:
                logger.error(f"获取统计信息失败: {e}")
                return jsonify({'status': 'error', 'message': '获取统计信息失败'}), 500
        
        @self.app.route('/api/admin/login', methods=['POST'])
        def admin_login():
            """管理员登录"""
            try:
                data = request.get_json()
                if not data or 'password' not in data:
                    return jsonify({'status': 'error', 'message': '缺少密码'}), 400
                
                password = data['password']
                
                # 调试信息
                logger.info(f"Received password: {repr(password)}, Config password: {repr(self.config.admin_password)}, Match: {password == self.config.admin_password}")
                
                if password == self.config.admin_password:
                    session['admin_authenticated'] = True
                    session['auth_time'] = int(time.time())
                    logger.info("管理员登录成功")
                    return jsonify({'status': 'success', 'message': '登录成功'})
                else:
                    logger.warning(f"管理员登录失败: 密码错误")
                    return jsonify({'status': 'error', 'message': '密码错误'}), 403
                
            except Exception as e:
                logger.error(f"管理员登录失败: {e}")
                return jsonify({'status': 'error', 'message': '登录失败'}), 500
        
        @self.app.route('/api/admin/config')
        def get_config():
            """获取配置信息"""
            try:
                config = self.config.to_dict()
                return jsonify({'status': 'success', 'config': config})
                
            except Exception as e:
                logger.error(f"获取配置失败: {e}")
                return jsonify({'status': 'error', 'message': '获取配置失败'}), 500
        
        @self.app.route('/api/admin/config', methods=['POST'])
        @self._require_admin_auth
        def update_config():
            """更新配置"""
            try:
                data = request.get_json()
                if not data:
                    return jsonify({'status': 'error', 'message': '缺少配置数据'}), 400
                
                # 更新配置并验证范围
                if 'max_file_size' in data:
                    max_file_size = int(data['max_file_size'])
                    # 限制文件大小在1MB到10GB之间
                    if max_file_size < 1 * 1024 * 1024:  # 1MB
                        max_file_size = 1 * 1024 * 1024
                    elif max_file_size > 10 * 1024 * 1024 * 1024:  # 10GB
                        max_file_size = 10 * 1024 * 1024 * 1024
                    self.config.max_file_size = max_file_size
                    # 同步更新Flask应用的MAX_CONTENT_LENGTH
                    self.app.config['MAX_CONTENT_LENGTH'] = max_file_size + 100 * 1024 * 1024  # 增加100MB余量
                
                if 'file_expire_hours' in data:
                    file_expire_hours = int(data['file_expire_hours'])
                    # 检查是否是管理员会话
                    is_admin = 'admin_authenticated' in session and session['admin_authenticated']
                    # 限制文件过期时间范围
                    if is_admin:
                        # 管理员登录后，最小支持10分钟（取整为1小时）
                        if file_expire_hours < 1:
                            file_expire_hours = 1
                    else:
                        # 普通用户最小5小时
                        if file_expire_hours < 5:
                            file_expire_hours = 5
                    # 最大值始终限制为48小时
                    if file_expire_hours > 48:
                        file_expire_hours = 48
                    self.config.file_expire_hours = file_expire_hours
                
                if 'max_files_per_upload' in data:
                    self.config.max_files_per_upload = int(data['max_files_per_upload'])
                
                if 'clean_interval' in data:
                    self.config.clean_interval = int(data['clean_interval'])
                
                # 添加对max_storage的更新支持
                if 'max_storage' in data:
                    max_storage = int(data['max_storage'])
                    # 限制总存储在1GB到100GB之间
                    if max_storage < 1 * 1024 * 1024 * 1024:  # 1GB
                        max_storage = 1 * 1024 * 1024 * 1024
                    elif max_storage > 100 * 1024 * 1024 * 1024:  # 100GB
                        max_storage = 100 * 1024 * 1024 * 1024
                    self.config.max_storage = max_storage
                
                logger.info(f"配置已更新: {data}")
                return jsonify({'status': 'success', 'message': '配置更新成功'})
                
            except Exception as e:
                logger.error(f"更新配置失败: {e}")
                return jsonify({'status': 'error', 'message': '更新配置失败'}), 500
        
        @self.app.route('/api/admin/logs')
        @self._require_admin_auth
        def get_logs():
            """获取系统日志"""
            try:
                level = request.args.get('level', 'INFO')
                limit = int(request.args.get('limit', 100))
                
                # 读取日志文件
                log_file = 'jack-disk.log'
                if not Path(log_file).exists():
                    return jsonify({'status': 'success', 'logs': []})
                
                logs = []
                with open(log_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    
                # 过滤和限制日志条数
                for line in reversed(lines[-1000:]):  # 只处理最近1000条
                    if level in line:
                        logs.append(line.strip())
                        if len(logs) >= limit:
                            break
                
                return jsonify({'status': 'success', 'logs': logs})
                
            except Exception as e:
                logger.error(f"获取日志失败: {e}")
                return jsonify({'status': 'error', 'message': '获取日志失败'}), 500
        
        @self.app.route('/api/admin/clear-all', methods=['POST'])
        @self._require_admin_auth
        def clear_all_files():
            """清空所有文件"""
            try:
                deleted_count = 0
                errors = []
                
                # 获取所有文件ID
                file_ids = list(self.file_metadata.keys())
                
                # 删除所有元数据中的文件
                for file_id in file_ids:
                    if file_id in self.file_metadata:
                        try:
                            self._delete_file(file_id)
                            deleted_count += 1
                        except Exception as e:
                            errors.append({'file_id': file_id, 'error': str(e)})
                
                # 清理上传目录中的所有文件（包括未被元数据记录的文件）
                upload_path = Path(self.config.upload_dir)
                if upload_path.exists():
                    # 删除日期目录下的所有文件
                    for date_dir in upload_path.iterdir():
                        if date_dir.is_dir() and date_dir.name != 'temp' and date_dir.name.isdigit() and len(date_dir.name) == 8:
                            try:
                                # 删除目录中的所有文件
                                for file_path in date_dir.iterdir():
                                    if file_path.is_file():
                                        file_path.unlink()
                                # 如果目录为空，则删除目录
                                if not any(date_dir.iterdir()):
                                    date_dir.rmdir()
                            except Exception as e:
                                logger.error(f"清理日期目录失败 {date_dir}: {e}")
                    
                    # 清理临时目录
                    temp_dir = upload_path / 'temp'
                    if temp_dir.exists():
                        try:
                            import shutil
                            shutil.rmtree(temp_dir)
                            temp_dir.mkdir(exist_ok=True)
                        except Exception as e:
                            logger.error(f"清理临时目录失败: {e}")
                
                # 重置统计信息
                self.stats['total_files'] = 0
                self.stats['storage_used'] = 0
                
                # 清空元数据
                self.file_metadata.clear()
                self._save_metadata()
                
                logger.info(f"清空所有文件: 成功删除{deleted_count}个文件，清理了上传目录")
                
                return jsonify({
                    'status': 'success',
                    'deleted_count': deleted_count,
                    'errors': errors,
                    'message': f'成功清空所有文件'
                })
                
            except Exception as e:
                logger.error(f"清空所有文件失败: {e}")
                return jsonify({'status': 'error', 'message': '清空文件失败'}), 500
    
    def _format_file_size(self, size: int) -> str:
        """格式化文件大小"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f}{unit}"
            size = int(size / 1024)  # 修复类型错误
        return f"{size:.1f}TB"
    
    def _format_time(self, timestamp: int) -> str:
        """格式化时间"""
        dt = datetime.fromtimestamp(timestamp)
        now = datetime.now()
        
        if dt.date() == now.date():
            return f"今天 {dt.strftime('%H:%M')}"
        elif dt.date() == (now - timedelta(days=1)).date():
            return f"昨天 {dt.strftime('%H:%M')}"
        else:
            return dt.strftime('%Y-%m-%d %H:%M')
    
    def _format_expire_time(self, timestamp: int) -> str:
        """格式化过期时间，显示为XX点XX分"""
        dt = datetime.fromtimestamp(timestamp)
        return dt.strftime('%H:%M')
    
    def _format_remaining_time(self, seconds: int) -> str:
        """格式化剩余时间"""
        if seconds < 60:
            return f"{seconds}秒"
        elif seconds < 3600:
            minutes = seconds // 60
            return f"{minutes}分钟"
        elif seconds < 86400:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f"{hours}小时{minutes}分钟"
        else:
            days = seconds // 86400
            hours = (seconds % 86400) // 3600
            return f"{days}天{hours}小时"
    
    def _cleanup_temp_files(self):
        """清理临时文件"""
        try:
            temp_dir = Path(self.config.upload_dir) / 'temp'
            if not temp_dir.exists():
                return
            
            # 获取当前时间
            current_time = time.time()
            # 设置临时文件保留时间（2小时）
            temp_file_expire = 2 * 3600  # 修改为2小时
            
            # 遍历临时目录
            for upload_dir in temp_dir.iterdir():
                if upload_dir.is_dir():
                    # 检查info文件
                    info_file = upload_dir / 'upload_info.json'
                    if info_file.exists():
                        try:
                            # 获取文件修改时间
                            file_mtime = info_file.stat().st_mtime
                            # 如果文件超过2小时未修改，则删除整个目录
                            if current_time - file_mtime > temp_file_expire:
                                import shutil
                                shutil.rmtree(upload_dir)
                                logger.info(f"清理过期临时文件目录: {upload_dir}")
                        except Exception as e:
                            logger.error(f"检查临时文件目录失败 {upload_dir}: {e}")
                    else:
                        # 如果没有info文件，检查目录创建时间
                        try:
                            dir_mtime = upload_dir.stat().st_mtime
                            if current_time - dir_mtime > temp_file_expire:
                                import shutil
                                shutil.rmtree(upload_dir)
                                logger.info(f"清理无信息的临时文件目录: {upload_dir}")
                        except Exception as e:
                            logger.error(f"检查临时目录失败 {upload_dir}: {e}")
            
            logger.info("临时文件清理完成")
        except Exception as e:
            logger.error(f"清理临时文件失败: {e}")

    def run(self, host='0.0.0.0', port=5000, debug=False):
        """运行应用"""
        logger.info(f"Jack-Disk 服务启动 - 监听 {host}:{port}")
        logger.info(f"上传目录: {self.config.upload_dir}")
        logger.info(f"文件过期时间: {self.config.file_expire_hours}小时")
        logger.info(f"最大文件大小: {self._format_file_size(self.config.max_file_size)}")
        logger.info(f"总存储限制: {self._format_file_size(self.config.max_storage)}")
        
        try:
            self.app.run(host=host, port=port, debug=debug)
        except KeyboardInterrupt:
            logger.info("服务正在关闭...")
            self.scheduler.shutdown()
            self._save_metadata()
            logger.info("服务已关闭")

if __name__ == '__main__':
    # 设置环境变量
    if not os.getenv('TEMPSTORE_ADMIN_PASSWORD'):
        os.environ['TEMPSTORE_ADMIN_PASSWORD'] = 'admin'  # 使用新的默认密码
    
    # 创建并运行应用
    jack_disk = JackDisk()
    app = jack_disk.app  # 新增这一行，暴露全局 Flask 实例（关键）
    # 获取端口参数
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    
    jack_disk.run(port=port)