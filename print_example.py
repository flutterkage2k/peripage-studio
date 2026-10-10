import peripage
import PIL.Image

# 1. 프린터 MAC 주소 및 모델 설정
MAC_ADDRESS = "20:20:08:1B:44:64"  # PeriPage+4464
printer = peripage.Printer(MAC_ADDRESS, peripage.PrinterType.A6)

print("프린터 연결 중...")
printer.connect()
print(f"연결 성공! 기기명: {printer.getDeviceName().decode('ascii', errors='ignore')}, 배터리: {printer.getDeviceBattery()}%")

# 2. 초기화 및 농도 설정 (0: 연하게, 1: 보통, 2: 진하게)
printer.reset()
printer.setConcentration(2)

# 3. 이미지 인쇄 예시
img = PIL.Image.open("honk.png")
print("이미지 인쇄 중...")
printer.printImage(img)

# 4. QR 코드 인쇄 예시 (원할 경우 주석 해제)
# printer.printQR("https://google.com")

# 5. 절취선까지 여백 밀어내기 (120픽셀 권장)
print("여백 급지 중...")
printer.printBreak(120)

# 6. 연결 종료
printer.disconnect()
print("인쇄 완료 및 연결 종료.")
