#!/usr/bin/env python3
"""
Output the curent wireguard config in json format
"""

import json
from pathlib import Path
import os
import subprocess

# Get running links
links = subprocess.run(['ip', '-j', 'link', 'list'], stdout=subprocess.PIPE).stdout.decode('utf-8')
links = json.loads(links)

retDevices = []
files = Path('/etc/wireguard').glob('*.conf')
for file in files:
    text = file.read_text()
    peerIPLine = [line for line in text.split('\n') if "Address" in line]
    serverIPLine = [line for line in text.split('\n') if "Endpoint" in line]
    peerIP = peerIPLine[0].split('=')[-1].strip()
    serverIP = serverIPLine[0].split('=')[-1].strip()

    # check if there's a link running with that name
    status = "disabled"
    for link in links:
        if link['ifname'] == str(os.path.basename(file).rsplit('.', 1)[0]):
            # Wireguard doesn't have an up/down state. So just tell the user that it's enabled
            status = "enabled"
            break

    retDevices.append({'profile': str(os.path.basename(file)), 'peer': peerIP, 'server': serverIP, 'status': status, 'interface': ""})

print(json.dumps(retDevices))
