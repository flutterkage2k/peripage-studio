import sys
import argparse
import json
import peripage
import PIL.Image

def detect_model(mac: str):
    # Temporarily connect with A6 to probe firmware
    p = peripage.Printer(mac, peripage.PrinterType.A6, timeout=3.5)
    p.connect()
    p.reset()
    try:
        fw = p.getDeviceFirmware().decode('ascii', errors='ignore')
    except:
        fw = ''
    try:
        dev_ip = p.getDeviceIP().decode('ascii', errors='ignore')
    except:
        dev_ip = ''
    name = p.getDeviceName().decode('ascii', errors='ignore')
    battery = p.getDeviceBattery()
    p.disconnect()

    # Determine DPI and type
    if '304' in fw or '300' in dev_ip:
        ptype_name = 'A6p'
        dpi = 304
        width = 576
        display_name = f"{name or 'PeriPage A6'} (304 DPI)"
    else:
        ptype_name = 'A6'
        dpi = 203
        width = 384
        display_name = f"{name or 'PeriPage A6'} (203 DPI)"

    return {
        "name": display_name,
        "battery": battery,
        "mac": mac,
        "firmware": fw,
        "model": ptype_name,
        "dpi": dpi,
        "width": width
    }

def do_status(mac: str):
    info = detect_model(mac)
    info["success"] = True
    print(json.dumps(info))

def do_feed(mac: str, lines: int, model: str):
    ptype = peripage.PrinterType[model] if model in peripage.PrinterType.names() else peripage.PrinterType.A6p
    p = peripage.Printer(mac, ptype, timeout=3.5)
    p.connect()
    p.reset()
    p.printBreak(lines)
    p.disconnect()
    print(json.dumps({
        "success": True,
        "message": f"{lines}px 급지 완료"
    }))

def do_print(mac: str, img_path: str, concentration: int, break_size: int, dither: bool, model: str):
    ptype = peripage.PrinterType[model] if model in peripage.PrinterType.names() else peripage.PrinterType.A6p
    p = peripage.Printer(mac, ptype, timeout=4.0)
    p.connect()
    p.reset()
    p.setConcentration(concentration)
    img = PIL.Image.open(img_path)
    p.printImage(img, dither=dither)
    if break_size > 0:
        p.printBreak(break_size)
    p.disconnect()
    print(json.dumps({
        "success": True,
        "message": "인쇄가 완료되었습니다!"
    }))

def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="cmd", required=True)

    status_p = subparsers.add_parser("status")
    status_p.add_argument("--mac", required=True)

    feed_p = subparsers.add_parser("feed")
    feed_p.add_argument("--mac", required=True)
    feed_p.add_argument("--lines", type=int, default=120)
    feed_p.add_argument("--model", type=str, default="A6p")

    print_p = subparsers.add_parser("print")
    print_p.add_argument("--mac", required=True)
    print_p.add_argument("--image", required=True)
    print_p.add_argument("--concentration", type=int, default=2)
    print_p.add_argument("--break", dest="break_size", type=int, default=120)
    print_p.add_argument("--dither", action="store_true", default=False)
    print_p.add_argument("--model", type=str, default="A6p")

    args = parser.parse_args()

    try:
        if args.cmd == "status":
            do_status(args.mac)
        elif args.cmd == "feed":
            do_feed(args.mac, args.lines, args.model)
        elif args.cmd == "print":
            do_print(args.mac, args.image, args.concentration, args.break_size, args.dither, args.model)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
