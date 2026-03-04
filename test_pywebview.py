#!/usr/bin/env python3
"""
Teste 2: PyWebView básico com API HTTP
Testar se a comunicação JS <-> Python funciona via HTTP
"""
import webview
import json
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler

# ========== API BACKEND ==========

class Api:
    """API simples para teste"""
    
    def ping(self):
        return {"status": "pong", "message": "Backend funcionando!"}
    
    def get_user(self):
        return {"name": "Vini Reis", "email": "user@company.com"}
    
    def sum_numbers(self, a, b):
        return {"result": a + b}


api = Api()


# ========== SERVIDOR HTTP ==========

class APIHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        if self.path == '/':
            self.serve_html()
        else:
            self.send_error(404)
    
    def do_POST(self):
        if self.path.startswith('/api/'):
            self.handle_api()
        else:
            self.send_error(404)
    
    def serve_html(self):
        html = '''<!DOCTYPE html>
<html>
<head>
    <title>Teste PyWebView + HTTP</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            margin: 0;
            min-height: 100vh;
        }
        h1 { margin-top: 0; }
        .card {
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 15px;
            margin: 10px 0;
        }
        button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
            font-size: 14px;
        }
        button:hover { background: #45a049; }
        button:active { transform: scale(0.98); }
        #log {
            background: rgba(0,0,0,0.3);
            border-radius: 5px;
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
            max-height: 200px;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        .success { color: #4ade80; }
        .error { color: #f87171; }
    </style>
</head>
<body>
    <h1>🧪 Teste PyWebView + HTTP API</h1>
    
    <div class="card">
        <h3>Testes de API</h3>
        <button onclick="testPing()">1. Ping</button>
        <button onclick="testGetUser()">2. Get User</button>
        <button onclick="testSum()">3. Sum(5, 3)</button>
        <button onclick="clearLog()">Limpar Log</button>
    </div>
    
    <div class="card">
        <h3>Log</h3>
        <div id="log">Clique em um botão para testar...</div>
    </div>
    
    <script>
        function log(msg, isError) {
            const el = document.getElementById('log');
            const time = new Date().toLocaleTimeString();
            const cls = isError ? 'error' : 'success';
            el.innerHTML += `<span class="${cls}">[${time}] ${msg}</span>\\n`;
            el.scrollTop = el.scrollHeight;
        }
        
        function clearLog() {
            document.getElementById('log').innerHTML = '';
        }
        
        async function callApi(method, args = []) {
            try {
                log(`Chamando ${method}...`);
                const response = await fetch(`/api/${method}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ args })
                });
                const data = await response.json();
                if (data.error) {
                    log(`❌ Erro: ${data.error}`, true);
                    return null;
                }
                log(`✅ Resultado: ${JSON.stringify(data.result)}`);
                return data.result;
            } catch (e) {
                log(`❌ Exceção: ${e.message}`, true);
                return null;
            }
        }
        
        function testPing() { callApi('ping'); }
        function testGetUser() { callApi('get_user'); }
        function testSum() { callApi('sum_numbers', [5, 3]); }
        
        // Log inicial
        log('Página carregada! Pronto para testar.');
    </script>
</body>
</html>'''
        self.send_response(200)
        self.send_header('Content-Type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode())
    
    def handle_api(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode() if content_length > 0 else '{}'
            data = json.loads(body) if body else {}
            
            method_name = self.path[5:]  # Remove '/api/'
            args = data.get('args', [])
            
            if not hasattr(api, method_name):
                self.send_json({'error': f'Método não encontrado: {method_name}'}, 404)
                return
            
            method = getattr(api, method_name)
            result = method(*args) if args else method()
            self.send_json({'result': result})
            
        except Exception as e:
            self.send_json({'error': str(e)}, 500)
    
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


def start_server():
    server = HTTPServer(('127.0.0.1', 18080), APIHandler)
    print("[server] HTTP rodando em http://127.0.0.1:18080")
    server.serve_forever()


# ========== MAIN ==========

if __name__ == '__main__':
    # Iniciar servidor HTTP em thread separada
    thread = threading.Thread(target=start_server, daemon=True)
    thread.start()
    
    # Criar janela PyWebView
    window = webview.create_window(
        title="Teste PyWebView",
        url="http://127.0.0.1:18080/",
        width=500,
        height=400
    )
    
    print("[main] Iniciando PyWebView...")
    webview.start(debug=False)
    print("[main] Encerrado")
