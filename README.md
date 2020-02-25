[![Build Status](https://travis-ci.org/stephendade/Rpanion-server.svg?branch=master)](https://travis-ci.org/stephendade/Rpanion-server)

User Documentation is at https://www.docs.rpanion.com/software/rpanion-server

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

### Automatic (Raspberry Pi)

For the Raspberry Pi 3 or 4, run the ``./deploy/RasPi3-4-deploy.sh`` on a fresh Raspian install
to configure and install Rpanion-server. Note this does not configure an initial Wifi hotspot.

This can be done directly by typing the following into a Raspian console:

```
curl -sL https://github.com/stephendade/Rpanion-server/raw/master/deploy/RasPi-deploy.sh | bash -
```

For the Raspberry Pi Zero W, run the ``./deploy/RasPiZero-deploy.sh`` on a fresh Raspian install
to configure and install Rpanion-server. Note this does configure an initial Wifi hotspot.

This can be done directly by typing the following into a Raspian console:

```
curl -sL https://github.com/stephendade/Rpanion-server/raw/master/deploy/RasPiZero-deploy.sh | bash -
```

If not already configured, for an initial Wifi hotspot, run the ``./deploy/wifi_access_point.sh`` script.
The hotspot has the SSID "rpanion" and password "rpanion123". The Pi's IP address will be 10.0.2.100,
so the Rpanion-sever website will be available at http://10.0.2.100:3000.

### Manual

Rpanion-server requires a recent version of node.js. It can be installed
via package manager:

```
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs npm
```

Note that the Raspberry Pi Zero is not compatible with version 12 (or later) of node.js. Version 11 
can instead be installed via:

```
wget https://nodejs.org/download/release/v11.15.0/node-v11.15.0-linux-armv6l.tar.xz
sudo mkdir -p /usr/local/lib/nodejs
sudo tar -xJvf node-v11.15.0-linux-armv6l.tar.xz -C /usr/local/lib/nodejs
sudo ln -s /usr/local/lib/nodejs/node-v11.15.0-linux-armv6l/bin/node /usr/local/bin
sudo ln -s /usr/local/lib/nodejs/node-v11.15.0-linux-armv6l/bin/npm /usr/local/bin
```

The required prerequisite packages can be installed via:

```
sudo apt install libgstreamer-plugins-base1.0* libgstreamer1.0-dev libgstrtspserver-1.0-dev gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-plugins-base-apps network-manager python3 python3-dev python3-gst-1.0 python3-pip dnsmasq

sudo apt purge openresolv dhcpcd5

pip3 install netifaces --user
```

For some systems (such as the Raspberry Pi), additional permissions may be requires to run ``nmcli`` from the
default user. In ``/etc/NetworkManager/NetworkManager.conf`` add ``auth-polkit=false`` in the ``main`` section.

If the Raspberry Pi Camera is intended to be used, the specific Gstreamer element (credit to 
https://github.com/thaytan/gst-rpicamsrc) must be installed:

```
git submodule init && git submodule update
cd ./modules/gst-rpicamsrc
./autogen.sh --prefix=/usr --libdir=/usr/lib/arm-linux-gnueabihf/
make
sudo make install
```

The node.js packages need to be installed using ``npm install`` in the Rpanion-server folder.



## Building and Running in production mode

Running in production mode builds the reactJS app first. This gives
performance increases over running in development mode.

```bash
npm run build
PORT=3000
npm run server
```

## Building and Running in development mode

Running in development mode allows for any code changes to trigger a restart of Rpanion-server. 
This is 

Rpanion-server consists of a node.js server running on port 3001 and a React frontend application
running on port 3000 in development mode. 

In production mode, the React application is rendered statically
from the node.js server on port 3001. This can be overidden via setting the ``PORT`` environment
variable (see ``rpanion.service`` for for example).

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

At this point, the website will be active at ``http://<ip of device>:3000``

## Updating

When updating Rpanion-server from Github, run ``npm install`` to grab any
changed dependencies.

If running in production mode, run ``npm run build`` too for the ReactJS app 
to be rebuilt.

If running Rpanion-server as a service, ensure to restart the service.

## Tests

Unit tests are split into seperate commands for the frontend (ReactJS) and backend.

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

Use ``npm version minor`` to create a new release. This will also update ``CHANGELOG.md``.

To produce a disk image from a SD card, insert the card and run ``./deploy/create_image.sh``.

## Running as a Service

To have Rpanion-server running on automatically on boot, there is an included systemd service file.

This can be enabled via:

```
sudo cp rpanion.service /etc/systemd/system
sudo systemctl enable rpanion.service
```

