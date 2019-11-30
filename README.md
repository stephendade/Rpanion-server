[![Build Status](https://travis-ci.org/stephendade/Rpanion-server.svg?branch=master)](https://travis-ci.org/stephendade/Rpanion-server)

# Rpanion-server

This is a node.js based server for companion computers used in Mavlink-based vehicles (ie Ardupilot, PX4).

It presents a web-based interface (running on the companion computer), where system settings such as network,
telemetry and video streaming can be configured from.

## Features

Rpanion-server allows the user to configure:

- Flight Controller telemetry routing to udp outputs
- Video Streaming via an RTSP server
- Network configuration

## Dependencies and First-time configuration

Rpanion-server requires Version 12 of node.js or later, It can be installed
via package manager:

```
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs npm
```

The required prerequisite packages can be installed via:

```
sudo apt install libgstreamer-plugins-base1.0* libgstreamer1.0-dev libgstrtspserver-1.0-dev gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-plugins-base-apps network-manager python3 python3-dev python3-gst-1.0 python3-pip dnsmasq

sudo apt purge openresolv dhcpcd5

pip3 install netifaces --user
```

For some systems (such as the Raspberry Pi), additional permissions may be requires to run ``nmcli`` from the
default user. In ``/etc/NetworkManager/NetworkManager.conf`` add ``auth-polkit=false`` in the ``main`` section.

Lastly the node.js packages need to be installed using ``npm install`` in the Rpanion-server folder.

## Building and Running

If the Raspberry Pi Camera is intended to be used, the specific Gstreamer element (credit to 
https://github.com/thaytan/gst-rpicamsrc) must be installed:

```
git submodule init && git submodule update
cd ./modules/gst-rpicamsrc
./autogen.sh --prefix=/usr --libdir=/usr/lib/arm-linux-gnueabihf/
make
sudo make install
```

Rpanion-server consists of a node.js server running on port 3001 and a React frontend application
running on port 3000.

You can start the server on its own with the command:

```bash
npm run server
```

Run the React application on its own with the command:

```bash
npm start
```

Run both applications together with the command:

```bash
npm run dev
```

Unit tests can be run with the command:

```bash
npm test
```

## Running as a Service

To have Rpanion-server running on automatically on boot, there is an included systemd service file.

This can be enabled via:

```
sudo cp rpanion.service /etc/systemd/system
sudo systemctl enable rpanion.service
```

