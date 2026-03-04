#!/usr/bin/env python3
"""
Teste 3: PyWebView + Jira API real
Buscar tickets reais do Jira e exibir na UI
"""
import webview
import json
import threading
import requests
from requests.auth import HTTPBasicAuth
from http.server import HTTPServer, SimpleHTTPRequestHandler

# ========== CONFIG ==========

JIRA_URL = "https://your-company.atlassian.net"
JIRA_EMAIL = "user@company.com"
JIRA_TOKEN = "YOUR_API_TOKEN_HERE"

auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_TOKEN)
headers = {"Accept": "application/json", "Content-Type": "application/json"}


# ========== JIRA API ==========

class JiraApi:
    def get_current_user(self):
        try:
            r = requests.get(f"{JIRA_URL}/rest/api/3/myself", auth=auth, headers=headers)
            if r.status_code == 200:
                user = r.json()
                return {"success": True, "user": {
                    "name": user.get("displayName"),
                    "email": user.get("emailAddress"),
                    "accountId": user.get("accountId")
                }}
            return {"success": False, "error": f"Status {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def search_tickets(self, jql, max_results=20):
        try:
            r = requests.post(
                f"{JIRA_URL}/rest/api/3/search/jql",
                auth=auth,
                headers=headers,
                json={"jql": jql, "maxResults": max_results, "fields": ["summary", "status", "assignee", "created", "updated", "priority"]}
            )
            if r.status_code == 200:
                data = r.json()
                tickets = []
                for issue in data.get("issues", []):
                    fields = issue.get("fields", {})
                    tickets.append({
                        "key": issue.get("key"),
                        "summary": fields.get("summary", ""),
                        "status": fields.get("status", {}).get("name", ""),
                        "assignee": fields.get("assignee", {}).get("displayName") if fields.get("assignee") else "Não atribuído",
                        "priority": fields.get("priority", {}).get("name") if fields.get("priority") else "-",
                        "created": fields.get("created", "")[:10],
                        "updated": fields.get("updated", "")[:10]
                    })
                return {"success": True, "total": data.get("total", 0), "tickets": tickets}
            return {"success": False, "error": f"Status {r.status_code}: {r.text[:200]}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_my_tickets(self):
        return self.search_tickets('assignee = currentUser() AND status != Done ORDER BY updated DESC')
    
    def get_recent_tickets(self):
        return self.search_tickets('updated >= -7d ORDER BY updated DESC', 10)


api = JiraApi()


# ========== HTTP SERVER ==========

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
    <meta charset="UTF-8">
    <title>Jira Monitor - Teste</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        h1 { font-size: 24px; margin-bottom: 20px; }
        h2 { font-size: 18px; margin-bottom: 10px; }
        .card {
            background: rgba(255,255,255,0.15);
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 15px;
            backdrop-filter: blur(10px);
        }
        .user-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .avatar {
            width: 40px;
            height: 40px;
            background: #4CAF50;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }
        button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        button:hover { background: #45a049; }
        button:disabled { background: #666; cursor: not-allowed; }
        .ticket {
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
        }
        .ticket-key {
            font-weight: bold;
            color: #90cdf4;
            font-size: 14px;
        }
        .ticket-summary {
            font-size: 14px;
            margin: 5px 0;
        }
        .ticket-meta {
            font-size: 12px;
            opacity: 0.8;
            display: flex;
            gap: 15px;
        }
        .status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
        }
        .status-progress { background: #3182ce; }
        .status-waiting { background: #d69e2e; }
        .status-done { background: #38a169; }
        .status-default { background: #718096; }
        .loading { text-align: center; padding: 20px; opacity: 0.7; }
        .error { background: rgba(239, 68, 68, 0.3); padding: 10px; border-radius: 8px; }
        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 15px;
        }
        .stat {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-value { font-size: 28px; font-weight: bold; }
        .stat-label { font-size: 12px; opacity: 0.8; }
    </style>
</head>
<body>
    <h1>🎫 Jira Monitor - Teste</h1>
    
    <div class="card" id="user-card">
        <div class="loading">Carregando usuário...</div>
    </div>
    
    <div class="card">
        <h2>Ações</h2>
        <button onclick="loadMyTickets()">Meus Tickets</button>
        <button onclick="loadRecentTickets()">Tickets Recentes</button>
        <button onclick="searchCustom()">Buscar JQL</button>
    </div>
    
    <div class="card">
        <h2>Estatísticas</h2>
        <div class="stats">
            <div class="stat">
                <div class="stat-value" id="stat-total">-</div>
                <div class="stat-label">Total</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="stat-open">-</div>
                <div class="stat-label">Em Aberto</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="stat-mine">-</div>
                <div class="stat-label">Meus</div>
            </div>
        </div>
    </div>
    
    <div class="card">
        <h2>Tickets</h2>
        <div id="tickets-container">
            <div class="loading">Clique em um botão para carregar tickets</div>
        </div>
    </div>
    
    <script>
        async function callApi(method, args = []) {
            try {
                const response = await fetch('/api/' + method, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ args })
                });
                const data = await response.json();
                return data.result || data;
            } catch (e) {
                return { success: false, error: e.message };
            }
        }
        
        function getStatusClass(status) {
            status = status.toLowerCase();
            if (status.includes('progress')) return 'status-progress';
            if (status.includes('waiting') || status.includes('pending')) return 'status-waiting';
            if (status.includes('done') || status.includes('closed')) return 'status-done';
            return 'status-default';
        }
        
        function renderTickets(data) {
            const container = document.getElementById('tickets-container');
            
            if (!data.success) {
                container.innerHTML = '<div class="error">Erro: ' + data.error + '</div>';
                return;
            }
            
            document.getElementById('stat-total').textContent = data.total;
            
            if (data.tickets.length === 0) {
                container.innerHTML = '<div class="loading">Nenhum ticket encontrado</div>';
                return;
            }
            
            container.innerHTML = data.tickets.map(t => `
                <div class="ticket">
                    <div class="ticket-key">${t.key}</div>
                    <div class="ticket-summary">${t.summary}</div>
                    <div class="ticket-meta">
                        <span class="status ${getStatusClass(t.status)}">${t.status}</span>
                        <span>👤 ${t.assignee}</span>
                        <span>📅 ${t.updated}</span>
                    </div>
                </div>
            `).join('');
        }
        
        async function loadMyTickets() {
            document.getElementById('tickets-container').innerHTML = '<div class="loading">Carregando...</div>';
            const data = await callApi('get_my_tickets');
            document.getElementById('stat-mine').textContent = data.total || 0;
            renderTickets(data);
        }
        
        async function loadRecentTickets() {
            document.getElementById('tickets-container').innerHTML = '<div class="loading">Carregando...</div>';
            const data = await callApi('get_recent_tickets');
            renderTickets(data);
        }
        
        async function searchCustom() {
            const jql = prompt('Digite a JQL:', 'project = ITOPS ORDER BY updated DESC');
            if (!jql) return;
            document.getElementById('tickets-container').innerHTML = '<div class="loading">Buscando...</div>';
            const data = await callApi('search_tickets', [jql, 20]);
            renderTickets(data);
        }
        
        async function loadUser() {
            const data = await callApi('get_current_user');
            const card = document.getElementById('user-card');
            
            if (data.success) {
                const initials = data.user.name.split(' ').map(n => n[0]).join('').substring(0,2);
                card.innerHTML = `
                    <div class="user-info">
                        <div class="avatar">${initials}</div>
                        <div>
                            <strong>${data.user.name}</strong>
                            <div style="font-size:12px;opacity:0.8">${data.user.email}</div>
                        </div>
                    </div>
                `;
            } else {
                card.innerHTML = '<div class="error">Erro: ' + data.error + '</div>';
            }
        }
        
        // Carregar usuário ao iniciar
        loadUser();
    </script>
</body>
</html>'''
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))
    
    def handle_api(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode() if content_length > 0 else '{}'
            data = json.loads(body) if body else {}
            
            method_name = self.path[5:]
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
    print("[server] HTTP em http://127.0.0.1:18080")
    server.serve_forever()


if __name__ == '__main__':
    thread = threading.Thread(target=start_server, daemon=True)
    thread.start()
    
    window = webview.create_window(
        title="Jira Monitor - Teste",
        url="http://127.0.0.1:18080/",
        width=450,
        height=650
    )
    
    webview.start(debug=False)
