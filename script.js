document.addEventListener("DOMContentLoaded", function () {
  const video = document.getElementById("videoElement");
  const startButton = document.getElementById("start-button");
  const capturedImagesDiv = document.getElementById("capturedImages");
  const gifPreview = document.getElementById("gifPreview");
  const cameraToggleButton = document.getElementById("camera-toggle-button");
  const stopwatchArea = document.getElementById("stopwatch-area");
  const progressBar = document.getElementById("progress-bar");
  const progressBarInner = document.getElementById("progress-bar-inner");
  const errorText = document.getElementById("errorText");
  const completeButton = document.getElementById("complete-button");
  const shareButton = document.getElementById("share-button");
  const challengeTimeInput = document.getElementById("challenge-time-input"); // 수정: challenge-time-input 요소 추가

  const blurController = document.getElementById("blur-controller");
  const blurConstant = 'blur(10px)';

  let isBlurOn = true;
  let capturedImages = [];
  let isFacingFront = false;
  let stopWatchIntervalId;
  let progressBarIntervalId;
  let captureIntervalId;
  let globalStopWatch = '00:00:00';
  let fileName;
  let globalBlob;
  let stream = null;
  let globalMinutes;
  let globalPercentage;
  let globalStartTime;


  let vh = window.innerHeight * 0.01;
  // Then we set the value in the --vh custom property to the root of the document
  document.documentElement.style.setProperty('--vh', `${vh}px`);

  // We listen to the resize event
  window.addEventListener('resize', () => {
    // We execute the same script as before
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  });

  function getMediaStream() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const constraints = { video: { facingMode: isFacingFront ? "user" : "environment" } };
      return navigator.mediaDevices.getUserMedia(constraints);
    } else if (navigator.getUserMedia) {
      const constraints = { video: { facingMode: { exact: isFacingFront ? "user" : "environment" } } };
      return new Promise(function (resolve, reject) {
        navigator.getUserMedia(constraints, resolve, reject);
      });
    } else {
      return Promise.reject(new Error("미디어 스트림을 가져올 수 없습니다."));
    }
  }

  function startMediaStream() {
    getMediaStream()
      .then(function (src) {
        stream = src;
        video.srcObject = stream;
        if (isBlurOn) {
          video.style.filter = blurConstant;
        } else {
          video.style.filter = "blur(" + 0 + "px)";
        }
      })
      .catch(function (error) {
        showInfoMessage("카메라에 접근할 수 없습니다: " + error);
      });
  }

  function endMediaStream() {
    if (stream) {
      const tracks = stream.getTracks();

      tracks.forEach(function (track) {
        track.stop();
      });

      video.srcObject = null;
    }
  }

  startButton.addEventListener("click", function () {
    const inputMinutes = document.getElementById("input-minutes").value;
    if (inputMinutes) {
      capturedImages = [];
      gifPreview.src = "";
      gifPreview.style.display = "none";
      capturedImagesDiv.innerHTML = "";
      errorText.innerHTML = "";
      completeButton.style.display = "none";
      challengeTimeInput.style.display = "none"; // 수정: challenge-time-input 숨김
      stopwatchArea.style.display = "block";
      progressBarInner.style.display = "flex";
      progressBar.style.display = "block";
      completeButton.style.display = "block"
      startCountingAndCapture(inputMinutes);
      hideBlurController();
    } else {
      showInfoMessage("도전 시간을 입력해주세요!");
    }
  });

  
  shareButton.addEventListener("click", function () {
    if (navigator.share && navigator.canShare) {
      const gifBlob = new Blob([globalBlob], { type: 'image/gif' });
      const gifFile = new File([gifBlob], 'timelapse.gif', { type: 'image/gif' });
  

      navigator.share({ files: [gifFile] })
        .then(() => {
          
        })
        .catch((error) => {
          // showInfoMessage(`파일 공유 실패: ${error}`);
        });
    } else {
      alert('파일 공유를 지원하지 않는 브라우저입니다.');
    }
  }
  );

  cameraToggleButton.addEventListener("click", function () {
    isFacingFront = !isFacingFront;
    startMediaStream();
  });

  function startCountingAndCapture(minutes) {
    const totalSeconds = minutes * 60;
    globalMinutes = minutes;
  
    progressBarInner.textContent = "0%";
    progressBarInner.style.width = "0%";
  
    globalStartTime = Date.now(); // 시작 시간 저장
  
    // 스톱워치 업데이트
    stopWatchIntervalId = setInterval(function () {
      const elapsedMilliseconds = Date.now() - globalStartTime; // 경과 시간 계산
      const secondsElapsed = Math.floor(elapsedMilliseconds / 1000); // 초 단위로 변환
      const hours = Math.floor(secondsElapsed / 3600);
      const minutes = Math.floor((secondsElapsed % 3600) / 60);
      const seconds = secondsElapsed % 60;
  
      globalStopWatch = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  
      stopwatchArea.textContent = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }, 500);
  
    progressBarIntervalId = setInterval(function () {
      const elapsedMilliseconds = Date.now() - globalStartTime; // 경과 시간 계산
      const progressPercentage = (elapsedMilliseconds / (totalSeconds * 1000)) * 100;
      globalPercentage = progressPercentage;
      progressBarInner.textContent = `${minutes}분(${Math.floor(progressPercentage)}%)`;
    
      const progressBarWidth = Math.min(progressPercentage, 100);
      completeButton.disabled = false;
    
      progressBarInner.style.width = `${progressBarWidth}%`;
    }, 100); 
  
    captureIntervalId = setInterval(function () {
      captureImage();
    }, 10);
  }

  function initCompleteButton() {
    completeButton.disabled = true;
    completeButton.addEventListener("click", function () {
      clearInterval(stopWatchIntervalId);
      clearInterval(captureIntervalId); 
      clearInterval(progressBarIntervalId);
      createGif();
      completeButton.disabled = true;
    });
  }

  const toggleList = document.querySelectorAll(".toggleSwitch");

  toggleList.forEach(($toggle) => {
    $toggle.onclick = () => {
      const isActive = !$toggle.classList.toggle('active');
      isBlurOn = isActive;
      if (isActive) {
        // videoElement의 스타일 속성 업데이트
        video.style.filter = blurConstant;
      } else {
        video.style.filter = "blur(" + 0 + "px)";
      }
    }
  });

  function captureImage() {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 300;
    const context = canvas.getContext("2d");

    context.drawImage(video, 0, 0, 400, 300);

    if (isBlurOn) {
      var radius = 10;
      StackBlur.canvasRGB(canvas, 0, 0, 400, 300, radius);
    }

    context.filter = "none";

    // Adding watermark
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
    const watermarkTextBottom = `[ ⏱️ ${globalStopWatch} ]`;
    const watermarkProgress = `목표시간 : ${globalMinutes}분 (${Math.floor(globalPercentage)}%)`;

    context.font = "25px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "white"

    const lineHeight = 40; // 텍스트 줄 사이의 간격을 조절하기 위한 값
    context.fillText(watermarkTextTop, canvas.width / 2, canvas.height / 2 - lineHeight * 2);
    context.fillText(watermarkTextMiddle, canvas.width / 2, canvas.height / 2 - lineHeight);
    context.fillText(watermarkTextBottom, canvas.width / 2, canvas.height / 2);
    context.fillText(watermarkProgress, canvas.width / 2, canvas.height / 2 + lineHeight * 2);

    try {
      const imageDataURL = canvas.toDataURL("image/png");
      const blob = dataURLToBlob(imageDataURL+ "33");
      capturedImages.push(blob);
    } catch (error) {
      showInfoMessage("이미지 캡처 중 오류가 발생했습니다: " + error);
    }
  }

  function hideBlurController() {
    blurController.style.display = "none";
  }

  function createGif() {
    try {
    showInfoMessage("gif 파일을 만드는 중 입니다.")
    const maxImages = 100;
    const totalGifDurationMs = 5000;
    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: "./gif.worker.js",
      width: 400,
      height: 300
    });

    const numImages = capturedImages.length;
    const step = Math.max(1, Math.floor(numImages / (maxImages)));
    const imagesToUse = [];

    for (let i = 0; i < numImages; i += step) {
      imagesToUse.push(capturedImages[i]);
    }

    if (imagesToUse.length == 0) {
      showInfoMessage("gif 이미지를 선별에 실패했습니다.");
      return;
    }

    // 마지막 프레임을 추가
    captureImage()
    imagesToUse.push(capturedImages[capturedImages.length - 1]);
    imagesToUse.unshift(capturedImages[capturedImages.length - 1]); // 썸네일용이미지도 맨앞에 추가.

    const delay = Math.floor(totalGifDurationMs / imagesToUse.length);
    
    // 이하 코드는 동일



    const imagePromises = imagesToUse.map(function (blob) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function () {
          resolve(this);
        };
        img.onerror = function (event) {
          showInfoMessage(`Image load failed: ${event}`);
          resolve(null);  // instead of rejecting, we resolve with null
        };
        img.src = URL.createObjectURL(blob);
      });
    });

    Promise.all(imagePromises)
      .then((images) => {
        showInfoMessage("gif 파일을 만드는 중 입니다..");
        images = images.filter(image => image !== null);
        images.forEach((image, index) => {
          const isFirstFrame =  index === 0;
          const frameDelay = isFirstFrame ? 3000 : delay; // 마지막 프레임이면 3초, 아니면 계산된 delay 값을 사용
  
          gif.addFrame(image, { delay: frameDelay });
        });

        showInfoMessage(`총 ${imagesToUse.length}장의 이미지를 gif로 합치는 중..`);

        gif.on("finished", function (blob) {
          showInfoMessage("gif 변환이 완료되었습니다.")
          const gifURL = URL.createObjectURL(blob);
          gifPreview.src = gifURL;
          gifPreview.style.display = "block";
          globalBlob = blob;
          downloadGif(blob);
          endMediaStream();
        });

        gif.render();
      })
      .catch((error) => {
        showInfoMessage(`Failed to creat gif: ${error}`);
      });
    } catch(error) {
        showInfoMessage(`Error in createGif(): ${error}`)
    }
  }

  function downloadGif(blob) {

    fileName = 'timelapse.gif';
    url = URL.createObjectURL(blob);

    if (navigator.share && navigator.canShare) {
      shareButton.style.display = "block";
      showInfoMessage('⭐️ 아이폰 : 위 [공유하기] 클릭 > 복사하기 > <br>작심한달 채팅입력창에 꾹눌러서 붙여넣기<br><br> ⭐️ 안드로이드: 위 [공유하기] 클릭 > 카카오톡 > 개인톡 공유 > 작심한달방 공유!<br>(조금 복잡하지만 현재로선 이게 최선인듯 합니다😂)<br><br>버그가 발생하면 말씀주세요! 빠르게 고쳐보겠습니다😅')
    } else {
      showInfoMessage('공유하기를 지원하지 않아 파일로 저장됩니다.<br>해당 파일을 작심한달 방에 올려주세요 :)');
      // 대체 동작을 수행하거나 경고 메시지를 표시할 수 있습니다.

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  function dataURLToBlob(dataURL) {
    const parts = dataURL.split(";base64,");
    const contentType = parts[0].split(":")[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  }

  function showInfoMessage(message) {
    errorText.innerHTML = message;
  }

  var useragt = navigator.userAgent.toLowerCase();
  if (isInAppBrowser() != true) {
    startMediaStream();
    stopwatchArea.style.display = "none";
    progressBarInner.style.display = "none";
    progressBar.style.display = "none";
    completeButton.style.display = "none";
    shareButton.style.display = "none";
    initCompleteButton();
  }
  else {
    goToOutBrowser();
    window.close();

  }
});
