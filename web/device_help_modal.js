// Shared device connection help modal (Text/File pages)
// - Creates modal DOM on demand (so HTML stays minimal)
// - Wires open/close interactions

function ensureOverlay(variant) {
  let overlay = document.getElementById('deviceHelpOverlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'deviceHelpOverlay';
  overlay.className = 'modalOverlay';
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="deviceHelpTitle">
      <div class="modalHeader">
        <h3 id="deviceHelpTitle" class="modalTitle">장치 연결(페어링/본딩) 가이드</h3>
        <button id="btnDeviceHelpClose" class="helpIconButton" type="button" aria-label="닫기" title="닫기">✕</button>
      </div>
      <div class="modalBody">
        <p class="muted small" style="margin-top: 0;">
          보안 설정상, 이 장치는 <b>암호화된 BLE 링크(페어링/본딩 이후)</b>에서만 전송이 가능합니다.
          아래 순서대로 1회만 OS에서 페어링해두면, 이후에는 웹에서 바로 연결됩니다.
        </p>

        <ol class="modalSteps">
          <li>
            <div class="modalStepTitle">Windows 설정 → Bluetooth 및 장치 → 장치 추가</div>
            <img class="modalStepImage" src="../docs/bt_conn_0.png" alt="장치 추가 진입" loading="lazy" />
          </li>
          <li>
            <div class="modalStepTitle">추가할 디바이스 유형에서 <b>Bluetooth</b> 선택</div>
            <img class="modalStepImage" src="../docs/bt_conn_1.png" alt="디바이스 유형 선택" loading="lazy" />
          </li>
          <li>
            <div class="modalStepTitle">목록에서 <b>ByteFlusher-xxxx</b> 선택(연결/페어링 진행)</div>
            <img class="modalStepImage" src="../docs/bt_conn_2.png" alt="장치 목록에서 ByteFlusher 선택" loading="lazy" />
          </li>
          <li>
            <div class="modalStepTitle">Windows에 <b>페어링됨</b>으로 표시되면 OK</div>
            <div class="muted small" style="margin: 6px 0 0;">
              ※ Windows 설정에서 "연결됨"이 안 떠도 정상입니다(실제 연결은 브라우저가 수행).
            </div>
            <img class="modalStepImage" src="../docs/bt_conn_3.png" alt="페어링됨 확인" loading="lazy" />
          </li>
          <li>
            <div class="modalStepTitle">웹에서 <b>장치 연결</b> 클릭(필요 시 OS 팝업 허용)</div>
            <img class="modalStepImage" src="../docs/bt_conn_4.png" alt="웹에서 페어링/권한 팝업" loading="lazy" />
          </li>
          <li>
            <div class="modalStepTitle">상태가 <b>연결됨</b>이면 전송 테스트 진행</div>
            <img class="modalStepImage" src="../docs/bt_conn_5.png" alt="연결됨 상태 확인" loading="lazy" />
          </li>
        </ol>
        <div class="muted small" style="margin-top: 8px;">
          안 될 때: Windows에서 장치 <b>제거</b> → Bluetooth OFF/ON → 다시 페어링 → 브라우저 재시도.
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

let scrollLockState = null;

function lockScroll() {
  if (scrollLockState) return;

  const body = document.body;
  const html = document.documentElement;

  // Reserve space for the scrollbar to avoid layout shift when overflow is hidden.
  const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
  const prevBodyOverflow = body.style.overflow;
  const prevHtmlOverflow = html.style.overflow;
  const prevBodyPaddingRight = body.style.paddingRight;
  const computedPaddingRight = Number.parseFloat(getComputedStyle(body).paddingRight || '0') || 0;

  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
  }

  scrollLockState = {
    prevBodyOverflow,
    prevHtmlOverflow,
    prevBodyPaddingRight,
  };
}

function unlockScroll() {
  if (!scrollLockState) return;
  const body = document.body;
  const html = document.documentElement;
  body.style.overflow = scrollLockState.prevBodyOverflow;
  html.style.overflow = scrollLockState.prevHtmlOverflow;
  body.style.paddingRight = scrollLockState.prevBodyPaddingRight;
  scrollLockState = null;
}

function openOverlay(overlay) {
  overlay.hidden = false;
  lockScroll();
}

function closeOverlay(overlay) {
  overlay.hidden = true;
  unlockScroll();
}

export function wireDeviceHelpModal({ variant }) {
  const v = variant === 'files' ? 'files' : 'text';
  const btn = document.getElementById('btnDeviceHelp');
  if (!btn) return;

  const overlay = ensureOverlay(v);
  const closeBtn = overlay.querySelector('#btnDeviceHelpClose');

  btn.addEventListener('click', () => {
    openOverlay(overlay);
    // Focus close button for keyboard users.
    if (closeBtn instanceof HTMLElement) closeBtn.focus();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeOverlay(overlay);
    });
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay(overlay);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (overlay.hidden) return;
    closeOverlay(overlay);
  });
}
