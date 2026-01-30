# BLE ↔ USB HID 입력 장치

펌웨어 버전: 1.0.0

## 목차

- 용어 정리
- 프로젝트 개요
- 시스템 구조
- 하드웨어 구성
- 통신 구조
- USB HID 동작
- 제어 PC 웹 페이지
- 브라우저 동작 흐름
- 전원 정책
- 개발 환경
- 완료 기준 (Acceptance Criteria)
- 향후 확장

## 🧾 용어 정리

- Flusher(= Byte Flusher): nRF52840 기반 장치. 브라우저(BLE) 명령을 받아 Target PC로 USB HID 키보드 입력을 출력하는 것이 주 목적이다.
- Control PC: 웹브라우저로 Flusher를 BLE로 제어하는 PC
- Target PC: Flusher가 USB로 연결되어 HID 입력을 받는 PC

## 📌 프로젝트 개요

본 프로젝트는 **nRF52840 기반 Pro Micro 호환 보드**를 이용하여 다음 기능을 수행하는 장치를 제작한다.

- 웹브라우저에서 BLE(Bluetooth Low Energy)로 장치를 제어
- Control PC의 브라우저에서 텍스트를 입력하고 [시작(Flush)]을 누르면, Flusher가 Target PC의 포커싱된 커서 위치에 해당 텍스트를 키보드 입력으로 전송(Flush)
- 외부 인터넷 연결 없이 동작
- 제어용 PC(Control PC)와 Target PC는 서로 다른 장치임.

---

## 🧠 시스템 구조

[ 제어 PC ]
Chrome / Edge 브라우저
Web Bluetooth API
|
| BLE
v
[ Flusher(Byte Flusher) ]
| |
USB HID
|
v
[ 타겟 PC ]


---

## 🔩 하드웨어 구성

### Flusher (Device)

- nRF52840 Pro Micro 호환 보드  
  (SuperMini NRF52840, Nice!Nano 계열)
- Bluetooth 5.0 BLE
- USB Device 지원
- HID 키보드 구현 가능

### 외부 부품

- USB 케이블 (타겟 PC 연결용)

---

## 📡 통신 구조

### BLE 역할

- Flusher(Device): BLE Peripheral (GATT Server)
- 브라우저: BLE Central

---

### BLE 서비스 구조(GATT)

#### ▶ Flusher Control Service (Custom UUID)

- Service UUID: `f3641400-00b0-4240-ba50-05ca45bf8abc`

##### Characteristic: Flush Text
- 속성: Write (with response)
- Characteristic UUID: `f3641401-00b0-4240-ba50-05ca45bf8abc`
- 값:
  - (권장) 패킷 포맷(LE): `[sessionId(2)][seq(2)][payload...]`
    - payload: UTF-8 문자열 바이트(청크)
    - sessionId: Flush 작업 단위(브라우저가 새로 생성)
    - seq: 0부터 시작하는 청크 번호
  - 브라우저에서 이 Characteristic에 문자열을 Write 하면 Flusher는 Target PC로 해당 문자열을 키보드 입력으로 출력한다.

##### Characteristic: Config
- 속성: Write (with response)
- Characteristic UUID: `f3641402-00b0-4240-ba50-05ca45bf8abc`
- 값(권장, LE): `[typingDelayMs(u16)][modeSwitchDelayMs(u16)][keyPressDelayMs(u16)][toggleKey(u8)][flags(u8)]`
  - `toggleKey`: 0=RightAlt, 1=LeftAlt, 2=RightCtrl, 3=LeftCtrl, 4=RightGUI, 5=LeftGUI, 6=CapsLock
  - `flags` 비트 정의
    - bit0: Pause (1=paused, 0=run)
    - bit1: Abort (1=즉시폐기; RX 큐 비우고 내부 디코더 상태 리셋)

##### Characteristic: Status (Flow Control)
- 속성: Read + Notify
- Characteristic UUID: `f3641403-00b0-4240-ba50-05ca45bf8abc`
- 값(LE): `[capacityBytes(u16)][freeBytes(u16)]`
  - 브라우저는 이 값을 이용해 **디바이스 RX 버퍼에 여유가 있을 때만** 다음 청크를 전송한다.

---

### 긴 텍스트 안정화(정확성 우선)

- USB HID 특성상 "Target PC의 실제 입력 완료"를 보드가 확인할 수 없다.
- 하지만 Pause/Stop의 즉시성(특히 장치 내부 큐가 쌓였을 때)을 보장하려면,
  브라우저가 장치 내부 RX 큐의 백로그를 무제한으로 쌓지 않도록 제어가 필요하다.
- 따라서 본 프로젝트는 **Status(READ+NOTIFY) 기반 Flow Control**을 사용한다.
  - 브라우저는 `freeBytes`가 충분할 때만 Flush Text Write를 수행한다.
  - Notify 누락 가능성을 고려해, 일정 시간 stale이면 Read로 폴백한다.
- 기존의 Chunk + Delay는 여전히 유효한 보조 안전장치로 유지한다.

추가로, BT가 끊겨도 끝까지 완료하기 위해 다음 정책을 사용한다.

- 브라우저는 청크를 `write(with response)`로 전송한다(정확도 우선)
- 전송 실패/연결 끊김 시 자동 재연결을 시도하고, **같은 청크(seq)를 재전송**한다
- Flusher는 같은 sessionId에서 이미 처리한 seq는 무시하여(중복 타이핑 방지) 재시도를 안전하게 만든다
- 사용자가 [중지]를 누르지 않는 한 전송은 끝까지 재시도한다

---

## 한/영 전환 및 한글 입력

- Target PC는 한/영 전환이 **Right Alt**로 설정되어 있다는 전제를 둔다.
- Flusher는 입력 스트림을 UTF-8로 디코딩하고 다음을 지원한다.
  - ASCII(영문/숫자/기호/개행/탭)
  - 한글 음절(가~힣, U+AC00~U+D7A3): 두벌식 매핑으로 타이핑
- 타이밍(펌웨어 기본값)
  - 키 입력 딜레이: 30ms
  - 한/영 전환 딜레이: 100ms
  - 키 눌림 유지: 10ms

---

## ⌨ USB HID 동작

- Flusher는 Target PC에 USB로 연결되면 HID 키보드로 인식되며, BLE로 수신한 문자열을 Target PC의 포커싱된 커서 위치에 키보드 입력으로 출력한다.


---

## 🌐 제어 PC 웹 페이지

### 제공 방식

- 본 프로젝트에서는 **정적 웹 페이지(HTML/JS/CSS)** 만 개발한다.
- 웹 페이지는 개인 서버(또는 로컬 개발용 서버)에서 호스팅하여 사용한다.
  - 참고: Web Bluetooth는 보안 컨텍스트(HTTPS 또는 localhost)가 필요하므로 `file://` 직접 실행은 제한된다.


---

### 웹 UI 구성

- [장치 연결] 버튼
- 텍스트 입력창(멀티라인 가능)
- [시작(Flush)] 버튼

---

## 🔄 브라우저 동작 흐름

1. 사용자가 [장치 연결] 클릭
2. BLE 장치 선택 팝업 표시
3. 장치 선택
4. 서비스 연결
5. 사용자가 텍스트 입력 후 [시작(Flush)] 클릭
6. Flush Text characteristic Write

---

## ⚡ 전원 정책

- 기본: Target PC USB 전원 사용 (USB 연결이 곧 전원 공급)

---

## 🛠 개발 환경

### 펌웨어

- (현재 repo 기준) PlatformIO + Arduino framework
  - `platformio.ini`: `nordicnrf52` / `adafruit_feather_nrf52840` (알리익스프레스 Pro Micro 폼팩터 nRF52840 보드 호환)
  - `src/main.cpp`: BLE GATT Write 수신 → USB HID 키보드 타이핑(기본 스캐폴딩)
- Arduino IDE
- Adafruit nRF52 Core 또는 Nice!Nano 호환 패키지
- BLE 라이브러리: ArduinoBLE / Adafruit Bluefruit
- USB HID: TinyUSB / Keyboard 라이브러리

### 브라우저

- Chrome / Edge
- Web Bluetooth API 사용

---

## ✅ 완료 기준 (Acceptance Criteria)

- [ ] (전제) Flusher가 Target PC에 USB로 연결되어 전원이 공급된다.
- [ ] 브라우저에서 BLE 연결 성공
- [ ] 브라우저에서 텍스트 입력 후 [시작(Flush)] 실행 가능
- [ ] Target PC의 포커싱된 입력 커서 위치에 텍스트가 키보드 입력으로 입력된다.
- [ ] 인터넷 없이 동작
- [ ] 제어 PC / 타겟 PC 분리 사용이 전제임

---

## 🚀 향후 확장

- BLE 페어링 보안 강화
- HID 키맵 확장

---

## 🧩 TODO

- BLE GATT Service/Characteristic UUID 확정
- Flush Text Write 방식 확정 (Write / Write Without Response)
- Flush Text 전송 한계 및 정책 확정 (1회 최대 길이, 긴 텍스트 처리)
- 개행/탭 등 제어문자 처리 규칙 확정 (예: `\n` → Enter, `\t` → Tab)
- 지원 문자 범위 및 키보드 레이아웃 가정 확정 (예: US 키보드 기준 여부)
- USB HID 출력 타이밍 확정 (키 입력 간 딜레이 등)
- 최소 보안/운영 정책 확정 (예: 페어링/재연결 정책)