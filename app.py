from flask import Flask, request, send_file, render_template, url_for
import os
import cv2
import mediapipe as mp

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "processed"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(static_image_mode=False, min_detection_confidence=0.5, min_tracking_confidence=0.5)
mp_drawing = mp.solutions.drawing_utils

@app.route("/", methods=["GET", "POST"])
def index():
    processed_image_path = None
    if request.method == "POST":
        file = request.files.get("image")
        if file:
            input_path = os.path.join(UPLOAD_FOLDER, file.filename)
            file.save(input_path)

            image = cv2.imread(input_path)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = pose.process(rgb_image)

            if results.pose_landmarks:
                mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

            output_path = os.path.join(OUTPUT_FOLDER, file.filename)
            cv2.imwrite(output_path, image)
            processed_image_path = url_for("processed_image", filename=file.filename)

            os.remove(input_path)
    
    # Render the page, passing the processed image URL if available
    return render_template("index.html", processed_image=processed_image_path)

@app.route("/processed/<filename>")
def processed_image(filename):
    return send_file(os.path.join(OUTPUT_FOLDER, filename), mimetype="image/jpeg")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))

