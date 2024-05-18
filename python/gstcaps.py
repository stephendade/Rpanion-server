#!/usr/bin/env python3
"""
Find device caps
Requires gst and picamera2
"""

import sys
import json
import gi
import math
import platform
import os
gi.require_version('Gst', '1.0')
from gi.repository import Gst

Gst.init(sys.argv)

device_provider = Gst.DeviceProviderFactory.get_by_name("v4l2deviceprovider")
devices = device_provider.get_devices()
registry = Gst.Registry.get()

# Get list of vals in cap
def getcapval(caps):
    allval = []
    for cap in caps:
        allval.append(cap['value'])      
    return allval


# Return true if running on RPi
def is_raspberry_pi():
    try:
        with open('/proc/cpuinfo', 'r') as f:
            cpuinfo = f.read()
        return 'Raspberry Pi' in cpuinfo
    except FileNotFoundError:
        return False


# Return true if running on RB5
def is_qualcomm_rb5():
    element = registry.find_plugin("qtiqmmfsrc")
    return element is not None


retDevices = []

# Libcamera check, if installed
if is_raspberry_pi():
    try:
        from picamera2 import Picamera2
        for cam in Picamera2.global_camera_info():
            caps = []
            if cam['Model'] == 'imx296':
                # Raspi global shutter camera has specific modes
                # https://www.raspberrypi.com/documentation/accessories/camera.html
                caps.append({'value': "1456x1088xx-raw", 'label': "1456x1088", 'height': 1088, 'width': 1456, 'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
                caps.append({'value': "1440x900xx-raw", 'label': "1440x900", 'height': 900, 'width': 1440, 'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
                caps.append({'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
                caps.append({'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640, 'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
            elif cam['Model'] == 'imx708':
                caps.append({'value': "1920x1200xx-raw", 'label': "1920x1200", 'height': 1200, 'width': 1920, 'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
                caps.append({'value': "1920x1080xx-raw", 'label': "1920x1080", 'height': 1080, 'width': 1920, 'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
                caps.append({'value': "1640x922xx-raw", 'label': "1640x922", 'height': 922, 'width': 1640, 'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
                caps.append({'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-raw', 'fpsmax': '120', 'fps': []})
                caps.append({'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640, 'format': 'video/x-raw', 'fpsmax': '120', 'fps': []})
            else:
                caps.append({'value': "1920x1080xx-raw", 'label': "1920x1080", 'height': 1080, 'width': 1920, 'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
                caps.append({'value': "1640x922xx-raw", 'label': "1640x922", 'height': 922, 'width': 1640, 'format': 'video/x-raw', 'fpsmax': '40', 'fps': []})
                caps.append({'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
                caps.append({'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640, 'format': 'video/x-raw', 'fpsmax': '90', 'fps': []})
            name = "CSI Port Camera ({0})".format(cam['Model'])
            path = cam['Id']
            if path.startswith("/base/soc/i2c") or path.startswith("/base/axi/pcie"):
                retDevices.append({'value': path, 'label': name, 'caps': caps})
    except:
        pass

if is_qualcomm_rb5():
    # manually add cameras. 4K main:
    caps = []
    caps.append({'value': "3840x2160", 'label': "3840x2160", 'height': 2160, 'width': 3840, 'format': 'video/x-raw', 'fpsmax': '30'})
    caps.append({'value': "2560x1440", 'label': "2560x1440", 'height': 1440, 'width': 2560, 'format': 'video/x-raw', 'fpsmax': '30'})
    caps.append({'value': "1920x1080", 'label': "1920x1080", 'height': 1080, 'width': 1920, 'format': 'video/x-raw', 'fpsmax': '60'})
    caps.append({'value': "1280x720", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-raw', 'fpsmax': '60'})
    name = "Main Camera (IMX577)"
    path = "qti-0"
    retDevices.append({'value': path, 'label': name, 'caps': caps})

    # tracking camera
    caps = []
    caps.append({'value': "1280x800", 'label': "1280x800", 'height': 800, 'width': 1280, 'format': 'video/x-raw', 'fpsmax': '60'})
    caps.append({'value': "1280x720", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-raw', 'fpsmax': '60'})
    caps.append({'value': "640x400", 'label': "640x400", 'height': 400, 'width': 640, 'format': 'video/x-raw', 'fpsmax': '120'})
    name = "Tracking Camera (OV9282)"
    path = "qti-1"
    retDevices.append({'value': path, 'label': name, 'caps': caps})

legacycamint = 0

for device in devices:
    path = device.get_properties().get_string("device.path")
    name = device.get_properties().get_string("v4l2.device.card")
    caps = []

    # Don't show Pi5 CSI here
    if name in ['pispbe', 'rp1-cfe']:
        continue

    # If Ubuntu and Rpi camera
    if "Ubuntu" in platform.uname().version and ("mmal service" in name or name == "unicam"):
        # Ubuntu needs to use the v4l2 driver
        caps.append({'value': "1920x1080xx-raw", 'label': "1920x1080", 'height': 1080, 'width': 1920, 'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
        caps.append({'value': "1640x922xx-raw", 'label': "1640x922", 'height': 922, 'width': 1640, 'format': 'video/x-raw', 'fpsmax': '40', 'fps': []})
        caps.append({'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
        caps.append({'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640, 'format': 'video/x-raw', 'fpsmax': '90', 'fps': []})

        path = "/dev/video0"
        name = "CSI Port Camera"
    # If legacy camera stack on RasPiOS
    elif "mmal service" in name:
        caps.append({'value': "1920x1080xx-raw", 'label': "1920x1080", 'height': 1080, 'width': 1920, 'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
        caps.append({'value': "1640x922xx-raw", 'label': "1640x922", 'height': 922, 'width': 1640, 'format': 'video/x-raw', 'fpsmax': '40', 'fps': []})
        caps.append({'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
        caps.append({'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640, 'format': 'video/x-raw', 'fpsmax': '90', 'fps': []})

        # Cope with dual CSI too
        if "/dev/video" in path:
            if legacycamint == 0:
                path = "0rpicam"
                name = "CSI Port Camera (0)"
            else:
                path = "1rpicam"
                name = "CSI Port Camera (1)"
            legacycamint = legacycamint + 1
        else:
            continue
    elif name == "unicam":
        continue
    elif "bcm2835-isp" in name:
        continue
    else:
        # USB camera
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

                # if on Rpi, don't return anything greater than 1080p on raw or jpg, as
                # Rpi's x264 hardware encoder doesn't support >1080p
                if is_raspberry_pi() and (height > 1080 or width > 1920) and structure.get_name() in ['video/x-raw', 'image/jpeg']:
                    continue
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
                form = structure.get_name().split('/')[1]
                if "{0}x{1}x{2}".format(width, height, form) not in getcapval(caps):
                    caps.append({'value': "{0}x{1}x{2}".format(width, height, form), 'label': "{0}x{1} ({2})".format(width, height, form), 'height': int(height), 'width': int(width), 'format': structure.get_name(), 'fpsmax': FPSMax, 'fps': fps})

    retDevices.append({'value': path, 'label': name, 'caps': caps})

# If we're on a Jetson and /dev/video0 or /dev/video0 exist but not listed, add as CSI ports
if 'aarch64' in platform.uname().machine and 'tegra' in platform.uname().release:
    caps = []
    caps.append({'value': "1920x1080xx-raw", 'label': "1920x1080", 'height': 1080, 'width': 1920, 'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
    caps.append({'value': "1640x922xx-raw", 'label': "1640x922", 'height': 922, 'width': 1640, 'format': 'video/x-raw', 'fpsmax': '40', 'fps': []})
    caps.append({'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
    caps.append({'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640, 'format': 'video/x-raw', 'fpsmax': '90', 'fps': []})
    if os.path.exists('/dev/video0') and '/dev/video0' not in [i['value'] for i in retDevices]:
        retDevices.append({'value': 'argus0', 'label': 'CSI0', 'caps': caps})
    if os.path.exists('/dev/video1') and '/dev/video1' not in [i['value'] for i in retDevices]:
        retDevices.append({'value': 'argus1', 'label': 'CSI1', 'caps': caps})

# Include testsrc
capsTest = []
capsTest.append({'value': "1920x1080xx-raw", 'label': "1920x1080", 'height': 1080, 'width': 1920, 'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
capsTest.append({'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
capsTest.append({'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640, 'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
retDevices.append({'value': "testsrc", 'label': "Test Source", 'caps': capsTest})

print(json.dumps(retDevices))
