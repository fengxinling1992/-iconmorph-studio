import json
import os
import time
import requests
import websocket

URL = "https://3000-i4fv8no6u1t6ctuelaml3-18632994.us3.manus.computer/"
DOWNLOAD_DIR = "/tmp/iconmorph-downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

pages = requests.get("http://127.0.0.1:9223/json", timeout=5).json()
page = next(item for item in pages if item.get("type") == "page")
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=10)
seq = 0

def command(method, params=None):
    global seq
    seq += 1
    ws.send(json.dumps({"id": seq, "method": method, "params": params or {}}))
    while True:
        message = json.loads(ws.recv())
        if message.get("id") == seq:
            return message

command("Browser.setDownloadBehavior", {"behavior": "allow", "downloadPath": DOWNLOAD_DIR})
command("Page.navigate", {"url": URL})
time.sleep(4)
command("Runtime.evaluate", {"expression": "document.querySelector('button[aria-label^=\\\"下载\\\"]')?.click()"})
time.sleep(4)
command("Runtime.evaluate", {"expression": "document.querySelector('button.export-trigger')?.click()"})
time.sleep(1)
command("Runtime.evaluate", {"expression": "document.querySelector('button.bundle-button')?.click()"})
time.sleep(8)
files = [name for name in os.listdir(DOWNLOAD_DIR) if not name.endswith(".crdownload")]
zip_files = [name for name in files if name.endswith(".zip")]
png_files = [name for name in files if name.endswith(".png")]
print(json.dumps({"downloaded_files": files, "downloaded_single_files": png_files, "downloaded_zip_files": zip_files, "download_dir": DOWNLOAD_DIR}, ensure_ascii=False))
if not png_files or not zip_files:
    raise SystemExit("未同时检测到完成的单张与 ZIP 下载")
ws.close()
