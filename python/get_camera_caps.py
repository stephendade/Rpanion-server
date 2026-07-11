#!/usr/bin/env python3
# -*- coding:utf-8 vi:ts=4:noexpandtab -*-

import subprocess
import re
import sys
import json
import os

def check_if_v4l2_ctl_avail():
    try:
        subprocess.run(['v4l2-ctl', '--help'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Could not load v4l2-ctl or v4l2-ctl is not installed. Exiting.")
        sys.exit(1)

def get_subdev_paths():
    base_path = '/dev'
    return sorted([os.path.join(base_path, dev) for dev in os.listdir(base_path) if dev.startswith('v4l-subdev')])

def get_video_device_paths():
    base_path = '/dev'
    return sorted([os.path.join(base_path, dev) for dev in os.listdir(base_path) if dev.startswith('video')])

def get_mbus_codes(dev_path):
    command = f"v4l2-ctl -d {dev_path} --list-subdev-mbus-codes 0"
    result = subprocess.run(command, shell=True, text=True, capture_output=True)
    if result.returncode != 0:
        return []
    pattern = r"0x([0-9a-fA-F]+):\s+([A-Za-z0-9_]+)"
    return re.findall(pattern, result.stdout)

def get_resolutions(dev_path, mbus_code):
    command = f"v4l2-ctl -d {dev_path} --list-subdev-framesizes pad=0,code=0x{mbus_code}"
    result = subprocess.run(command, shell=True, text=True, capture_output=True)
    if result.returncode != 0:
        return []
    pattern = r"Size Range: (\d+)x(\d+)"
    matches = re.findall(pattern, result.stdout)
    return [{'width': int(w), 'height': int(h)} for w, h in matches]

def get_formats_and_resolutions(dev_path):
    command = f"v4l2-ctl -d {dev_path} --list-formats-ext"
    result = subprocess.run(command, shell=True, text=True, capture_output=True)
    if result.returncode != 0:
        return []

    devices = []
    fmt_pattern = r"^\s*\[\d+\]: '(\w+)' \(.*?\)"
    size_pattern = r"\s+Size: Discrete (\d+)x(\d+)"
    current_fmt = None

    for line in result.stdout.splitlines():
        fmt_match = re.match(fmt_pattern, line)
        if fmt_match:
            current_fmt = fmt_match.group(1)
            continue

        size_match = re.match(size_pattern, line)
        if size_match and current_fmt:
            width, height = map(int, size_match.groups())
            devices.append({
                'format': current_fmt,
                'width': width,
                'height': height,
                'label': f"{width}x{height}_{current_fmt}",
                'value': f"{current_fmt}_{width}x{height}"
            })

    return devices

def get_card_name(dev_path):
    command = f"v4l2-ctl -d {dev_path} --all"
    result = subprocess.run(command, shell=True, text=True, capture_output=True)
    if result.returncode != 0:
        return None

    match = re.search(r"Card type\s+:\s+(.+)", result.stdout)
    if match:
        return match.group(1).strip()

    return None

def get_subdev_name(dev_path):
    """Read sensor model name from sysfs — fast file read, no subprocess."""
    dev_name = os.path.basename(dev_path)  # e.g. v4l-subdev0
    sysfs_path = f"/sys/class/video4linux/{dev_name}/name"
    try:
        with open(sysfs_path, 'r') as f:
            # sysfs name is e.g. "imx219 10-0010" — take just the model part
            return f.read().strip().split()[0]
    except (FileNotFoundError, IndexError):
        return None

# Check library availability without importing picamera2 at all.
# Saves ~10s on a Pi Zero 2W
def get_capabilities():
    """Check cv2 and picamera2 availability without triggering libcamera init."""
    import importlib.util
    return {
        'cv2': importlib.util.find_spec('cv2') is not None,
        'picamera2': importlib.util.find_spec('picamera2') is not None,
    }

check_if_v4l2_ctl_avail()
devices = []
 
# Query v4l2 subdevices before initializing libcamera.
# On Pi, libcamera's daemon holds /dev/media0 open after global_camera_info(),
# which causes v4l2-ctl subdev ioctls to fail or return no results.
# Doing the v4l2 queries first avoids that conflict entirely.
 
# Pass 1: enumerate CSI caps via v4l2-ctl (no libcamera yet)
csi_devices = []
for dev_path in get_subdev_paths():
    mbus_codes = get_mbus_codes(dev_path)
    if not mbus_codes:
        continue

    # Get card name here via v4l2 — avoids needing libcamera later
    card_name = get_subdev_name(dev_path) or "Unnamed CSI Camera"

    device_caps = {
        'id': f"CSI-{re.sub(r'[^a-zA-Z0-9]', '_', card_name)}",
        'device': None,
        'type': 'CSI',
        'card_name': card_name,
        'caps': []
    }
 
    seen = set()
    for mbus_code, pixel_format in mbus_codes:
        resolutions = get_resolutions(dev_path, mbus_code)
        for res in resolutions:
            key = (res['width'], res['height'])
            if key in seen:
                continue
            seen.add(key)
            device_caps['caps'].append({
                'format': 'YUV420',
                'width': res['width'],
                'height': res['height'],
                'label': f"{res['width']}x{res['height']}",
                'value': f"{res['width']}x{res['height']}_YUV420"
            })
        break  # all mbus codes report the same resolutions — one query is enough
 
    if device_caps['caps']:
        csi_devices.append(device_caps)

# Pass 2: Initialize libcamera to get friendly model names and capabilities.
# v4l2-ctl is finished with the subdevs so there is no conflict.
devices.extend(csi_devices)

# Process UVC cameras
for dev_path in get_video_device_paths():
    caps = get_formats_and_resolutions(dev_path)
    if caps:
        devices.append({
            'id': dev_path, # use the device path as the unique ID for UVC cameras
            'device': dev_path,
            'type': 'UVC',
            'card_name': get_card_name(dev_path) or "Unnamed UVC Camera",
            'caps': caps
        })

output = {
    'devices': devices,
    'capabilities': get_capabilities()
}

print(json.dumps(output, indent=4))