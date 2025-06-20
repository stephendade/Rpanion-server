#!/usr/bin/env python3
# -*- coding:utf-8 vi:ts=4:noexpandtab

from picamera2 import Picamera2
from picamera2.encoders import H264Encoder
from libcamera import Transform

import cv2
import argparse
import time, signal, os, sys, shutil, traceback

GOT_SIGUSR1 = False
GOT_SIGTERM = False
VIDEO_ACTIVE = False
pid = os.getpid()
print("PID is : ", pid)

def handle_sigusr1(signum, stack):
    global GOT_SIGUSR1
    GOT_SIGUSR1 = True

def handle_sigterm(signum, stack):
    global GOT_SIGTERM
    GOT_SIGTERM = True

# Register the signal handler functions with the actual signals
signal.signal(signal.SIGTERM, handle_sigterm)
signal.signal(signal.SIGUSR1, handle_sigusr1)

# Parse command line arguments
parser = argparse.ArgumentParser(description="Camera control server")
parser.add_argument("-d", "--destination", dest="mediaPath",
                    help="Save captured image to PATH. Default: /home/pi/Rpanion-server/media/",
                    metavar="PATH",
                    default="/home/pi/Rpanion-server/media/"
                    )
parser.add_argument("-m", "--mode", choices=['photo', 'video'],
                    dest="captureMode",
                    help="Capture mode options: photo [default], video", metavar="MODE",
                    default='photo'
                    )
parser.add_argument("--device", dest="captureDeviceId",
                    help="Unique device ID. If it starts with 'CSI', Picamera2 is used. Otherwise, it's treated as a V4L2 device path.",
                    default=None
                    )
parser.add_argument("--width", metavar="W", type=int, dest="vidWidth",
                    help="Image width", default=1920
                    )
parser.add_argument("--height", metavar="H", type=int, dest="vidHeight",
                    help="Image height", default=1080
                    )
parser.add_argument("--fps", metavar="FPS", type=int, dest="vidFps",
                    help="Video framerate", default=30
                    )
parser.add_argument("--format", dest="vidFormat",
                    help="Video format (e.g., YUV420, MJPEG, RGB888). Default: YUV420",
                    default="YUV420"
                    )
parser.add_argument("--rotation", metavar="DEG", type=int, choices=[0, 90, 180, 270],
                    dest="imageRotation", help="Image rotation", default=0)
parser.add_argument("-b", "--bitrate", metavar = "N",
                    type = int, dest="vidBitrate",
                    help="Video bitrate in bits per second. Default: 10000000",
                    default=10000000
                    )
parser.add_argument("-f", "--min-disk-space", metavar = "N",
                type = int, dest="minFreeSpace",
                help="Minimum free disk space (in MB) required to save files. Default: 1000 MB",
                default=1000
                )
args = parser.parse_args()

mediaPath = args.mediaPath
captureMode = args.captureMode
minFreeSpace = args.minFreeSpace * 10**6

picam2_still = None
picam2_vid = None
v4l2_cam = None
v4l2_writer = None
encoder = None
use_picamera = False

# Create media directory if it doesn't exist
try:
    os.makedirs(mediaPath, exist_ok=True)
    print(f"Media storage directory '{mediaPath}' is ready.")
except Exception as e:
    sys.exit(f"An error occurred creating directory: {e}")

# Determine which backend type to use and initialize the camera
if args.captureDeviceId is None or args.captureDeviceId.startswith('CSI'):
    print("CSI camera specified or no device specified. Defaulting to Picamera2 backend.")
    use_picamera = True
    try:
        if not Picamera2.global_camera_info():
             sys.exit("Picamera2 backend selected, but no libcamera cameras found.")
    except Exception as e:
        sys.exit(f"Could not query for Picamera2 cameras: {e}")
else:
    print(f"Device {args.captureDeviceId} specified. Using V4L2/OpenCV backend.")
    use_picamera = False
    # For V4L2 devices, the device ID and device path are the same
    args.captureDevicePath = args.captureDeviceId

if captureMode == "photo":
    if use_picamera:
        picam2_still = Picamera2()
        config = picam2_still.create_still_configuration({"size":(args.vidWidth, args.vidHeight)}, transform=Transform(rotation=args.imageRotation))
        picam2_still.configure(config)
        picam2_still.start()
        time.sleep(2)
        print(f"Camera is ready in Picamera2 photo mode. Capturing {args.vidWidth}x{args.vidHeight}, {args.imageRotation}° rotation")
    else:
        v4l2_cam = cv2.VideoCapture(args.captureDevicePath, cv2.CAP_V4L2)
        v4l2_cam.set(cv2.CAP_PROP_FRAME_WIDTH, args.vidWidth)
        v4l2_cam.set(cv2.CAP_PROP_FRAME_HEIGHT, args.vidHeight)
        if not v4l2_cam.isOpened():
            sys.exit(f"V4L2 camera at {args.captureDevicePath} failed to open.")
        time.sleep(2)
        print(f"Camera is ready in V4L2 photo mode. Capturing {args.vidWidth}x{args.vidHeight}")

elif captureMode == "video":
    if use_picamera:
        picam2_vid = Picamera2()
        video_config = picam2_vid.create_video_configuration(main={"size": (args.vidWidth, args.vidHeight), "format": args.vidFormat}, controls={"FrameRate": args.vidFps}, transform=Transform(rotation=args.imageRotation))
        picam2_vid.configure(video_config)
        encoder = H264Encoder(bitrate=args.vidBitrate)
        picam2_vid.start()
        print(f"Camera is ready in Picamera2 video mode. Capturing {args.vidWidth}x{args.vidHeight} {args.vidFormat} @ {args.vidFps} fps, {args.imageRotation}° rotation")
    else:
        v4l2_cam = cv2.VideoCapture(args.captureDevicePath, cv2.CAP_V4L2)
        if not v4l2_cam.isOpened():
            sys.exit(f"V4L2 camera at {args.captureDevicePath} failed to open.")

        v4l2_cam.set(cv2.CAP_PROP_FRAME_WIDTH, args.vidWidth)
        v4l2_cam.set(cv2.CAP_PROP_FRAME_HEIGHT, args.vidHeight)
        v4l2_cam.set(cv2.CAP_PROP_FPS, args.vidFps)

        # Check if the actual width, height, and FPS were written correctly
        actual_v4l2_width = int(v4l2_cam.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_v4l2_height = int(v4l2_cam.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_v4l2_fps = int(v4l2_cam.get(cv2.CAP_PROP_FPS))

        print(f"Camera is ready in V4L2 video mode. Capturing {actual_v4l2_width}x{actual_v4l2_height} {args.vidFormat} @ {actual_v4l2_fps} fps")

def graceful_exit():
    global VIDEO_ACTIVE
    print("Gracefully exiting...")
    if VIDEO_ACTIVE:
        startstop_video()
        time.sleep(0.2)
    if use_picamera:
        if picam2_still: picam2_still.stop()
        if picam2_vid: picam2_vid.stop()
    elif v4l2_cam:
        v4l2_cam.release()
    sys.exit(0)

def startstop_video():
    global VIDEO_ACTIVE, v4l2_writer
    if use_picamera:
        if VIDEO_ACTIVE:
            picam2_vid.stop_recording()
            VIDEO_ACTIVE = False
            print("Picamera2 recording stopped.")
        else:
            filepath = os.path.join(mediaPath, time.strftime("RPN%Y%m%d_%H%M%S.h264"))
            picam2_vid.start_recording(encoder, filepath)
            VIDEO_ACTIVE = True
            print(f"Picamera2 recording started to {filepath}")
    else: # V4L2
        if VIDEO_ACTIVE:
            VIDEO_ACTIVE = False
            if v4l2_writer:
                v4l2_writer.release()
                v4l2_writer = None
                print("V4L2 recording stopped.")
        else:
            for _ in range(5): v4l2_cam.read() # Flush buffer
            filepath = os.path.join(mediaPath, time.strftime("RPN%Y%m%d_%H%M%S.avi"))
            fourcc = cv2.VideoWriter_fourcc(*'MJPG')
            v4l2_writer = cv2.VideoWriter(filepath, fourcc, actual_v4l2_fps, (actual_v4l2_width, actual_v4l2_height))
            if v4l2_writer.isOpened():
                VIDEO_ACTIVE = True
                print(f"V4L2 recording started to {filepath}")
            else:
                print(f"Error: Could not open VideoWriter for {filepath}", file=sys.stderr)

if __name__ == '__main__':
    try:
        while True:
            if GOT_SIGTERM:
                GOT_SIGTERM = False
                graceful_exit()

            if GOT_SIGUSR1:
                GOT_SIGUSR1 = False

                freeDiskSpace = shutil.disk_usage(mediaPath).free
                if freeDiskSpace < minFreeSpace and (captureMode == 'photo' or (captureMode == 'video' and not VIDEO_ACTIVE)):
                    print(f"Free disk space is {(int)(freeDiskSpace / 10**6)} MB, which is less than the minimum of {(int)(minFreeSpace / 10**6)} MB. Action aborted.")
                else:
                    if captureMode == 'photo':
                        filepath = os.path.join(mediaPath, time.strftime("RPN%Y%m%d_%H%M%S.jpg"))
                        print(f"Capturing photo to {filepath}")
                        if use_picamera:
                            picam2_still.capture_file(filepath)
                            print("Photo captured.")
                        else:
                            for _ in range(5): v4l2_cam.read()
                            ret, frame = v4l2_cam.read()
                            if ret:
                                cv2.imwrite(filepath, frame)
                                print("Photo captured.")
                            else:
                                print("Failed to capture frame from V4L2 camera.", file=sys.stderr)
                    elif captureMode == 'video':
                        print("Toggling video recording.")
                        startstop_video()

            # Main loop with two states: paused and waiting for a signal, or actively recording V4L2 video
            if use_picamera or not VIDEO_ACTIVE:
                print("... Paused, waiting for signal ...", file=sys.stderr)
                signal.pause()
            else:
                if v4l2_cam and v4l2_writer:
                    ret, frame = v4l2_cam.read()
                    if ret:
                        v4l2_writer.write(frame)
                    else:
                        print("V4L2 frame read failed during recording. Stopping.", file=sys.stderr)
                        startstop_video()
                time.sleep(0.01)

    except KeyboardInterrupt:
        graceful_exit()
    except Exception as e:
        print(f"!!! PYTHON ERROR: Unhandled exception: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        graceful_exit()