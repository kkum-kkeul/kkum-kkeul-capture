document.addEventListener("DOMContentLoaded", function () {
  const elements = {
    video: document.getElementById("videoElement"),
    startButton: document.getElementById("start-button"),
    capturedImagesDiv: document.getElementById("capturedImages"),
    gifPreview: document.getElementById("gifPreview"),
    cameraToggleButton: document.getElementById("camera-toggle-button"),
    stopwatchArea: document.getElementById("stopwatch-area"),
    progressBar: document.getElementById("progress-bar"),
    progressBarInner: document.getElementById("progress-bar-inner"),
    errorText: document.getElementById("errorText"),
    completeButton: document.getElementById("complete-button"),
    shareButton: document.getElementById("share-button"),
    challengeTimeInput: document.getElementById("challenge-time-input"),
    blurController: document.getElementById("blur-controller"),
  };

  const constants = {
    blurValue: 'blur(10px)',
    canvasWidth: 400,
    canvasHeight: 300,
    maxGifImages: 100,
    totalGifDuration: 5000,
  };

  const state = {
    isBlurOn: true,
    capturedImages: [],
    isFacingFront: false,
    stopWatchIntervalId: null,
    progressBarIntervalId: null,
    captureIntervalId: null,
    globalStopWatch: '00:00:00',
    fileName: 'timelapse.gif',
    globalBlob: null,
    stream: null,
    globalMinutes: 0,
    globalPercentage: 0,
    globalStartTime: null,
  };

  setViewportHeight();
  window.addEventListener('resize', setViewportHeight);
  initializeEventListeners();

  if (!isInAppBrowser()) {
    startMediaStream();
    initializeCompleteButton();
    hideInitialElements();
  } else {
    goToOutBrowser();
    window.close();
  }

  function setViewportHeight() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }

  function initializeEventListeners() {
    elements.startButton.addEventListener("click", onStartButtonClick);
    elements.shareButton.addEventListener("click", onShareButtonClick);
    elements.cameraToggleButton.addEventListener("click", onCameraToggleClick);
    document.querySelectorAll(".toggleSwitch").forEach(toggle => toggle.addEventListener("click", onBlurToggleClick));
  }

  function onStartButtonClick() {
    const inputMinutes = document.getElementById("input-minutes").value;
    if (inputMinutes) {
      resetUIForChallenge();
      startCountingAndCapture(inputMinutes);
    } else {
      showInfoMessage("도전 시간을 입력해주세요!");
    }
  }

  function onShareButtonClick() {
    if (navigator.share && navigator.canShare) {
      const gifBlob = new Blob([state.globalBlob], { type: 'image/gif' });
      const gifFile = new File([gifBlob], 'timelapse.gif', { type: 'image/gif' });
      navigator.share({ files: [gifFile] }).catch(error => {});
    } else {
      alert('파일 공유를 지원하지 않는 브라우저입니다.');
    }
  }

  function onCameraToggleClick() {
    state.isFacingFront = !state.isFacingFront;
    startMediaStream();
  }

  function onBlurToggleClick() {
    state.isBlurOn = !this.classList.toggle('active');
    elements.video.style.filter = state.isBlurOn ? constants.blurValue : "blur(0px)";
  }

  function resetUIForChallenge() {
    state.capturedImages = [];
    elements.gifPreview.src = "";
    elements.gifPreview.style.display = "none";
    elements.capturedImagesDiv.innerHTML = "";
    elements.errorText.innerHTML = "";
    elements.completeButton.style.display = "none";
    elements.challengeTimeInput.style.display = "none";
    elements.stopwatchArea.style.display = "block";
    elements.progressBarInner.style.display = "flex";
    elements.progressBar.style.display = "block";
    elements.completeButton.style.display = "block";
    hideBlurController();
  }

  function startCountingAndCapture(minutes) {
    const totalSeconds = minutes * 60;
    state.globalMinutes = minutes;
    state.globalStartTime = Date.now();

    updateProgressBar(0, totalSeconds);

    state.stopWatchIntervalId = setInterval(updateStopWatch, 500);
    state.progressBarIntervalId = setInterval(() => updateProgressBar(Date.now() - state.globalStartTime, totalSeconds), 100);
    state.captureIntervalId = setInterval(captureImage, 10);
  }

  function updateStopWatch() {
    const elapsedMilliseconds = Date.now() - state.globalStartTime;
    const secondsElapsed = Math.floor(elapsedMilliseconds / 1000);
    const hours = Math.floor(secondsElapsed / 3600);
    const minutes = Math.floor((secondsElapsed % 3600) / 60);
    const seconds = secondsElapsed % 60;

    state.globalStopWatch = formatTime(hours, minutes, seconds);
    elements.stopwatchArea.textContent = state.globalStopWatch;
  }

  function updateProgressBar(elapsedMilliseconds, totalSeconds) {
    const progressPercentage = (elapsedMilliseconds / (totalSeconds * 1000)) * 100;
    state.globalPercentage = progressPercentage;

    elements.progressBarInner.textContent = `${state.globalMinutes}분(${Math.floor(progressPercentage)}%)`;
    elements.progressBarInner.style.width = `${Math.min(progressPercentage, 100)}%`;

    elements.completeButton.disabled = false;
  }

  function initializeCompleteButton() {
    elements.completeButton.disabled = true;
    elements.completeButton.addEventListener("click", onCompleteButtonClick);
  }

  function onCompleteButtonClick() {
    clearInterval(state.stopWatchIntervalId);
    clearInterval(state.captureIntervalId);
    clearInterval(state.progressBarIntervalId);
    createGif();
    elements.completeButton.disabled = true;
  }

  function captureImage() {
    const canvas = document.createElement("canvas");
    canvas.width = constants.canvasWidth;
    canvas.height = constants.canvasHeight;
    const context = canvas.getContext("2d");

    context.drawImage(elements.video, 0, 0, constants.canvasWidth, constants.canvasHeight);
    applyBlur(context, canvas);
    addWatermark(context);

    try {
      const imageDataURL = canvas.toDataURL("image/png");
      const blob = dataURLToBlob(imageDataURL);
      state.capturedImages.push(blob);
    } catch (error) {
      showInfoMessage("이미지 캡처 중 오류가 발생했습니다: " + error);
    }
  }

  function applyBlur(context, canvas) {
    if (state.isBlurOn) {
      StackBlur.canvasRGB(canvas, 0, 0, constants.canvasWidth, constants.canvasHeight, 10);
    }
    context.filter = "none";
  }

  function addWatermark(context) {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const watermarkTextTop = "🔥작심한달🔥";
    const watermarkTextMiddle = `${currentTime}`;
    const watermarkTextBottom = `[ ⏱️ ${state.globalStopWatch} ]`;
    const watermarkProgress = `목표시간 : ${state.globalMinutes}분 (${Math.floor(state.globalPercentage)}%)`;

    context.font = "25px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "white";

    const lineHeight = 40;
    context.fillText(watermarkTextTop, constants.canvasWidth / 2, constants.canvasHeight / 2 - lineHeight * 2);
    context.fillText(watermarkTextMiddle, constants.canvasWidth / 2, constants.canvasHeight / 2 - lineHeight);
    context.fillText(watermarkTextBottom, constants.canvasWidth / 2, constants.canvasHeight / 2);
    context.fillText(watermarkProgress, constants.canvasWidth / 2, constants.canvasHeight / 2 + lineHeight * 2);
  }

  function hideBlurController() {
    elements.blurController.style.display = "none";
  }

  function createGif() {
    showInfoMessage("gif 파일을 만드는 중 입니다.");
    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: "./gif.worker.js",
      width: constants.canvasWidth,
      height: constants.canvasHeight,
    });

    const imagesToUse = selectImagesForGif();

    if (imagesToUse.length === 0) {
      showInfoMessage("gif 이미지를 선별에 실패했습니다.");
      return;
    }

    const delay = Math.floor(constants.totalGifDuration / imagesToUse.length);
    const imagePromises = imagesToUse.map(loadImageFromBlob);

    Promise.all(imagePromises)
      .then(images => {
        showInfoMessage("gif 파일을 만드는 중 입니다..");
        images = images.filter(image => image !== null);
        images.forEach((image, index) => gif.addFrame(image, { delay: index === 0 ? 3000 : delay }));
        showInfoMessage(`총 ${imagesToUse.length}장의 이미지를 gif로 합치는 중..`);
        gif.on("finished", onGifCreationFinished);
        gif.render();
      })
      .catch(error => showInfoMessage(`Failed to create gif: ${error}`));
  }

  function selectImagesForGif() {
    const numImages = state.capturedImages.length;
    const step = Math.max(1, Math.floor(numImages / constants.maxGifImages));
    const imagesToUse = state.capturedImages.filter((_, index) => index % step === 0);
    imagesToUse.push(state.capturedImages[state.capturedImages.length - 1]);
    return imagesToUse;
  }

  function loadImageFromBlob(blob) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function () { resolve(this); };
      img.onerror = function () { resolve(null); };
      img.src = URL.createObjectURL(blob);
    });
  }

  function onGifCreationFinished(blob) {
    showInfoMessage("gif 변환이 완료되었습니다.");
    const gifURL = URL.createObjectURL(blob);
    elements.gifPreview.src = gifURL;
    elements.gifPreview.style.display = "block";
    state.globalBlob = blob;
    downloadGif(blob);
    endMediaStream();
  }

  function downloadGif(blob) {
    const url = URL.createObjectURL(blob);

    if (navigator.share && navigator.canShare) {
      elements.shareButton.style.display = "block";
      showInfoMessage('⭐️ 아이폰 : 위 [공유하기] 클릭 > 복사하기 > <br>작심한달 채팅입력창에 꾹눌러서 붙여넣기<br><br> ⭐️ 안드로이드: 위 [공유하기] 클릭 > 카카오톡 > 개인톡 공유 > 작심한달방 공유!<br>(조금 복잡하지만 현재로선 이게 최선인듯 합니다😂)<br><br>버그가 발생하면 말씀주세요! 빠르게 고쳐보겠습니다😅');
    } else {
      showInfoMessage('공유하기를 지원하지 않아 파일로 저장됩니다.<br>해당 파일을 작심한달 방에 올려주세요 :)');
      const a = document.createElement("a");
      a.href = url;
      a.download = state.fileName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  function dataURLToBlob(dataURL) {
    const [header, base64Data] = dataURL.split(";base64,");
    const contentType = header.split(":")[1];
    const raw = window.atob(base64Data);
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  }

  function showInfoMessage(message) {
    elements.errorText.innerHTML = message;
  }

  function hideInitialElements() {
    elements.stopwatchArea.style.display = "none";
    elements.progressBarInner.style.display = "none";
    elements.progressBar.style.display = "none";
    elements.completeButton.style.display = "none";
    elements.shareButton.style.display = "none";
  }

  function startMediaStream() {
    getMediaStream()
      .then(stream => {
        state.stream = stream;
        elements.video.srcObject = stream;
        elements.video.style.filter = state.isBlurOn ? constants.blurValue : "blur(0px)";
      })
      .catch(error => showInfoMessage("카메라에 접근할 수 없습니다: " + error));
  }

  function endMediaStream() {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
      elements.video.srcObject = null;
    }
  }

  function getMediaStream() {
    const constraints = { video: { facingMode: state.isFacingFront ? "user" : "environment" } };
    return navigator.mediaDevices.getUserMedia(constraints)
      .catch(() => Promise.reject(new Error("미디어 스트림을 가져올 수 없습니다.")));
  }

  function formatTime(hours, minutes, seconds) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
});
