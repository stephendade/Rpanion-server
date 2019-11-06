# Rpanion-server

This is a node.js based server for Drone companion computers.

It presents a web-based interface (running on the drone's companion computer), where system settings such as network and telemetry streaming
can be configured from.

## Using this project

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

The React application will run on port 3000 and the server port 3001.

Requirements:

sudo apt install libgstreamer-plugins-base1.0* libgstreamer1.0-dev libgstrtspserver-1.0-dev gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly

