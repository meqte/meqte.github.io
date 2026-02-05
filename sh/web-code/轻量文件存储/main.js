class JackDiskUI {
    constructor() {
        this.isAdmin = false;
        this.initializeEventListeners();
        this.loadFiles();
        this.loadStats();
        this.loadConfig(); // 确保在初始化时加载配置信息
    }

    initializeEventListeners() {
        // 上传区域事件
        const uploadZone = document.getElementById('upload-zone');
        const fileInput = document.getElementById('file-input');
        const selectFilesBtn = document.getElementById('select-files-btn');

        if (uploadZone) {
            uploadZone.addEventListener('click', (e) => {
                // 防止点击选择文件按钮时触发上传区域的点击事件
                if (e.target !== selectFilesBtn) {
                    fileInput.click();
                }
            });
            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadZone.classList.add('dragover');
            });
            uploadZone.addEventListener('dragleave', () => {
                uploadZone.classList.remove('dragover');
            });
            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    this.handleFiles(e.dataTransfer.files);
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFiles(e.target.files);
                    // 清空文件输入框的值，以便下次选择相同文件时也能触发change事件
                    e.target.value = '';
                }
            });
        }

        if (selectFilesBtn) {
            selectFilesBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                fileInput.click();
            });
        }

        // 刷新按钮
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadFiles();
                this.loadStats();
            });
        }

        // 搜索框
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.loadFiles(e.target.value);
                }, 300);
            });
        }

        // 排序选择
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.loadFiles(null, e.target.value);
            });
        }

        // 全选按钮
        const selectAllBtn = document.getElementById('select-all-btn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.toggleSelectAll();
            });
        }

        // 批量删除按钮
        const batchDeleteBtn = document.getElementById('batch-delete-btn');
        if (batchDeleteBtn) {
            batchDeleteBtn.addEventListener('click', () => {
                this.handleBatchDelete();
            });
        }

        // 管理员登录相关
        const settingsBtn = document.getElementById('settings-btn');
        const adminLoginBtn = document.getElementById('admin-login-btn');
        const adminCancelBtn = document.getElementById('admin-cancel-btn');
        const adminPassword = document.getElementById('admin-password');
        const adminLoginModal = document.getElementById('admin-login-modal');
        
        // 新增的内联管理员登录相关元素
        const adminConfigArea = document.getElementById('admin-config-area');
        const adminLoginForm = document.getElementById('admin-login-form');
        const configManagement = document.getElementById('config-management');
        const adminPasswordInline = document.getElementById('admin-password-inline');
        const adminLoginInlineBtn = document.getElementById('admin-login-inline-btn');
        const adminCancelInlineBtn = document.getElementById('admin-cancel-inline-btn');
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                if (this.isAdmin) {
                    // 退出管理员模式
                    this.exitAdminMode();
                } else {
                    // 显示内联登录表单
                    if (adminConfigArea) {
                        adminConfigArea.classList.remove('hidden');
                        adminLoginForm.classList.remove('hidden');
                        configManagement.classList.add('hidden');
                        // 聚焦到密码输入框
                        if (adminPasswordInline) {
                            setTimeout(() => adminPasswordInline.focus(), 100);
                        }
                    }
                }
            });
        }

        if (adminLoginBtn) {
            adminLoginBtn.addEventListener('click', () => {
                this.handleAdminLogin();
            });
        }
        
        // 内联登录按钮事件
        if (adminLoginInlineBtn) {
            adminLoginInlineBtn.addEventListener('click', () => {
                this.handleInlineAdminLogin();
            });
        }
        
        // 内联取消按钮事件
        if (adminCancelInlineBtn) {
            adminCancelInlineBtn.addEventListener('click', () => {
                if (adminConfigArea) {
                    adminConfigArea.classList.add('hidden');
                }
            });
        }
        
        // 内联配置关闭按钮事件
        const closeInlineConfigBtn = document.getElementById('close-inline-config');
        if (closeInlineConfigBtn) {
            closeInlineConfigBtn.addEventListener('click', () => {
                if (adminConfigArea) {
                    adminConfigArea.classList.add('hidden');
                }
            });
        }

        if (adminPassword) {
            adminPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleAdminLogin();
                }
            });
        }

        // 模态框关闭事件
        const closeConfigModal = document.getElementById('close-config-modal');
        if (closeConfigModal) {
            closeConfigModal.addEventListener('click', () => {
                this.hideConfigModal();
            });
        }

        const closeLogsModal = document.getElementById('close-logs-modal');
        if (closeLogsModal) {
            closeLogsModal.addEventListener('click', () => {
                this.hideLogsModal();
            });
        }

        const closePreviewModal = document.getElementById('close-preview-modal');
        if (closePreviewModal) {
            closePreviewModal.addEventListener('click', () => {
                this.hidePreviewModal();
            });
        }

        // 配置保存
        const saveConfigBtn = document.getElementById('save-config-btn');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', () => {
                this.saveConfig();
            });
        }

        // 查看日志
        const viewLogsBtn = document.getElementById('view-logs-btn');
        if (viewLogsBtn) {
            viewLogsBtn.addEventListener('click', () => {
                this.loadLogs();
            });
        }
        
        // 内联保存配置
        const saveConfigInlineBtn = document.getElementById('save-config-inline-btn');
        if (saveConfigInlineBtn) {
            saveConfigInlineBtn.addEventListener('click', () => {
                this.saveInlineConfig();
            });
        }
        
        // 清空文件按钮
        const clearAllFilesBtn = document.getElementById('clear-all-files-btn');
        if (clearAllFilesBtn) {
            clearAllFilesBtn.addEventListener('click', () => {
                this.clearAllFiles();
            });
        }

        // 配置滑块事件
        this.initializeConfigSliders();
    }

    initializeConfigSliders() {
        // 模态框滑块事件
        const expireHoursSlider = document.getElementById('config-expire-hours');
        const expireHoursValue = document.getElementById('expire-hours-value');
        if (expireHoursSlider && expireHoursValue) {
            expireHoursSlider.addEventListener('input', (e) => {
                expireHoursValue.textContent = `${e.target.value}小时`;
            });
        }

        const maxFileSizeSlider = document.getElementById('config-max-file-size');
        const maxFileSizeValue = document.getElementById('max-file-size-value');
        if (maxFileSizeSlider && maxFileSizeValue) {
            maxFileSizeSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                // 处理不同的单位显示
                if (value >= 1024) {
                    if (value >= 10240) { // 10GB
                        maxFileSizeValue.textContent = `${(value / 1024).toFixed(0)}GB`;
                    } else {
                        maxFileSizeValue.textContent = `${(value / 1024).toFixed(1)}GB`;
                    }
                } else {
                    maxFileSizeValue.textContent = `${value}MB`;
                }
            });
        }

        const totalStorageSlider = document.getElementById('config-total-storage');
        const totalStorageValue = document.getElementById('total-storage-value');
        if (totalStorageSlider && totalStorageValue) {
            totalStorageSlider.addEventListener('input', (e) => {
                totalStorageValue.textContent = `${e.target.value}GB`;
            });
        }
        
        // 内联配置滑块事件
        const expireHoursInlineSlider = document.getElementById('config-expire-hours-inline');
        const expireHoursInlineValue = document.getElementById('expire-hours-value-inline');
        if (expireHoursInlineSlider && expireHoursInlineValue) {
            expireHoursInlineSlider.addEventListener('input', (e) => {
                expireHoursInlineValue.textContent = `${e.target.value}小时`;
            });
        }

        const maxFileSizeInlineSlider = document.getElementById('config-max-file-size-inline');
        const maxFileSizeInlineValue = document.getElementById('max-file-size-value-inline');
        if (maxFileSizeInlineSlider && maxFileSizeInlineValue) {
            maxFileSizeInlineSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                // 处理不同的单位显示
                if (value >= 1024) {
                    if (value >= 10240) { // 10GB
                        maxFileSizeInlineValue.textContent = `${(value / 1024).toFixed(0)}GB`;
                    } else {
                        maxFileSizeInlineValue.textContent = `${(value / 1024).toFixed(1)}GB`;
                    }
                } else {
                    maxFileSizeInlineValue.textContent = `${value}MB`;
                }
            });
        }

        const totalStorageInlineSlider = document.getElementById('config-total-storage-inline');
        const totalStorageInlineValue = document.getElementById('total-storage-value-inline');
        if (totalStorageInlineSlider && totalStorageInlineValue) {
            totalStorageInlineSlider.addEventListener('input', (e) => {
                totalStorageInlineValue.textContent = `${e.target.value}GB`;
            });
        }
    }

    handleFiles(files) {
        const fileList = Array.from(files);
        if (fileList.length === 0) return;

        // 显示上传进度区域
        this.showUploadProgress();

        // 处理每个文件（串行处理，避免进度条冲突）
        this.processFilesSequentially(fileList);
    }

    async processFilesSequentially(fileList) {
        for (const file of fileList) {
            // 对于大文件使用分片上传
            if (file.size > 100 * 1024 * 1024) { // 大于100MB的文件使用分片上传
                await this.handleChunkedUpload(file);
            } else {
                // 小文件使用普通上传
                await this.handleRegularUpload(file);
            }
        }
        
        // 不再在这里调用showUploadSuccessInProgressBar，每个文件独立处理
    }

    async handleRegularUpload(file) {
        const formData = new FormData();
        formData.append('files', file);

        try {
            // 显示上传进度条
            this.showUploadProgress();
            this.updateRegularUploadProgress(file, 0, 0); // 添加速度参数
            
            // 使用 XMLHttpRequest 来跟踪上传进度
            const xhr = new XMLHttpRequest();
            
            // 上传进度事件
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    const speed = event.loaded / (event.timeStamp / 1000); // bytes per second
                    this.updateRegularUploadProgress(file, percentComplete, speed);
                }
            });
            
            // 上传完成事件
            const promise = new Promise((resolve, reject) => {
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            resolve(result);
                        } catch (e) {
                            reject(new Error('解析响应失败'));
                        }
                    } else {
                        reject(new Error(`上传失败: ${xhr.status}`));
                    }
                });
                
                xhr.addEventListener('error', () => {
                    reject(new Error('网络错误'));
                });
            });
            
            // 开始上传
            xhr.open('POST', '/api/upload', true);
            xhr.send(formData);
            
            // 等待上传完成
            const result = await promise;
            
            if (result.status === 'success') {
                this.updateRegularUploadProgress(file, 100, 0);
                // 每个文件上传完成后独立显示成功状态
                this.showUploadSuccessInProgressBar(file.name, file.size);
                this.loadFiles();
                this.loadStats();
            } else {
                throw new Error(result.message || '上传失败');
            }
        } catch (error) {
            console.error('上传失败:', error);
            this.showNotification('上传失败', error.message, 'error');
        } finally {
            // 不再单独隐藏进度条，由processFilesSequentially统一处理
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.value = '';
            }
        }
    }

    async handleChunkedUpload(file) {
        const chunkSize = 2 * 1024 * 1024; // 2MB per chunk
        const chunks = Math.ceil(file.size / chunkSize);
        
        // 用于计算上传速度的变量
        let startTime = Date.now();
        let uploadedBytes = 0;
        
        try {
            // 1. 初始化分片上传
            const initResponse = await fetch('/api/upload/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: file.name,
                    file_size: file.size,
                    chunk_size: chunkSize
                })
            });
            
            const initResult = await initResponse.json();
            if (initResult.status !== 'success') {
                throw new Error(initResult.message || '初始化上传失败');
            }
            
            const uploadId = initResult.upload_id;
            let uploadedChunks = 0;
            
            // 如果服务器返回了已上传的分片信息，则使用这些信息
            if (initResult.uploaded_chunks) {
                uploadedChunks = initResult.uploaded_chunks.length;
                uploadedBytes = uploadedChunks * chunkSize;
                // 更新进度显示
                const progress = (uploadedChunks / chunks) * 100;
                this.updateChunkedUploadProgress(file, uploadedChunks, chunks, progress, 0, 0);
                
                // 如果有已上传的分片，自动继续上传，无需用户确认
                if (initResult.uploaded_chunks.length > 0) {
                    console.log(`检测到文件 "${file.name}" 已上传了 ${initResult.uploaded_chunks.length}/${chunks} 个分片，自动继续上传。`);
                }
            }
            
            // 2. 逐个上传分片（跳过已上传的分片）
            for (let i = 0; i < chunks; i++) {
                // 如果分片已上传，跳过
                if (initResult.uploaded_chunks && initResult.uploaded_chunks.includes(i)) {
                    continue;
                }
                
                const start = i * chunkSize;
                const end = Math.min(file.size, start + chunkSize);
                const chunk = file.slice(start, end);
                const chunkBytes = chunk.size;
                
                const formData = new FormData();
                formData.append('upload_id', uploadId);
                formData.append('chunk_index', i);
                formData.append('chunk', chunk, `chunk_${i}`);
                
                const chunkStartTime = Date.now();
                const chunkResponse = await fetch('/api/upload/chunk', {
                    method: 'POST',
                    body: formData
                });
                
                const chunkEndTime = Date.now();
                const chunkDuration = (chunkEndTime - chunkStartTime) / 1000; // 转换为秒
                const chunkSpeed = chunkDuration > 0 ? chunkBytes / chunkDuration : 0;
                
                const chunkResult = await chunkResponse.json();
                if (chunkResult.status !== 'success') {
                    throw new Error(chunkResult.message || `上传分片 ${i} 失败`);
                }
                
                uploadedChunks++;
                uploadedBytes += chunkBytes;
                
                // 计算平均上传速度
                const elapsedTime = (Date.now() - startTime) / 1000; // 转换为秒
                const avgSpeed = elapsedTime > 0 ? uploadedBytes / elapsedTime : 0;
                
                // 更新进度显示
                const progress = (uploadedChunks / chunks) * 100;
                this.updateChunkedUploadProgress(file, uploadedChunks, chunks, progress, avgSpeed, chunkSpeed);
            }
            
            // 3. 完成分片上传
            const completeResponse = await fetch('/api/upload/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    upload_id: uploadId
                })
            });
            
            const completeResult = await completeResponse.json();
            if (completeResult.status !== 'success') {
                throw new Error(completeResult.message || '完成上传失败');
            }
            
            // 每个文件上传完成后独立显示成功状态
            this.showUploadSuccessInProgressBar(file.name, file.size);
            this.loadFiles();
            this.loadStats();
            
        } catch (error) {
            console.error('分片上传失败:', error);
            this.showNotification('上传失败', error.message, 'error');
        } finally {
            // 不再单独隐藏进度条，由processFilesSequentially统一处理
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.value = '';
            }
        }
    }

    updateChunkedUploadProgress(file, uploadedChunks, totalChunks, percentComplete, avgSpeed, chunkSpeed) {
        const progressContainer = document.getElementById('upload-progress');
        if (!progressContainer) return;
        
        // 格式化速度显示为 kb/s
        const formatSpeed = (bytesPerSecond) => {
            if (bytesPerSecond < 1024) {
                return `${Math.round(bytesPerSecond)} B/s`;
            } else {
                // 转换为 kb/s 并保留整数
                return `${Math.round(bytesPerSecond / 1024)} kb/s`;
            }
        };
        
        // 格式化文件大小显示为 MB
        const formatFileSizeMB = (bytes) => {
            return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
        };
        
        // 格式化剩余时间
        const formatRemainingTime = (seconds) => {
            if (seconds < 60) {
                return `${Math.round(seconds)}秒`;
            } else {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = Math.round(seconds % 60);
                return `${minutes}分钟${remainingSeconds}秒`;
            }
        };
        
        // 计算已上传字节数和剩余时间
        const uploadedBytes = (uploadedChunks * file.size) / totalChunks;
        const remainingBytes = file.size - uploadedBytes;
        const remainingTime = avgSpeed > 0 ? remainingBytes / avgSpeed : 0;
        
        // 为每个文件创建独立的进度条容器
        const fileId = `${file.name}-${file.size}`;
        let progressItem = document.getElementById(fileId);
        
        // 如果还没有创建进度条，则创建一个
        if (!progressItem) {
            progressItem = document.createElement('div');
            progressItem.id = fileId;
            progressItem.className = 'bg-white rounded-lg border mb-2 relative overflow-hidden';
            progressItem.innerHTML = `
                <div class="progress-overlay absolute top-0 left-0 w-full h-full bg-blue-100 transition-all duration-300 ease-out" style="width: 0%"></div>
                <div class="relative z-10 p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-medium text-gray-900 truncate">${file.name}</span>
                        <span class="text-xs text-gray-500">${formatFileSizeMB(file.size)}</span>
                    </div>
                    <div class="flex justify-between text-xs text-gray-500">
                        <span class="speed-text">0 kb/s</span>
                        <span class="size-text">0MB/${formatFileSizeMB(file.size)}</span>
                        <span class="time-text">剩余时间 0分钟0秒</span>
                    </div>
                </div>
            `;
            progressContainer.appendChild(progressItem);
        }
        
        const progressOverlay = progressItem.querySelector('.progress-overlay');
        const speedText = progressItem.querySelector('.speed-text');
        const sizeText = progressItem.querySelector('.size-text');
        const timeText = progressItem.querySelector('.time-text');
        
        if (progressOverlay && speedText && sizeText && timeText) {
            progressOverlay.style.width = `${percentComplete}%`;
            speedText.textContent = `${formatSpeed(avgSpeed)}`;
            sizeText.textContent = `${formatFileSizeMB(uploadedBytes)}/${formatFileSizeMB(file.size)}`;
            // 当上传完成时显示"上传成功"，否则显示剩余时间
            timeText.textContent = percentComplete >= 100 ? '上传成功' : `剩余时间 ${formatRemainingTime(remainingTime)}`;
        }
    }

    updateRegularUploadProgress(file, percentComplete, speed = 0) {
        const progressContainer = document.getElementById('upload-progress');
        if (!progressContainer) return;
        
        // 格式化文件大小显示为 MB
        const formatFileSizeMB = (bytes) => {
            return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
        };
        
        // 为每个文件创建独立的进度条容器
        const fileId = `${file.name}-${file.size}`;
        let progressItem = document.getElementById(fileId);
        
        // 如果还没有创建进度条，则创建一个
        if (!progressItem) {
            progressItem = document.createElement('div');
            progressItem.id = fileId;
            progressItem.className = 'bg-white rounded-lg border mb-2 relative overflow-hidden';
            progressItem.innerHTML = `
                <div class="progress-overlay absolute top-0 left-0 w-full h-full bg-blue-100 transition-all duration-300 ease-out" style="width: 0%"></div>
                <div class="relative z-10 p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-medium text-gray-900 truncate">${file.name}</span>
                        <span class="text-xs text-gray-500">${formatFileSizeMB(file.size)}</span>
                    </div>
                    <div class="flex justify-between text-xs text-gray-500">
                        <span class="speed-text">0 kb/s</span>
                        <span class="size-text">0MB/${formatFileSizeMB(file.size)}</span>
                        <span class="percent-text">${Math.round(percentComplete)}%</span>
                    </div>
                </div>
            `;
            progressContainer.appendChild(progressItem);
        }
        
        // 格式化速度显示为 kb/s
        const formatSpeed = (bytesPerSecond) => {
            if (bytesPerSecond < 1024) {
                return `${Math.round(bytesPerSecond)} B/s`;
            } else {
                // 转换为 kb/s 并保留整数
                return `${Math.round(bytesPerSecond / 1024)} kb/s`;
            }
        };
        
        const progressOverlay = progressItem.querySelector('.progress-overlay');
        const speedText = progressItem.querySelector('.speed-text');
        const sizeText = progressItem.querySelector('.size-text');
        const percentText = progressItem.querySelector('.percent-text');
        
        if (progressOverlay && speedText && sizeText && percentText) {
            progressOverlay.style.width = `${percentComplete}%`;
            // 显示上传速度
            speedText.textContent = `${formatSpeed(speed)}`;
            sizeText.textContent = `${formatFileSizeMB((percentComplete / 100) * file.size)}/${formatFileSizeMB(file.size)}`;
            // 当上传完成时显示"上传成功"，否则显示百分比
            percentText.textContent = percentComplete >= 100 ? '上传成功' : `${Math.round(percentComplete)}%`;
        }
    }

    showUploadProgress() {
        const progressContainer = document.getElementById('upload-progress');
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
        }
    }

    hideUploadProgress() {
        const progressContainer = document.getElementById('upload-progress');
        if (progressContainer) {
            // 检查是否还有正在进行的上传
            const progressItems = progressContainer.querySelectorAll('.progress-overlay');
            let allComplete = true;
            
            for (const item of progressItems) {
                const width = parseFloat(item.style.width);
                if (width < 100) {
                    allComplete = false;
                    break;
                }
            }
            
            // 只有当所有上传都完成时才隐藏进度条
            if (allComplete) {
                // 上传完成时，将所有进度条设置为100%
                progressItems.forEach(item => {
                    item.style.width = '100%';
                });
                
                // 不再立即隐藏进度条，由showUploadSuccessInProgressBar处理
                // 进度条会在showUploadSuccessInProgressBar中6秒后隐藏
            }
        }
    }

    showUploadSuccessInProgressBar(filename, fileSize = 0) {
        // 为特定文件显示上传成功状态并6秒后隐藏其进度条
        const fileId = `${filename}-${fileSize}`; // 使用文件名和大小作为ID
        const progressItem = document.getElementById(fileId);
        
        if (progressItem) {
            // 保持显示上传完成的进度条状态（100%填充）
            const progressOverlay = progressItem.querySelector('.progress-overlay');
            if (progressOverlay) {
                progressOverlay.style.width = '100%';
            }
            
            // 更新文本显示为上传成功
            // 检查是分片上传还是普通上传的进度条结构
            const percentText = progressItem.querySelector('.percent-text');
            const timeText = progressItem.querySelector('.time-text');
            
            if (percentText) {
                percentText.textContent = '上传成功';
            } else if (timeText) {
                timeText.textContent = '上传成功';
            }
            
            // 6秒后隐藏该文件的进度条
            setTimeout(() => {
                progressItem.remove();
                
                // 检查是否还有其他进度条，如果没有则隐藏整个容器
                const progressContainer = document.getElementById('upload-progress');
                if (progressContainer && progressContainer.children.length === 0) {
                    progressContainer.classList.add('hidden');
                }
            }, 6000);
        }
    }

    async loadFiles(search = null, sort = 'upload_time') {
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (sort) params.append('sort', sort);
            
            const response = await fetch(`/api/files?${params.toString()}`);
            const result = await response.json();
            
            if (result.status === 'success') {
                this.renderFileList(result.files);
                this.updateFileCount(result.files.length);
            } else {
                throw new Error(result.message || '获取文件列表失败');
            }
        } catch (error) {
            console.error('获取文件列表失败:', error);
            this.showNotification('错误', '获取文件列表失败', 'error');
        }
    }

    renderFileList(files) {
        const fileList = document.getElementById('file-list');
        const emptyState = document.getElementById('empty-state');
        
        if (!fileList) return;
        
        if (files.length === 0) {
            fileList.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
            }
            return;
        }
        
        if (emptyState) {
            emptyState.classList.add('hidden');
        }
        
        fileList.innerHTML = files.map(file => `
            <div class="p-4 hover:bg-gray-50 file-card" data-file-id="${file.file_id}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" class="custom-checkbox file-checkbox" data-file-id="${file.file_id}">
                        <div class="flex-shrink-0">
                            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="min-w-0 flex-1 cursor-pointer" onclick="tempStoreUI.downloadFile('${file.file_id}')">
                            <p class="text-sm font-medium text-gray-900 truncate">${file.original_name}</p>
                            <p class="text-xs text-gray-500">${this.formatFileSize(file.file_size)} • ${file.upload_time_formatted} • 过期时间: ${file.expire_time_formatted}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button class="text-blue-500 hover:text-blue-700 p-1" onclick="tempStoreUI.copyFileLink('${file.file_id}')" title="复制下载链接">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                        </button>
                        <button class="text-green-500 hover:text-green-700 p-1" onclick="tempStoreUI.downloadFile('${file.file_id}')">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                        </button>
                        <button class="text-red-500 hover:text-red-700 p-1 delete-btn hidden" onclick="tempStoreUI.deleteFile('${file.file_id}')">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // 根据管理员权限显示/隐藏删除按钮
        this.updateDeleteButtonsVisibility();
    }

    updateDeleteButtonsVisibility() {
        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(btn => {
            if (this.isAdmin) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        });
        
        // 同时更新批量删除按钮
        const batchDeleteBtn = document.getElementById('batch-delete-btn');
        if (batchDeleteBtn) {
            if (this.isAdmin) {
                batchDeleteBtn.classList.remove('hidden');
            } else {
                batchDeleteBtn.classList.add('hidden');
            }
        }
        
        // 控制全选和清空文件按钮的显示/隐藏
        const selectAllBtn = document.getElementById('select-all-btn');
        const clearAllFilesBtn = document.getElementById('clear-all-files-btn');
        
        if (selectAllBtn) {
            if (this.isAdmin) {
                selectAllBtn.classList.remove('hidden');
            } else {
                selectAllBtn.classList.add('hidden');
            }
        }
        
        if (clearAllFilesBtn) {
            if (this.isAdmin) {
                clearAllFilesBtn.classList.remove('hidden');
            } else {
                clearAllFilesBtn.classList.add('hidden');
            }
        }
    }

    updateFileCount(count) {
        const fileCount = document.getElementById('file-count');
        if (fileCount) {
            fileCount.textContent = `${count} 个文件`;
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const result = await response.json();
            
            if (result.status === 'success') {
                this.updateStats(result.stats);
            }
        } catch (error) {
            console.error('获取统计信息失败:', error);
        }
    }

    updateStats(stats) {
        const uploadsElement = document.getElementById('stats-uploads');
        const filesElement = document.getElementById('stats-files');
        const storageElement = document.getElementById('stats-storage');
        const maxFileSizeElement = document.getElementById('max-file-size');
        const expireInfoElement = document.getElementById('expire-info');
        
        if (uploadsElement) {
            uploadsElement.textContent = `上传: ${stats.total_uploads}`;
        }
        
        if (filesElement) {
            filesElement.textContent = `文件: ${stats.active_files}`;
        }
        
        if (storageElement) {
            // 显示实际磁盘使用量（如果可用）
            const diskUsage = stats.actual_disk_usage_formatted || stats.storage_used_formatted;
            storageElement.textContent = `存储: ${diskUsage}/${stats.storage_total_formatted}`;
        }
        
        // 修复：正确显示单个文件大小限制
        // 文件大小限制信息将从配置加载中更新，这里不再清空内容
        // if (maxFileSizeElement) {
        //     maxFileSizeElement.textContent = '';
        // }
        
        // 从配置中获取过期时间，而不是硬编码为24小时
        if (expireInfoElement) {
            // 过期时间信息将从配置加载中更新
        }
    }

    async loadConfig() {
        // 不再检查管理员权限，匿名用户也需要获取配置信息
        try {
            const response = await fetch('/api/admin/config');
            const result = await response.json();
            
            if (result.status === 'success') {
                this.updateConfigSliders(result.config);
            }
        } catch (error) {
            console.error('获取配置失败:', error);
        }
    }

    updateConfigSliders(config) {
        const expireHoursSlider = document.getElementById('config-expire-hours');
        const maxFileSizeSlider = document.getElementById('config-max-file-size');
        const totalStorageSlider = document.getElementById('config-total-storage');
        
        // 内联配置滑块
        const expireHoursInlineSlider = document.getElementById('config-expire-hours-inline');
        const maxFileSizeInlineSlider = document.getElementById('config-max-file-size-inline');
        const totalStorageInlineSlider = document.getElementById('config-total-storage-inline');
        
        if (expireHoursSlider) {
            // 管理员登录后，将过期时间最小值改为10分钟（0.167小时，取整为1小时）
            if (this.isAdmin) {
                expireHoursSlider.min = "1";
            } else {
                expireHoursSlider.min = "5";
            }
            expireHoursSlider.value = config.file_expire_hours;
            document.getElementById('expire-hours-value').textContent = `${config.file_expire_hours}小时`;
        }
        
        // 更新内联滑块
        if (expireHoursInlineSlider) {
            // 管理员登录后，将过期时间最小值改为10分钟（0.167小时，取整为1小时）
            if (this.isAdmin) {
                expireHoursInlineSlider.min = "1";
            } else {
                expireHoursInlineSlider.min = "5";
            }
            expireHoursInlineSlider.value = config.file_expire_hours;
            document.getElementById('expire-hours-value-inline').textContent = `${config.file_expire_hours}小时`;
        }
        
        if (maxFileSizeSlider) {
            const maxFileSizeMB = Math.round(config.max_file_size / (1024 * 1024));
            maxFileSizeSlider.value = maxFileSizeMB;
            // 根据大小显示MB或GB
            if (maxFileSizeMB >= 1024) {
                document.getElementById('max-file-size-value').textContent = `${(maxFileSizeMB / 1024).toFixed(1)}GB`;
            } else {
                document.getElementById('max-file-size-value').textContent = `${maxFileSizeMB}MB`;
            }
            // 更新页面上显示的单个文件大小限制
            this.updateMaxFileSizeDisplay(maxFileSizeMB);
        }
        
        // 更新内联滑块
        if (maxFileSizeInlineSlider) {
            const maxFileSizeMB = Math.round(config.max_file_size / (1024 * 1024));
            maxFileSizeInlineSlider.value = maxFileSizeMB;
            // 根据大小显示MB或GB
            if (maxFileSizeMB >= 1024) {
                document.getElementById('max-file-size-value-inline').textContent = `${(maxFileSizeMB / 1024).toFixed(1)}GB`;
            } else {
                document.getElementById('max-file-size-value-inline').textContent = `${maxFileSizeMB}MB`;
            }
        }
        
        if (totalStorageSlider) {
            const totalStorageGB = Math.round(config.max_storage / (1024 * 1024 * 1024));
            totalStorageSlider.value = totalStorageGB;
            document.getElementById('total-storage-value').textContent = `${totalStorageGB}GB`;
            // 更新页面上显示的总存储限制
            this.updateTotalStorageDisplay(totalStorageGB);
        }
        
        // 更新内联滑块
        if (totalStorageInlineSlider) {
            const totalStorageGB = Math.round(config.max_storage / (1024 * 1024 * 1024));
            totalStorageInlineSlider.value = totalStorageGB;
            document.getElementById('total-storage-value-inline').textContent = `${totalStorageGB}GB`;
        }
        
        // 更新页面上显示的过期时间信息
        this.updateExpireInfo(config.file_expire_hours);
        
        // 同时更新页面上显示的文件大小和存储限制
        this.updateMaxFileSizeDisplay(Math.round(config.max_file_size / (1024 * 1024)));
        this.updateTotalStorageDisplay(Math.round(config.max_storage / (1024 * 1024 * 1024)));
    }

    updateMaxFileSizeDisplay(maxFileSizeMB) {
        const maxFileSizeElement = document.getElementById('max-file-size');
        if (maxFileSizeElement) {
            // 根据大小显示MB或GB
            if (maxFileSizeMB >= 1024) {
                maxFileSizeElement.textContent = `${(maxFileSizeMB / 1024).toFixed(1)}GB`;
            } else {
                maxFileSizeElement.textContent = `${maxFileSizeMB}MB`;
            }
        }
    }

    updateTotalStorageDisplay(totalStorageGB) {
        const totalStorageDisplay = document.getElementById('total-storage-display');
        if (totalStorageDisplay) {
            totalStorageDisplay.textContent = totalStorageGB;
        }
    }

    updateExpireInfo(expireHours) {
        const expireHoursDisplay = document.getElementById('expire-hours-display');
        if (expireHoursDisplay) {
            expireHoursDisplay.textContent = expireHours;
        }
    }

    showNotification(title, message, type = 'info') {
        // 获取通知区域
        const notificationArea = document.getElementById('notification-area');
        if (!notificationArea) {
            // 如果找不到通知区域，回退到原来的屏幕中央显示
            this._showNotificationCenter(title, message, type);
            return;
        }
        
        // 显示通知区域
        notificationArea.classList.remove('hidden');
        
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `p-4 rounded-lg shadow-md transform transition-all duration-300 mb-2 ${
            type === 'success' ? 'bg-green-100 border border-green-200 text-green-800' : 
            type === 'error' ? 'bg-red-100 border border-red-200 text-red-800' : 
            'bg-blue-100 border border-blue-200 text-blue-800'
        }`;
        notification.innerHTML = `
            <div class="flex items-start">
                <div class="flex-1">
                    <p class="font-bold">${title}</p>
                    <p class="text-sm mt-1">${message}</p>
                </div>
                <button class="ml-4 text-gray-500 hover:text-gray-700 focus:outline-none">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // 添加到通知区域的顶部
        if (notificationArea.firstChild) {
            notificationArea.insertBefore(notification, notificationArea.firstChild);
        } else {
            notificationArea.appendChild(notification);
        }
        
        // 添加关闭事件
        const closeBtn = notification.querySelector('button');
        closeBtn.addEventListener('click', () => {
            notification.classList.remove('opacity-100');
            notification.classList.add('opacity-0');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                    // 如果没有更多通知，隐藏通知区域
                    if (notificationArea.children.length === 0) {
                        notificationArea.classList.add('hidden');
                    }
                }
            }, 300);
        });
        
        // 添加出现动画
        setTimeout(() => {
            notification.classList.add('opacity-100');
            notification.classList.remove('opacity-0');
        }, 10);
        
        // 3秒后自动关闭
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('opacity-100');
                notification.classList.add('opacity-0');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                        // 如果没有更多通知，隐藏通知区域
                        if (notificationArea.children.length === 0) {
                            notificationArea.classList.add('hidden');
                        }
                    }
                }, 300);
            }
        }, 10000);
    }

    // 原来的屏幕中央显示通知方法（作为回退方案）
    _showNotificationCenter(title, message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 p-6 rounded-lg shadow-xl transition-all duration-300 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            'bg-blue-500'
        } text-white`;
        notification.innerHTML = `
            <div class="flex items-start">
                <div class="flex-1">
                    <p class="font-bold text-lg">${title}</p>
                    <p class="text-sm opacity-90 mt-1">${message}</p>
                </div>
                <button class="ml-4 text-white hover:text-gray-200 focus:outline-none">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // 添加关闭事件
        const closeBtn = notification.querySelector('button');
        closeBtn.addEventListener('click', () => {
            notification.classList.remove('opacity-100');
            notification.classList.add('opacity-0', 'scale-95');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 添加出现动画
        setTimeout(() => {
            notification.classList.add('opacity-100', 'scale-100');
            notification.classList.remove('scale-95');
        }, 10);
        
        // 3秒后自动关闭
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('opacity-100');
                notification.classList.add('opacity-0', 'scale-95');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
    }

    toggleSelectAll() {
        const checkboxes = document.querySelectorAll('.file-checkbox');
        const selectAllBtn = document.getElementById('select-all-btn');
        
        if (!checkboxes.length) return;
        
        // 检查是否所有文件都被选中
        const allSelected = Array.from(checkboxes).every(cb => cb.checked);
        
        // 切换选中状态
        checkboxes.forEach(cb => {
            cb.checked = !allSelected;
        });
        
        // 更新按钮文本
        if (selectAllBtn) {
            selectAllBtn.textContent = allSelected ? '全选' : '取消全选';
        }
    }

    async handleBatchDelete() {
        const selectedCheckboxes = document.querySelectorAll('.file-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            this.showNotification('提示', '请先选择要删除的文件', 'info');
            return;
        }
        
        if (!confirm(`确定要删除选中的 ${selectedCheckboxes.length} 个文件吗？`)) {
            return;
        }
        
        const fileIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.fileId);
        
        try {
            const response = await fetch('/api/batch/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ file_ids: fileIds })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('删除成功', `成功删除 ${result.deleted_count} 个文件`, 'success');
                this.loadFiles();
                this.loadStats();
            } else {
                throw new Error(result.message || '批量删除失败');
            }
        } catch (error) {
            console.error('批量删除失败:', error);
            this.showNotification('删除失败', error.message, 'error');
        }
    }

    async downloadFile(fileId) {
        try {
            const link = document.createElement('a');
            link.href = `/api/download/${fileId}`;
            link.download = '';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 更新下载统计
            this.loadStats();
        } catch (error) {
            console.error('下载失败:', error);
            this.showNotification('下载失败', '文件下载失败', 'error');
        }
    }

    copyFileLink(fileId) {
        try {
            // 构造完整的下载链接
            const downloadUrl = `${window.location.origin}/api/download/${fileId}`;
            
            // 使用Clipboard API复制链接
            if (navigator.clipboard) {
                navigator.clipboard.writeText(downloadUrl).then(() => {
                    this.showNotification('复制成功', '下载链接已复制到剪贴板', 'success');
                }).catch(err => {
                    console.error('复制失败:', err);
                    // 降级到传统方法
                    this.fallbackCopyTextToClipboard(downloadUrl);
                });
            } else {
                // 降级到传统方法
                this.fallbackCopyTextToClipboard(downloadUrl);
            }
        } catch (error) {
            console.error('复制链接失败:', error);
            this.showNotification('复制失败', '无法复制下载链接', 'error');
        }
    }

    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // 避免滚动到底部
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showNotification('复制成功', '下载链接已复制到剪贴板', 'success');
            } else {
                this.showNotification('复制失败', '无法复制下载链接', 'error');
            }
        } catch (err) {
            console.error('复制命令失败:', err);
            this.showNotification('复制失败', '无法复制下载链接', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    async deleteFile(fileId) {
        if (!confirm('确定要删除这个文件吗？')) {
            return;
        }
        
        try {
            const response = await fetch('/api/batch/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ file_ids: [fileId] })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('删除成功', '文件已删除', 'success');
                this.loadFiles();
                this.loadStats();
            } else {
                throw new Error(result.message || '删除失败');
            }
        } catch (error) {
            console.error('删除失败:', error);
            this.showNotification('删除失败', error.message, 'error');
        }
    }

    showAdminLoginModal() {
        const modal = document.getElementById('admin-login-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const passwordInput = document.getElementById('admin-password');
            if (passwordInput) {
                passwordInput.value = '';
                setTimeout(() => passwordInput.focus(), 100);
            }
        }
    }

    hideAdminLoginModal() {
        const modal = document.getElementById('admin-login-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    async handleInlineAdminLogin() {
        const passwordInput = document.getElementById('admin-password-inline');
        if (!passwordInput) return;
        
        const password = passwordInput.value;
        if (!password) {
            this.showNotification('错误', '请输入密码', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.isAdmin = true;
                // 隐藏登录表单，显示配置管理
                const adminConfigArea = document.getElementById('admin-config-area');
                const adminLoginForm = document.getElementById('admin-login-form');
                const configManagement = document.getElementById('config-management');
                
                if (adminLoginForm) adminLoginForm.classList.add('hidden');
                if (configManagement) configManagement.classList.remove('hidden');
                
                this.showNotification('登录成功', '管理员登录成功', 'success');
                this.updateDeleteButtonsVisibility();
                this.loadConfig();
            } else {
                throw new Error(result.message || '登录失败');
            }
        } catch (error) {
            console.error('登录失败:', error);
            this.showNotification('登录失败', error.message, 'error');
        }
    }

    async handleAdminLogin() {
        const passwordInput = document.getElementById('admin-password');
        if (!passwordInput) return;
        
        const password = passwordInput.value;
        if (!password) {
            this.showNotification('错误', '请输入密码', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.isAdmin = true;
                this.hideAdminLoginModal();
                this.showNotification('登录成功', '管理员登录成功', 'success');
                this.updateDeleteButtonsVisibility();
                this.loadConfig();
            } else {
                throw new Error(result.message || '登录失败');
            }
        } catch (error) {
            console.error('登录失败:', error);
            this.showNotification('登录失败', error.message, 'error');
        }
    }

    showConfigModal() {
        const modal = document.getElementById('config-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideConfigModal() {
        const modal = document.getElementById('config-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async saveConfig() {
        const expireHours = document.getElementById('config-expire-hours').value;
        const maxFileSize = document.getElementById('config-max-file-size').value;
        const totalStorage = document.getElementById('config-total-storage').value;
        
        try {
            const response = await fetch('/api/admin/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_expire_hours: parseInt(expireHours),
                    max_file_size: parseInt(maxFileSize) * 1024 * 1024,
                    max_storage: parseInt(totalStorage) * 1024 * 1024 * 1024
                })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('保存成功', '配置已保存', 'success');
                this.hideConfigModal();
                this.loadStats();
            } else {
                throw new Error(result.message || '保存配置失败');
            }
        } catch (error) {
            console.error('保存配置失败:', error);
            this.showNotification('保存失败', error.message, 'error');
        }
    }
    
    async saveInlineConfig() {
        const expireHours = document.getElementById('config-expire-hours-inline').value;
        const maxFileSize = document.getElementById('config-max-file-size-inline').value;
        const totalStorage = document.getElementById('config-total-storage-inline').value;
        
        try {
            const response = await fetch('/api/admin/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_expire_hours: parseInt(expireHours),
                    max_file_size: parseInt(maxFileSize) * 1024 * 1024,
                    max_storage: parseInt(totalStorage) * 1024 * 1024 * 1024
                })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('保存成功', '配置已保存', 'success');
                // 自动退出管理员模式
                this.exitAdminMode();
                this.loadStats();
            } else {
                throw new Error(result.message || '保存配置失败');
            }
        } catch (error) {
            console.error('保存配置失败:', error);
            this.showNotification('保存失败', error.message, 'error');
        }
    }

    async loadLogs() {
        try {
            const response = await fetch('/api/admin/logs');
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showLogsModal(result.logs);
            } else {
                throw new Error(result.message || '获取日志失败');
            }
        } catch (error) {
            console.error('获取日志失败:', error);
            this.showNotification('获取失败', error.message, 'error');
        }
    }

    showLogsModal(logs) {
        const modal = document.getElementById('logs-modal');
        const contentDiv = document.getElementById('log-content');
        
        if (modal && contentDiv) {
            contentDiv.innerHTML = logs.map(log => `<div class="py-1">${this.escapeHtml(log)}</div>`).join('');
            modal.classList.remove('hidden');
        }
    }

    hideLogsModal() {
        const modal = document.getElementById('logs-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    async clearAllFiles() {
        if (!confirm('确定要清空所有文件吗？此操作不可恢复！')) {
            return;
        }
        
        try {
            const response = await fetch('/api/admin/clear-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showNotification('清空成功', `成功清空 ${result.deleted_count} 个文件`, 'success');
                this.loadFiles();
                this.loadStats();
            } else {
                throw new Error(result.message || '清空文件失败');
            }
        } catch (error) {
            console.error('清空文件失败:', error);
            this.showNotification('清空失败', error.message, 'error');
        }
    }
    
    exitAdminMode() {
        // 退出管理员模式
        this.isAdmin = false;
        
        // 隐藏管理员配置区域
        const adminConfigArea = document.getElementById('admin-config-area');
        if (adminConfigArea) {
            adminConfigArea.classList.add('hidden');
        }
        
        // 更新删除按钮可见性
        this.updateDeleteButtonsVisibility();
        
        // 显示通知
        this.showNotification('退出成功', '已退出管理员模式', 'info');
    }
}

// 初始化应用
const jackDiskUI = new JackDiskUI();