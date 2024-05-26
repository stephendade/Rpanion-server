#!/usr/bin/env python3
# -*- coding:utf-8 vi:ts=4:noexpandtab

from picamera2 import Picamera2
from picamera2.encoders import H264Encoder

import argparse
import time, signal, os

from gi.repository import GLib

# Reset the signal flag
GOT_SIGNAL = False
# Get the PID (for testing/troubleshooting)
pid = os.getpid()
print("PID is : ", pid)

def receive_signal(signum, stack):
    global GOT_SIGNAL
    GOT_SIGNAL = True

# Register the signal handler function to fire when signals are received
signal.signal(signal.SIGUSR1, receive_signal)

# Reset the video recording flag
VIDEO_ACTIVE = False

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Camera control server using libcamera")
    parser.add_argument("-d", "--destination", dest="mediaPath",
                        help="Save captured image to PATH. Default: ../media/",
                        metavar="PATH",
                        default="../media/"
                        )
    parser.add_argument("-m", "--mode", choices=['photo', 'video'],
                        dest="captureMode",
                        help="Capture mode options: photo [default], video", metavar="MODE",
                        default='photo'
                        )
    parser.add_argument("-b", "--bitrate", metavar = "N",
                        type = int, dest="vidBitrate",
                        help="Video bitrate in bits per second. Default: 10000000",
                        default=10000000
                        )
    args = parser.parse_args()

captureMode = args.captureMode
print("Mode is: ", captureMode)

mediaPath = args.mediaPath
print("Media storage directory is:", mediaPath)

if captureMode == "video":
    vidBitrate = args.vidBitrate
    print("Video Bitrate is: ", vidBitrate, " (", vidBitrate / 1000000, " MBps)", sep = "")


# Initialize the camera
if captureMode == "photo":
    # Initialize the camera
    picam2_still = Picamera2()
    # By default, use the full resolution of the sensor
    config = picam2_still.create_still_configuration(
        main={"size": picam2_still.sensor_resolution},
        buffer_count=2
    )
    picam2_still.configure(config)
    # Keep the camera active to make responses faster
    picam2_still.start()
    print("Waiting 2 seconds for camera to stabilize...")
    time.sleep(2)
    print("Camera is ready")

elif captureMode == "video":
    picam2_vid = Picamera2()
    video_config = picam2_vid.create_video_configuration()
    picam2_vid.configure(video_config)

    encoder = H264Encoder(bitrate = vidBitrate)

def startstop_video():
    global VIDEO_ACTIVE

    if VIDEO_ACTIVE:
        picam2_vid.stop_recording()
        VIDEO_ACTIVE = False
        print ("Video recording stopped.")
    else:
        filename = time.strftime("RPN%Y%m%d_%H%M%S.h264")
        filepath = os.path.join(mediaPath, filename)
        print("Recording to ", filepath)

        VIDEO_ACTIVE = True
        output_video = picam2_vid.start_recording(encoder, filepath)

try:
    # Wait for a signal to arrive
    while True:
        if (GOT_SIGNAL and (captureMode == "photo")):
            GOT_SIGNAL = False
            print("Received signal.SIGUSR1. Capturing photo.")
            filename = time.strftime("/home/pi/Rpanion-server/media/RPN%Y%m%d_%H%M%S.jpg")
            print(filename)
            output_orig = picam2_still.capture_file(filename)
        elif (GOT_SIGNAL and (captureMode == "video")):
            GOT_SIGNAL = False
            print("Received signal.SIGUSR1.")
            startstop_video()

        # Wait for a signal
        signal.pause()
        #loop.run()
except:
    print("Exiting Photo/Video Server")