#!/usr/bin/env python3
"""
Find device caps
Requires gst and picamera2
"""

import math
import platform
import os
import sys
import json
import gi
import re
gi.require_version('Gst', '1.0')
from gi.repository import Gst

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


def is_jetson() -> int:
    """returns major jetpack version if running on a Jetson, else returns 0"""
    if 'aarch64' in platform.uname().machine and 'tegra' in platform.uname().release:
        try:
            with open('/etc/nv_tegra_release', 'r', encoding='utf-8') as f:
                # R39 (release), REVISION: 2.0, GCID: 45755727, BOARD: generic, EABI: aarch64, DATE: Mon Jun  1 09:28:48 PM UTC 2026
                line = f.readline()
                release_match = re.search(r'# R(\d+)', line)
            if release_match:
                r_num = release_match.group(1)
                return int(r_num)
            else:
                return 0
        except (FileNotFoundError, IndexError, ValueError):
            return 0
    else:
        return 0

def gstObjToList(gstobj, field: str) -> list:
    """Convert a GStreamer object to a list."""
    obj_list_gst = None
    obj_list = []
    obj_int = 0

    success, obj_list_gst = gstobj.get_list(field)
    if success:
        for j in range(obj_list_gst.n_values):
            val_int = obj_list_gst.get_nth(j)
            obj_list.append(val_int)
    else:
        obj_int = gstobj.get_int(field).value
        obj_list.append(obj_int)

    return obj_list

def decode_caps(capsGST) -> list:
    """Decode GStreamer caps into a dictionary format."""
    widthList = gstObjToList(capsGST, 'width')
    heightList = gstObjToList(capsGST, 'height')
    caps = []

    # if using v4l2h264enc hw encoder, don't return anything greater than 1080p on raw or jpg, as
    # Rpi's x264 hardware encoder doesn't support >1080p
    if (Gst.ElementFactory.find("v4l2h264enc") and
        (max(heightList) > 1080 or max(widthList) > 1920) and
        capsGST.get_name() in ['video/x-raw', 'image/jpeg']):
        return []

    # Decode framerate(s)
    FPSMax = 0
    fps = []
    if capsGST.get_fraction('framerate')[0] == True:
        (_, fps_numerator, fps_denominator) = capsGST.get_fraction('framerate')
        FPSMax = math.floor(int(fps_numerator)/int(fps_denominator))
    else:
        framerates = capsGST.get_list('framerate').array
        fps = []
        if framerates:
            for i in range(framerates.n_values):
                try:
                    frac = framerates.get_nth(i)
                    numerator = int(frac.num)
                    denominator = int(frac.denom)
                    if denominator == 1:
                        fps.append({'value': str(int(numerator/denominator)), 'label': (str(int(numerator/denominator)) + " fps")})
                    else:
                        fps_val = numerator / denominator
                        fps.append({'value': str(fps_val), 'label': (str(fps_val) + " fps")})
                except (AttributeError, TypeError, ValueError, ZeroDivisionError):
                    # Skip framerates that can't be parsed
                    pass
        else:
            fps.append({'value': "-1", 'label': "N/A"})

    # Generate list of caps dictionaries for each width/height/format combination
    form = capsGST.get_name().split('/')[1]
    if len(widthList) == 1 and len(heightList) == 1:
        caps.append({'value': "{0}x{1}x{2}".format(widthList[0], heightList[0], form),
                     'label': "{0}x{1} ({2})".format(widthList[0], heightList[0], form),
                     'height': int(heightList[0]),
                     'width': int(widthList[0]),
                     'format': capsGST.get_name(),
                     'fpsmax': FPSMax,
                     'fps': fps})
    elif len(widthList) > 1 and len(heightList) > 1:
        for width in widthList:
            for height in heightList:
                caps.append({'value': "{0}x{1}x{2}".format(width, height, form),
                             'label': "{0}x{1} ({2})".format(width, height, form),
                             'height': int(height),
                             'width': int(width),
                             'format': capsGST.get_name(),
                             'fpsmax': FPSMax, 'fps': fps})
    return caps


REF_RES = [
    {'value': "2048x1080xx-raw", 'label': "2048x1080", 'height': 1080, 'width': 2048,
                                    'format': 'video/x-raw', 'fpsmax': 0, 'fps': []},
    {'value': "1920x1200xx-raw", 'label': "1920x1200", 'height': 1200, 'width': 1920,
                                    'format': 'video/x-raw', 'fpsmax': 0, 'fps': []},
    {'value': "1920x1080xx-raw", 'label': "1920x1080", 'height': 1080, 'width': 1920,
                                    'format': 'video/x-raw', 'fpsmax': 0, 'fps': []},
    {'value': "1680x1050xx-raw", 'label': "1680x1050", 'height': 1050, 'width': 1680,
                                    'format': 'video/x-raw', 'fpsmax': 0, 'fps': []},
    {'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280,
                                    'format': 'video/x-raw', 'fpsmax': 0, 'fps': []},
    {'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640,
                                    'format': 'video/x-raw', 'fpsmax': 0, 'fps': []}    
]


if __name__ == "__main__":

    Gst.init(sys.argv)

    legacycamint = 0
    retDevices = []

    # Raspberry Pi, so use picamera2 to get the caps for CSI cameras
    if is_raspberry_pi():
        try:
            from picamera2 import Picamera2
            for cam in Picamera2.global_camera_info():
                name = "CSI Port Camera ({0})".format(cam['Model'])
                path = cam['Id']
                # ignore USB cameras
                if not (path.startswith("/base/soc/i2c") or path.startswith("/base/axi/pcie")) or "usb@" in path:
                    continue

                caps = []
                # open the camera and query. Note that different versions of Picamera have different ways of querying
                try:
                    picam2 = Picamera2(cam['Id'])
                except TypeError:
                    picam2 = Picamera2(cam['Num'])
                modes = picam2.sensor_modes
                for mode in modes:
                    #print("Camera size W{0} H{1} and max fps {2}".format(mode['size'][0], mode['size'][1], math.floor(mode['fps'])))
                    # Figure out largest standard resolution
                    for REF in REF_RES:
                        IS_DUPLICATE = False
                        # can't run some resolutions with the hardware x264 encoder
                        if Gst.ElementFactory.find("v4l2h264enc"):
                            if REF['width'] > 1920 or REF['height'] > 1080:
                                continue
                        if mode['size'][0] >= REF['width'] and mode['size'][1] >= REF['height']:
                            # if res is already in the list, update the fpsmax
                            for cap in caps:
                                if cap['value'] == "{0}x{1}xx-raw".format(REF['width'], REF['height']) and cap['fpsmax'] < math.floor(mode['fps']):
                                    if Gst.ElementFactory.find("v4l2h264enc") and math.floor(mode['fps']) > 30:
                                        # hardare x264 encoder can't do >30fps
                                        IS_DUPLICATE = True
                                        continue
                                    cap['fpsmax'] = math.floor(mode['fps'])
                                    #print("updating {0}".format("{0}x{1}xx-raw".format(REF['width'], REF['height'])))
                                    caps.pop(caps.index(cap))
                                    caps.append(cap)
                                    IS_DUPLICATE = True
                                    break
                                elif cap['value'] == "{0}x{1}xx-raw".format(REF['width'], REF['height']):
                                    #print("Duplicate {0}".format("{0}x{1}xx-raw".format(REF['width'], REF['height'])))
                                    IS_DUPLICATE = True
                                    break
                            if not IS_DUPLICATE:
                                #print("adding {0}".format("{0}x{1}xx-raw at {2} fps".format(REF['width'], REF['height'], math.floor(mode['fps']))))
                                # FPS limits on hardware H264 encoder. See https://forums.raspberrypi.com/viewtopic.php?t=345416
                                if Gst.ElementFactory.find("v4l2h264enc") and math.floor(mode['fps']) > 30:
                                    if REF['width'] <= 1280 and REF['height'] <= 720:
                                        fps = 60
                                    elif REF['width'] <= 1920 and REF['height'] <= 1080:
                                        fps = 30
                                else:
                                    fps = math.floor(mode['fps'])
                                caps.append({'value': "{0}x{1}xx-raw".format(REF['width'], REF['height']),
                                                'label': "{0}x{1}".format(REF['width'], REF['height']),
                                                'height': REF['height'], 'width': REF['width'],
                                                'format': 'video/x-raw', 'fpsmax': fps, 'fps': []})
                if cam['Model'] == 'imx296':
                    # Raspi global shutter camera has specific modes
                    # https://www.raspberrypi.com/documentation/accessories/camera.html
                    caps.append({'value': "1456x1088xx-raw", 'label': "1456x1088", 'height': 1088, 'width': 1456,
                                'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
                retDevices.append({'value': path, 'label': name, 'caps': caps})
        except:
            pass

    # Get remaining devices from GStreamer device provider (USB cameras, etc.)
    device_provider = Gst.DeviceProviderFactory.get_by_name("v4l2deviceprovider")
    devices = device_provider.get_devices()

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
            caps.append({'value': "1920x1080xx-raw", 'label': "1920x1080", 'height': 1080, 'width': 1920,
                        'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
            caps.append({'value': "1640x922xx-raw", 'label': "1640x922", 'height': 922, 'width': 1640,
                        'format': 'video/x-raw', 'fpsmax': '40', 'fps': []})
            caps.append({'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280,
                        'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
            caps.append({'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640,
                        'format': 'video/x-raw', 'fpsmax': '90', 'fps': []})

            # path = "/dev/video0"
            name = "CSI Port Camera"
        # If legacy camera stack on RasPiOS
        elif "mmal service" in name:
            caps.append({'value': "1920x1080xx-raw", 'label': "1920x1080", 'height': 1080, 'width': 1920,
                        'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
            caps.append({'value': "1640x922xx-raw", 'label': "1640x922", 'height': 922, 'width': 1640,
                        'format': 'video/x-raw', 'fpsmax': '40', 'fps': []})
            caps.append({'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280,
                        'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
            caps.append({'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640,
                        'format': 'video/x-raw', 'fpsmax': '90', 'fps': []})

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
            # gstreamer 1.25.0 to 1.26.2 (inclusive) broke the accessing
            # `caps.get_structure(0).get_name()`, but allow wrapping the
            # object in a context manager. with gstreamer 1.24.x one can
            # not use the structure as a context manager at all. version
            # 1.26.3 will supposedly revert it to the previous behaviour.
            outCaps = []
            allowable_formats = ['video/x-raw', 'video/x-h264', 'image/jpeg']
            if is_jetson() in [38, 39]:
                allowable_formats.append('video/x-bayer')
            for i in range(capsGST.get_size()):
                structure = capsGST.get_structure(i)
                try:
                    structure.get_name()
                    if structure.get_name() in allowable_formats:
                        outCaps.extend(decode_caps(structure))
                except AttributeError:
                    with structure as _structure:
                        if _structure.get_name() in allowable_formats:
                            outCaps.extend(decode_caps(_structure))
            # De-duplicate outCaps by the 'value' field
            outCaps = list({cap['value']: cap for cap in outCaps}.values())

            retDevices.append({'value': path, 'label': name, 'caps': outCaps})

    # If we're on a Jetson (Jetpack 6.x) and /dev/video0 or /dev/video0 exist but not listed, add as CSI ports
    if is_jetson() == 36:
        caps = []
        caps.append({'value': "1920x1080xx-raw", 'label': "1920x1080", 'height': 1080, 'width': 1920,
                    'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
        caps.append({'value': "1640x922xx-raw", 'label': "1640x922", 'height': 922, 'width': 1640,
                    'format': 'video/x-raw', 'fpsmax': '40', 'fps': []})
        caps.append({'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280,
                    'format': 'video/x-raw', 'fpsmax': '60', 'fps': []})
        caps.append({'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640,
                    'format': 'video/x-raw', 'fpsmax': '90', 'fps': []})
        if os.path.exists('/dev/video0') and '/dev/video0' not in [i['value'] for i in retDevices]:
            retDevices.append({'value': 'argus0', 'label': 'CSI0', 'caps': caps})
        if os.path.exists('/dev/video1') and '/dev/video1' not in [i['value'] for i in retDevices]:
            retDevices.append({'value': 'argus1', 'label': 'CSI1', 'caps': caps})
    # Jetpack 7.x
    if is_jetson() in [38, 39]:
        # rename any '/dev/video1' values with "vi-output" labels to argus0 and argus1,
        # as these are the CSI cameras on Jetson 7.x
        for dev in retDevices:
            if dev['value'] == '/dev/video0' and 'vi-output' in dev['label']:
                dev['value'] = 'argus0'
                dev['label'] = 'CSI0' + dev['label'].split('vi-output')[1]
            if dev['value'] == '/dev/video1' and 'vi-output' in dev['label']:
                dev['value'] = 'argus1'
                dev['label'] = 'CSI1' + dev['label'].split('vi-output')[1]

    # Include testsrc
    capsTest = []
    capsTest.append({'value': "1920x1080xx-raw", 'label': "1920x1080", 'height': 1080, 'width': 1920,
                    'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
    capsTest.append({'value': "1280x720xx-raw", 'label': "1280x720", 'height': 720, 'width': 1280,
                    'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
    capsTest.append({'value': "640x480xx-raw", 'label': "640x480", 'height': 480, 'width': 640,
                    'format': 'video/x-raw', 'fpsmax': '30', 'fps': []})
    retDevices.append({'value': "testsrc", 'label': "Test Source", 'caps': capsTest})

    # Sort each device's resolutions largest-to-smallest. The caps lists above are
    # built in whichever order the camera's native sensor modes were enumerated,
    # which has no relation to resolution size - so without this, the Resolution
    # dropdown in the UI shows options in a fairly arbitrary order.
    for dev in retDevices:
        dev['caps'].sort(key=lambda c: (c['width'], c['height']), reverse=True)

    print(json.dumps(retDevices))
