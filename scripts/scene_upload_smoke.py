import json
import time
import requests
import websocket

URL = "https://3000-i4fv8no6u1t6ctuelaml3-18632994.us3.manus.computer/"
FILE = "/tmp/iconmorph-custom.svg"
pages = requests.get("http://127.0.0.1:9229/json", timeout=5).json()
page = next(item for item in pages if item.get("type") == "page")
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=10)
seq = 0

def command(method, params=None):
    global seq
    seq += 1
    ws.send(json.dumps({"id": seq, "method": method, "params": params or {}}))
    while True:
        result = json.loads(ws.recv())
        if result.get("id") == seq:
            return result.get("result", {})

def evaluate(expression):
    result = command("Runtime.evaluate", {"expression": expression, "returnByValue": True})
    return result.get("result", {}).get("value")

command("Page.navigate", {"url": URL})
time.sleep(4)
evaluate("[...document.querySelectorAll('.template-chip')].find(button => button.innerText.includes('3D 插画场景'))?.click()")
time.sleep(1)
click_result = evaluate("JSON.stringify([...document.querySelectorAll('.scene-kit-options')].map(group => { const button = [...group.querySelectorAll('button')].find(node => node.innerText.includes('自定义')); button?.click(); return Boolean(button); }))")
if json.loads(click_result) != [True, True]:
    raise SystemExit(f"自定义按钮点击失败: {click_result}")
time.sleep(.5)
root = command("DOM.getDocument", {"depth": -1})["root"]["nodeId"]
inputs = command("DOM.querySelectorAll", {"nodeId": root, "selector": 'input[type=file][accept="image/svg+xml,image/png"]'})["nodeIds"]
if len(inputs) != 2:
    raise SystemExit(f"预期两个自定义上传输入，实际 {len(inputs)}")
for node_id in inputs:
    command("DOM.setFileInputFiles", {"nodeId": node_id, "files": [FILE]})
    time.sleep(.8)
time.sleep(.5)
initial = json.loads(evaluate("JSON.stringify({selected:[...document.querySelectorAll('.scene-kit-options .scene-kit-active')].map(node=>node.innerText), images:[...document.querySelectorAll('.variant-card-scene image')].filter(node=>node.getAttribute('href')?.startsWith('data:image/svg+xml')).map(node=>({x:node.getAttribute('x'),y:node.getAttribute('y')})), grid:[...document.querySelectorAll('.scene-kit-options')].map(node=>getComputedStyle(node).gridTemplateColumns), heights:[...document.querySelectorAll('.scene-assets [role=slider]')].length})"))
if initial["selected"].count("自定义") != 2 or len(initial["images"]) < 2 or initial["heights"] < 2:
    raise SystemExit(f"上传后场景状态不完整: {initial}")
def image_positions():
    return json.loads(evaluate("JSON.stringify([...document.querySelectorAll('.variant-card-scene image')].filter(node=>node.getAttribute('href')?.startsWith('data:image/svg+xml')).map(node=>({x:node.getAttribute('x'),y:node.getAttribute('y')})))"))

def nudge_slider(index):
    evaluate(f"document.querySelectorAll('.scene-assets [role=slider]')[{index}].focus()")
    for _ in range(3):
        command("Input.dispatchKeyEvent", {"type":"keyDown", "key":"ArrowUp", "code":"ArrowUp", "windowsVirtualKeyCode":38})
        command("Input.dispatchKeyEvent", {"type":"keyUp", "key":"ArrowUp", "code":"ArrowUp", "windowsVirtualKeyCode":38})
    time.sleep(.4)

object_initial = {item["x"]: item["y"] for item in initial["images"] if item["x"] in {"48", "247"}}
motion_initial = {item["x"]: item["y"] for item in initial["images"] if item["x"] == "18"}
nudge_slider(0)
after_first = image_positions()
object_after_first = {item["x"]: item["y"] for item in after_first if item["x"] in {"48", "247"}}
motion_after_first = {item["x"]: item["y"] for item in after_first if item["x"] == "18"}
first_changed = object_after_first != object_initial or motion_after_first != motion_initial
nudge_slider(1)
after_second = image_positions()
object_after_second = {item["x"]: item["y"] for item in after_second if item["x"] in {"48", "247"}}
motion_after_second = {item["x"]: item["y"] for item in after_second if item["x"] == "18"}
second_changed = object_after_second != object_after_first or motion_after_second != motion_after_first
if not first_changed or not second_changed or object_after_second == object_initial and motion_after_second == motion_initial:
    raise SystemExit("两组高度滑块未分别改变对应自定义素材坐标")
command("Emulation.setDeviceMetricsOverride", {"width":390,"height":844,"deviceScaleFactor":1,"mobile":True})
time.sleep(.5)
mobile_grid = evaluate("[...document.querySelectorAll('.scene-kit-options')].map(node=>getComputedStyle(node).gridTemplateColumns)")
print(json.dumps({"clicked_custom_buttons":click_result,"selected":initial["selected"],"object_initial":object_initial,"object_after_first_slider":object_after_first,"object_after_second_slider":object_after_second,"motion_initial":motion_initial,"motion_after_first_slider":motion_after_first,"motion_after_second_slider":motion_after_second,"desktop_grid":initial["grid"],"mobile_grid":mobile_grid}, ensure_ascii=False))
if any(len(value.split()) != 4 for value in mobile_grid):
    raise SystemExit(f"移动端未保持一行四项: {mobile_grid}")
ws.close()
