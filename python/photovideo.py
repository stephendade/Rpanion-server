#!/usr/bin/env python3
# -*- coding:utf-8 vi:ts=4:noexpandtab

import argparse
import time, signal, os, sys, shutil, traceback
import json

# Parse command line arguments
home_dir = os.path.expanduser("~")

parser = argparse.ArgumentParser(description="Camera control server")
parser.add_argument("-d", "--destination", dest="mediaPath",
                    help="Save captured image to PATH. Default: ~/Rpanion-server/media/",
                    metavar="PATH",
                    default=f"{home_dir}/Rpanion-server/media/"
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

# Try importing piexif for geotagging, if photo mode was requested
if captureMode == "photo":
    try:
        import piexif
        HAS_PIEXIF = True
    except ImportError:
        HAS_PIEXIF = False
        print("Warning: 'piexif' module not found. Geotagging will be disabled. Install with: pip3 install piexif", flush=True)

# Set up signals before importing heavy libraries (cv2, picamera2)
# to prevent the process from being killed if a signal arrives during import.

GOT_SIGUSR1 = False
GOT_SIGTERM = False
VIDEO_ACTIVE = False

def handle_sigusr1(signum, stack):
    global GOT_SIGUSR1
    GOT_SIGUSR1 = True

def handle_sigterm(signum, stack):
    global GOT_SIGTERM
    GOT_SIGTERM = True

# Register the signal handler functions with the actual signals
signal.signal(signal.SIGTERM, handle_sigterm)
signal.signal(signal.SIGUSR1, handle_sigusr1)

# Notify Node.js immediately that we are alive (prevents timeout)
print(f"PID is : {os.getpid()}", flush=True)

# Load the heavy libraries
HAS_PICAMERA = False

# Attempt to load Picamera2
print("Loading camera libraries. This may take a while.", flush=True)
try:
    from picamera2 import Picamera2
    print("Loaded Picamera2", flush=True)
    # Only try importing H264Encoder if video mode was requested
    if captureMode == "video":
        from picamera2.encoders import H264Encoder
        print("Loaded the H264 Encoder", flush=True)
    from libcamera import Transform
    
    HAS_PICAMERA = True

except (ImportError, OSError):
    HAS_PICAMERA = False
    print("Picamera2 not found. Will attempt to fall back to V4L2.", flush=True)

try:
    import cv2
    print("Loaded OpenCV-Python", flush=True)
    print("Finished loading camera libraries.", flush=True)
except ImportError:
    print("Critical Error: OpenCV-Python (cv2) not found. Exiting.", file=sys.stderr)
    sys.exit(1)

# --- Helper Functions for EXIF ---
def to_deg(value, loc):
    """Converts decimal coordinates to EXIF-ready rational (deg, min, sec)"""
    if value < 0:
        loc_value = loc[1] # S or W
    else:
        loc_value = loc[0] # N or E
    abs_value = abs(value)
    deg = int(abs_value)
    t1 = (deg, 1)
    min = int((abs_value - deg) * 60)
    t2 = (min, 1)
    sec = round((abs_value - deg - min / 60) * 3600 * 100)
    t3 = (sec, 100)
    return (t1, t2, t3), loc_value

def geotag_image(filepath):
    if not HAS_PIEXIF:
        print("EXIF library not available. Skipping geotag.", flush=True)
        return

    gps_file = '/tmp/rpanion_gps.json'
    if not os.path.exists(gps_file):
        return

    try:
        with open(gps_file, 'r') as f:
            data = json.load(f)
        
        # Check if data is valid (non-zero)
        if data['lat'] == 0 and data['lon'] == 0:
            print("Warning: GPS Lat/Lon are 0.0 (No Fix). Skipping geotag.", flush=True)
            return

        lat_deg, lat_ref = to_deg(data['lat'], ["N", "S"])
        lon_deg, lon_ref = to_deg(data['lon'], ["E", "W"])
        
        # Altitude (MSL)
        alt = data.get('alt', 0)
        alt_ref = 0 if alt >= 0 else 1
        alt_rational = (int(abs(alt) * 100), 100)

        exif_dict = piexif.load(filepath)
        
        gps_ifd = {
            piexif.GPSIFD.GPSLatitudeRef: lat_ref,
            piexif.GPSIFD.GPSLatitude: lat_deg,
            piexif.GPSIFD.GPSLongitudeRef: lon_ref,
            piexif.GPSIFD.GPSLongitude: lon_deg,
            piexif.GPSIFD.GPSAltitudeRef: alt_ref,
            piexif.GPSIFD.GPSAltitude: alt_rational,
        }

        exif_dict["GPS"] = gps_ifd
        exif_bytes = piexif.dump(exif_dict)
        piexif.insert(exif_bytes, filepath)
        print(f"Geotagged image with Lat: {data['lat']}, Lon: {data['lon']}", flush=True)
        
        # Cleanup
        os.remove(gps_file)

    except Exception as e:
        print(f"Error Geotagging: {e}", file=sys.stderr)

# Main script setup
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

# Determine which backend to use
# If the device path starts with '/dev/video', it is a USB/V4L2 camera.
# Everything else (None, 'CSI', '/base/soc/...') is treated as a Libcamera/Picamera2 device.

is_explicit_v4l2 = args.captureDeviceId is not None and args.captureDeviceId.startswith('/dev/video')

if not is_explicit_v4l2 and HAS_PICAMERA:
    print(f"Device {args.captureDeviceId} specified (or None). Defaulting to Picamera2 backend.", flush=True)
    use_picamera = True
    try:
        if not Picamera2.global_camera_info():
             sys.exit("Picamera2 backend selected, but no libcamera cameras found.")
    except Exception as e:
        sys.exit(f"Could not query for Picamera2 cameras: {e}")
else:
    print(f"Device {args.captureDeviceId} specified. Using V4L2/OpenCV backend.", flush=True)
    use_picamera = False

    # If no device ID was provided, default to /dev/video0
    if args.captureDeviceId is None:
        args.captureDevicePath = "/dev/video0"
        print("No device ID provided. Defaulting to /dev/video0")
    else:
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

        # Sanitize the format codes: Convert GStreamer MIME types (from frontend) to Picamera2 pixel formats
        # Picamera2 generally needs 'YUV420' as the main stream format to feed the H264 encoder.
        if args.vidFormat and (args.vidFormat.startswith("video/") or "h264" in args.vidFormat):
            print(f"Mapping format '{args.vidFormat}' to 'YUV420' for Picamera2", flush=True)
            args.vidFormat = "YUV420"
            
        picam2_vid = Picamera2()
        video_config = picam2_vid.create_video_configuration(
            main={
                "size": (args.vidWidth, args.vidHeight),
                "format": args.vidFormat},
                controls={"FrameRate": args.vidFps},
                transform=Transform(rotation=args.imageRotation)
            )
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
                    print(f"Free disk space is {(int)(freeDiskSpace / 10**6)} MB, which is less than the minimum of {(int)(minFreeSpace / 10**6)} MB. Action aborted.", flush=True)
                else:
                    if captureMode == 'photo':
                        filepath = os.path.join(mediaPath, time.strftime("RPN%Y%m%d_%H%M%S.jpg"))
                        print(f"Capturing photo to {filepath}")
                        if use_picamera:
                            picam2_still.capture_file(filepath)
                            print("Photo captured.")
                            # Geotag the captured photo
                            geotag_image(filepath)
                        else:
                            for _ in range(5): v4l2_cam.read()
                            ret, frame = v4l2_cam.read()
                            if ret:
                                cv2.imwrite(filepath, frame)
                                print("Photo captured.")
                                # Geotag the captured photo
                                geotag_image(filepath)
                            else:
                                print("Failed to capture frame from V4L2 camera.", file=sys.stderr)
                    elif captureMode == 'video':
                        print("Toggling video recording.")
                        startstop_video()

            # Main loop with two states: paused and waiting for a signal, or actively recording V4L2 video
            if use_picamera or not VIDEO_ACTIVE:
                #print("... Paused, waiting for signal ...", file=sys.stderr)
                time.sleep(0.1)
            else:
                if v4l2_cam and v4l2_writer:
                    ret, frame = v4l2_cam.read()
                    if ret:
                        v4l2_writer.write(frame)
                    else:
                        print("V4L2 frame read failed during recording. Stopping.", file=sys.stderr)
                        startstop_video()
                time.sleep(0.1)

    except KeyboardInterrupt:
        graceful_exit()
    except Exception as e:
        print(f"!!! PYTHON ERROR: Unhandled exception: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        graceful_exit()
