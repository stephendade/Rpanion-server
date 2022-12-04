#!/usr/bin/env python3
"""
Find device caps
Requires gst
"""

import sys
import json
import gi
import math
import platform
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib

Gst.init(sys.argv)

device_provider = Gst.DeviceProviderFactory.get_by_name("v4l2deviceprovider")
devices = device_provider.get_devices()

# Get list of vals in cap
def getcapval(caps):
    allval = []
    for cap in caps:
        allval.append(cap['value'])      
    return allval

retDevices = []

for device in devices:
    path = device.get_properties().get_string("device.path")
    name = device.get_properties().get_string("v4l2.device.card")
    caps = []

    # Check if it's a Rpi Cam V2, if so manually add modes for hardware encoding
    # Also change path to tell rtsp-server to use specific ras pi cam driver
    #if "unicam" in name or "mmal service" in name:
    if "mmal service" in name:
        caps = []
        if "Ubuntu" in platform.uname().version:
            # Ubuntu needs to use the v4l2 driver
            caps.append({'value': "1920x1080", 'label': "1920x1080", 'height': 1080, 'width': 1920, 'format': 'video/x-raw', 'fpsmax': '30'})
            caps.append({'value': "1640x922", 'label': "1640x922", 'height': 922, 'width': 1640, 'format': 'video/x-raw', 'fpsmax': '40'})
            caps.append({'value': "1280x720", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-raw', 'fpsmax': '60'})
            caps.append({'value': "640x480", 'label': "640x480", 'height': 480, 'width': 640, 'format': 'video/x-raw', 'fpsmax': '90'})

            path = "/dev/video0"
            name = "Raspberry Pi Camera (V2)"
        else:
            caps.append({'value': "1920x1080", 'label': "1920x1080", 'height': 1080, 'width': 1920, 'format': 'video/x-h264', 'fpsmax': '30'})
            caps.append({'value': "1640x922", 'label': "1640x922", 'height': 922, 'width': 1640, 'format': 'video/x-h264', 'fpsmax': '40'})
            caps.append({'value': "1280x720", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-h264', 'fpsmax': '60'})
            caps.append({'value': "640x480", 'label': "640x480", 'height': 480, 'width': 640, 'format': 'video/x-h264', 'fpsmax': '90'})

            # If using the "unicam" interface in Bullseye, label the path
            path = "rpicam"  # + ("-uni" if ("unicam" in name) else "")
            name = "CSI Port Camera"

    elif "bcm2835-isp" in name:
        continue
    else:
        #Get better name for camera
        if "UVC Camera (" in name:
            vendorproduct = name.split("(")[1].split(")")[0]
            import subprocess
            process = subprocess.Popen(['lsusb', '-d', vendorproduct], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = process.communicate()
            if stderr == b'' and vendorproduct in stdout.decode("utf-8"):
                name = stdout.decode("utf-8").split(vendorproduct)[1].strip()

        capsGST = device.get_caps()

        # enumerate available resolutions and framerates
        for i in range(capsGST.get_size()):
            structure = capsGST.get_structure(i)
            #print(structure.to_string())
            if structure.get_name() in ['video/x-raw', 'video/x-h264', 'image/jpeg'] :
                width = structure.get_int('width').value
                height = structure.get_int('height').value
                #print(structure.get_list('framerate')[1].get_nth(0).fps_numerator)
                #(_, fps_numerator, fps_denominator) = structure.get_fraction('framerate')
                #single fpsmax, or list of available fps'
                FPSMax = 0
                fps = []
                if structure.get_fraction('framerate')[0] == True:
                    (_, fps_numerator, fps_denominator) = structure.get_fraction('framerate')
                    #fpsmaxstruct = structure.get_fraction('framerate') #math.floor(int(fps_numerator)/int(fps_denominator))
                    FPSMax = math.floor(int(fps_numerator)/int(fps_denominator))
                else:
                    framerates = structure.get_list('framerate').array
                    fps = []
                    if framerates:
                        for i in range(framerates.n_values):
                            fp = str(framerates.get_nth(i)).split('/')
                            if int(fp[1]) == 1:
                                fps.append({'value': str(int(fp[0])/int(fp[1])), 'label': (str(int(fp[0])/int(fp[1])) + " fps")})
                            #print(' - framerate = ', framerates.get_nth(i))
                    else:
                        fps.append({'value': "-1", 'label': "N/A"})
                
                #Only append if it's a unique value
                if "{0}x{1}".format(width, height) not in getcapval(caps):
                    form = structure.get_name().split('/')[1]
                    caps.append({'value': "{0}x{1}".format(width, height), 'label': "{0}x{1} ({2})".format(width, height, form), 'height': int(height), 'width': int(width), 'format': structure.get_name(), 'fpsmax': FPSMax, 'fps': fps})

    retDevices.append({'value': path, 'label': name, 'caps': caps})

# Include testsrc
capsTest = []
capsTest.append({'value': "1920x1080", 'label': "1920x1080", 'height': 1080, 'width': 1920, 'format': 'video/x-h264', 'fpsmax': '30'})
capsTest.append({'value': "1280x720", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-h264', 'fpsmax': '30'})
capsTest.append({'value': "640x480", 'label': "640x480", 'height': 480, 'width': 640, 'format': 'video/x-h264', 'fpsmax': '30'})
retDevices.append({'value': "testsrc", 'label': "Test Source", 'caps': capsTest})

print(json.dumps(retDevices))


