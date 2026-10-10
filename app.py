import io
import os
import sys
import json
import time
import tempfile
import threading
import subprocess
from flask import Flask, render_template, request, jsonify
import PIL.Image
import PIL.ImageDraw
import PIL.ImageFont
import PIL.ImageOps
import qrcode

app = Flask(__name__, static_folder='static', template_folder='templates')
printer_lock = threading.Lock()

DEFAULT_MAC = "20:20:08:1B:44:64"
VENV_PYTHON = os.path.join(os.path.dirname(__file__), ".venv", "bin", "python")
if not os.path.exists(VENV_PYTHON):
    VENV_PYTHON = sys.executable

BT_TOOL = os.path.join(os.path.dirname(__file__), "bt_tool.py")

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
]
FONT_PATH = None
for f in FONT_CANDIDATES:
    if os.path.exists(f):
        FONT_PATH = f
        break


def run_bt_tool(args: list, timeout: float = 30.0) -> dict:
    cmd = [VENV_PYTHON, BT_TOOL] + args
    with printer_lock:
        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            if res.returncode == 0:
                return json.loads(res.stdout.strip())
            else:
                err_msg = res.stderr.strip()
                try:
                    err_json = json.loads(err_msg)
                    return {"success": False, "error": err_json.get("error", err_msg)}
                except:
                    return {"success": False, "error": err_msg or "작업 실패"}
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "프린터 응답 대기 시간 초과 (Timeout)"}
        except Exception as e:
            return {"success": False, "error": str(e)}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/devices', methods=['GET'])
def list_devices():
    devices = []
    try:
        import IOBluetooth
        paired = IOBluetooth.IOBluetoothDevice.pairedDevices() or []
        for dev in paired:
            name = dev.name() or ''
            addr = dev.addressString() or ''
            formatted_addr = addr.replace('-', ':').upper()
            if 'peripage' in name.lower() or 'a6' in name.lower():
                devices.append({
                    'name': name,
                    'mac': formatted_addr,
                    'is_peripage': True
                })
            else:
                devices.append({
                    'name': name,
                    'mac': formatted_addr,
                    'is_peripage': False
                })
    except Exception as e:
        pass

    devices.sort(key=lambda d: not d.get('is_peripage', False))
    return jsonify({
        'success': True,
        'devices': devices
    })


@app.route('/api/status', methods=['GET'])
def get_status():
    mac = request.args.get('mac', '').strip()
    if not mac:
        return jsonify({'success': False, 'error': '기기 MAC 주소가 비어있습니다. [기기 검색]을 눌러주세요.'}), 400

    result = run_bt_tool(["status", "--mac", mac], timeout=10.0)
    if result.get("success"):
        return jsonify({
            'success': True,
            'connected': True,
            'name': result.get('name', 'PeriPage A6'),
            'battery': result.get('battery', 100),
            'mac': mac,
            'model': result.get('model', 'A6p'),
            'dpi': result.get('dpi', 304),
            'width': result.get('width', 576),
            'firmware': result.get('firmware', '')
        })
    else:
        return jsonify({
            'success': False,
            'connected': False,
            'error': result.get('error', '연결 실패'),
            'mac': mac
        }), 400


@app.route('/api/feed', methods=['POST'])
def feed_paper():
    data = request.get_json() or {}
    mac = data.get('mac', '').strip()
    if not mac:
        return jsonify({'success': False, 'error': '기기 MAC 주소가 비어있습니다.'}), 400

    lines = int(data.get('lines', 120))
    lines = max(10, min(300, lines))
    model = data.get('model', 'A6p')

    result = run_bt_tool(["feed", "--mac", mac, "--lines", str(lines), "--model", model], timeout=15.0)
    if result.get("success"):
        return jsonify({'success': True, 'message': result.get('message', '급지 완료')})
    else:
        return jsonify({'success': False, 'error': result.get('error', '급지 실패')}), 500


def render_text_to_image(text: str, font_size: int = 32, align: str = 'left', width: int = 576) -> PIL.Image.Image:
    margin = 16
    content_width = width - (margin * 2)

    try:
        if FONT_PATH:
            font = PIL.ImageFont.truetype(FONT_PATH, font_size)
        else:
            font = PIL.ImageFont.load_default()
    except:
        font = PIL.ImageFont.load_default()

    raw_lines = text.split('\n')
    wrapped_lines = []
    dummy_img = PIL.Image.new('L', (width, 100), 255)
    draw = PIL.ImageDraw.Draw(dummy_img)

    for line in raw_lines:
        if not line:
            wrapped_lines.append('')
            continue

        current_line = ''
        for char in line:
            test_line = current_line + char
            bbox = draw.textbbox((0, 0), test_line, font=font)
            line_w = bbox[2] - bbox[0]
            if line_w <= content_width:
                current_line = test_line
            else:
                wrapped_lines.append(current_line)
                current_line = char
        if current_line:
            wrapped_lines.append(current_line)

    line_height = int(font_size * 1.35)
    total_height = max(50, len(wrapped_lines) * line_height + (margin * 2))

    img = PIL.Image.new('L', (width, total_height), 255)
    draw = PIL.ImageDraw.Draw(img)

    y = margin
    for line in wrapped_lines:
        if line:
            bbox = draw.textbbox((0, 0), line, font=font)
            line_w = bbox[2] - bbox[0]
            if align == 'center':
                x = margin + (content_width - line_w) // 2
            elif align == 'right':
                x = margin + (content_width - line_w)
            else:
                x = margin
            draw.text((x, y), line, fill=0, font=font)
        y += line_height

    return img


@app.route('/api/print/text', methods=['POST'])
def print_text():
    data = request.get_json() or {}
    mac = data.get('mac', '').strip()
    if not mac:
        return jsonify({'success': False, 'error': '기기 MAC 주소가 비어있습니다. [기기 검색]을 눌러주세요.'}), 400

    text = data.get('text', '').strip()
    font_size = int(data.get('font_size', 32))
    align = data.get('align', 'left')
    concentration = int(data.get('concentration', 2))
    break_size = int(data.get('break_size', 120))
    model = data.get('model', 'A6p')
    width = int(data.get('width', 576))

    if not text:
        return jsonify({'success': False, 'error': '인쇄할 텍스트가 없습니다.'}), 400

    img = render_text_to_image(text, font_size=font_size, align=align, width=width)

    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        tmp_path = tmp.name
        img.save(tmp_path, format='PNG')

    try:
        args = [
            "print",
            "--mac", mac,
            "--image", tmp_path,
            "--concentration", str(concentration),
            "--break", str(break_size),
            "--model", model
        ]
        result = run_bt_tool(args, timeout=30.0)
        if result.get("success"):
            return jsonify({'success': True, 'message': result.get('message', '인쇄 완료')})
        else:
            return jsonify({'success': False, 'error': result.get('error', '인쇄 실패')}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.route('/api/print/image', methods=['POST'])
def print_image():
    mac = request.form.get('mac', '').strip()
    if not mac:
        return jsonify({'success': False, 'error': '기기 MAC 주소가 비어있습니다. [기기 검색]을 눌러주세요.'}), 400

    concentration = int(request.form.get('concentration', 2))
    break_size = int(request.form.get('break_size', 120))
    dither = request.form.get('dither', 'true') == 'true'
    model = request.form.get('model', 'A6p')

    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '이미지 파일이 없습니다.'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'success': False, 'error': '유효한 파일이 아닙니다.'}), 400

    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        tmp_path = tmp.name
        try:
            raw_img = PIL.Image.open(file.stream)
            if raw_img.mode in ('RGBA', 'LA'):
                bg = PIL.Image.new('RGB', raw_img.size, (255, 255, 255))
                bg.paste(raw_img, mask=raw_img.split()[-1])
                raw_img = bg
            elif raw_img.mode != 'RGB':
                raw_img = raw_img.convert('RGB')
            raw_img.save(tmp_path, format='PNG')
        except Exception as e:
            return jsonify({'success': False, 'error': f'이미지 처리 실패: {e}'}), 400

    try:
        args = [
            "print",
            "--mac", mac,
            "--image", tmp_path,
            "--concentration", str(concentration),
            "--break", str(break_size),
            "--model", model
        ]
        if dither:
            args.append("--dither")

        result = run_bt_tool(args, timeout=35.0)
        if result.get("success"):
            return jsonify({'success': True, 'message': result.get('message', '인쇄 완료')})
        else:
            return jsonify({'success': False, 'error': result.get('error', '인쇄 실패')}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.route('/api/print/qr', methods=['POST'])
def print_qr():
    data = request.get_json() or {}
    mac = data.get('mac', '').strip()
    if not mac:
        return jsonify({'success': False, 'error': '기기 MAC 주소가 비어있습니다. [기기 검색]을 눌러주세요.'}), 400

    qr_text = data.get('text', '').strip()
    label = data.get('label', '').strip()
    concentration = int(data.get('concentration', 2))
    break_size = int(data.get('break_size', 120))
    model = data.get('model', 'A6p')
    width = int(data.get('width', 576))

    if not qr_text:
        return jsonify({'success': False, 'error': 'QR 데이터가 없습니다.'}), 400

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=3,
    )
    qr.add_data(qr_text)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('L')

    ratio = width / qr_img.width
    new_h = int(qr_img.height * ratio)
    qr_resized = qr_img.resize((width, new_h), PIL.Image.NEAREST)

    final_img = qr_resized
    if label:
        label_img = render_text_to_image(label, font_size=26, align='center', width=width)
        combined = PIL.Image.new('L', (width, qr_resized.height + label_img.height), 255)
        combined.paste(qr_resized, (0, 0))
        combined.paste(label_img, (0, qr_resized.height))
        final_img = combined

    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        tmp_path = tmp.name
        final_img.save(tmp_path, format='PNG')

    try:
        args = [
            "print",
            "--mac", mac,
            "--image", tmp_path,
            "--concentration", str(concentration),
            "--break", str(break_size),
            "--model", model
        ]
        result = run_bt_tool(args, timeout=30.0)
        if result.get("success"):
            return jsonify({'success': True, 'message': result.get('message', 'QR 인쇄 완료')})
        else:
            return jsonify({'success': False, 'error': result.get('error', 'QR 인쇄 실패')}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == '__main__':
    port = 4700
    print(f"🚀 PeriPage Web Server starting on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
