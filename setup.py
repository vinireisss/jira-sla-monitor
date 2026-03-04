"""
Setup para criar Jira Monitor.app
"""
from setuptools import setup

APP = ['main.py']
DATA_FILES = [
    ('ui', [
        'ui/index.html',
        'ui/styles.css',
        'ui/renderer.js',
        'ui/electron-compat.js',
        'ui/custom-fixes.css',
        'ui/ux-enhancements.css',
        'ui/performance-optimizations.css',
        'ui/pywebview-fixes.css',
        'ui/driver.css',
        'ui/driver.js',
        'ui/confetti.js',
        'ui/i18n.js',
    ]),
]

OPTIONS = {
    'argv_emulation': False,
    'iconfile': 'icon.icns',
    'plist': {
        'CFBundleName': 'Jira Monitor',
        'CFBundleDisplayName': 'Jira Monitor',
        'CFBundleIdentifier': 'com.example.jira-monitor',
        'CFBundleVersion': '3.0.0',
        'CFBundleShortVersionString': '3.0.0',
        'NSHighResolutionCapable': True,
    },
    'packages': ['webview', 'requests'],
}

setup(
    name='Jira Monitor',
    app=APP,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
