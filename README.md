<div align="left">

![Build Status](https://github.com/stephendade/Rpanion-server/actions/workflows/unitests.yml/badge.svg)![Package Status](https://github.com/stephendade/Rpanion-server/actions/workflows/package.yml/badge.svg)![Coverage Status](https://coveralls.io/repos/github/stephendade/Rpanion-server/badge.svg)

</div>

User Documentation is at https://www.docs.rpanion.com/software/rpanion-server

<p float="left">
<img src="https://raw.githubusercontent.com/stephendade/Rpanion-server/master/images/controller.png" width="200">
<img src="https://raw.githubusercontent.com/stephendade/Rpanion-server/master/images/network.png" width="200">
<img src="https://raw.githubusercontent.com/stephendade/Rpanion-server/master/images/video.png" width="200">
</p>

# Rpanion-server

This is a node.js based server for companion computers used in Mavlink-based vehicles (ie Ardupilot, PX4).

It presents a web-based interface (running on the companion computer), where system settings such as network,
telemetry and video streaming can be configured from.

On the Raspberry Pi, Rpanion-server is compatible with the Raspberry Pi OS and Ubuntu 20.04 LTS.

On the Nvidia Jetson, Rpanion-server is compatible with Ubuntu 18.04 LTS.

On the Nvidia Jetson Orin, Rpanion-server is compatible with Ubuntu 22.04 LTS.

On the [Libre Computer Le Potato](https://libre.computer/products/aml-s905x-cc/), Rpanion-server is compatible with their flavor of [Raspberry Pi OS](https://distro.libre.computer/ci/raspbian/).

> [!NOTE]
> Some users may have issues connecting to the UART on the Raspberry Pi 3B+. Further details and configuration fixes are at https://github.com/stephendade/Rpanion-server/issues/215#issuecomment-2049058406.

> [!NOTE]
> For the Raspberry Pi CM4, Wifi AP performance is typically poor when using the
> internal antenna. It is recommended to use an external antenna. Additionally
> any CSI cameras will not be autodetected. See [here](https://forums.raspberrypi.com/viewtopic.php?t=352540) for more details.


## Features

Rpanion-server allows the user to configure:

- Flight Controller telemetry routing to udp outputs
- Video Streaming via an RTSP server
- Network configuration
- NTRIP Streaming
- Logging (tlog and bin logs)

## Installing

Rpanion-server has pre-built debian packges for arm64 platforms (Jetson, Raspberry Pi, etc). This
is the easiest way to get started. The packages are available from the "Releases" page.

### Disk Images

There are full disk images with a pre-configured Wifi hotspot for the Raspberry Pi. These
are on the "releases" page

### Installation from deb package

This method installs rpanion-server (and pre-requisities) on an existing system.

First install the required packages:

```
sudo apt install -y gstreamer1.0-plugins-good libgstrtspserver-1.0-0 gir1.2-gst-rtsp-server-1.0 
sudo apt install -y gstreamer1.0-plugins-base-apps gstreamer1.0-plugins-ugly gstreamer1.0-plugins-bad
sudo apt install -y network-manager python3 python3-gst-1.0 python3-pip dnsmasq git jq wireless-tools iw
sudo apt install -y python3-lxml python3-numpy gpsbabel zip
```

If running on RasPiOS, install the libcamera drivers:

```
sudo apt install -y gstreamer1.0-libcamera python3-picamera2 python3-libcamera python3-kms++
```

Install Nodejs:
```
sudo apt install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt update
sudo apt install -y nodejs
```


To (optionally) use the Zerotier and/or Wireguard VPN's, install as follows:

```
curl -s https://install.zerotier.com | sudo bash
sudo apt install wireguard wireguard-tools
```

Download Rpanion-server from the releases page.

Then install Rpanion-server:
```
sudo dpkg -i rpanion-server-xxx.deb
```

For device-specific configurations, see the ``./deploy`` folder for Jetson, X86 and Raspberry Pi (RasPiOS and Ubuntu) scripts.

After installation, Rpanion-server will be available at http://<device_ip>:3001

### Raspberry Pi notes

The Raspberry Pi Zero W(1) and Raspberry Pi 2 are not supported from version 0.10.0 onwards.

Note the CSI camera does not currently work on Ubuntu 22.04 and 24.04, due to incompatibilities with the Raspberry Pi.

Note the GPIO UARTs are not currently working with Ubuntu 24.04.

If an older version of the Raspberry Pi OS is used (Buster, V10 or below), the ``gst-rpicamsrc`` Gstreamer element
must be installed. See https://github.com/thaytan/gst-rpicamsrc for install instructions.

### Libre Computer AML-S905X-CC aka 'Le Potato' notes

If using a usb to serial converter, you might need to modify permissions of the device.

**Temporary device permission update**

```
sudo chmod 666 /dev/ttyACM0
```

**Persistent device permission update**

Follow the steps on this site for your specific device:
https://www.xmodulo.com/change-usb-device-permission-linux.html

## Building and Running in development mode

The mavlink-router (https://github.com/mavlink/mavlink-router) software is used for backend routing and is required to be installed.

Follow the scripts in the ``/deploy`` folder for your selected platform to set up the
development environment. The ``./deploy/devExtras.sh`` contains additional packages to install.

Running in development mode allows for any code changes to trigger a restart of Rpanion-server. 

Rpanion-server consists of a node.js server running on port 3001 and a React frontend application
running on port 3000 in development mode. 

Run both applications (front and back end) together, use the command:

```bash
npm run dev
```

It is important to *only* use ``npm run dev`` during development, as it will skip
the user login and authentication checks.

At this point, the website will be active at ``http://<ip of device>:3000``

## Packaging

To produce a deb package, run ``npm run package``.

## Default username and password

Rpanion-server has access control in place to prevent unauthorised users from
making changes to the system via the GUI.

The access control does *not* apply to any MAVLink or video streams

The default username is ``admin`` and password ``admin``. This can be changed
on the "User Management" page.

Usernames and passwords are stored in the ``user.json`` file in the Rpanion-server folder. Resetting this file (via ``git checkout user.json``)
will reset the usernames/passwords back to it's defaults.

## Tests

Unit tests are split into separate commands for the frontend (ReactJS) and backend.

Unit tests can be run with the command:

```bash
npm run testback
npm run testfront
```

Code coverage statistics are automatically calculated for the backend tests.

Linting (via eslint) is available via:

```bash
npm run lint
```

## Releasing

Use ``npx npm-check-updates -u`` to update nodejs libraries.

Use ``npm version minor`` to create a new release commit.

Then update the changelog.md and amend this to the commit.

Then "git push --tags" to create the release PR.

To produce a disk image from a SD card, insert the card and run ``./deploy/create_image.sh``.

