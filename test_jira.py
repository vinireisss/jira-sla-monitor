#!/usr/bin/env python3
"""
Teste 1: Conexão com Jira API
"""
import requests
from requests.auth import HTTPBasicAuth

# Credenciais
JIRA_URL = "https://your-company.atlassian.net"
JIRA_EMAIL = "user@company.com"
JIRA_TOKEN = "YOUR_API_TOKEN_HERE"

auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_TOKEN)
headers = {
    "Accept": "application/json",
    "Content-Type": "application/json"
}

print("=" * 50)
print("TESTE: Conexão com Jira")
print("=" * 50)

# Teste 1: Verificar usuário atual
print("\n1. Testando autenticação...")
response = requests.get(f"{JIRA_URL}/rest/api/3/myself", auth=auth, headers=headers)
if response.status_code == 200:
    user = response.json()
    print(f"   ✅ Conectado como: {user.get('displayName')}")
else:
    print(f"   ❌ Erro: {response.status_code}")
    exit(1)

# Teste 2: Listar projetos disponíveis
print("\n2. Listando projetos...")
response = requests.get(f"{JIRA_URL}/rest/api/3/project/search?maxResults=10", auth=auth, headers=headers)
if response.status_code == 200:
    projects = response.json().get("values", [])
    print(f"   Total projetos acessíveis: {len(projects)}")
    for p in projects[:5]:
        print(f"      - {p.get('key')}: {p.get('name')}")
else:
    print(f"   Erro: {response.status_code}")

# Teste 3: Buscar meus tickets recentes
print("\n3. Buscando seus tickets recentes...")
jql = 'assignee = currentUser() ORDER BY updated DESC'
response = requests.post(
    f"{JIRA_URL}/rest/api/3/search/jql",
    auth=auth,
    headers=headers,
    json={"jql": jql, "maxResults": 10}
)
if response.status_code == 200:
    data = response.json()
    total = data.get("total", 0)
    print(f"   ✅ Total de tickets atribuídos a você: {total}")
    issues = data.get("issues", [])
    for issue in issues[:5]:
        key = issue.get("key")
        summary = issue.get("fields", {}).get("summary", "")[:40]
        status = issue.get("fields", {}).get("status", {}).get("name", "?")
        print(f"      - {key} [{status}]: {summary}...")
else:
    print(f"   Erro: {response.status_code} - {response.text[:200]}")

# Teste 4: Buscar tickets da queue do app original (se existir)
print("\n4. Buscando tickets por filtro personalizado...")
# Tentar várias queries
queries = [
    ('Seus tickets em aberto', 'assignee = currentUser() AND status != Done AND status != Closed'),
    ('Tickets recentes ITOPS', 'project = ITOPS AND updated >= -7d'),
    ('Qualquer ticket recente', 'updated >= -1d ORDER BY updated DESC'),
]

for name, jql in queries:
    response = requests.post(
        f"{JIRA_URL}/rest/api/3/search/jql",
        auth=auth,
        headers=headers,
        json={"jql": jql, "maxResults": 5}
    )
    if response.status_code == 200:
        total = response.json().get("total", 0)
        print(f"   {name}: {total} tickets")
    else:
        print(f"   {name}: Erro {response.status_code}")

print("\n" + "=" * 50)
print("Backend OK - API Jira funcionando")
print("=" * 50)
