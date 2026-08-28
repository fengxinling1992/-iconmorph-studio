import json
import time
import requests
import websocket

url = "https://3000-i4fv8no6u1t6ctuelaml3-18632994.us3.manus.computer/"
pages = requests.get("http://127.0.0.1:9227/json", timeout=5).json()
page = next(item for item in pages if item.get("type") == "page")
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=10)
seq = 0

def evaluate(expression):
    global seq
    seq += 1
    ws.send(json.dumps({"id": seq, "method": "Runtime.evaluate", "params": {"expression": expression, "returnByValue": True}}))
    while True:
        result = json.loads(ws.recv())
        if result.get("id") == seq:
            return result.get("result", {}).get("result", {}).get("value")

seq += 1
ws.send(json.dumps({"id": seq, "method": "Page.navigate", "params": {"url": url}}))
while True:
    result = json.loads(ws.recv())
    if result.get("id") == seq:
        break
time.sleep(4)
evaluate("[...document.querySelectorAll('.template-chip')].find(button => button.innerText.includes('3D 插画场景'))?.click()")
time.sleep(1)
summary = evaluate("JSON.stringify({groups:[...document.querySelectorAll('.scene-kit-options')].map(node=>node.innerText.trim().split('\\n')), legacy:[...document.querySelectorAll('.scene-upload')].length})")
print(summary)
parsed = json.loads(summary)
if any(len(group) != 4 for group in parsed["groups"]) or parsed["legacy"] != 0:
    raise SystemExit("3D 套件 UI 验证失败")
ws.close()
