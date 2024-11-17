#!/usr/bin/env python3
# -*- coding:utf-8 vi:ts=4:noexpandtab

from picamera2 import Picamera2
from picamera2.encoders import H264Encoder

import argparse
import time, signal, os, sys, shutil

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
    parser = argparse.ArgumentParser(description="Camera control server using Picamera2")
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
    parser.add_argument("-f", "--min-disk-space", metavar = "N",
                    type = int, dest="minFreeSpace",
                    help="Minimum free disk space (in MB) required to save files. Default: 1000 MB",
                    default=1000
                    )
    args = parser.parse_args()

captureMode = args.captureMode
print("Mode is: ", captureMode)

mediaPath = args.mediaPath

# Convert to bytes
minFreeSpace = args.minFreeSpace * 1000 * 1000

# Check if the specified media directory exists
if os.path.isdir(mediaPath):
    print(f"Media storage directory '{mediaPath}' exists")
# Check if we can write to the directory
    try:
        testfilepath = os.path.join(mediaPath, 'test.tmp')
        filehandle = open( testfilepath, 'w' )
        filehandle.close()
        os.remove(testfilepath)
        print(f"Media storage directory '{mediaPath}' is writable")
    except IOError:
        sys.exit(f"Unable to write to media storage directory '{mediaPath}'" )

else:
    print("Media storage path '{mediaPath}' doesn't exist. Attempting to create.")
    # Create the directory
    try:
        os.mkdir(mediaPath)
        print(f"Directory '{mediaPath}' created successfully.")
    except FileExistsError:
        print(f"Directory '{mediaPath}' already exists.")
    except PermissionError:
        sys.exit(f"Permission denied: Unable to create '{mediaPath}'.")
    except Exception as e:
        sys.exit(f"An error occurred: {e}")

if captureMode == "video":
    vidBitrate = args.vidBitrate
    print("Video Bitrate is: ", vidBitrate, " (", vidBitrate / 1000000, " MBps)", sep = "")

# Wait for input on stdin
async def ainput(string: str) -> str:
    await asyncio.to_thread(sys.stdout.write, f'{string} ')
    name = await ainput("Your name:")

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

            # Get the amount of free disk space, in bytes
            freeDiskSpace = shutil.disk_usage(mediaPath)[2]

            if freeDiskSpace < minFreeSpace:
                print(f"Free disk space is below the minimum of {minFreeSpace} MiB. Image not recorded.")
            else:
                print("Received signal.SIGUSR1. Capturing photo.")
                filename = time.strftime("RPN%Y%m%d_%H%M%S.jpg")
                filepath = os.path.join(mediaPath, filename)
                print(filepath)
                output_orig = picam2_still.capture_file(filepath)

        elif (GOT_SIGNAL and (captureMode == "video")):
            GOT_SIGNAL = False
            print("Received signal.SIGUSR1.")
            startstop_video()

        # Wait for a signal
        signal.pause()
        #loop.run()
except:
    print("Exiting Photo/Video Server")