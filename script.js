const uploadBtn = document.getElementById("uploadBtn");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("canvas");
const resultsEl = document.getElementById("results");

// Hidden file input
const imageInput = document.createElement("input");
imageInput.type = "file";
imageInput.accept = "image/*";

// MediaPipe Pose
const pose = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
pose.onResults(onResults);

// Click triggers hidden file input
uploadBtn.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  statusEl.textContent = "Processing image...";
  resultsEl.textContent = "";

  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    pose.send({image: canvas});
  };
  img.src = URL.createObjectURL(file);
  canvas.style.display = "block";
});

// --- Helper functions ---

function extractKeyLandmarks(landmarks, width, height) {
  const keypoints = {
    nose: 0, wrist_l: 15, wrist_r: 16,
    shoulder_l: 11, shoulder_r: 12,
    l_elbow: 13, r_elbow: 14,
    hip_l: 23, hip_r: 24,
    knee_l: 25, knee_r: 26,
    ankle_l: 27, ankle_r: 28
  };
  const extracted = {};
  for (let [k, i] of Object.entries(keypoints)) {
    extracted[k] = [landmarks[i].x * width, landmarks[i].y * height];
  }
  return extracted;
}

function angle(p1, mid, p2) {
  const v1 = [p1[0]-mid[0], -(p1[1]-mid[1])];
  const v2 = [p2[0]-mid[0], -(p2[1]-mid[1])];
  const dot = v1[0]*v2[0] + v1[1]*v2[1];
  const mag1 = Math.hypot(v1[0], v1[1]);
  const mag2 = Math.hypot(v2[0], v2[1]);
  return Math.acos(dot / (mag1 * mag2)) * 180 / Math.PI;
}

function analyzeRowing(keypoints) {
  const nose = keypoints.nose, r_ankle = keypoints.ankle_r, l_ankle = keypoints.ankle_l;
  let elbow, knee, hip, shoulder, wrist, ankle;

  if (nose[0] < r_ankle[0] && nose[0] < l_ankle[0]) {
    elbow = keypoints.r_elbow; knee = keypoints.knee_r; hip = keypoints.hip_r;
    shoulder = keypoints.shoulder_r; wrist = keypoints.wrist_r; ankle = keypoints.ankle_r;
  } else {
    elbow = keypoints.l_elbow; knee = keypoints.knee_l; hip = keypoints.hip_l;
    shoulder = keypoints.shoulder_l; wrist = keypoints.wrist_l; ankle = keypoints.ankle_l;
  }

  const not_stand = Math.abs(shoulder[1]-hip[1]) / Math.abs(hip[1]-ankle[1]) > 1;
  const height = elbow[1] < hip[1] && elbow[1] < ankle[1] && wrist[1] < ankle[1];
  const not_lay = Math.abs(nose[1]-knee[1]) / Math.abs(knee[0]-hip[0]) > 0.6;
  const knee_angle = angle(ankle, knee, hip);
  const hip_angle = angle(shoulder, hip, knee);
  const not_sit = knee_angle > 100 || knee_angle < 80;
  const is_row = not_stand && height && !not_lay && !not_sit;

  let results = "";
  if (is_row) {
    if (knee_angle < 100) {
      results += "The person is at the catch.\n";
      if (Math.abs(elbow[0]-knee[0]) > Math.abs(knee[0]-ankle[0])) {
        if (hip_angle < 40) results += "Straighten your back and lean less forward at the catch.\n";
        else results += "Lean forward at the catch.\n";
      }
    } else if (knee_angle > 150) {
      results += "The person is at the finish.\n";
      if (Math.abs(knee[0]-elbow[0]) < Math.abs(elbow[0]-shoulder[0])) results += "Place your hands close to your chest at the finish.\n";
      if (Math.abs(wrist[1]-hip[1]) > Math.abs(wrist[1]-shoulder[1])) results += "Place your wrists lower at the finish.\n";
    } else {
      results += "This person is between catch and finish.\n";
      if (hip_angle > 90) results += "Lean forward as you approach the catch.\n";
    }
  } else results += "The person is not rowing.\n";

  return results;
}

// --- MediaPipe results handler ---
function onResults(results) {
  const ctx = canvas.getContext("2d");
  ctx.drawImage(results.image, 0, 0);

  if (!results.poseLandmarks) {
    resultsEl.textContent = "No person detected in the image.";
    statusEl.textContent = "";
    return;
  }

  drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color:'white', lineWidth:3});
  drawLandmarks(ctx, results.poseLandmarks, {color:'red', lineWidth:2});

  const keypoints = extractKeyLandmarks(results.poseLandmarks, canvas.width, canvas.height);
  resultsEl.textContent = analyzeRowing(keypoints);
  statusEl.textContent = "";
}
