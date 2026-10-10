// PeriPage A6 Web Studio Client Logic (Supports 304 DPI / 576px & 203 DPI / 384px)

document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentTab = 'tab-text';
    let uploadedFile = null;
    let selectedAlign = 'left';
    let selectedConcentration = 2;
    let currentTemplate = 'receipt';
    let selectedTemplateAlign = 'center';

    // Printer Specifications (Auto-detected from firmware)
    let printerWidth = 576; // 304 DPI default (A6+)
    let printerDpi = 304;
    let printerModel = 'A6p';

    // DOM Elements
    const macInput = document.getElementById('macAddress');
    const btnScanDevices = document.getElementById('btnScanDevices');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const batteryIndicator = document.getElementById('batteryIndicator');
    const batteryVal = document.getElementById('batteryVal');
    const btnCheckStatus = document.getElementById('btnCheckStatus');
    const btnQuickFeed = document.getElementById('btnQuickFeed');
    const btnPrint = document.getElementById('btnPrint');
    const printBtnText = document.getElementById('printBtnText');
    const printSpinner = document.getElementById('printSpinner');
    const printIcon = document.getElementById('printIcon');
    const paperWidthBadge = document.getElementById('paperWidthBadge');

    // Controls
    const textInput = document.getElementById('textInput');
    const textCounter = document.getElementById('textCounter');
    const fontSizeInput = document.getElementById('fontSize');
    const fontSizeVal = document.getElementById('fontSizeVal');
    const textAlignControl = document.getElementById('textAlignControl');

    const imageInput = document.getElementById('imageInput');
    const dropZone = document.getElementById('dropZone');
    const imageOptionsBar = document.getElementById('imageOptionsBar');
    const thresholdRange = document.getElementById('thresholdRange');
    const thresholdVal = document.getElementById('thresholdVal');
    const ditherToggle = document.getElementById('ditherToggle');

    const qrInput = document.getElementById('qrInput');
    const qrLabelInput = document.getElementById('qrLabelInput');

    // Template Controls
    const templateText = document.getElementById('templateText');
    const templateCounter = document.getElementById('templateCounter');
    const templateFontSizeInput = document.getElementById('templateFontSize');
    const templateFontSizeVal = document.getElementById('templateFontSizeVal');
    const templateAlignControl = document.getElementById('templateAlignControl');
    const btnInsertDate = document.getElementById('btnInsertDate');
    const btnInsertDoubleLine = document.getElementById('btnInsertDoubleLine');
    const btnInsertDashLine = document.getElementById('btnInsertDashLine');
    const btnInsertCheck = document.getElementById('btnInsertCheck');
    const btnResetTemplate = document.getElementById('btnResetTemplate');

    const concentrationControl = document.getElementById('concentrationControl');
    const breakSizeInput = document.getElementById('breakSize');
    const breakSizeVal = document.getElementById('breakSizeVal');

    // Preview Elements
    const previewCanvas = document.getElementById('previewCanvas');
    const placeholderPreview = document.getElementById('placeholderPreview');
    const ctx = previewCanvas.getContext('2d');

    // Load saved MAC
    const savedMac = localStorage.getItem('peripage_mac');
    if (savedMac) {
        macInput.value = savedMac;
    }

    macInput.addEventListener('change', () => {
        localStorage.setItem('peripage_mac', macInput.value.trim());
    });

    // Toast Notification helper
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: '✅', error: '❌', info: 'ℹ️' };
        toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Auto Device Scan
    if (btnScanDevices) {
        btnScanDevices.addEventListener('click', async () => {
            btnScanDevices.disabled = true;
            btnScanDevices.textContent = '검색 중...';
            try {
                showToast('Mac에 페어링된 기기를 탐색 중입니다...', 'info');
                const res = await fetch('/api/devices');
                const data = await res.json();
                if (data.success && data.devices && data.devices.length > 0) {
                    const peripageDev = data.devices.find(d => d.is_peripage) || data.devices[0];
                    macInput.value = peripageDev.mac;
                    localStorage.setItem('peripage_mac', peripageDev.mac);
                    showToast(`기기를 감지했습니다: ${peripageDev.name} (${peripageDev.mac})`, 'success');
                    checkDeviceStatus();
                } else {
                    showToast('PeriPage 기기를 찾지 못했습니다. 블루투스 페어링을 확인해주세요.', 'error');
                }
            } catch (err) {
                showToast('기기 검색 실패: ' + err.message, 'error');
            } finally {
                btnScanDevices.disabled = false;
                btnScanDevices.textContent = '🔍 기기 검색';
            }
        });
    }

    // Check Status and Auto-Detect DPI / Width
    async function checkDeviceStatus() {
        const mac = macInput.value.trim();
        if (!mac) return showToast('MAC 주소를 입력해주세요.', 'error');

        statusText.textContent = '연결 확인 중...';
        statusBadge.className = 'status-badge';
        btnCheckStatus.disabled = true;

        try {
            const res = await fetch(`/api/status?mac=${encodeURIComponent(mac)}`);
            const data = await res.json();
            if (data.connected) {
                statusBadge.className = 'status-badge connected';
                statusText.textContent = data.name || 'PeriPage A6';
                batteryIndicator.style.display = 'inline-flex';
                batteryVal.textContent = `${data.battery}%`;

                // Update Printer Specs dynamically
                if (data.width) printerWidth = data.width;
                if (data.dpi) printerDpi = data.dpi;
                if (data.model) printerModel = data.model;

                if (paperWidthBadge) {
                    paperWidthBadge.textContent = `${printerWidth}px (${printerDpi} DPI)`;
                }

                showToast(`기기 연결 성공 (${data.name}, ${printerDpi} DPI, 배터리 ${data.battery}%)`, 'success');
                updatePreview();
            } else {
                statusBadge.className = 'status-badge disconnected';
                statusText.textContent = '연결 실패';
                batteryIndicator.style.display = 'none';
                showToast(data.error || '연결 실패', 'error');
            }
        } catch (err) {
            statusBadge.className = 'status-badge disconnected';
            statusText.textContent = '오류 발생';
            batteryIndicator.style.display = 'none';
            showToast('서버 통신 실패: ' + err.message, 'error');
        } finally {
            btnCheckStatus.disabled = false;
        }
    }

    btnCheckStatus.addEventListener('click', checkDeviceStatus);

    // Quick Feed
    btnQuickFeed.addEventListener('click', async () => {
        const mac = macInput.value.trim();
        if (!mac) return showToast('MAC 주소를 입력해주세요.', 'error');
        btnQuickFeed.disabled = true;
        try {
            showToast('용지 급지 중...', 'info');
            const res = await fetch('/api/feed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mac, lines: 120, model: printerModel })
            });
            const data = await res.json();
            if (data.success) {
                showToast('120px 용지 급지가 완료되었습니다.', 'success');
            } else {
                showToast('급지 실패: ' + data.error, 'error');
            }
        } catch (err) {
            showToast('요청 실패: ' + err.message, 'error');
        } finally {
            btnQuickFeed.disabled = false;
        }
    });

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            currentTab = btn.getAttribute('data-tab');
            document.getElementById(currentTab).classList.add('active');
            updatePreview();
        });
    });

    // Text Align segmented control
    textAlignControl.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            textAlignControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedAlign = btn.getAttribute('data-align');
            updatePreview();
        });
    });

    // Concentration segmented control
    concentrationControl.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            concentrationControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedConcentration = parseInt(btn.getAttribute('data-val'));
        });
    });

    // Break Size Slider
    breakSizeInput.addEventListener('input', () => {
        breakSizeVal.textContent = breakSizeInput.value;
    });

    // Font Size Slider
    fontSizeInput.addEventListener('input', () => {
        fontSizeVal.textContent = fontSizeInput.value;
        updatePreview();
    });

    // Text Input Events
    textInput.addEventListener('input', () => {
        textCounter.textContent = `${textInput.value.length}자`;
        updatePreview();
    });

    // Threshold Events
    thresholdRange.addEventListener('input', () => {
        thresholdVal.textContent = thresholdRange.value;
        renderImagePreview();
    });

    ditherToggle.addEventListener('change', () => {
        renderImagePreview();
    });

    // QR Input Events
    qrInput.addEventListener('input', updatePreview);
    qrLabelInput.addEventListener('input', updatePreview);

    // Image Upload
    dropZone.addEventListener('click', () => imageInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageFile(e.dataTransfer.files[0]);
        }
    });

    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImageFile(e.target.files[0]);
        }
    });

    function handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            return showToast('이미지 파일만 업로드할 수 있습니다.', 'error');
        }
        uploadedFile = file;
        imageOptionsBar.style.display = 'block';
        dropZone.querySelector('.drop-title').textContent = file.name;
        dropZone.querySelector('.drop-desc').textContent = `${(file.size / 1024).toFixed(1)} KB`;
        renderImagePreview();
    }

    function showCanvas() {
        placeholderPreview.style.display = 'none';
        previewCanvas.style.display = 'block';
    }

    function showPlaceholder() {
        placeholderPreview.style.display = 'block';
        previewCanvas.style.display = 'none';
    }

    // Helper to format date and time cleanly without overflowing
    function getFormattedDateTime() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${y}.${m}.${day} ${hh}:${mm}`;
    }

    function getFormattedDate() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}.${m}.${day}`;
    }

    // Core Canvas Text Rendering (WYSIWYG on 576px / 384px)
    function drawTextOnCanvas(text, baseFontSize, align) {
        if (!text || !text.trim()) {
            showPlaceholder();
            return;
        }
        showCanvas();

        const fontScale = printerWidth / 384;
        const fontSize = Math.round(baseFontSize * fontScale);
        const lineHeight = Math.round(fontSize * 1.4);
        const width = printerWidth;
        const margin = Math.round(18 * fontScale);
        const maxContentWidth = width - margin * 2;

        ctx.font = `600 ${fontSize}px "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Apple Color Emoji", sans-serif`;

        const rawLines = text.split('\n');
        const lines = [];
        for (const line of rawLines) {
            if (!line) {
                lines.push('');
                continue;
            }
            let cur = '';
            for (const char of line) {
                const test = cur + char;
                if (ctx.measureText(test).width <= maxContentWidth) {
                    cur = test;
                } else {
                    lines.push(cur);
                    cur = char;
                }
            }
            if (cur) lines.push(cur);
        }

        const totalHeight = Math.max(80, lines.length * lineHeight + margin * 2);
        previewCanvas.width = width;
        previewCanvas.height = totalHeight;

        // White paper background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, totalHeight);

        // Black thermal text
        ctx.fillStyle = '#000000';
        ctx.font = `600 ${fontSize}px "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Apple Color Emoji", sans-serif`;
        ctx.textBaseline = 'top';

        let y = margin;
        for (const l of lines) {
            let x = margin;
            if (align === 'center') {
                const w = ctx.measureText(l).width;
                x = margin + (maxContentWidth - w) / 2;
            } else if (align === 'right') {
                const w = ctx.measureText(l).width;
                x = margin + (maxContentWidth - w);
            }
            ctx.fillText(l, x, y);
            y += lineHeight;
        }
    }

    function renderTextPreview() {
        drawTextOnCanvas(textInput.value, parseInt(fontSizeInput.value), selectedAlign);
    }

    // Image Preview Rendering with B/W Threshold / Dithering
    function renderImagePreview() {
        if (!uploadedFile) {
            showPlaceholder();
            return;
        }
        showCanvas();

        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.onload = () => {
                const width = printerWidth;
                const scale = width / img.width;
                const height = Math.round(img.height * scale);

                previewCanvas.width = width;
                previewCanvas.height = height;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                const imgData = ctx.getImageData(0, 0, width, height);
                const data = imgData.data;
                const threshold = parseInt(thresholdRange.value);
                const useDither = ditherToggle.checked;

                if (useDither) {
                    const gray = new Float32Array(width * height);
                    for (let i = 0; i < data.length; i += 4) {
                        gray[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    }

                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const idx = y * width + x;
                            const oldVal = gray[idx];
                            const newVal = oldVal < threshold ? 0 : 255;
                            gray[idx] = newVal;
                            const err = oldVal - newVal;

                            if (x + 1 < width) gray[idx + 1] += err * (7 / 16);
                            if (x - 1 >= 0 && y + 1 < height) gray[(y + 1) * width + (x - 1)] += err * (3 / 16);
                            if (y + 1 < height) gray[(y + 1) * width + x] += err * (5 / 16);
                            if (x + 1 < width && y + 1 < height) gray[(y + 1) * width + (x + 1)] += err * (1 / 16);
                        }
                    }

                    for (let i = 0; i < gray.length; i++) {
                        const val = gray[i];
                        const offset = i * 4;
                        data[offset] = val;
                        data[offset + 1] = val;
                        data[offset + 2] = val;
                    }
                } else {
                    for (let i = 0; i < data.length; i += 4) {
                        const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        const val = luminance < threshold ? 0 : 255;
                        data[i] = val;
                        data[i + 1] = val;
                        data[i + 2] = val;
                    }
                }

                ctx.putImageData(imgData, 0, 0);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(uploadedFile);
    }

    // QR Preview
    function renderQrPreview() {
        const text = qrInput.value.trim();
        const label = qrLabelInput.value.trim();
        if (!text) {
            showPlaceholder();
            return;
        }
        showCanvas();

        const qrImg = new Image();
        qrImg.crossOrigin = 'Anonymous';
        qrImg.onload = () => {
            const width = printerWidth;
            const qrSize = Math.round(width * 0.88);
            const labelHeight = label ? 48 : 0;
            const totalHeight = qrSize + labelHeight + 30;

            previewCanvas.width = width;
            previewCanvas.height = totalHeight;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, totalHeight);

            const x = (width - qrSize) / 2;
            ctx.drawImage(qrImg, x, 15, qrSize, qrSize);

            if (label) {
                ctx.fillStyle = '#000000';
                ctx.font = `600 ${Math.round(20 * (width / 384))}px "Pretendard", sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(label, width / 2, qrSize + 32);
            }
        };
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(text)}`;
    }

    // Template Presets with optimal 304 DPI / 576px line lengths (no awkward wrapping)
    const TEMPLATE_PRESETS = {
        receipt: {
            align: 'center',
            fontSize: 24,
            getText: () => `[ ☕️ 코드 카페 ]
일시: ${getFormattedDateTime()}
======================
아메리카노 (Ice)   4,500
카페 라떼 (Hot)     5,000
초코 쿠키           2,500
======================
합계 금액: 12,000원

감사합니다. 또 방문해 주세요!`
        },
        todo: {
            align: 'left',
            fontSize: 24,
            getText: () => `=== 📋 오늘의 할 일 ===
날짜: ${getFormattedDate()}
----------------------
□ 오전 팀 회의 참석
□ 기획서 피드백 검토
□ PeriPage 출력 테스트
□ 저녁 운동 및 독서
----------------------
오늘도 멋진 하루 되세요!`
        },
        quote: {
            align: 'center',
            fontSize: 24,
            getText: () => `"가장 훌륭한 코드는
더 이상 뺄 것이 없는 코드이다."

- Antoine de Saint-Exupéry`
        },
        label: {
            align: 'center',
            fontSize: 24,
            getText: () => `[ 🏷️ 상품 정보 라벨 ]
----------------------
품명: 프리미엄 드립백
원산지: 에티오피아 예가체프
제조일: ${getFormattedDate()}
----------------------
판매가: 9,000원`
        }
    };

    function insertAtCursor(textarea, textToInsert) {
        if (!textarea) return;
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const val = textarea.value;
        textarea.value = val.substring(0, start) + textToInsert + val.substring(end);
        const newPos = start + textToInsert.length;
        textarea.selectionStart = textarea.selectionEnd = newPos;
        textarea.focus();
        if (templateCounter) templateCounter.textContent = `${textarea.value.length}자`;
        renderTemplatePreview();
    }

    function loadTemplatePreset(tmplKey) {
        const preset = TEMPLATE_PRESETS[tmplKey] || TEMPLATE_PRESETS.receipt;
        if (templateText) {
            templateText.value = preset.getText();
            if (templateCounter) templateCounter.textContent = `${templateText.value.length}자`;
        }
        if (templateFontSizeInput) {
            templateFontSizeInput.value = preset.fontSize;
            if (templateFontSizeVal) templateFontSizeVal.textContent = preset.fontSize;
        }
        selectedTemplateAlign = preset.align;
        if (templateAlignControl) {
            templateAlignControl.querySelectorAll('.segment-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-align') === preset.align);
            });
        }
        renderTemplatePreview();
    }

    function renderTemplatePreview() {
        if (!templateText) return;
        const baseFontSize = parseInt(templateFontSizeInput?.value || 24);
        drawTextOnCanvas(templateText.value, baseFontSize, selectedTemplateAlign);
    }

    function setupTemplates() {
        // Preset Chips
        document.querySelectorAll('.template-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.template-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentTemplate = chip.getAttribute('data-tmpl');
                loadTemplatePreset(currentTemplate);
            });
        });

        // Template Text Editing
        if (templateText) {
            templateText.addEventListener('input', () => {
                if (templateCounter) templateCounter.textContent = `${templateText.value.length}자`;
                renderTemplatePreview();
            });
        }

        // Font Size Slider
        if (templateFontSizeInput) {
            templateFontSizeInput.addEventListener('input', () => {
                if (templateFontSizeVal) templateFontSizeVal.textContent = templateFontSizeInput.value;
                renderTemplatePreview();
            });
        }

        // Align Segmented Control
        if (templateAlignControl) {
            templateAlignControl.querySelectorAll('.segment-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    templateAlignControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    selectedTemplateAlign = btn.getAttribute('data-align');
                    renderTemplatePreview();
                });
            });
        }

        // Quick Toolbar buttons
        if (btnInsertDate) {
            btnInsertDate.addEventListener('click', () => insertAtCursor(templateText, getFormattedDateTime()));
        }
        if (btnInsertDoubleLine) {
            btnInsertDoubleLine.addEventListener('click', () => insertAtCursor(templateText, '\n======================\n'));
        }
        if (btnInsertDashLine) {
            btnInsertDashLine.addEventListener('click', () => insertAtCursor(templateText, '\n----------------------\n'));
        }
        if (btnInsertCheck) {
            btnInsertCheck.addEventListener('click', () => insertAtCursor(templateText, '□ '));
        }
        if (btnResetTemplate) {
            btnResetTemplate.addEventListener('click', () => loadTemplatePreset(currentTemplate));
        }

        // Initial Load
        loadTemplatePreset(currentTemplate);
    }

    // Unified Preview Update
    function updatePreview() {
        if (currentTab === 'tab-text') {
            renderTextPreview();
        } else if (currentTab === 'tab-image') {
            renderImagePreview();
        } else if (currentTab === 'tab-qr') {
            renderQrPreview();
        } else if (currentTab === 'tab-template') {
            renderTemplatePreview();
        }
    }

    // Print Action Handler
    btnPrint.addEventListener('click', async () => {
        const mac = macInput.value.trim();
        if (!mac) return showToast('MAC 주소를 입력해주세요.', 'error');

        const breakSize = parseInt(breakSizeInput.value);
        const concentration = selectedConcentration;

        btnPrint.disabled = true;
        printSpinner.style.display = 'inline-block';
        printIcon.style.display = 'none';
        printBtnText.textContent = '프린터로 전송 중...';

        try {
            let res;
            if (currentTab === 'tab-text' || currentTab === 'tab-template') {
                // WYSIWYG Full-Width Print (576px / 384px)
                const blob = await new Promise(resolve => previewCanvas.toBlob(resolve, 'image/png'));
                if (!blob) throw new Error('미리보기 이미지를 생성할 수 없습니다.');

                const formData = new FormData();
                formData.append('mac', mac);
                formData.append('file', blob, 'rendered_canvas.png');
                formData.append('concentration', concentration);
                formData.append('break_size', breakSize);
                formData.append('dither', 'false');
                formData.append('model', printerModel);

                res = await fetch('/api/print/image', {
                    method: 'POST',
                    body: formData
                });
            } else if (currentTab === 'tab-image') {
                if (!uploadedFile) throw new Error('업로드된 이미지가 없습니다.');
                const formData = new FormData();
                formData.append('mac', mac);
                formData.append('file', uploadedFile);
                formData.append('concentration', concentration);
                formData.append('break_size', breakSize);
                formData.append('dither', ditherToggle.checked ? 'true' : 'false');
                formData.append('model', printerModel);

                res = await fetch('/api/print/image', {
                    method: 'POST',
                    body: formData
                });
            } else if (currentTab === 'tab-qr') {
                const text = qrInput.value.trim();
                const label = qrLabelInput.value.trim();
                if (!text) throw new Error('QR 데이터가 없습니다.');
                res = await fetch('/api/print/qr', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mac,
                        text,
                        label,
                        concentration,
                        break_size: breakSize,
                        model: printerModel,
                        width: printerWidth
                    })
                });
            }

            const data = await res.json();
            if (data.success) {
                showToast(data.message || '인쇄가 완료되었습니다!', 'success');
            } else {
                showToast('인쇄 실패: ' + data.error, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btnPrint.disabled = false;
            printSpinner.style.display = 'none';
            printIcon.style.display = 'inline-block';
            printBtnText.textContent = '지금 인쇄하기';
        }
    });

    // Initialize
    setupTemplates();
    updatePreview();

    // If MAC is saved, check status. If empty (e.g. Incognito mode), trigger auto-scan
    if (macInput.value.trim()) {
        setTimeout(checkDeviceStatus, 800);
    } else {
        statusText.textContent = '기기 검색 필요';
        setTimeout(() => {
            if (!macInput.value.trim() && btnScanDevices) {
                btnScanDevices.click();
            }
        }, 500);
    }
});
