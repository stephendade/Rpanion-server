#!/usr/bin/env python3

from picamera2 import Picamera2
from argparse import ArgumentParser
import time, signal, os

parser = ArgumentParser()
parser.add_argument("-f", "--filename", dest="filename",
                    help="Save captured image to FILE", metavar="FILE")
args = parser.parse_args()

pid = os.getpid()
GOT_SIGNAL = 0

def receive_signal(signum, stack):
    global GOT_SIGNAL
    GOT_SIGNAL = 1

# Initialize the camera
picam2 = Picamera2()
config = picam2.create_still_configuration(
    main={"size": picam2.sensor_resolution},
    buffer_count=2
)
picam2.configure(config)
# Keep the camera active to make responses faster
picam2.start()

print("Waiting 2 seconds for camera to stabilize...")
time.sleep(2)
print("Camera is ready")

# Register the signal handler function
signal.signal(signal.SIGUSR1, receive_signal)
print("PID is : ", pid)

# Wait for a signal to arrive
while True:
    if GOT_SIGNAL == 1:
        print("Received signal.SIGUSR1. Capturing photo.")
        filename = time.strftime("RPN%Y%m%d_%H%M%S.jpg")
        print(filename)
        output_orig = picam2.capture_file(filename)
        GOT_SIGNAL = 0
    #time.sleep(1)
    # Wait for a signal
    signal.pause()