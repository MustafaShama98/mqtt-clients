# server.py
import cv2
from flask import Flask, Response
from flask_cors import CORS
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

def get_camera():
    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        logger.error("Could not open camera")
        return None
    
    # Set lower resolution for better performance
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    return camera

@app.route('/video_feed')
def single_frame():
    """Endpoint to return a single JPEG frame."""
    camera = get_camera()
    if camera is None:
        return Response("Camera error", status=500)

    success, frame = camera.read()
    if not success:
        camera.release()
        return Response("Failed to capture frame", status=500)
    
    # Encode the frame as JPEG
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    camera.release()

    # Send the encoded JPEG as the response
    return Response(buffer.tobytes(), mimetype='image/jpeg')

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=4000)
