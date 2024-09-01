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
    captureInterval: 300,
  };

  const state = {
    isBlurOn: true,
    isSoundOn: true,
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
    isNoTimeLimit: false,
    hasPlayedCelebrationSound: false,
    captureFrameNumber: 0, // 프레임 번호 초기화
  };

  const celebrationAudio = new Audio('celebration.mp3');

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
    // document.querySelectorAll(".toggleSwitch").forEach(toggle => toggle.addEventListener("click", onBlurToggleClick));
    document.getElementById('toggle-sound').addEventListener('change', onSoundToggleClick); // 추가된 이벤트 리스너
    document.getElementById('toggle-blur').addEventListener('change', onBlurToggleClick); // 추가된 이벤트 리스너

    const radioButtons = document.querySelectorAll('.radio-button');
    radioButtons.forEach(button => {
      button.addEventListener('click', () => {
        radioButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
      });
    });
  }

  function onSoundToggleClick() {
    state.isSoundOn = !state.isSoundOn;
  }

  function onStartButtonClick() {
    const selectedButton = document.querySelector('.radio-button.active');
    if (selectedButton) {
      const inputMinutes = parseFloat(selectedButton.getAttribute('data-value'));
      state.isNoTimeLimit = inputMinutes === 0;
      resetUIForChallenge();
      startCountingAndCapture(inputMinutes);
    } else {
      showInfoMessage("도전 시간을 선택해주세요!");
    }

    // 활성화를 위한 임시설정
    celebrationAudio.play();
    celebrationAudio.pause();
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
    state.captureFrameNumber = 0; // 프레임 번호 초기화
    elements.gifPreview.src = "";
    elements.gifPreview.style.display = "none";
    elements.capturedImagesDiv.innerHTML = "";
    elements.errorText.innerHTML = "";
    elements.completeButton.style.display = "none";
    elements.challengeTimeInput.style.display = "none";
    elements.stopwatchArea.style.display = "block";
    elements.progressBarInner.style.display = state.isNoTimeLimit ? "none" : "flex";
    elements.progressBar.style.display = state.isNoTimeLimit ? "none" : "block";
    elements.completeButton.style.display = "block";
    elements.completeButton.disabled = false;
    state.hasPlayedCelebrationSound = false;
    hideBlurController();
  }

  function startCountingAndCapture(minutes) {
    if (minutes == 0) {
      startCapturingWithoutTimeLimit();
    } else {
      startCapturingWithTimeLimit(minutes);
    }
  }

  function startCapturingWithoutTimeLimit() {
    state.globalStartTime = Date.now();
    state.stopWatchIntervalId = setInterval(updateStopWatch, 500);
    state.captureIntervalId = setInterval(captureImage, constants.captureInterval);
  }

  function startCapturingWithTimeLimit(minutes) {
    const totalSeconds = minutes * 60;
    state.globalMinutes = minutes;
    state.globalStartTime = Date.now();

    updateProgressBar(0, totalSeconds);

    state.stopWatchIntervalId = setInterval(updateStopWatch, 500);
    state.progressBarIntervalId = setInterval(() => updateProgressBar(Date.now() - state.globalStartTime, totalSeconds), 100);
    state.captureIntervalId = setInterval(captureImage, constants.captureInterval);
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

    if (Math.floor(progressPercentage) >= 100 && !state.hasPlayedCelebrationSound) {
      playCelebrationSoundOrVibrate();
      state.hasPlayedCelebrationSound = true;
    }

    elements.completeButton.disabled = false;
  }

  function playCelebrationSoundOrVibrate() {
    if (!state.isSoundOn) {
      return
    }

    celebrationAudio.play().catch(() => {
      triggerVibration();
    });

    if (celebrationAudio.volume === 0) {
      triggerVibration();
    }
  }

  function triggerVibration() {
    if (navigator.vibrate) {
      navigator.vibrate(2000); // 2초 동안 진동
    } else {
      console.warn("이 기기는 진동을 지원하지 않습니다.");
    }
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
      state.capturedImages.push({ blob, frameNumber: state.captureFrameNumber });
      state.captureFrameNumber++;

      if (state.capturedImages.length >= constants.maxGifImages * 2) {
        state.capturedImages = compressImages(state.capturedImages, constants.maxGifImages);
      }
    } catch (error) {
      showInfoMessage("이미지 캡처 중 오류가 발생했습니다: " + error);
    }
  }

  function compressImages(images, maxImages) {
    const numImages = images.length;
    if (numImages <= maxImages) {
      return images;
    }
  
    const totalFrames = images[images.length - 1].frameNumber - images[0].frameNumber;
    const step = totalFrames / (maxImages - 1);
    const compressedImages = [images[0]]; // 첫 번째 이미지 추가
    const frameNumbers = [images[0].frameNumber]; // 첫 번째 프레임 번호 추가
  
    let currentFrame = images[0].frameNumber + step;
    for (let i = 1; i < maxImages - 1; i++) {
      let closestImageIndex = 0;
      let closestFrameDifference = Math.abs(images[0].frameNumber - currentFrame);
  
      for (let j = 1; j < images.length; j++) {
        const frameDifference = Math.abs(images[j].frameNumber - currentFrame);
        if (frameDifference < closestFrameDifference) {
          closestFrameDifference = frameDifference;
          closestImageIndex = j;
        }
      }
  
      compressedImages.push(images[closestImageIndex]);
      frameNumbers.push(images[closestImageIndex].frameNumber);
      currentFrame += step;
    }
  
    const lastImage = images[images.length - 1];
    compressedImages.push(lastImage); // 마지막 이미지 추가
    frameNumbers.push(lastImage.frameNumber); // 마지막 프레임 번호 추가
  
    console.log("Selected frame numbers:", frameNumbers);
  
    return compressedImages;
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
    const watermarkProgress = state.isNoTimeLimit ? "목표시간 : 없음" : `목표시간 : ${state.globalMinutes}분 (${Math.floor(state.globalPercentage)}%)`;

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
    showInfoMessage("gif 파일로 변환 중이에요 :)");
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
    const imagePromises = imagesToUse.map(item => loadImageFromBlob(item.blob));

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
    const imagesToUse = compressImages(state.capturedImages, constants.maxGifImages);
    const lastImage = state.capturedImages[state.capturedImages.length - 1];
    imagesToUse.push(lastImage);
    imagesToUse.unshift(lastImage);
    return imagesToUse
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
      .then((stream) => {
        return stream;
      })
      .catch((error) => {
        console.error("Error accessing media devices.", error);
        return handleLegacyMediaDevices(constraints);
      })
      .catch(legacyError => {
        console.error("Error with legacy media devices.", legacyError);
        return enumerateDevicesAndRetry();
    });
  }

  function handleLegacyMediaDevices(constraints) {
    if (navigator.getUserMedia) {
      return new Promise((resolve, reject) => {
        navigator.getUserMedia(constraints, resolve, reject);
      });
    } else if (navigator.webkitGetUserMedia) {
      return new Promise((resolve, reject) => {
        navigator.webkitGetUserMedia(constraints, resolve, reject);
      });
    } else if (navigator.mozGetUserMedia) {
      return new Promise((resolve, reject) => {
        navigator.mozGetUserMedia(constraints, resolve, reject);
      });
    } else if (navigator.msGetUserMedia) {
      return new Promise((resolve, reject) => {
        navigator.msGetUserMedia(constraints, resolve, reject);
      });
    } else {
      return Promise.reject(new Error("미디어 스트림을 가져올 수 없습니다."));
    }
  }

  function enumerateDevicesAndRetry() {
    return navigator.mediaDevices.enumerateDevices()
        .then(devices => {
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log("Available video devices:", videoDevices);

            if (videoDevices.length === 0) {
                return Promise.reject(new Error("No video input devices found."));
            }

            let selectedDevice = null;

            // Attempt to find a suitable camera by matching labels
            selectedDevice = videoDevices.find(device =>
                state.isFacingFront ? device.label.toLowerCase().includes('front') : device.label.toLowerCase().includes('back')
            );

            if (!selectedDevice) {
                // Fall back to the first available device if specific front/back label is not found
                selectedDevice = videoDevices[0];
            }

            console.log("Selected device:", selectedDevice);

            // First attempt: Use deviceId directly
            const firstAttemptConstraints = { video: { deviceId: { exact: selectedDevice.deviceId } } };
            return navigator.mediaDevices.getUserMedia(firstAttemptConstraints);
        })
        .catch(error => {
            console.error("First attempt failed with deviceId, retrying without deviceId.", error);

            // Second attempt: Fallback without deviceId
            const fallbackConstraints = { video: true };
            return navigator.mediaDevices.getUserMedia(fallbackConstraints);
        })
        .catch(error => {
            console.error("Second attempt failed without deviceId, retrying with basic constraints.", error);

            // Third attempt: Basic video constraints (minimal configuration)
            const basicConstraints = { video: {} };
            return navigator.mediaDevices.getUserMedia(basicConstraints);
        })
        .then(stream => {
            // If successful, determine which camera is in use
            const activeDeviceId = stream.getVideoTracks()[0].getSettings().deviceId;
            state.isFacingFront = videoDevices.some(device => 
                device.deviceId === activeDeviceId && device.label.toLowerCase().includes('front')
            );
            return stream;
        })
        .catch(error => {
            console.error("All attempts failed to access the camera.", error);
            showInfoMessage("Unable to access the camera after multiple attempts: " + error.message);
            return Promise.reject(error); // Final error after all retries
        });
  }

  function formatTime(hours, minutes, seconds) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
});
