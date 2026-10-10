# PeriPage Thermal Studio (macOS & Linux)

**macOS 네이티브 블루투스(IOBluetooth) 및 웹 UI를 지원하는 PeriPage A6/A6+/A40 열전사 프린터 제어 도구**

본 프로젝트는 [bitrate16/peripage-python](https://github.com/bitrate16/peripage-python)을 기반으로, **macOS 환경에서 Linux 전용 PyBluez 없이 네이티브 블루투스로 완벽히 작동**하도록 개선하고, 누구나 쉽게 사용할 수 있는 **반응형 웹 UI(Thermal Studio)**를 내장한 확장 버전입니다.

---

## 🌟 주요 특징

* **macOS 완벽 지원**: macOS 네이티브 블루투스(`IOBluetooth` RFCOMM)를 사용하여 별도 드라이버 설치 없이 즉시 연결 및 인쇄
* **웹 UI(Thermal Studio) 기본 제공**: 브라우저(포트 `4700`)에서 기기 연결, 실시간 감열지 미리보기, 원클릭 인쇄 가능
* **한글 / 이모티콘 / 다국어 악센트 완벽 지원**:
  * 한글 폰트(`AppleSDGothicNeo`, `Arial Unicode`) 자동 적용
  * 이모티콘(`📋`, `☕`, `🖨️`) 및 특수문자(`é` 등)의 폰트 깨짐 없는 비트맵 렌더링(WYSIWYG)
* **다양한 인쇄 모드**:
  * ✍️ 텍스트 인쇄 (폰트 크기 및 좌/중/우 정렬)
  * 🖼️ 이미지 인쇄 (384px 리사이징, 흑백 대비 슬라이더, Floyd-Steinberg 디더링)
  * 📱 QR 코드 생성 및 라벨 문구 인쇄
  * 📋 간이 영수증 / 오늘의 할 일(To-Do) / 명언 메모 템플릿
* **A6 절취선 최적화**: 인쇄 후 절취선 밖으로 종이가 정확히 배출되도록 여백 급지(`printBreak`) 자동 보정

---

## 🚀 빠른 시작 (웹 UI 실행)

### 1. 가상환경 및 패키지 설치
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install flask pyobjc-framework-IOBluetooth
```

### 2. 웹 서버 실행 (포트 4700)
```bash
.venv/bin/python app.py
```

브라우저에서 **[http://localhost:4700](http://localhost:4700)** 에 접속합니다.

---

## 🔍 프린터 블루투스 MAC 주소 확인 방법

프린터와 통신하려면 블루투스 MAC 주소(예: `20:20:08:1B:44:64`)가 필요합니다. 다음 세 가지 방법 중 하나를 이용하세요.

### 방법 1. 프린터 전원 버튼 더블 클릭 (가장 쉬움 ⭐)
1. PeriPage 프린터 전원을 켭니다 (초록색 불 점등).
2. **전원 버튼을 빠르게 두 번(더블 클릭)** 누릅니다.
3. 기기 정보가 적힌 테스트 영수증이 출력됩니다.
4. 영수증에 인쇄된 **`MAC: XX:XX:XX:XX:XX:XX`** 를 확인합니다.

### 방법 2. macOS 시스템 리포트에서 확인
1. Mac 화면 좌측 상단 ** 애플 메뉴 > 이 Mac에 관하여 > 추가 정보... > 시스템 리포트...** 로 이동합니다.
2. 하드웨어 목록에서 **Bluetooth**를 클릭합니다.
3. 연결/페어링된 기기 목록 중 `PeriPage+xxxx` 항목을 찾습니다.
4. **주소(Address)** 항목에 표기된 `20-20-08-1b-44-64`를 확인합니다 (`:` 또는 `-` 형식 모두 지원).

### 방법 3. 웹 UI에서 자동 검색 (웹 앱 기능)
1. [http://localhost:4700](http://localhost:4700) 접속 후 상단 헤더의 **[🔍 기기 검색]** 버튼을 클릭합니다.
2. Mac에 블루투스 페어링된 PeriPage 기기를 자동으로 찾아 MAC 주소 필드에 즉시 입력해 줍니다.

---

## 💻 CLI (터미널) 사용법

웹 UI 대신 터미널 명령어로 직접 인쇄할 수도 있습니다:

```bash
# 1. 기기 상태 확인 (이름, 배터리 잔량 등)
.venv/bin/python -m peripage -m 20:20:08:1B:44:64 -p A6 -e

# 2. 텍스트 인쇄 (농도 진하게 -c 2, 절취선 여백 -b 120)
.venv/bin/python -m peripage -m 20:20:08:1B:44:64 -p A6 -t "Hello Mac!" -c 2 -b 120

# 3. 이미지 인쇄
.venv/bin/python -m peripage -m 20:20:08:1B:44:64 -p A6 -i honk.png -c 2 -b 120

# 4. QR 코드 인쇄
.venv/bin/python -m peripage -m 20:20:08:1B:44:64 -p A6 -q "https://google.com" -b 120
```

---

## 🐍 Python 라이브러리 연동 예제

파이썬 코드에서 직접 인쇄하려면 다음과 같이 사용합니다:

```python
import peripage
import PIL.Image

# 프린터 연결
printer = peripage.Printer('20:20:08:1B:44:64', peripage.PrinterType.A6)
printer.connect()
printer.reset()

# 배터리 확인
print(f"배터리 잔량: {printer.getDeviceBattery()}%")

# 농도 설정 (0: 연하게, 1: 보통, 2: 진하게)
printer.setConcentration(2)

# 이미지 인쇄
img = PIL.Image.open("photo.png")
printer.printImage(img)

# 절취선 밖으로 종이 밀어내기 (120px 권장)
printer.printBreak(120)

# 연결 종료
printer.disconnect()
```

---

## 📋 지원 기종
* PeriPage A6 (384px 너비)
* PeriPage A6+ (576px 너비)
* PeriPage A40 (1728px 너비)
* PeriPage A40+ (1848px 너비)

## 📄 라이선스
GPLv3 License
