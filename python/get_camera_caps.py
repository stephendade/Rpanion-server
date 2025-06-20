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
    except subprocess.CalledProcessError:
        print("v4l2-ctl is not installed. Exiting.")
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

check_if_v4l2_ctl_avail()

devices = []

# Process CSI cameras
for dev_path in get_subdev_paths():
    mbus_codes = get_mbus_codes(dev_path)
    if not mbus_codes:
        continue

    card_name = get_card_name(dev_path) or "Unnamed CSI Camera"

    device_caps = {
        # Don't specify a device path for CSI cameras,
        # but generate a unique ID for them.
        'id': f"CSI-{re.sub(r'[^a-zA-Z0-9]', '_', card_name)}",
        'device': None,
        'type': 'CSI',
        'card_name': card_name,
        'caps': []
    }

    for mbus_code, pixel_format in mbus_codes:
        resolutions = get_resolutions(dev_path, mbus_code)

        for res in resolutions:
            fmt = pixel_format.split("MEDIA_BUS_FMT_")[1] if "MEDIA_BUS_FMT_" in pixel_format else pixel_format
            cap_info = {
                'format': fmt,
                'width': res['width'],
                'height': res['height'],
                'label': f"{res['width']}x{res['height']}_{fmt}",
                'value': f"{mbus_code}_{fmt}_{res['width']}x{res['height']}"
            }
            device_caps['caps'].append(cap_info)

    if device_caps['caps']:
        devices.append(device_caps)

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

print(json.dumps(devices, indent=4))