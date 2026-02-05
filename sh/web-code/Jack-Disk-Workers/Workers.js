/**
 * Jack-Disk - 终极并发增强版 (v3.3)
 * 修复：恢复上传速度、文件大小显示，并保持并发上传
 */

// --- 1. 全局配置中心 ---
const CONFIG = {
    USER_NAME: "jack",         
    USER_PASS: "jack",        
    MAX_GB: 10,                 
    EXPIRE_HOURS: 48            
};

// --- 2. S3 签名算法 ---
async function getSignedUrl(method, key, env) {
    const region = 'auto';
    const service = 's3';
    const datetime = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = datetime.slice(0, 8);
    const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const canonicalUri = `/${env.R2_BUCKET_NAME}/${encodeURIComponent(key)}`;
    const query = `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(`${env.R2_ACCESS_KEY_ID}/${date}/${region}/${service}/aws4_request`)}&X-Amz-Date=${datetime}&X-Amz-Expires=3600&X-Amz-SignedHeaders=host`;
    const canonicalRequest = `${method}\n${canonicalUri}\n${query}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
    
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest));
    const hashedReq = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    const stringToSign = `AWS4-HMAC-SHA256\n${datetime}\n${date}/${region}/${service}/aws4_request\n${hashedReq}`;
    
    const kEncode = (s) => new TextEncoder().encode(s);
    const hmac = async (key, data) => {
        const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        return await crypto.subtle.sign('HMAC', k, typeof data === 'string' ? kEncode(data) : data);
    };
    
    const kDate = await hmac(kEncode(`AWS4${env.R2_SECRET_ACCESS_KEY}`), date);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, service);
    const kSigning = await hmac(kService, 'aws4_request');
    
    const signature = Array.from(new Uint8Array(await hmac(kSigning, stringToSign))).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${endpoint}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

// --- 3. 前端 HTML 渲染 ---
function renderHTML(env) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jack-Disk | 云存储</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%233B82F6%22 stroke-width=%222%22><path d=%22M13.47,6a4,4,0,0,0-6.94,0A3.17,3.17,0,0,0,6,6a3,3,0,0,0-.78,5.89%22/><polyline points=%2213 20 15 16 11 16 13 12%22/><path d=%22M7,15.82A3,3,0,0,1,8,10h.1a5,5,0,0,1,9.48-1A3.49,3.49,0,0,1,19,15.65%22/></svg>">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb { background: #3B82F6; border-radius: 3px; }
        .drag-zone { transition: all 0.3s ease; }
        .drag-zone.dragover { border-color: #3B82F6; background-color: #EFF6FF; transform: scale(1.01); }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <header class="bg-white shadow-sm border-b sticky top-0 z-50">
        <div class="max-w-5xl mx-auto px-4 h-16 flex justify-between items-center">
            <h1 class="text-xl font-bold text-gray-900 flex items-center">
                <svg class="w-7 h-7 mr-2 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13.47,6a4,4,0,0,0-6.94,0A3.17,3.17,0,0,0,6,6a3,3,0,0,0-.78,5.89"/><polyline points="13 20 15 16 11 16 13 12"/><path d="M7,15.82A3,3,0,0,1,8,10h.1a5,5,0,0,1,9.48-1A3.49,3.49,0,0,1,19,15.65"/></svg>
                Jack-Disk
            </h1>
            <span id="stats-storage" class="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">加载中...</span>
        </div>
    </header>

    <main class="max-w-5xl mx-auto px-4 py-8">
        <div id="upload-zone" class="drag-zone border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer bg-white shadow-sm">
            <input type="file" id="file-input" multiple class="hidden">
            <div class="space-y-4">
                <div class="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                </div>
                <button onclick="document.getElementById('file-input').click()" class="bg-blue-500 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg transition-all active:scale-95"> Concurrent upload </button>
            </div>
        </div>

        <div id="upload-progress" class="mt-6 space-y-3 hidden"></div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 mt-8 overflow-hidden">
            <div class="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                <h2 class="text-xs font-black text-gray-500 uppercase tracking-widest text-blue-600">文件列表</h2>
            </div>
            <div id="file-list" class="divide-y divide-gray-100"></div>
            <div id="empty-state" class="py-20 text-center text-gray-400 hidden">暂无文件</div>
        </div>
    </main>

    <script>
        const UI_CONFIG = { MAX_GB: ${CONFIG.MAX_GB}, EXPIRE_HOURS: ${CONFIG.EXPIRE_HOURS} };

        class JackDiskUI {
            constructor() { this.init(); this.loadFiles(); }
            init() {
                const zone = document.getElementById('upload-zone');
                const input = document.getElementById('file-input');
                zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('dragover'); };
                zone.ondragleave = () => zone.classList.remove('dragover');
                zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove('dragover'); this.handleFiles(e.dataTransfer.files); };
                input.onchange = () => { if(input.files.length) this.handleFiles(input.files); input.value = ''; };
            }

            async handleFiles(files) {
                document.getElementById('upload-progress').classList.remove('hidden');
                const uploadPromises = Array.from(files).map(file => this.uploadWithPresign(file));
                await Promise.all(uploadPromises);
                this.loadFiles();
            }

            async uploadWithPresign(file) {
                const id = 'up-' + Math.random().toString(36).substr(2, 9);
                this.renderProgressItem(id, file.name, file.size);
                
                try {
                    const res = await fetch('/?presign', { method: 'POST', body: JSON.stringify({ fileName: file.name }) });
                    if (res.status === 403) {
                        const err = await res.json();
                        alert(err.error);
                        document.getElementById(id).remove();
                        return;
                    }
                    const { uploadUrl } = await res.json();
                    
                    const xhr = new XMLHttpRequest();
                    const startTime = Date.now();
                    
                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const percent = Math.floor((e.loaded / e.total) * 100);
                            const speed = (e.loaded / 1024 / ((Date.now() - startTime) / 1000)).toFixed(1);
                            this.updateProgressUI(id, percent, speed, e.loaded, e.total);
                        }
                    };

                    return new Promise((resolve, reject) => {
                        xhr.open('PUT', uploadUrl, true);
                        xhr.onload = () => {
                            if (xhr.status < 300) {
                                this.markSuccess(id);
                                setTimeout(() => { document.getElementById(id)?.remove(); resolve(); }, 2000);
                            } else {
                                reject();
                            }
                        };
                        xhr.onerror = () => reject();
                        xhr.send(file);
                    });
                } catch (err) { 
                    alert(file.name + " 上传失败"); 
                }
            }

            renderProgressItem(id, name, size) {
                const container = document.getElementById('upload-progress');
                const item = document.createElement('div');
                item.id = id;
                item.className = 'bg-white p-4 rounded-lg border border-gray-200 relative overflow-hidden shadow-sm';
                item.innerHTML = \`
                    <div class="progress-bg absolute top-0 left-0 h-full bg-blue-50 transition-all duration-300" style="width:0%"></div>
                    <div class="relative z-10">
                        <div class="flex justify-between items-center text-sm mb-1 font-bold">
                            <span class="truncate max-w-[60%] text-gray-700">\${name}</span>
                            <span class="status-text font-mono text-blue-600">0%</span>
                        </div>
                        <div class="relative z-10 flex justify-between text-[10px] text-gray-500 font-medium">
                            <span class="speed-text">计算速度...</span>
                            <span class="size-text">0 / \${(size/1024/1024).toFixed(1)} MB</span>
                        </div>
                    </div>\`;
                container.prepend(item);
            }

            updateProgressUI(id, percent, speed, loaded, total) {
                const el = document.getElementById(id);
                if(!el) return;
                el.querySelector('.progress-bg').style.width = percent + '%';
                el.querySelector('.status-text').innerText = percent + '%';
                el.querySelector('.speed-text').innerText = speed + ' KB/s';
                el.querySelector('.size-text').innerText = \`\${(loaded/1024/1024).toFixed(1)} / \${(total/1024/1024).toFixed(1)} MB\`;
            }

            markSuccess(id) {
                const el = document.getElementById(id);
                if(el) {
                    el.querySelector('.status-text').innerText = '✓ 上传完成';
                    el.querySelector('.status-text').className = 'status-text font-bold text-green-600';
                    el.querySelector('.progress-bg').classList.replace('bg-blue-50', 'bg-green-50');
                }
            }

            async loadFiles() {
                const res = await fetch('/?list');
                let files = await res.json();
                if(files && files.length > 0) {
                    files.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
                }
                const list = document.getElementById('file-list');
                const empty = document.getElementById('empty-state');
                if(!files || !files.length) { 
                    list.innerHTML = ''; 
                    empty.classList.remove('hidden'); 
                    document.getElementById('stats-storage').innerText = '存储: 0MB / ' + UI_CONFIG.MAX_GB + 'GB';
                    return; 
                }
                empty.classList.add('hidden');
                list.innerHTML = files.map(f => {
                    const downloadUrl = window.location.origin + '/' + encodeURIComponent(f.key);
                    const diffMs = new Date(f.uploaded).getTime() + (UI_CONFIG.EXPIRE_HOURS * 3600000) - Date.now();
                    const totalMins = Math.max(0, Math.floor(diffMs / 60000));
                    const hours = Math.floor(totalMins / 60);
                    const mins = totalMins % 60;
                    return \`
                    <div class="p-4 flex items-center justify-between hover:bg-gray-50 transition-all">
                        <div class="flex items-center space-x-4 min-w-0">
                            <div class="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 text-blue-500">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                            </div>
                            <div class="min-w-0">
                                <a href="\${downloadUrl}" target="_blank" class="text-sm font-bold text-gray-900 truncate block hover:text-blue-600">\${f.key}</a>
                                <p class="text-[12px] text-gray-500 mt-1 flex items-center">
                                    <span class="bg-gray-100 px-1.5 py-0.5 rounded mr-2 font-mono">\${(f.size/1024/1024).toFixed(2)} MB</span>
                                    <span class="\${totalMins < 60 ? 'text-red-500 font-bold' : ''}">剩余: \${hours}h \${mins}m</span>
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <a href="\${downloadUrl}" target="_blank" class="px-6 py-2 bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-700"> Download </a>
                            <button onclick="if(confirm('删除?')) fetch('/\${encodeURIComponent(f.key)}', {method:'DELETE'}).then(()=>location.reload())" class="p-2 text-gray-300 hover:text-red-500">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                            </button>
                        </div>
                    </div>\`;
                }).join('');
                const totalSize = files.reduce((acc, f) => acc + f.size, 0);
                document.getElementById('stats-storage').innerText = \`存储: \${(totalSize/1024/1024).toFixed(1)}MB / \${UI_CONFIG.MAX_GB}GB\`;
            }
        }
        new JackDiskUI();
    </script>
</body>
</html>`;
}

// --- 4. 后端逻辑保持不变 ---
export default {
    async fetch(request, env) {
        const auth = request.headers.get("Authorization");
        const expectedAuth = "Basic " + btoa(`${CONFIG.USER_NAME}:${CONFIG.USER_PASS}`);
        if (!auth || auth !== expectedAuth) {
            return new Response("Unauthorized", {
                status: 401,
                headers: { "WWW-Authenticate": 'Basic realm="Jack-Disk"' }
            });
        }
        const url = new URL(request.url);
        const key = url.pathname.slice(1);
        if (request.method === "POST" && url.searchParams.has("presign")) {
            const objects = await env.MY_BUCKET.list();
            const totalSize = objects.objects.reduce((acc, obj) => acc + obj.size, 0);
            if (totalSize >= CONFIG.MAX_GB * 1024 * 1024 * 1024) {
                return new Response(JSON.stringify({ error: "存储空间已满" }), { status: 403 });
            }
            const { fileName } = await request.json();
            const uploadUrl = await getSignedUrl('PUT', fileName, env);
            return new Response(JSON.stringify({ uploadUrl }));
        }
        if (request.method === "GET" && url.searchParams.has("list")) {
            const objects = await env.MY_BUCKET.list();
            const formatted = objects.objects.map(obj => ({
                key: obj.key, size: obj.size, uploaded: obj.uploaded.toISOString()
            }));
            return new Response(JSON.stringify(formatted));
        }
        if (request.method === "DELETE" && key) {
            await env.MY_BUCKET.delete(decodeURIComponent(key));
            return new Response(JSON.stringify({ success: true }));
        }
        if (request.method === "GET" && !key) {
            return new Response(renderHTML(env), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
        }
        if (request.method === "GET" && key) {
            return Response.redirect(`https://r2.mjack.tk/${key}`, 302);
        }
        return new Response("Not Found", { status: 404 });
    }
};