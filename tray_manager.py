"""
Tray Manager para Jira Monitor - Processo Separado com rumps
"""

import multiprocessing
import os

_tray_process = None
_command_queue = None


def _run_tray(command_queue, icon_path):
    """Processo separado do tray usando rumps"""
    import sys
    
    # Log para arquivo
    log_path = os.path.expanduser("~/tray_debug.log")
    with open(log_path, "w") as f:
        f.write(f"Tray process started\nicon_path: {icon_path}\n")
    
    try:
        import rumps
        import threading
        import time
        import webbrowser
    except Exception as e:
        with open(log_path, "a") as f:
            f.write(f"Import error: {e}\n")
        return
    
    with open(log_path, "a") as f:
        f.write("Imports OK\n")
    
    class JiraMonitorStatusBar(rumps.App):
        def __init__(self):
            super().__init__(
                name="Jira Monitor",
                title="⚪ 0",
                icon=None,  # Sem ícone para ocupar menos espaço na menu bar
                quit_button=None
            )
            self.tickets = {'critical': [], 'warning': [], 'normal': []}
            self.queue = command_queue
            
            # Thread para processar comandos
            self.queue_thread = threading.Thread(target=self._process_queue, daemon=True)
            self.queue_thread.start()
            
            self._rebuild_menu()
        
        def _process_queue(self):
            log_path = os.path.expanduser("~/tray_debug.log")
            while True:
                try:
                    if not self.queue.empty():
                        cmd = self.queue.get_nowait()
                        if cmd.get('action') == 'update':
                            self.tickets = cmd.get('data', self.tickets)
                            self._update_display()
                        elif cmd.get('action') == 'quit':
                            rumps.quit_application()
                            return
                except Exception as e:
                    with open(log_path, "a") as f:
                        f.write(f"Queue error: {e}\n")
                time.sleep(0.5)
        
        def _get_title(self):
            parts = []
            if self.tickets.get('critical'):
                parts.append(f"🔴{len(self.tickets['critical'])}")
            if self.tickets.get('warning'):
                parts.append(f"🟡{len(self.tickets['warning'])}")
            if self.tickets.get('normal'):
                parts.append(f"🟢{len(self.tickets['normal'])}")
            return " ".join(parts) if parts else "⚪ 0"
        
        def _rebuild_menu(self):
            self.menu.clear()
            
            total = len(self.tickets.get('critical', [])) + len(self.tickets.get('warning', [])) + len(self.tickets.get('normal', []))
            
            if total == 0:
                self.menu.add(rumps.MenuItem("✅ Sem tickets", callback=None))
            else:
                # Critical
                if self.tickets.get('critical'):
                    self.menu.add(rumps.MenuItem(f"🔴 {len(self.tickets['critical'])} crítico(s)", callback=None))
                    for t in self.tickets['critical'][:5]:
                        item = rumps.MenuItem(f"   {t.get('key')}: {t.get('summary', '')[:25]}")
                        item._ticket_key = t.get('key')
                        item.set_callback(self._open_ticket)
                        self.menu.add(item)
                
                # Warning
                if self.tickets.get('warning'):
                    self.menu.add(rumps.MenuItem(f"🟡 {len(self.tickets['warning'])} em alerta", callback=None))
                    for t in self.tickets['warning'][:5]:
                        item = rumps.MenuItem(f"   {t.get('key')}: {t.get('summary', '')[:25]}")
                        item._ticket_key = t.get('key')
                        item.set_callback(self._open_ticket)
                        self.menu.add(item)
                
                # Normal
                if self.tickets.get('normal'):
                    self.menu.add(rumps.MenuItem(f"🟢 {len(self.tickets['normal'])} no prazo", callback=None))
                    for t in self.tickets['normal'][:3]:
                        item = rumps.MenuItem(f"   {t.get('key')}: {t.get('summary', '')[:25]}")
                        item._ticket_key = t.get('key')
                        item.set_callback(self._open_ticket)
                        self.menu.add(item)
            
            self.menu.add(rumps.separator)
            self.menu.add(rumps.MenuItem("🚪 Sair", callback=self._quit))
        
        def _open_ticket(self, sender):
            key = getattr(sender, '_ticket_key', None)
            if key:
                webbrowser.open(f"https://your-company.atlassian.net/browse/{key}")
        
        def _quit(self, _):
            rumps.quit_application()
        
        def _update_display(self):
            self.title = self._get_title()
            self._rebuild_menu()
            print(f"🔄 Tray: {self.title}")
    
    with open(log_path, "a") as f:
        f.write("Creating app...\n")
    
    try:
        app = JiraMonitorStatusBar()
        with open(log_path, "a") as f:
            f.write("App created, running...\n")
        app.run()
        with open(log_path, "a") as f:
            f.write("App run ended\n")
    except Exception as e:
        import traceback
        with open(log_path, "a") as f:
            f.write(f"Error: {e}\n")
            f.write(traceback.format_exc())


class TrayManager:
    def __init__(self, **kwargs):
        global _command_queue
        _command_queue = multiprocessing.Queue()
        self.queue = _command_queue
        self.icon_path = self._find_icon()
    
    def _find_icon(self):
        from pathlib import Path
        paths = [
            Path(__file__).parent / "assets" / "icon.png",
        ]
        for p in paths:
            if p.exists():
                return str(p)
        return None
    
    def create(self):
        global _tray_process
        _tray_process = multiprocessing.Process(
            target=_run_tray,
            args=(self.queue, self.icon_path),
            daemon=True
        )
        _tray_process.start()
        print("✅ Tray Manager iniciado (processo separado)")
    
    def update_tickets(self, data):
        if self.queue:
            self.queue.put({'action': 'update', 'data': data or {'critical': [], 'warning': [], 'normal': []}})
    
    def destroy(self):
        global _tray_process
        if self.queue:
            self.queue.put({'action': 'quit'})
        if _tray_process:
            _tray_process.terminate()
