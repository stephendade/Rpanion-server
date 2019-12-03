#!/usr/bin/env python3
"""
Find device caps
Requires gst
"""

import sys
import json
import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib

Gst.init(sys.argv)

device_provider = Gst.DeviceProviderFactory.get_by_name("v4l2deviceprovider")
devices = device_provider.get_devices()

retDevices = []

for device in devices:
    path = device.get_properties().get_string("device.path")
    name = device.get_properties().get_string("v4l2.device.card")
    caps = []

    # Check if it's a Rpi Cam V2, if so manually add modes for hardware encoding
    # Also change path to tell rtsp-server to use specific ras pi cam driver
    if "mmal service" in name:
        caps = []
        caps.append({'value': 0, 'label': "1920x1080", 'height': 1080, 'width': 1920, 'format': 'video/x-h264'})
        caps.append({'value': 1, 'label': "1640x922", 'height': 922, 'width': 1640, 'format': 'video/x-h264'})
        caps.append({'value': 2, 'label': "1280x720", 'height': 720, 'width': 1280, 'format': 'video/x-h264'})
        caps.append({'value': 3, 'label': "640x480", 'height': 480, 'width': 640, 'format': 'video/x-h264'})
        name = "Raspberry Pi Camera (V2)"
        path = "rpicam"

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
        
        # enumerate available resolutions
        for i in range(capsGST.get_size()):
            structure = capsGST.get_structure(i)
            if structure.get_name() in ['video/x-raw', 'video/x-h264'] :
                width = structure.get_int('width').value
                height = structure.get_int('height').value
                caps.append({'value': i, 'label': "{0}x{1}".format(width, height), 'height': int(height), 'width': int(width), 'format': structure.get_name()})
            
    retDevices.append({'value': path, 'label': name, 'caps': caps})


print(json.dumps(retDevices))


