#!/usr/bin/env python3
"""
Jira Monitor v3 - PyWebView + HTTP API
"""
import webview
import json
import os
import sys
import threading
import webbrowser
import subprocess
import platform
import requests
import socket
from requests.auth import HTTPBasicAuth
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from datetime import datetime
import time

# ========== SINGLE INSTANCE LOCK ==========
LOCK_PORT = 47200
_lock_socket = None

def acquire_single_instance_lock():
    """
    Tenta adquirir lock para garantir instância única.
    Retorna True se conseguiu (primeira instância), False se já existe outra.
    """
    global _lock_socket
    try:
        _lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        _lock_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        _lock_socket.bind(('127.0.0.1', LOCK_PORT))
        _lock_socket.listen(1)
        print(f"[main] Single instance lock acquired on port {LOCK_PORT}")
        return True
    except socket.error as e:
        print(f"[main] Another instance is already running (port {LOCK_PORT} in use)")
        return False

def show_already_running_alert():
    """Mostra alerta de que o app já está rodando"""
    try:
        subprocess.run([
            "osascript", "-e",
            'display dialog "Jira Monitor já está em execução!" buttons {"OK"} default button "OK" with icon caution with title "Jira Monitor"'
        ], check=False)
    except:
        pass

# Variáveis globais
main_window = None
mini_window = None
status_item = None
tray_tickets_data = {"critical": [], "warning": [], "normal": []}

# ========== TRAY ICON (macOS Menu Bar) ==========
HAS_TRAY = False
try:
    import AppKit
    import objc
    from Foundation import NSObject
    HAS_TRAY = True
except ImportError:
    print("[main] AppKit não disponível - tray icon desativado")

if HAS_TRAY:
    class TrayMenuDelegate(NSObject):
        """Delegate para ações do menu do tray"""
        
        def showWindow_(self, sender):
            global main_window
            if main_window:
                try:
                    main_window.show()
                    main_window.restore()
                except Exception as e:
                    print(f"[tray] Erro ao mostrar: {e}")
        
        def hideWindow_(self, sender):
            global main_window
            if main_window:
                try:
                    main_window.hide()
                except Exception as e:
                    print(f"[tray] Erro ao esconder: {e}")
        
        def refreshTickets_(self, sender):
            """Força atualização dos tickets"""
            global main_window
            if main_window:
                try:
                    main_window.evaluate_js("fetchAndUpdateStats()")
                except:
                    pass
        
        def openTicket_(self, sender):
            """Abre um ticket no Jira"""
            try:
                ticket_key = sender.representedObject()
                if ticket_key:
                    url = f"{config.get('jiraUrl', 'https://your-company.atlassian.net')}/browse/{ticket_key}"
                    webbrowser.open(url)
            except Exception as e:
                print(f"[tray] Erro ao abrir ticket: {e}")
        
        def quitApp_(self, sender):
            global main_window
            if main_window:
                try:
                    main_window.destroy()
                except:
                    pass
            os._exit(0)
        
        def menuNeedsUpdate_(self, menu):
            """Chamado quando o menu vai ser exibido - atualiza dinamicamente"""
            rebuild_tray_menu(menu)

tray_delegate = None

def rebuild_tray_menu(menu):
    """Reconstrói o menu com os dados atuais"""
    global tray_delegate, tray_tickets_data
    
    if not tray_delegate:
        return
    
    try:
        # Limpar menu existente
        menu.removeAllItems()
        
        critical = tray_tickets_data.get("critical", [])
        warning = tray_tickets_data.get("warning", [])
        normal = tray_tickets_data.get("normal", [])
        
        # Seção: Críticos (SLA estourado)
        if critical:
            header = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                f"🔴 SLA Estourado ({len(critical)})", None, "")
            header.setEnabled_(False)
            menu.addItem_(header)
            
            for ticket in critical[:5]:
                key = ticket.get('key', '?')
                summary = ticket.get('summary', '')[:35]
                title = f"  {key} - {summary}"
                item = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                    title, "openTicket:", "")
                item.setTarget_(tray_delegate)
                item.setRepresentedObject_(key)
                menu.addItem_(item)
            
            menu.addItem_(AppKit.NSMenuItem.separatorItem())
        
        # Seção: Alerta (SLA próximo)
        if warning:
            header = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                f"🟡 SLA Próximo ({len(warning)})", None, "")
            header.setEnabled_(False)
            menu.addItem_(header)
            
            for ticket in warning[:5]:
                key = ticket.get('key', '?')
                summary = ticket.get('summary', '')[:35]
                title = f"  {key} - {summary}"
                item = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                    title, "openTicket:", "")
                item.setTarget_(tray_delegate)
                item.setRepresentedObject_(key)
                menu.addItem_(item)
            
            menu.addItem_(AppKit.NSMenuItem.separatorItem())
        
        # Seção: Normal (SLA ok)
        if normal:
            header = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                f"🟢 SLA OK ({len(normal)})", None, "")
            header.setEnabled_(False)
            menu.addItem_(header)
            
            for ticket in normal[:3]:
                key = ticket.get('key', '?')
                summary = ticket.get('summary', '')[:35]
                title = f"  {key} - {summary}"
                item = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                    title, "openTicket:", "")
                item.setTarget_(tray_delegate)
                item.setRepresentedObject_(key)
                menu.addItem_(item)
            
            menu.addItem_(AppKit.NSMenuItem.separatorItem())
        
        # Se não tem tickets
        if not critical and not warning and not normal:
            empty = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                "✅ Nenhum ticket pendente", None, "")
            empty.setEnabled_(False)
            menu.addItem_(empty)
            menu.addItem_(AppKit.NSMenuItem.separatorItem())
        
        # Ações
        show_item = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Mostrar Jira Monitor", "showWindow:", "")
        show_item.setTarget_(tray_delegate)
        menu.addItem_(show_item)
        
        hide_item = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Esconder Jira Monitor", "hideWindow:", "")
        hide_item.setTarget_(tray_delegate)
        menu.addItem_(hide_item)
        
        menu.addItem_(AppKit.NSMenuItem.separatorItem())
        
        refresh_item = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Atualizar", "refreshTickets:", "r")
        refresh_item.setTarget_(tray_delegate)
        menu.addItem_(refresh_item)
        
        menu.addItem_(AppKit.NSMenuItem.separatorItem())
        
        quit_item = AppKit.NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Sair", "quitApp:", "q")
        quit_item.setTarget_(tray_delegate)
        menu.addItem_(quit_item)
        
    except Exception as e:
        print(f"[tray] Erro ao reconstruir menu: {e}")

def update_tray_menu():
    """Placeholder - menu é atualizado dinamicamente via delegate"""
    pass

def update_tray_status(critical=0, warning=0, normal=0):
    """Atualiza o ícone do tray com contagem"""
    global status_item
    
    if not HAS_TRAY or not status_item:
        return
    
    try:
        # Determinar emoji baseado na situação
        if critical > 0:
            icon = f"🔴{critical}"
        elif warning > 0:
            icon = f"🟡{warning}"
        elif normal > 0:
            icon = f"🟢{normal}"
        else:
            icon = "✅"
        
        # Atualizar título diretamente (sem callAfter para evitar deadlock)
        try:
            status_item.button().setTitle_(icon)
            tooltip = f"Jira Monitor - 🔴{critical} 🟡{warning} 🟢{normal}"
            status_item.button().setToolTip_(tooltip)
        except:
            pass
        
    except Exception as e:
        print(f"[tray] Erro ao atualizar: {e}")

def setup_status_bar():
    """Configura o status bar na main thread"""
    global status_item, tray_delegate
    
    if not HAS_TRAY:
        return
    
    try:
        from PyObjCTools import AppHelper
        
        def _setup():
            global status_item, tray_delegate
            
            tray_delegate = TrayMenuDelegate.alloc().init()
            
            # Criar status item
            status_bar = AppKit.NSStatusBar.systemStatusBar()
            status_item = status_bar.statusItemWithLength_(AppKit.NSVariableStatusItemLength)
            
            # Configurar título inicial
            status_item.button().setTitle_("⏳")
            status_item.button().setToolTip_("Jira Monitor - Carregando...")
            
            # Criar menu com delegate para atualização dinâmica
            menu = AppKit.NSMenu.alloc().init()
            menu.setDelegate_(tray_delegate)
            status_item.setMenu_(menu)
            
            print("[tray] Status bar OK")
        
        AppHelper.callAfter(_setup)
    except Exception as e:
        print(f"[tray] Erro ao configurar: {e}")

# ========== CACHE SIMPLES ==========
class SimpleCache:
    def __init__(self, ttl=30):  # 30 segundos de cache
        self._cache = {}
        self._ttl = ttl
    
    def get(self, key):
        if key in self._cache:
            data, timestamp = self._cache[key]
            if time.time() - timestamp < self._ttl:
                return data
            del self._cache[key]
        return None
    
    def set(self, key, value):
        self._cache[key] = (value, time.time())
    
    def clear(self):
        self._cache.clear()

cache = SimpleCache(ttl=15)  # Cache de 15 segundos (reduzido)

# PyInstaller: determinar diretório base
if getattr(sys, 'frozen', False):
    # Executando como app empacotado
    BASE_DIR = Path(sys._MEIPASS)
else:
    # Executando como script
    BASE_DIR = Path(__file__).parent

# ========== CONFIG ==========

CONFIG_DIR = Path.home() / "Library" / "Application Support" / "jira-monitor"
CONFIG_FILE = CONFIG_DIR / "config.json"

def load_config():
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text())
        except:
            pass
    # Retornar config vazio para primeira vez (sem credenciais)
    return {
        "jiraUrl": "",
        "jiraEmail": "",
        "jiraApiToken": "",
        "queueId": "1104",
        "refreshInterval": 60,
        "language": "pt-BR",
        "windowBounds": {"width": 1200, "height": 700}
    }

def save_config(config):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(config, indent=2))

config = load_config()

# ========== CANNED RESPONSES ==========
CANNED_RESPONSES_FILE = CONFIG_DIR / "canned-responses.json"

def load_canned_responses():
    if CANNED_RESPONSES_FILE.exists():
        try:
            return json.loads(CANNED_RESPONSES_FILE.read_text())
        except:
            pass
    return {"personal": [], "shared": []}

def save_canned_responses(responses):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CANNED_RESPONSES_FILE.write_text(json.dumps(responses, indent=2))

# ========== JIRA API ==========

def get_auth():
    return HTTPBasicAuth(config.get("jiraEmail", ""), config.get("jiraApiToken", ""))

def get_headers():
    return {"Accept": "application/json", "Content-Type": "application/json"}

def jira_url():
    return config.get("jiraUrl", "https://your-company.atlassian.net")

class JiraAPI:
    def getConfig(self):
        # Garantir que floatingWindow existe no config
        if 'floatingWindow' not in config:
            config['floatingWindow'] = {
                'enabled': False,  # Desativado por padrão
                'opacity': 0.9,
                'width': 160,
                'height': 80,
                'x': 20,
                'y': 60,
                'showCritical': True,
                'showWarning': True,
                'showNormal': True,
                'showTicketList': False
            }
        return config
    
    def saveConfig(self, new_config):
        global config
        config.update(new_config)
        save_config(config)
        return {"success": True}
    
    # Canned Responses (Respostas Prontas)
    def getCannedResponses(self):
        return {"success": True, "data": load_canned_responses()}
    
    def saveCannedResponse(self, response_data):
        """Salvar uma resposta pronta (criar ou atualizar)"""
        try:
            responses = load_canned_responses()
            category = response_data.get("category", "personal")  # personal ou shared
            response_id = response_data.get("id")
            
            if category not in responses:
                responses[category] = []
            
            if response_id:
                # Atualizar existente
                for i, r in enumerate(responses[category]):
                    if r.get("id") == response_id:
                        responses[category][i] = {
                            "id": response_id,
                            "name": response_data.get("name", ""),
                            "content": response_data.get("content", ""),
                            "category": category
                        }
                        break
            else:
                # Criar nova
                import uuid
                new_response = {
                    "id": str(uuid.uuid4())[:8],
                    "name": response_data.get("name", "Nova Resposta"),
                    "content": response_data.get("content", ""),
                    "category": category
                }
                responses[category].append(new_response)
            
            save_canned_responses(responses)
            return {"success": True, "data": responses}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def deleteCannedResponse(self, response_id, category="personal"):
        """Deletar uma resposta pronta"""
        try:
            responses = load_canned_responses()
            if category in responses:
                responses[category] = [r for r in responses[category] if r.get("id") != response_id]
            save_canned_responses(responses)
            return {"success": True, "data": responses}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def getConfigValue(self, key, default=None):
        return config.get(key, default)
    
    def setConfigValue(self, key, value):
        config[key] = value
        save_config(config)
        return {"success": True}
    
    def testConnection(self):
        try:
            r = requests.get(f"{jira_url()}/rest/api/3/myself", auth=get_auth(), headers=get_headers(), timeout=10)
            if r.status_code == 200:
                return {"success": True, "user": r.json().get("displayName")}
            return {"success": False, "error": f"Status {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def getCurrentUser(self):
        try:
            r = requests.get(f"{jira_url()}/rest/api/3/myself", auth=get_auth(), headers=get_headers())
            if r.status_code == 200:
                u = r.json()
                return {"success": True, "displayName": u.get("displayName"), "emailAddress": u.get("emailAddress"), "accountId": u.get("accountId")}
            return {"success": False, "error": f"Status {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def fetchStats(self, other_user_email=None):
        # Determinar qual usuário buscar
        assignee = f'"{other_user_email}"' if other_user_email else 'currentUser()'
        cache_key = f"stats_{other_user_email or 'me'}"
        
        # Verificar cache primeiro
        cached = cache.get(cache_key)
        if cached:
            print(f"[api] fetchStats: usando cache para {assignee}")
            return cached
        
        try:
            # JQL para buscar tickets do projeto IT (não finalizados - exclui Canceled, Resolved, etc)
            jql = f'assignee = {assignee} AND project = "IT" AND statusCategory != Done ORDER BY updated DESC'
            
            print(f"[api] fetchStats JQL: {jql}")
            
            r = requests.post(
                f"{jira_url()}/rest/api/3/search/jql",
                auth=get_auth(),
                headers=get_headers(),
                json={"jql": jql, "maxResults": 100, "fields": ["summary", "status", "priority", "created", "updated"]},
                timeout=15
            )
            
            if r.status_code != 200:
                print(f"[api] fetchStats error: {r.status_code} - {r.text[:200]}")
                return {"success": False, "error": f"Status {r.status_code}"}
            
            response_data = r.json()
            issues = response_data.get("issues", [])
            api_total = response_data.get("total", 0)
            print(f"[api] fetchStats: API retornou total={api_total}, issues={len(issues)}")
            
            # Processar estatísticas
            stats = {
                "total": len(issues),
                "waitingForSupport": 0,
                "waitingForCustomer": 0,
                "inProgress": 0,
                "pending": 0,
                "supportTickets": [],
                "customerTickets": [],
                "inProgressTickets": [],
                "pendingTickets": [],
                "allTickets": []
            }
            
            for issue in issues:
                fields = issue.get("fields", {})
                status_name = fields.get("status", {}).get("name", "")
                status_lower = status_name.lower()
                
                ticket_data = {
                    "key": issue.get("key"),
                    "summary": fields.get("summary", ""),
                    "status": status_name,
                    "priority": fields.get("priority", {}).get("name") if fields.get("priority") else None,
                    "created": fields.get("created", ""),
                    "updated": fields.get("updated", ""),
                    "fields": fields
                }
                
                stats["allTickets"].append(ticket_data)
                
                if "waiting for support" in status_lower or "aguardando suporte" in status_lower:
                    stats["waitingForSupport"] += 1
                    stats["supportTickets"].append(ticket_data)
                elif "waiting for customer" in status_lower or "aguardando cliente" in status_lower:
                    stats["waitingForCustomer"] += 1
                    stats["customerTickets"].append(ticket_data)
                elif "progress" in status_lower or "progresso" in status_lower:
                    stats["inProgress"] += 1
                    stats["inProgressTickets"].append(ticket_data)
                elif "pending" in status_lower or "pendente" in status_lower:
                    stats["pending"] += 1
                    stats["pendingTickets"].append(ticket_data)
            
            print(f"[api] fetchStats: {stats['total']} tickets")
            
            # Pro Mode - usar cache separado e carregar em paralelo
            stats["simcardPendingTickets"] = self._getCached("simcard", self._getSimCardsTickets)
            stats["l0BotTickets"] = self._getCached("l0bot", self._getL0BotTickets)
            stats["l1OpenTickets"] = self._getCached("l1open", self._getL1OpenTickets)
            
            # Atividade de Hoje (sem cache - dados em tempo real)
            today_data = self._getTodayActivity()
            stats["todayReceived"] = today_data.get("received", [])
            stats["todayResolved"] = today_data.get("resolved", [])
            # todayComments deve ser um ARRAY de objetos, não um número!
            stats["todayComments"] = today_data.get("comments", [])
            print(f"[api] Today: received={len(stats['todayReceived'])}, resolved={len(stats['todayResolved'])}, comments={len(stats['todayComments'])}")
            
            # Tickets Avaliados
            stats["evaluatedTickets"] = self._getCached("evaluated", self._getEvaluatedTickets)
            
            # Tickets Recentes
            stats["recentTickets"] = issues[:10] if issues else []
            
            # Tendência
            stats["trend"] = self._getCached("trend", self._getTrendData)
            
            result = {"success": True, "data": stats}
            cache.set(cache_key, result)
            return result
        except Exception as e:
            print(f"[api] fetchStats error: {e}")
            return {"success": False, "error": str(e)}
    
    def _getCached(self, key, func):
        """Helper para buscar do cache ou executar função"""
        cached = cache.get(key)
        if cached is not None:
            return cached
        try:
            result = func()
            cache.set(key, result)
            return result
        except Exception as e:
            print(f"[api] _getCached({key}) error: {e}")
            return {}
    
    def getTicketDetails(self, key):
        """Buscar detalhes completos de um ticket com processamento"""
        try:
            # Buscar dados do ticket com todos os campos
            r = requests.get(
                f"{jira_url()}/rest/api/3/issue/{key}?fields=*all&expand=names",
                auth=get_auth(),
                headers=get_headers(),
                timeout=15
            )
            
            if r.status_code != 200:
                return {"success": False, "error": f"Status {r.status_code}"}
            
            data = r.json()
            fields = data.get("fields", {})
            names_map = data.get("names", {})
            
            # Processar descrição (ADF para HTML simples)
            description = self._convertADFToHTML(fields.get("description"))
            
            # Processar comentários
            comments_data = fields.get("comment", {}).get("comments", [])
            comments = []
            for c in comments_data:
                comments.append({
                    "id": c.get("id"),
                    "author": c.get("author", {}).get("displayName", "Desconhecido"),
                    "authorAccountId": c.get("author", {}).get("accountId", ""),
                    "created": c.get("created"),
                    "body": self._convertADFToHTML(c.get("body")),
                    "isInternal": c.get("jsdPublic") == False
                })
            
            # Processar anexos
            attachments_data = fields.get("attachment", [])
            attachments = []
            for a in attachments_data:
                attachments.append({
                    "id": a.get("id"),
                    "filename": a.get("filename"),
                    "size": a.get("size"),
                    "mimeType": a.get("mimeType"),
                    "created": a.get("created"),
                    "author": a.get("author", {}).get("displayName", ""),
                    "content": a.get("content"),
                    "thumbnail": a.get("thumbnail")
                })
            
            # Buscar transições disponíveis
            transitions = []
            try:
                r_trans = requests.get(
                    f"{jira_url()}/rest/api/3/issue/{key}/transitions",
                    auth=get_auth(),
                    headers=get_headers(),
                    timeout=5
                )
                if r_trans.status_code == 200:
                    for t in r_trans.json().get("transitions", []):
                        transitions.append({
                            "id": t.get("id"),
                            "name": t.get("name"),
                            "to": t.get("to")
                        })
            except:
                pass
            
            # Detectar campos customizados (Support Level, ITOps Team)
            support_level = None
            team = None
            custom_fields = {}
            
            
            for field_id, value in fields.items():
                if not field_id.startswith("customfield_"):
                    continue
                
                field_name = names_map.get(field_id, field_id)
                display_value = self._extractFieldDisplayValue(value)
                
                custom_fields[field_id] = {
                    "id": field_id,
                    "name": field_name,
                    "value": display_value
                }
                
                if field_name:
                    fn_lower = field_name.lower()
                    
                    # Detectar Support Level - ITOPS (customfield_10906)
                    if field_id == "customfield_10906" or ("support" in fn_lower and "level" in fn_lower and "itops" in fn_lower):
                        support_level = display_value
                    
                    # Detectar ITOps Team (customfield_10635)
                    if field_id == "customfield_10635" or fn_lower == "itops team":
                        team = display_value
            
            # Montar objeto final
            status = fields.get("status", {})
            assignee = fields.get("assignee")
            reporter = fields.get("reporter")
            priority = fields.get("priority")
            project = fields.get("project", {})
            
            ticket_details = {
                "key": key,
                "summary": fields.get("summary", ""),
                "description": description or "<p>Sem descrição</p>",
                "status": {
                    "name": status.get("name", ""),
                    "id": status.get("id", "")
                },
                "assignee": {
                    "displayName": assignee.get("displayName", "") if assignee else None,
                    "accountId": assignee.get("accountId", "") if assignee else None,
                    "emailAddress": assignee.get("emailAddress", "") if assignee else None
                } if assignee else None,
                "reporter": {
                    "displayName": reporter.get("displayName", "") if reporter else None,
                    "accountId": reporter.get("accountId", "") if reporter else None,
                    "emailAddress": reporter.get("emailAddress", "") if reporter else None
                } if reporter else None,
                "priority": priority.get("name", "N/A") if priority else "N/A",
                "created": fields.get("created"),
                "updated": fields.get("updated"),
                "duedate": fields.get("duedate"),
                "comments": comments,
                "attachments": attachments,
                "customFields": custom_fields,
                "availableTransitions": transitions,
                "project": project.get("key", ""),
                "supportLevel": support_level,
                "team": team,
                "fieldIds": {
                    "supportLevel": None,
                    "team": None
                },
                "sla": None
            }
            
            print(f"[api] Ticket {key}: {len(comments)} comments, {len(attachments)} attachments")
            return {"success": True, "data": ticket_details}
        except Exception as e:
            print(f"[api] getTicketDetails error: {e}")
            return {"success": False, "error": str(e)}
    
    def _convertADFToHTML(self, content):
        """Converter ADF (Atlassian Document Format) para HTML simples"""
        if not content:
            return ""
        
        if isinstance(content, str):
            return f"<p>{content}</p>"
        
        if not isinstance(content, dict):
            return ""
        
        def convert_node(node):
            if not node or not isinstance(node, dict):
                return ""
            
            node_type = node.get("type", "")
            text = node.get("text", "")
            children = node.get("content", [])
            
            if node_type == "text":
                # Aplicar marcas (bold, italic, etc)
                marks = node.get("marks", [])
                result = text
                for mark in marks:
                    mark_type = mark.get("type", "")
                    if mark_type == "strong":
                        result = f"<strong>{result}</strong>"
                    elif mark_type == "em":
                        result = f"<em>{result}</em>"
                    elif mark_type == "code":
                        result = f"<code>{result}</code>"
                    elif mark_type == "link":
                        href = mark.get("attrs", {}).get("href", "#")
                        result = f'<a href="{href}" target="_blank">{result}</a>'
                return result
            
            elif node_type == "paragraph":
                inner = "".join(convert_node(c) for c in children)
                return f"<p>{inner}</p>"
            
            elif node_type == "heading":
                level = node.get("attrs", {}).get("level", 1)
                inner = "".join(convert_node(c) for c in children)
                return f"<h{level}>{inner}</h{level}>"
            
            elif node_type == "bulletList":
                items = "".join(convert_node(c) for c in children)
                return f"<ul>{items}</ul>"
            
            elif node_type == "orderedList":
                items = "".join(convert_node(c) for c in children)
                return f"<ol>{items}</ol>"
            
            elif node_type == "listItem":
                inner = "".join(convert_node(c) for c in children)
                return f"<li>{inner}</li>"
            
            elif node_type == "codeBlock":
                inner = "".join(convert_node(c) for c in children)
                return f"<pre><code>{inner}</code></pre>"
            
            elif node_type == "blockquote":
                inner = "".join(convert_node(c) for c in children)
                return f"<blockquote>{inner}</blockquote>"
            
            elif node_type == "hardBreak":
                return "<br>"
            
            elif node_type == "mention":
                mention_text = node.get("attrs", {}).get("text", "@user")
                return f'<span class="mention">{mention_text}</span>'
            
            elif node_type == "doc":
                return "".join(convert_node(c) for c in children)
            
            else:
                # Para outros tipos, processar filhos
                return "".join(convert_node(c) for c in children)
        
        return convert_node(content)
    
    def _extractFieldDisplayValue(self, value):
        """Extrair valor de exibição de um campo"""
        if value is None:
            return None
        if isinstance(value, str):
            return value
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, dict):
            return value.get("value") or value.get("name") or value.get("displayName") or str(value)
        if isinstance(value, list):
            return ", ".join(self._extractFieldDisplayValue(v) for v in value if v)
        return str(value)
    
    def searchTickets(self, query, max_results=50):
        try:
            r = requests.post(
                f"{jira_url()}/rest/api/3/search/jql",
                auth=get_auth(),
                headers=get_headers(),
                json={"jql": query, "maxResults": max_results}
            )
            if r.status_code == 200:
                return {"success": True, **r.json()}
            return {"success": False, "error": f"Status {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def addComment(self, key, comment, internal=False, mentions=None):
        try:
            # Converter texto com menções para ADF
            adf_content = self._convertTextToADF(comment, mentions or {})
            body = {"body": adf_content}
            
            # Adicionar propriedade de comentário interno se necessário
            if internal:
                body["properties"] = [{"key": "sd.public.comment", "value": {"internal": True}}]
            
            r = requests.post(f"{jira_url()}/rest/api/3/issue/{key}/comment", auth=get_auth(), headers=get_headers(), json=body)
            return {"success": r.status_code in [200, 201]}
        except Exception as e:
            print(f"[api] addComment error: {e}")
            return {"success": False, "error": str(e)}
    
    def _convertTextToADF(self, text, mentions):
        """Converter texto com menções para ADF do Jira"""
        import re
        
        # Se não há menções, retornar ADF simples
        if not mentions:
            return {
                "type": "doc",
                "version": 1,
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}]
            }
        
        # Dividir o texto em partes, identificando menções
        content = []
        current_text = text
        
        # Ordenar menções por posição no texto (da última para a primeira para não bagunçar os índices)
        mention_positions = []
        for display_name, account_id in mentions.items():
            pattern = f"@{re.escape(display_name)}"
            for match in re.finditer(pattern, current_text):
                mention_positions.append({
                    "start": match.start(),
                    "end": match.end(),
                    "display_name": display_name,
                    "account_id": account_id
                })
        
        # Ordenar por posição
        mention_positions.sort(key=lambda x: x["start"])
        
        # Construir conteúdo do parágrafo
        paragraph_content = []
        last_end = 0
        
        for mention in mention_positions:
            # Adicionar texto antes da menção
            if mention["start"] > last_end:
                paragraph_content.append({
                    "type": "text",
                    "text": current_text[last_end:mention["start"]]
                })
            
            # Adicionar menção
            paragraph_content.append({
                "type": "mention",
                "attrs": {
                    "id": mention["account_id"],
                    "text": f"@{mention['display_name']}",
                    "accessLevel": ""
                }
            })
            
            last_end = mention["end"]
        
        # Adicionar texto restante
        if last_end < len(current_text):
            paragraph_content.append({
                "type": "text",
                "text": current_text[last_end:]
            })
        
        # Se não houver conteúdo, adicionar texto vazio
        if not paragraph_content:
            paragraph_content.append({"type": "text", "text": text})
        
        return {
            "type": "doc",
            "version": 1,
            "content": [{"type": "paragraph", "content": paragraph_content}]
        }
    
    def addWorklog(self, key, time_spent, comment=""):
        try:
            body = {"timeSpent": time_spent}
            if comment:
                body["comment"] = {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": comment}]}]}
            r = requests.post(f"{jira_url()}/rest/api/3/issue/{key}/worklog", auth=get_auth(), headers=get_headers(), json=body)
            return {"success": r.status_code in [200, 201]}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def getWorklogs(self, key):
        """Buscar worklogs de um ticket"""
        try:
            r = requests.get(
                f"{jira_url()}/rest/api/3/issue/{key}/worklog",
                auth=get_auth(),
                headers=get_headers(),
                timeout=10
            )
            if r.status_code == 200:
                worklogs = r.json().get("worklogs", [])
                # Processar worklogs para formato mais simples
                processed = []
                for w in worklogs:
                    processed.append({
                        "id": w.get("id"),
                        "author": w.get("author", {}).get("displayName", ""),
                        "timeSpent": w.get("timeSpent", ""),
                        "timeSpentSeconds": w.get("timeSpentSeconds", 0),
                        "started": w.get("started", ""),
                        "comment": self._convertADFToText(w.get("comment")) if w.get("comment") else ""
                    })
                return {"success": True, "worklogs": processed}
            return {"success": False, "error": f"Status {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def updateComment(self, key, comment_id, new_body):
        """Atualizar um comentário existente"""
        try:
            body = {
                "body": {
                    "type": "doc",
                    "version": 1,
                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": new_body}]}]
                }
            }
            r = requests.put(
                f"{jira_url()}/rest/api/3/issue/{key}/comment/{comment_id}",
                auth=get_auth(),
                headers=get_headers(),
                json=body,
                timeout=10
            )
            if r.status_code == 200:
                return {"success": True}
            return {"success": False, "error": f"Status {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def deleteComment(self, key, comment_id):
        """Deletar um comentário"""
        try:
            r = requests.delete(
                f"{jira_url()}/rest/api/3/issue/{key}/comment/{comment_id}",
                auth=get_auth(),
                headers=get_headers(),
                timeout=10
            )
            if r.status_code == 204:
                return {"success": True}
            return {"success": False, "error": f"Status {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _convertADFToText(self, adf_content):
        """Converter ADF para texto simples"""
        if not adf_content:
            return ""
        if isinstance(adf_content, str):
            return adf_content
        
        def extract_text(node):
            if not node or not isinstance(node, dict):
                return ""
            if node.get("type") == "text":
                return node.get("text", "")
            children = node.get("content", [])
            return "".join(extract_text(c) for c in children)
        
        return extract_text(adf_content)
    
    def getTransitions(self, key):
        try:
            r = requests.get(f"{jira_url()}/rest/api/3/issue/{key}/transitions", auth=get_auth(), headers=get_headers())
            if r.status_code == 200:
                return {"success": True, "transitions": r.json().get("transitions", [])}
            return {"success": False, "error": f"Status {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def transitionTicket(self, key, transition_id):
        try:
            r = requests.post(f"{jira_url()}/rest/api/3/issue/{key}/transitions", auth=get_auth(), headers=get_headers(), json={"transition": {"id": transition_id}})
            return {"success": r.status_code == 204}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def getTicketSla(self, key):
        """Buscar informações de SLA de um ticket usando Service Desk API"""
        try:
            r = requests.get(
                f"{jira_url()}/rest/servicedeskapi/request/{key}/sla",
                auth=get_auth(),
                headers=get_headers(),
                timeout=8  # Timeout reduzido para resposta mais rápida
            )
            
            if r.status_code != 200:
                return {"success": True, "data": None}
            
            sla_data = r.json().get("values", [])
            
            if not sla_data:
                return {"success": True, "data": None}
            
            sla_info = self._parseSlaData(sla_data)
            return {"success": True, "data": sla_info if sla_info else None}
        except Exception as e:
            print(f"[api] SLA error for {key}: {e}")
            return {"success": True, "data": None}
    
    def getTicketSlaBatch(self, keys):
        """Buscar SLA de múltiplos tickets em paralelo"""
        import concurrent.futures
        
        if not keys or not isinstance(keys, list):
            return {"success": True, "data": {}}
        
        results = {}
        
        def fetch_sla(key):
            try:
                r = requests.get(
                    f"{jira_url()}/rest/servicedeskapi/request/{key}/sla",
                    auth=get_auth(),
                    headers=get_headers(),
                    timeout=8
                )
                if r.status_code == 200:
                    sla_data = r.json().get("values", [])
                    return key, self._parseSlaData(sla_data)
                return key, None
            except:
                return key, None
        
        # Executar em paralelo com máximo de 5 threads
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(fetch_sla, key) for key in keys[:20]]  # Limitar a 20 tickets
            for future in concurrent.futures.as_completed(futures, timeout=15):
                try:
                    key, sla_info = future.result()
                    results[key] = sla_info
                except:
                    pass
        
        print(f"[api] SLA batch: {len(results)}/{len(keys)} tickets")
        return {"success": True, "data": results}
    
    def _parseSlaData(self, sla_data):
        """Parse SLA data comum"""
        if not sla_data:
            return None
        
        sla_info = {}
        
        for sla in sla_data:
            sla_name = sla.get("name", "").lower()
            
            # Time to Resolution
            if "time to resolution" in sla_name or "resolution" in sla_name:
                sla_info["timeToResolution"] = {
                    "name": sla.get("name"),
                    "ongoingCycle": sla.get("ongoingCycle"),
                    "completedCycles": sla.get("completedCycles", [])
                }
            
            # Time to First Response
            if "time to first response" in sla_name or "first response" in sla_name:
                sla_info["timeToFirstResponse"] = {
                    "name": sla.get("name"),
                    "ongoingCycle": sla.get("ongoingCycle"),
                    "completedCycles": sla.get("completedCycles", [])
                }
        
        return sla_info if sla_info else None
    
    def updateTicketField(self, key, field_name, value):
        """Atualizar campo do ticket - mapeia nomes amigáveis para IDs do Jira"""
        try:
            # Mapeamento de nomes amigáveis para IDs de campos do Jira
            field_mapping = {
                "supportLevel": "customfield_10906",  # Support Level - ITOPS
                "team": "customfield_10635",           # ITOps Team
                "priority": "priority",
                "assignee": "assignee",
                "reporter": "reporter",
            }
            
            # Obter ID real do campo
            jira_field = field_mapping.get(field_name, field_name)
            
            # Preparar valor conforme o tipo de campo
            if field_name == "supportLevel":
                # Support Level é um campo de seleção - precisa do formato correto
                field_value = {"value": value}
            elif field_name == "team":
                # ITOps Team também é um campo de seleção
                field_value = [{"value": value}]  # É um array de valores
            elif field_name == "priority":
                # Prioridade usa o nome
                field_value = {"name": value}
            elif field_name in ["assignee", "reporter"]:
                # Assignee/Reporter usam accountId
                field_value = {"accountId": value} if value else None
            elif field_name == "status":
                # Status usa transição, não update direto
                return self.transitionTicket(key, value)
            else:
                field_value = value
            
            print(f"[api] updateTicketField: {key} - {jira_field} = {field_value}")
            
            r = requests.put(
                f"{jira_url()}/rest/api/3/issue/{key}",
                auth=get_auth(),
                headers=get_headers(),
                json={"fields": {jira_field: field_value}},
                timeout=10
            )
            
            if r.status_code == 204:
                return {"success": True}
            else:
                error_msg = r.text[:200] if r.text else f"Status {r.status_code}"
                print(f"[api] updateTicketField error: {error_msg}")
                return {"success": False, "error": error_msg}
        except Exception as e:
            print(f"[api] updateTicketField exception: {e}")
            return {"success": False, "error": str(e)}
    
    def searchUsers(self, query):
        try:
            r = requests.get(f"{jira_url()}/rest/api/3/user/search?query={query}", auth=get_auth(), headers=get_headers())
            if r.status_code == 200:
                return {"success": True, "data": r.json()}  # Mudado de 'users' para 'data'
            return {"success": False, "error": f"Status {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def getAssignableUsers(self, project):
        try:
            r = requests.get(f"{jira_url()}/rest/api/3/user/assignable/search?project={project}", auth=get_auth(), headers=get_headers())
            if r.status_code == 200:
                return {"success": True, "users": r.json()}
            return {"success": False, "error": f"Status {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def fetchMentions(self):
        """Buscar usuários recentes para menções"""
        try:
            # Buscar usuários atribuíveis ao projeto IT
            r = requests.get(
                f"{jira_url()}/rest/api/3/user/search?query=&maxResults=50",
                auth=get_auth(), 
                headers=get_headers(),
                timeout=10
            )
            
            if r.status_code == 200:
                users = r.json()
                mentions = []
                for u in users:
                    if u.get("accountType") == "atlassian":  # Apenas usuários reais
                        mentions.append({
                            "accountId": u.get("accountId"),
                            "displayName": u.get("displayName"),
                            "emailAddress": u.get("emailAddress", ""),
                            "avatarUrl": u.get("avatarUrls", {}).get("24x24", "")
                        })
                return {"success": True, "mentions": mentions}
            return {"success": False, "error": f"Status {r.status_code}", "mentions": []}
        except Exception as e:
            return {"success": False, "error": str(e), "mentions": []}
    
    def getJiraPriorities(self):
        try:
            r = requests.get(f"{jira_url()}/rest/api/3/priority", auth=get_auth(), headers=get_headers())
            if r.status_code == 200:
                return {"success": True, "priorities": r.json()}
            return {"success": False, "error": f"Status {r.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def addAttachment(self, ticket_key, file_paths):
        """Adicionar anexo(s) a um ticket"""
        try:
            if not file_paths:
                return {"success": False, "error": "Nenhum arquivo selecionado"}
            
            # Se for string única, converter para lista
            if isinstance(file_paths, str):
                file_paths = [file_paths]
            
            results = []
            for file_path in file_paths:
                if not os.path.exists(file_path):
                    results.append({"file": file_path, "error": "Arquivo não encontrado"})
                    continue
                
                # Upload multipart
                with open(file_path, 'rb') as f:
                    files = {'file': (os.path.basename(file_path), f)}
                    headers = {
                        'X-Atlassian-Token': 'no-check'
                    }
                    
                    r = requests.post(
                        f"{jira_url()}/rest/api/3/issue/{ticket_key}/attachments",
                        auth=get_auth(),
                        headers=headers,
                        files=files,
                        timeout=60
                    )
                    
                    if r.status_code in [200, 201]:
                        results.append({"file": file_path, "success": True, "data": r.json()})
                    else:
                        results.append({"file": file_path, "error": f"Status {r.status_code}"})
            
            all_success = all(r.get("success") for r in results)
            print(f"[api] Attachment upload: {len(results)} files, success={all_success}")
            return {"success": all_success, "results": results}
        except Exception as e:
            print(f"[api] Attachment error: {e}")
            return {"success": False, "error": str(e)}
    
    def downloadAttachment(self, attachment_id, filename="attachment"):
        """Baixar um anexo"""
        try:
            # Buscar o conteúdo do anexo
            r = requests.get(
                f"{jira_url()}/rest/api/3/attachment/content/{attachment_id}",
                auth=get_auth(),
                stream=True,
                timeout=60
            )
            
            if r.status_code != 200:
                return {"success": False, "error": f"Status {r.status_code}"}
            
            # Salvar no diretório de Downloads
            downloads_dir = Path.home() / "Downloads"
            save_path = downloads_dir / filename
            
            # Se arquivo já existe, adicionar número
            counter = 1
            original_path = save_path
            while save_path.exists():
                name, ext = os.path.splitext(original_path.name)
                save_path = downloads_dir / f"{name}_{counter}{ext}"
                counter += 1
            
            with open(save_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"[api] Attachment downloaded: {save_path}")
            return {"success": True, "path": str(save_path)}
        except Exception as e:
            print(f"[api] Download error: {e}")
            return {"success": False, "error": str(e)}
    
    def getAttachmentUrl(self, attachment_id):
        """Obter URL direta do anexo"""
        return {"success": True, "url": f"{jira_url()}/rest/api/3/attachment/content/{attachment_id}"}
    
    def selectAttachmentFiles(self):
        """Abrir diálogo para selecionar arquivos (chamado pelo frontend)"""
        global window
        try:
            if window:
                file_types = ('All files (*.*)',)
                result = window.create_file_dialog(
                    webview.OPEN_DIALOG,
                    allow_multiple=True,
                    file_types=file_types
                )
                if result:
                    return {"cancelled": False, "filePaths": list(result)}
            return {"cancelled": True}
        except Exception as e:
            print(f"[api] File dialog error: {e}")
            return {"cancelled": True, "error": str(e)}
    
    def selectAndUploadAttachments(self, ticket_key):
        """Selecionar e fazer upload de anexos em um único passo"""
        global window
        try:
            if window:
                file_types = ('All files (*.*)',)
                result = window.create_file_dialog(
                    webview.OPEN_DIALOG,
                    allow_multiple=True,
                    file_types=file_types
                )
                if result and len(result) > 0:
                    return self.addAttachment(ticket_key, list(result))
            return {"cancelled": True}
        except Exception as e:
            print(f"[api] Select and upload error: {e}")
            return {"cancelled": True, "error": str(e)}
    
    # Sistema
    def openExternal(self, url):
        webbrowser.open(url)
        return {"success": True}
    
    def openJiraTicket(self, key):
        webbrowser.open(f"{jira_url()}/browse/{key}")
        return {"success": True}
    
    def openUserWindow(self, email):
        webbrowser.open(f"{jira_url()}/jira/people/search?q={email}")
        return {"success": True}
    
    def openJiraWebview(self, url, title="Jira"):
        """Abrir URL do Jira em uma nova janela webview"""
        try:
            import threading
            def create_window():
                webview.create_window(
                    title,
                    url,
                    width=1200,
                    height=800,
                    resizable=True
                )
            # Criar janela em thread separada para não bloquear
            threading.Thread(target=create_window, daemon=True).start()
            return {"success": True}
        except Exception as e:
            # Fallback: abrir no navegador
            webbrowser.open(url)
            return {"success": True, "fallback": True}
    
    def copyToClipboard(self, text):
        try:
            subprocess.run(["pbcopy"], input=text.encode(), check=True)
            return {"success": True}
        except:
            return {"success": False}
    
    def showNotification(self, title, body):
        try:
            subprocess.run(["osascript", "-e", f'display notification "{body}" with title "{title}"'])
            return {"success": True}
        except:
            return {"success": False}
    
    def checkTicketsNeedingResponse(self, hours_threshold=2):
        """
        Verifica tickets onde o último comentário público é do cliente
        e já se passaram X horas sem resposta do agente
        """
        try:
            # Buscar tickets atribuídos ao usuário atual que estão abertos
            jql = 'assignee = currentUser() AND status NOT IN (Resolved, Closed, Done, Cancelled) ORDER BY updated DESC'
            
            r = requests.post(
                f"{jira_url()}/rest/api/3/search",
                auth=get_auth(),
                headers=get_headers(),
                json={
                    "jql": jql,
                    "maxResults": 50,
                    "fields": ["key", "summary", "comment", "updated"]
                },
                timeout=15
            )
            
            if r.status_code != 200:
                return {"success": False, "error": f"Status {r.status_code}"}
            
            issues = r.json().get("issues", [])
            tickets_needing_response = []
            
            # Obter accountId do usuário atual
            r_user = requests.get(f"{jira_url()}/rest/api/3/myself", auth=get_auth(), headers=get_headers(), timeout=5)
            my_account_id = r_user.json().get("accountId") if r_user.status_code == 200 else None
            
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            
            for issue in issues:
                key = issue.get("key")
                summary = issue.get("fields", {}).get("summary", "")
                comments = issue.get("fields", {}).get("comment", {}).get("comments", [])
                
                if not comments:
                    continue
                
                # Pegar último comentário público (não interno)
                public_comments = [c for c in comments if not c.get("jsdPublic") == False]
                
                if not public_comments:
                    continue
                
                last_comment = public_comments[-1]
                last_author_id = last_comment.get("author", {}).get("accountId")
                last_comment_time = last_comment.get("created", "")
                
                # Se o último comentário é meu, não preciso responder
                if last_author_id == my_account_id:
                    continue
                
                # Calcular tempo desde o último comentário
                try:
                    comment_dt = datetime.fromisoformat(last_comment_time.replace("Z", "+00:00"))
                    hours_since = (now - comment_dt).total_seconds() / 3600
                    
                    if hours_since >= hours_threshold:
                        tickets_needing_response.append({
                            "key": key,
                            "summary": summary[:50] + "..." if len(summary) > 50 else summary,
                            "hours_waiting": round(hours_since, 1),
                            "last_comment_by": last_comment.get("author", {}).get("displayName", "Cliente")
                        })
                except:
                    pass
            
            return {"success": True, "tickets": tickets_needing_response}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def sendProactiveAlerts(self, hours_threshold=2):
        """Envia notificações para tickets que precisam de resposta"""
        result = self.checkTicketsNeedingResponse(hours_threshold)
        
        if not result.get("success") or not result.get("tickets"):
            return {"success": True, "alerted": 0}
        
        tickets = result["tickets"]
        
        # Limitar a 3 notificações por vez para não spammar
        for ticket in tickets[:3]:
            self.showNotification(
                f"⏰ {ticket['key']} aguardando resposta",
                f"{ticket['summary']} - {ticket['hours_waiting']}h sem resposta"
            )
        
        return {"success": True, "alerted": len(tickets[:3]), "total": len(tickets)}
    
    def testNotification(self):
        """Gerar notificação de teste"""
        try:
            # Mostrar notificação do sistema
            self.showNotification(
                "Jira Monitor - Teste",
                "🔔 Esta é uma notificação de teste! Funcionando corretamente."
            )
            
            # Retornar dados fake para testar o painel de notificações
            import random
            test_notifications = [
                {
                    "ticketKey": "IT-TEST001",
                    "type": "mention",
                    "message": "@você foi mencionado em um comentário de teste",
                    "author": "Test User",
                    "created": datetime.now().isoformat(),
                    "priority": "High"
                },
                {
                    "ticketKey": "IT-TEST002", 
                    "type": "comment",
                    "message": "Novo comentário de teste no ticket",
                    "author": "Another User",
                    "created": datetime.now().isoformat(),
                    "priority": "Medium"
                }
            ]
            
            return {
                "success": True, 
                "message": "Notificação de teste enviada!",
                "testNotifications": test_notifications
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def testDownload(self):
        """Criar arquivo de teste para download"""
        try:
            import tempfile
            
            # Criar arquivo de teste
            test_content = f"""
=== JIRA MONITOR - ARQUIVO DE TESTE ===

Este arquivo foi gerado para testar a funcionalidade de download.

Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Se você está vendo este arquivo, o download está funcionando corretamente!

============================================
"""
            
            # Salvar em Downloads
            downloads_path = Path.home() / "Downloads" / f"jira-monitor-test-{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            downloads_path.write_text(test_content)
            
            return {
                "success": True,
                "message": f"Arquivo de teste criado em: {downloads_path}",
                "path": str(downloads_path)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # Janela
    def minimizeWindow(self):
        if window: window.minimize()
        return {"success": True}
    
    def maximizeWindow(self):
        if window: window.maximize()
        return {"success": True}
    
    def closeWindow(self):
        if window: window.destroy()
        return {"success": True}
    
    def setAlwaysOnTop(self, value):
        if window: window.on_top = value
        return {"success": True}
    
    def resizeWindow(self, width, height):
        global window
        if window:
            window.resize(int(width), int(height))
        return {"success": True}
    
    def centerWindow(self, width=None, height=None):
        """Apenas redimensiona a janela (centralização removida por instabilidade)"""
        global window
        w = int(width) if width else 1200
        h = int(height) if height else 700
        if window:
            window.resize(w, h)
        return {"success": True}
    
    def getWindowBounds(self):
        # Tentar obter tamanho real da janela
        try:
            import AppKit
            for w in AppKit.NSApp.windows():
                frame = w.frame()
                if frame.size.width > 150:  # Janela principal
                    return {
                        "width": int(frame.size.width),
                        "height": int(frame.size.height),
                        "x": int(frame.origin.x),
                        "y": int(frame.origin.y)
                    }
        except:
            pass
        return config.get("windowBounds", {"width": 1200, "height": 700})
    
    def setWindowBounds(self, bounds):
        config["windowBounds"] = bounds
        save_config(config)
        return {"success": True}
    
    def updateTray(self, tickets_data):
        """
        Atualiza a mini janela flutuante com dados dos tickets
        
        Args:
            tickets_data: { 'critical': [], 'warning': [], 'normal': [] }
        """
        global mini_window
        if mini_window:
            try:
                data = tickets_data or {'critical': [], 'warning': [], 'normal': []}
                
                # Atualizar via JavaScript
                js = f'''
                    if (typeof updateDisplay === 'function') {{
                        updateDisplay({json.dumps(data)});
                    }}
                '''
                mini_window.evaluate_js(js)
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return {"success": False, "error": "Mini window not initialized"}
    
    def updateTray(self, tickets_data):
        """Atualiza o tray com dados de SLA dos tickets"""
        global tray_tickets_data
        
        if not HAS_TRAY:
            return {"success": False, "error": "Tray não disponível"}
        
        try:
            # Salvar dados para o menu (será usado quando o menu for aberto)
            tray_tickets_data = tickets_data
            
            critical = len(tickets_data.get('critical', []))
            warning = len(tickets_data.get('warning', []))
            normal = len(tickets_data.get('normal', []))
            
            # Atualizar apenas o ícone (menu atualiza dinamicamente ao abrir)
            update_tray_status(critical=critical, warning=warning, normal=normal)
            
            return {"success": True, "critical": critical, "warning": warning, "normal": normal}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def checkTicketsNeedingResponse(self, hours_threshold=2):
        """
        Verifica tickets onde o último comentário público é do cliente
        e já se passaram X horas sem resposta do agente
        """
        try:
            jql = 'assignee = currentUser() AND status NOT IN (Resolved, Closed, Done, Cancelled) ORDER BY updated DESC'
            
            r = requests.post(
                f"{jira_url()}/rest/api/3/search",
                auth=get_auth(),
                headers=get_headers(),
                json={
                    "jql": jql,
                    "maxResults": 50,
                    "fields": ["key", "summary", "comment", "updated"]
                },
                timeout=15
            )
            
            if r.status_code != 200:
                return {"success": False, "error": f"Status {r.status_code}"}
            
            issues = r.json().get("issues", [])
            tickets_needing_response = []
            
            # Obter accountId do usuário atual
            r_user = requests.get(f"{jira_url()}/rest/api/3/myself", auth=get_auth(), headers=get_headers(), timeout=5)
            my_account_id = r_user.json().get("accountId") if r_user.status_code == 200 else None
            
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            
            for issue in issues:
                key = issue.get("key")
                summary = issue.get("fields", {}).get("summary", "")
                comments = issue.get("fields", {}).get("comment", {}).get("comments", [])
                
                if not comments:
                    continue
                
                public_comments = [c for c in comments if not c.get("jsdPublic") == False]
                
                if not public_comments:
                    continue
                
                last_comment = public_comments[-1]
                last_author_id = last_comment.get("author", {}).get("accountId")
                last_comment_time = last_comment.get("created", "")
                
                if last_author_id == my_account_id:
                    continue
                
                try:
                    comment_dt = datetime.fromisoformat(last_comment_time.replace("Z", "+00:00"))
                    hours_since = (now - comment_dt).total_seconds() / 3600
                    
                    if hours_since >= hours_threshold:
                        tickets_needing_response.append({
                            "key": key,
                            "summary": summary[:50] + "..." if len(summary) > 50 else summary,
                            "hours_waiting": round(hours_since, 1),
                            "last_comment_by": last_comment.get("author", {}).get("displayName", "Cliente")
                        })
                except:
                    pass
            
            return {"success": True, "tickets": tickets_needing_response}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def sendProactiveAlerts(self, hours_threshold=2):
        """Envia notificações para tickets que precisam de resposta"""
        result = self.checkTicketsNeedingResponse(hours_threshold)
        
        if not result.get("success") or not result.get("tickets"):
            return {"success": True, "alerted": 0}
        
        tickets = result["tickets"]
        
        for ticket in tickets[:3]:
            self.showNotification(
                f"⏰ {ticket['key']} aguardando resposta",
                f"{ticket['summary']} - {ticket['hours_waiting']}h sem resposta"
            )
        
        return {"success": True, "alerted": len(tickets[:3]), "total": len(tickets)}
    
    def toggleFloatingWindow(self):
        """Mostra/esconde a janela flutuante"""
        global mini_window, config
        
        if mini_window:
            try:
                # Toggle visibility
                if config.get('floatingWindow', {}).get('enabled', True):
                    mini_window.hide()
                    config.setdefault('floatingWindow', {})['enabled'] = False
                else:
                    mini_window.show()
                    config.setdefault('floatingWindow', {})['enabled'] = True
                
                save_config(config)
                return {"success": True, "enabled": config['floatingWindow']['enabled']}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return {"success": False, "error": "Mini window not initialized"}
    
    def updateFloatingWindowConfig(self, fw_config):
        """Atualiza configurações da janela flutuante"""
        global mini_window, config
        
        config['floatingWindow'] = {**config.get('floatingWindow', {}), **fw_config}
        save_config(config)
        
        # Aplicar mudanças
        if mini_window:
            try:
                # Atualizar tamanho se especificado
                if 'width' in fw_config or 'height' in fw_config:
                    w = config['floatingWindow'].get('width', 200)
                    h = config['floatingWindow'].get('height', 50)
                    mini_window.resize(w, h)
                
                # Atualizar posição se especificado
                if 'x' in fw_config or 'y' in fw_config:
                    x = config['floatingWindow'].get('x', 600)
                    y = config['floatingWindow'].get('y', 80)
                    mini_window.move(x, y)
                
                # Toggle visibility
                if 'enabled' in fw_config:
                    if fw_config['enabled']:
                        mini_window.show()
                    else:
                        mini_window.hide()
                
                # Para opacidade ou tema, recarregar HTML
                if 'opacity' in fw_config or 'theme' in fw_config:
                    current_theme = config.get('theme', 'default')
                    is_dark = current_theme in ['dark', 'midnight', 'hacker']
                    new_html = get_mini_window_html(config, 'dark' if is_dark else 'light')
                    mini_window.load_html(new_html)
                
            except Exception as e:
                print(f"Erro ao atualizar floating window: {e}")
        
        return {"success": True, "config": config['floatingWindow']}
    
    def setFloatingWindowTheme(self, theme):
        """Atualiza o tema da janela flutuante"""
        global mini_window, config
        
        if mini_window:
            try:
                is_dark = theme in ['dark', 'midnight', 'hacker']
                # Atualizar via JavaScript
                js = f'if(typeof setTheme === "function") setTheme({str(is_dark).lower()});'
                mini_window.evaluate_js(js)
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return {"success": False, "error": "Mini window not initialized"}
    
    def getFloatingWindowConfig(self):
        """Retorna configurações da janela flutuante"""
        return config.get('floatingWindow', {
            'enabled': False,  # Desativado por padrão
            'opacity': 0.9,
            'width': 160,
            'height': 80,
            'showCritical': True,
            'showWarning': True,
            'showNormal': True,
            'showTicketList': False
        })
    
    def getPerformanceMetrics(self, days=30):
        """Buscar métricas de performance dos últimos X dias"""
        from datetime import datetime, timedelta
        
        try:
            start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            
            # Tickets resolvidos nos últimos X dias
            jql = f'assignee = currentUser() AND resolved >= "{start_date}" ORDER BY resolved DESC'
            r = requests.post(
                f"{jira_url()}/rest/api/3/search/jql",
                auth=get_auth(),
                headers=get_headers(),
                json={"jql": jql, "maxResults": 200, "fields": ["summary", "status", "resolutiondate", "created", "priority", "project", "timespent"]}
            )
            
            if r.status_code != 200:
                print(f"[api] Performance metrics error: {r.status_code}")
                return {"success": True, "data": self._empty_performance_metrics()}
            
            issues = r.json().get("issues", [])
            
            # Calcular métricas
            total_resolution_hours = 0
            by_priority = {}
            by_project = {}
            activity_by_hour = [0] * 24
            recent_resolved = []
            
            for issue in issues:
                fields = issue.get("fields", {})
                
                # Tempo de resolução
                created = fields.get("created")
                resolved = fields.get("resolutiondate")
                if created and resolved:
                    try:
                        created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                        resolved_dt = datetime.fromisoformat(resolved.replace("Z", "+00:00"))
                        hours = (resolved_dt - created_dt).total_seconds() / 3600
                        total_resolution_hours += hours
                        
                        # Atividade por hora
                        hour = resolved_dt.hour
                        activity_by_hour[hour] += 1
                    except:
                        pass
                
                # Por prioridade
                priority = fields.get("priority", {}).get("name", "Sem prioridade") if fields.get("priority") else "Sem prioridade"
                by_priority[priority] = by_priority.get(priority, 0) + 1
                
                # Por projeto
                project = fields.get("project", {}).get("key", "Outros") if fields.get("project") else "Outros"
                by_project[project] = by_project.get(project, 0) + 1
                
                # Recentes
                if len(recent_resolved) < 10:
                    recent_resolved.append({
                        "key": issue.get("key"),
                        "summary": fields.get("summary", ""),
                        "resolved": resolved
                    })
            
            tickets_resolved = len(issues)
            avg_hours = total_resolution_hours / tickets_resolved if tickets_resolved > 0 else 0
            tickets_per_week = (tickets_resolved / days) * 7 if days > 0 else 0
            
            print(f"[api] Performance: {tickets_resolved} resolved, avg {avg_hours:.1f}h")
            
            return {
                "success": True,
                "data": {
                    "avgResolutionDays": min(round(avg_hours / 24, 1), 99),
                    "avgResolutionHours": min(round(avg_hours, 1), 999),
                    "ticketsResolved": tickets_resolved,
                    "ticketsPerWeek": round(tickets_per_week, 1),
                    "byPriority": by_priority,
                    "byProject": by_project,
                    "activityByHour": activity_by_hour,
                    "recentResolved": recent_resolved
                }
            }
        except Exception as e:
            print(f"[api] Performance metrics error: {e}")
            return {"success": True, "data": self._empty_performance_metrics()}
    
    def _empty_performance_metrics(self):
        return {
            "avgResolutionDays": 0,
            "avgResolutionHours": 0,
            "ticketsResolved": 0,
            "ticketsPerWeek": 0.0,
            "byPriority": {},
            "byProject": {},
            "activityByHour": [0] * 24,
            "recentResolved": []
        }
    
    def getTicketsWithCriticalSLA(self, minutes_before=15):
        """Buscar tickets com SLA crítico (prestes a vencer)"""
        from datetime import datetime, timedelta
        
        try:
            now = datetime.now()
            future_threshold = now + timedelta(minutes=minutes_before)
            future_str = future_threshold.strftime("%Y-%m-%d %H:%M")
            
            # Buscar tickets com duedate próximo
            jql = f'assignee = currentUser() AND resolution = Unresolved AND duedate <= "{future_str}" ORDER BY duedate ASC'
            
            r = requests.post(
                f"{jira_url()}/rest/api/3/search/jql",
                auth=get_auth(),
                headers=get_headers(),
                json={"jql": jql, "maxResults": 20, "fields": ["key", "summary", "duedate", "status", "priority"]},
                timeout=10
            )
            
            if r.status_code != 200:
                print(f"[api] Critical SLA error: {r.status_code}")
                return {"success": True, "tickets": []}
            
            issues = r.json().get("issues", [])
            tickets = []
            
            for issue in issues:
                fields = issue.get("fields", {})
                duedate = fields.get("duedate")
                
                if duedate:
                    try:
                        due_dt = datetime.fromisoformat(duedate.replace("Z", "+00:00"))
                        minutes_until = int((due_dt.replace(tzinfo=None) - now).total_seconds() / 60)
                        
                        if minutes_until > 0:  # Apenas futuros
                            tickets.append({
                                "key": issue.get("key"),
                                "summary": fields.get("summary", ""),
                                "duedate": duedate,
                                "status": fields.get("status", {}).get("name", "") if fields.get("status") else "",
                                "priority": fields.get("priority", {}).get("name", "") if fields.get("priority") else "",
                                "minutesUntilDue": minutes_until
                            })
                    except:
                        pass
            
            print(f"[api] Critical SLA: {len(tickets)} tickets")
            return {"success": True, "tickets": tickets}
        except Exception as e:
            print(f"[api] Critical SLA error: {e}")
            return {"success": True, "tickets": []}
    
    def getItopsTeamOptions(self):
        """Buscar opções disponíveis para o campo ITOps Team"""
        try:
            # Buscar metadados do campo customfield_10635 (ITOps Team)
            r = requests.get(
                f"{jira_url()}/rest/api/3/field/customfield_10635/context",
                auth=get_auth(),
                headers=get_headers(),
                timeout=10
            )
            
            # Alternativa: buscar opções diretamente
            r2 = requests.get(
                f"{jira_url()}/rest/api/3/customFieldOption/10635",
                auth=get_auth(),
                headers=get_headers(),
                timeout=10
            )
            
            # Se não conseguir pela API, usar lista fixa conhecida
            # Baseada nos valores comuns do ITOps Team
            teams = [
                "TechCenter",
                "Engineering",
                "Security",
                "Infrastructure",
                "Platform",
                "DevOps",
                "SRE",
                "Data",
                "Cloud",
                "Network"
            ]
            
            return {"success": True, "data": teams}
        except Exception as e:
            print(f"[api] getItopsTeamOptions error: {e}")
            # Retornar lista padrão mesmo em caso de erro
            return {"success": True, "data": ["TechCenter", "Engineering", "Security", "Infrastructure"]}
    
    # ========== MODO PRO - Filas Específicas (Otimizado) ==========
    
    def _quickSearch(self, jql, max_results=30):
        """Helper para busca rápida"""
        try:
            r = requests.post(
                f"{jira_url()}/rest/api/3/search/jql",
                auth=get_auth(),
                headers=get_headers(),
                json={"jql": jql, "maxResults": max_results, "fields": ["summary", "status", "created", "updated", "assignee"]},
                timeout=10
            )
            if r.status_code == 200:
                issues = r.json().get("issues", [])
                return [{
                    "key": i.get("key"),
                    "summary": i.get("fields", {}).get("summary", "") or "Sem título",
                    "status": i.get("fields", {}).get("status", {}).get("name", ""),
                    "created": i.get("fields", {}).get("created", ""),
                    "updated": i.get("fields", {}).get("updated", ""),
                    "assignee": i.get("fields", {}).get("assignee", {}).get("displayName") if i.get("fields", {}).get("assignee") else None
                } for i in issues]
            return []
        except:
            return []
    
    def _getSimCardsTickets(self):
        """Buscar MEUS tickets SIM Cards"""
        jql = 'filter = 52128 AND assignee = currentUser() ORDER BY created DESC'
        tickets = self._quickSearch(jql, 30)
        return {"count": len(tickets), "tickets": tickets, "jql": jql}
    
    def _getL0BotTickets(self):
        """Buscar MEUS tickets L0 Jira Bot"""
        jql = 'project = "IT" AND assignee = currentUser() AND statusCategory != Done ORDER BY created DESC'
        tickets = self._quickSearch(jql, 50)
        return {"count": len(tickets), "tickets": tickets, "jql": jql}
    
    def _getL1OpenTickets(self):
        """Buscar MEUS tickets L1 Open"""
        jql = 'project = "IT" AND assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC'
        tickets = self._quickSearch(jql, 50)
        return {"count": len(tickets), "tickets": tickets, "jql": jql}
    
    def _getTodayActivity(self):
        """Buscar atividade de hoje"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        result = {"received": [], "resolved": [], "comments": 0}
        
        # Buscar recebidos e resolvidos
        try:
            jql = f'assignee = currentUser() AND (created >= "{today}" OR resolved >= "{today}") ORDER BY updated DESC'
            r = requests.post(
                f"{jira_url()}/rest/api/3/search/jql",
                auth=get_auth(),
                headers=get_headers(),
                json={"jql": jql, "maxResults": 50, "fields": ["summary", "created", "resolutiondate"]},
                timeout=10
            )
            
            if r.status_code == 200:
                for issue in r.json().get("issues", []):
                    fields = issue.get("fields", {})
                    created = fields.get("created", "")[:10]
                    resolved = (fields.get("resolutiondate") or "")[:10]
                    
                    item = {"key": issue.get("key"), "fields": {"summary": fields.get("summary", "")}}
                    
                    if created == today:
                        result["received"].append(item)
                    if resolved == today:
                        result["resolved"].append(item)
        except Exception as e:
            print(f"[api] Today received/resolved error: {e}")
        
        # Buscar comentários feitos hoje pelo usuário (retorna array de objetos)
        try:
            r_user = requests.get(f"{jira_url()}/rest/api/3/myself", auth=get_auth(), headers=get_headers(), timeout=5)
            user_account_id = r_user.json().get("accountId") if r_user.status_code == 200 else None
            
            if user_account_id:
                jql_comments = f'assignee = currentUser() AND updated >= "{today}" ORDER BY updated DESC'
                r2 = requests.post(
                    f"{jira_url()}/rest/api/3/search/jql",
                    auth=get_auth(),
                    headers=get_headers(),
                    json={"jql": jql_comments, "maxResults": 50, "fields": ["summary", "comment"]},
                    timeout=10
                )
                
                if r2.status_code == 200:
                    comments_list = []
                    for issue in r2.json().get("issues", []):
                        ticket_key = issue.get("key")
                        ticket_summary = issue.get("fields", {}).get("summary", "")
                        comments = issue.get("fields", {}).get("comment", {}).get("comments", [])
                        for c in comments:
                            comment_date = c.get("created", "")[:10]
                            author_id = c.get("author", {}).get("accountId", "")
                            if comment_date == today and author_id == user_account_id:
                                comments_list.append({
                                    "ticketKey": ticket_key,
                                    "ticketSummary": ticket_summary,
                                    "commentCreated": c.get("created", "")
                                })
                    result["comments"] = comments_list
                    print(f"[api] Comments today: {len(comments_list)}")
        except Exception as e:
            print(f"[api] Comments error: {e}")
            result["comments"] = []
        
        return result
    
    def _getEvaluatedTickets(self):
        """Buscar tickets avaliados"""
        try:
            jql = 'status IN (Resolved, Cancelado) AND assignee = currentUser() ORDER BY resolved DESC'
            satisfaction_field = "customfield_10120"
            
            r = requests.post(
                f"{jira_url()}/rest/api/3/search/jql",
                auth=get_auth(),
                headers=get_headers(),
                json={"jql": jql, "maxResults": 50, "fields": ["summary", "status", "resolutiondate", satisfaction_field]},
                timeout=10
            )
            
            if r.status_code != 200:
                print(f"[api] Evaluated tickets error: {r.status_code}")
                return {"count": 0, "tickets": [], "ratingDistribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}}
            
            issues = r.json().get("issues", [])
            rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            evaluated_tickets = []
            
            for issue in issues:
                fields = issue.get("fields", {})
                satisfaction_raw = fields.get(satisfaction_field)
                
                # Extrair rating do campo de satisfação
                rating = 0
                if satisfaction_raw:
                    if isinstance(satisfaction_raw, dict):
                        rating = satisfaction_raw.get("rating") or 0
                    elif isinstance(satisfaction_raw, (int, float)):
                        rating = int(satisfaction_raw)
                
                if rating and 1 <= rating <= 5:
                    rating_distribution[rating] += 1
                
                # Incluir todos os tickets resolvidos (com ou sem avaliação)
                evaluated_tickets.append({
                    "key": issue.get("key"),
                    "summary": fields.get("summary", ""),
                    "status": fields.get("status", {}).get("name", ""),
                    "satisfaction": rating,
                    "rating": rating,
                    "resolved": fields.get("resolutiondate", ""),
                    "ratingEmoji": "⭐" * rating if rating > 0 else "-"
                })
            
            print(f"[api] Evaluated tickets: {len(evaluated_tickets)} with ratings")
            return {
                "count": len(evaluated_tickets),
                "tickets": evaluated_tickets,
                "ratingDistribution": rating_distribution,
                "jql": jql
            }
        except Exception as e:
            print(f"[api] Evaluated tickets error: {e}")
            return {"count": 0, "tickets": [], "ratingDistribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}}
    
    def _getTrendData(self, days=7):
        """Buscar tendência de tickets nos últimos X dias (otimizado - única requisição)"""
        from datetime import datetime, timedelta
        from collections import defaultdict
        
        trend = []
        try:
            start_date = (datetime.now() - timedelta(days=days-1)).strftime("%Y-%m-%d")
            
            # Uma única requisição para todos os dias
            jql = f'assignee = currentUser() AND updated >= "{start_date} 00:00" ORDER BY updated DESC'
            
            r = requests.post(
                f"{jira_url()}/rest/api/3/search/jql",
                auth=get_auth(),
                headers=get_headers(),
                json={"jql": jql, "maxResults": 100, "fields": ["updated"]},
                timeout=10
            )
            
            # Contar por dia
            counts_by_date = defaultdict(int)
            if r.status_code == 200:
                for issue in r.json().get("issues", []):
                    updated = issue.get("fields", {}).get("updated", "")[:10]
                    if updated:
                        counts_by_date[updated] += 1
            
            # Criar array de tendência com JQL para cada dia
            for i in range(days - 1, -1, -1):
                date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
                day_jql = f'assignee = currentUser() AND updated >= "{date} 00:00" AND updated <= "{date} 23:59" ORDER BY updated DESC'
                trend.append({
                    "date": date,
                    "count": counts_by_date.get(date, 0),
                    "jql": day_jql
                })
            
            print(f"[api] Trend data: {len(trend)} days")
        except Exception as e:
            print(f"[api] Trend error: {e}")
            for i in range(days - 1, -1, -1):
                date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
                day_jql = f'assignee = currentUser() AND updated >= "{date} 00:00" AND updated <= "{date} 23:59" ORDER BY updated DESC'
                trend.append({"date": date, "count": 0, "jql": day_jql})
        
        return trend
    
    def getRecentNotifications(self, max_results=15):
        """Buscar notificações recentes (menções e comentários)"""
        try:
            # Obter account ID do usuário atual
            r_user = requests.get(f"{jira_url()}/rest/api/3/myself", auth=get_auth(), headers=get_headers(), timeout=5)
            if r_user.status_code != 200:
                return {"success": True, "notifications": []}
            
            user_data = r_user.json()
            user_account_id = user_data.get("accountId")
            user_email = user_data.get("emailAddress", "")
            
            # Buscar tickets onde o usuário é assignee, watcher ou reporter (últimos 7 dias)
            jql = 'assignee = currentUser() AND updated >= -7d ORDER BY updated DESC'
            
            r = requests.post(
                f"{jira_url()}/rest/api/3/search/jql",
                auth=get_auth(),
                headers=get_headers(),
                json={"jql": jql, "maxResults": 30, "fields": ["key", "summary", "priority", "updated", "comment"]},
                timeout=15
            )
            
            if r.status_code != 200:
                print(f"[api] Notifications error: {r.status_code}")
                return {"success": True, "notifications": []}
            
            issues = r.json().get("issues", [])
            notifications = []
            
            for issue in issues:
                ticket_key = issue.get("key")
                fields = issue.get("fields", {})
                ticket_summary = fields.get("summary", "")
                priority = fields.get("priority", {}).get("name", "N/A") if fields.get("priority") else "N/A"
                
                comments = fields.get("comment", {}).get("comments", [])
                
                for comment in comments:
                    author = comment.get("author", {})
                    author_id = author.get("accountId", "")
                    author_email = author.get("emailAddress", "")
                    
                    # Pular comentários do próprio usuário
                    if author_id == user_account_id or author_email == user_email:
                        continue
                    
                    # Verificar se é interno
                    is_internal = comment.get("jsdPublic") == False
                    
                    # Verificar se há menção ao usuário (simplificado)
                    body = comment.get("body", {})
                    is_mention = self._checkMentionInADF(body, user_account_id, user_email)
                    
                    # Converter corpo para texto simples
                    body_text = self._convertADFToText(body)
                    
                    notifications.append({
                        "ticketKey": ticket_key,
                        "ticketSummary": ticket_summary,
                        "priority": priority,
                        "type": "mention" if is_mention else "comment",
                        "author": author.get("displayName", "Unknown"),
                        "created": comment.get("created", ""),
                        "body": body_text,
                        "isInternal": is_internal,
                        "commentId": comment.get("id")
                    })
            
            # Ordenar por data (mais recente primeiro) e limitar
            notifications.sort(key=lambda x: x.get("created", ""), reverse=True)
            result = notifications[:max_results]
            
            print(f"[api] Notifications: {len(result)} of {len(notifications)} total")
            return {"success": True, "notifications": result}
        except Exception as e:
            print(f"[api] Notifications error: {e}")
            return {"success": True, "notifications": []}
    
    def _checkMentionInADF(self, adf, user_id, user_email):
        """Verificar se há menção ao usuário no formato ADF"""
        try:
            def traverse(node):
                if not node or not isinstance(node, dict):
                    return False
                if node.get("type") == "mention":
                    attrs = node.get("attrs", {})
                    if attrs.get("id") == user_id or attrs.get("text") == user_email:
                        return True
                content = node.get("content", [])
                if isinstance(content, list):
                    for child in content:
                        if traverse(child):
                            return True
                return False
            return traverse(adf)
        except:
            return False
    
    def _convertADFToText(self, adf, max_length=200):
        """Converter ADF para texto simples"""
        try:
            text_parts = []
            
            def traverse(node):
                if not node or not isinstance(node, dict):
                    return
                if node.get("type") == "text":
                    text_parts.append(node.get("text", ""))
                elif node.get("type") == "mention":
                    text_parts.append(f"@{node.get('attrs', {}).get('text', 'user')}")
                content = node.get("content", [])
                if isinstance(content, list):
                    for child in content:
                        traverse(child)
            
            traverse(adf)
            full_text = " ".join(text_parts)
            
            if len(full_text) > max_length:
                return full_text[:max_length] + "..."
            return full_text
        except:
            return ""


api = JiraAPI()
window = None

# ========== HTTP SERVER ==========

class APIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        self.directory = directory
        super().__init__(*args, directory=directory, **kwargs)
    
    def log_message(self, format, *args):
        pass
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_POST(self):
        if self.path.startswith('/api/'):
            self.handle_api()
        else:
            self.send_error(404)
    
    def handle_api(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode() if length > 0 else '{}'
            data = json.loads(body) if body else {}
            
            method = self.path[5:]  # Remove '/api/'
            args = data.get('args', [])
            
            if not hasattr(api, method):
                self.send_json({'error': f'Método não encontrado: {method}'}, 404)
                return
            
            result = getattr(api, method)(*args) if args else getattr(api, method)()
            self.send_json({'result': result})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)
    
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


def start_server(ui_dir):
    os.chdir(ui_dir)
    server = HTTPServer(('127.0.0.1', 18080), lambda *a: APIHandler(*a, directory=ui_dir))
    print(f"[server] http://127.0.0.1:18080")
    server.serve_forever()


# ========== MAIN ==========

# HTML da mini janela flutuante - suporta tema claro/escuro
def get_mini_window_html(config, theme='light'):
    opacity = config.get('floatingWindow', {}).get('opacity', 0.95)
    show_critical = config.get('floatingWindow', {}).get('showCritical', True)
    show_warning = config.get('floatingWindow', {}).get('showWarning', True)
    show_normal = config.get('floatingWindow', {}).get('showNormal', True)
    
    # Cores baseadas no tema
    if theme == 'dark':
        bg_color = f'rgba(30, 30, 40, {opacity})'
        text_color = '#e0e0e0'
        border_color = 'rgba(138, 43, 226, 0.3)'
        close_color = '#888'
        close_hover_bg = 'rgba(255, 255, 255, 0.1)'
        zero_color = '#555'
    else:
        bg_color = f'rgba(255, 255, 255, {opacity})'
        text_color = '#333'
        border_color = 'rgba(138, 43, 226, 0.15)'
        close_color = '#999'
        close_hover_bg = 'rgba(138, 43, 226, 0.1)'
        zero_color = '#bbb'
    
    return f'''
<!DOCTYPE html>
<html>
<head>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            background: {bg_color};
            color: {text_color};
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            height: 100vh;
            cursor: move;
            -webkit-app-region: drag;
            user-select: none;
            border-radius: 16px;
            border: 1px solid {border_color};
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(138, 43, 226, 0.15), 0 1px 3px rgba(0,0,0,0.08);
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        .container {{
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 10px 16px;
        }}
        .status-item {{
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 700;
            font-size: 16px;
        }}
        .status-item .icon {{
            font-size: 12px;
        }}
        .status-item .count {{
            min-width: 18px;
            text-align: center;
            font-size: 18px;
        }}
        .status-item.critical .count {{ color: #e74c3c; }}
        .status-item.warning .count {{ color: #f39c12; }}
        .status-item.normal .count {{ color: #27ae60; }}
        .status-item.zero .count {{ color: {zero_color}; }}
        
        .close-btn {{
            font-size: 14px;
            color: {close_color};
            cursor: pointer;
            -webkit-app-region: no-drag;
            padding: 4px 8px;
            border-radius: 6px;
            margin-left: 4px;
            transition: all 0.2s;
        }}
        .close-btn:hover {{ 
            color: {text_color}; 
            background: {close_hover_bg};
        }}
    </style>
</head>
<body>
    <div class="container" id="status">
        <span class="status-item critical"><span class="icon">🔴</span><span class="count">0</span></span>
        <span class="status-item warning"><span class="icon">🟡</span><span class="count">0</span></span>
        <span class="status-item normal"><span class="icon">🟢</span><span class="count">0</span></span>
        <span class="close-btn" id="closeBtn">✕</span>
    </div>
    <script>
        const config = {{
            showCritical: {'true' if show_critical else 'false'},
            showWarning: {'true' if show_warning else 'false'},
            showNormal: {'true' if show_normal else 'false'}
        }};
        
        // Fechar janela - aguardar pywebview carregar
        function closeWindow() {{
            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.toggleFloatingWindow();
            }} else {{
                // Fallback se API não estiver disponível
                document.body.style.opacity = '0';
                setTimeout(() => {{ document.body.style.display = 'none'; }}, 200);
            }}
        }}
        
        document.getElementById('closeBtn').addEventListener('click', closeWindow);
        
        function updateDisplay(data) {{
            const container = document.getElementById('status');
            
            const critical = (data.critical || []).length;
            const warning = (data.warning || []).length;
            const normal = (data.normal || []).length;
            
            let html = '';
            
            if (config.showCritical) {{
                html += '<span class="status-item critical' + (critical === 0 ? ' zero' : '') + '">';
                html += '<span class="icon">🔴</span><span class="count">' + critical + '</span></span>';
            }}
            
            if (config.showWarning) {{
                html += '<span class="status-item warning' + (warning === 0 ? ' zero' : '') + '">';
                html += '<span class="icon">🟡</span><span class="count">' + warning + '</span></span>';
            }}
            
            if (config.showNormal) {{
                html += '<span class="status-item normal' + (normal === 0 ? ' zero' : '') + '">';
                html += '<span class="icon">🟢</span><span class="count">' + normal + '</span></span>';
            }}
            
            html += '<span class="close-btn" id="closeBtn">✕</span>';
            
            container.innerHTML = html;
            
            // Re-adicionar listener após atualizar HTML
            document.getElementById('closeBtn').addEventListener('click', closeWindow);
        }}
        
        function setTheme(isDark) {{
            if (isDark) {{
                document.body.style.background = 'rgba(30, 30, 40, {opacity})';
                document.body.style.borderColor = 'rgba(138, 43, 226, 0.3)';
            }} else {{
                document.body.style.background = 'rgba(255, 255, 255, {opacity})';
                document.body.style.borderColor = 'rgba(138, 43, 226, 0.15)';
            }}
        }}
    </script>
</body>
</html>
'''

if __name__ == '__main__':
    # Verificar se já existe outra instância rodando
    if not acquire_single_instance_lock():
        print("[main] Exiting: another instance is already running")
        show_already_running_alert()
        sys.exit(0)
    
    ui_dir = BASE_DIR / "ui"
    
    print(f"[main] BASE_DIR: {BASE_DIR}")
    print(f"[main] ui_dir: {ui_dir}")
    print(f"[main] ui_dir exists: {ui_dir.exists()}")
    
    # Garantir config de floating window
    if 'floatingWindow' not in config:
        config['floatingWindow'] = {
            'enabled': False,  # Desativado por padrão
            'opacity': 0.95,
            'width': 200,
            'height': 48,
            'x': None,  # None = centralizar
            'y': 80,
            'showCritical': True,
            'showWarning': True,
            'showNormal': True,
            'showTicketList': False
        }
    
    fw_config = config['floatingWindow']
    
    # Iniciar servidor HTTP
    thread = threading.Thread(target=start_server, args=(str(ui_dir),), daemon=True)
    thread.start()
    
    # Obter bounds salvos ou usar padrão
    saved_bounds = config.get("windowBounds", {})
    win_width = saved_bounds.get("width", 1268)
    win_height = saved_bounds.get("height", 768)
    win_x = saved_bounds.get("x")  # None = deixar o sistema posicionar
    win_y = saved_bounds.get("y")
    
    # Criar janela principal com posição persistida
    main_window = webview.create_window(
        title="Jira Monitor",
        url="http://127.0.0.1:18080/index.html",
        width=win_width,
        height=win_height,
        x=win_x,
        y=win_y,
        min_size=(200, 80),  # Reduzido para permitir modo compacto
        resizable=True,
        frameless=True,
        easy_drag=False  # Desabilitar drag de qualquer lugar - usar apenas pywebview-drag-region
    )
    window = main_window  # Atribuir à variável global para uso na API
    
    # Função para salvar bounds da janela antes de fechar
    def on_closing():
        try:
            # Tentar obter bounds via AppKit (mais confiável no macOS)
            try:
                import AppKit
                for w in AppKit.NSApp.windows():
                    if w.title() == "Jira Monitor" or (hasattr(window, '_nswindow') and w == window._nswindow):
                        frame = w.frame()
                        bounds = {
                            "width": int(frame.size.width),
                            "height": int(frame.size.height),
                            "x": int(frame.origin.x),
                            "y": int(frame.origin.y)
                        }
                        config["windowBounds"] = bounds
                        save_config(config)
                        print(f"[main] Window bounds saved (AppKit): {bounds}")
                        return True
            except Exception as e:
                print(f"[main] AppKit error: {e}")
            
            # Fallback: usar atributos do PyWebView
            if window:
                bounds = {
                    "width": getattr(window, 'width', 1268),
                    "height": getattr(window, 'height', 768),
                    "x": getattr(window, 'x', None),
                    "y": getattr(window, 'y', None)
                }
                config["windowBounds"] = bounds
                save_config(config)
                print(f"[main] Window bounds saved (fallback): {bounds}")
        except Exception as e:
            print(f"[main] Error saving window bounds: {e}")
        return True  # Permitir fechar
    
    main_window.events.closing += on_closing
    
    # API para a mini window
    class MiniWindowAPI:
        def toggleFloatingWindow(self):
            global mini_window, config
            if mini_window:
                mini_window.hide()
                config.setdefault('floatingWindow', {})['enabled'] = False
                save_config(config)
            return {"success": True}
    
    mini_api = MiniWindowAPI()
    
    # Criar mini janela flutuante (faróis) se habilitada
    if fw_config.get('enabled', True):
        fw_width = fw_config.get('width', 200)
        fw_height = fw_config.get('height', 50)
        fw_x = fw_config.get('x')
        fw_y = fw_config.get('y', 80)
        
        # Detectar tema atual
        current_theme = config.get('theme', 'default')
        is_dark = current_theme in ['dark', 'midnight', 'hacker']
        
        # Se x for None, centralizar na tela
        if fw_x is None:
            try:
                import AppKit
                screen = AppKit.NSScreen.mainScreen()
                screen_width = screen.frame().size.width
                fw_x = int((screen_width - fw_width) / 2)
            except:
                fw_x = 600  # fallback
        
        mini_window = webview.create_window(
            title="",
            html=get_mini_window_html(config, 'dark' if is_dark else 'light'),
            width=fw_width,
            height=fw_height,
            x=fw_x,
            y=fw_y,
            resizable=True,  # Permite redimensionar
            frameless=True,
            on_top=True,
            easy_drag=True,
            min_size=(150, 40),  # Tamanho mínimo
            js_api=mini_api  # Expor API
        )
    
    # Função para configurar tray após janela carregar
    def on_loaded():
        if HAS_TRAY:
            import time
            time.sleep(0.5)
            setup_status_bar()
    
    webview.start(func=on_loaded, debug=False)
