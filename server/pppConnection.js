/*
    * PPPConnection.js
    * This module manages a PPP connection using pppd.
    * It allows setting device, baud rate, local and remote IPs,
    * starting and stopping the PPP connection, and retrieving data transfer stats.
    * Used for the PPP feature in ArduPilot
*/
const { autoDetect } = require('@serialport/bindings-cpp')
const si = require('systeminformation')
const fs = require('fs');
const { spawn, execSync } = require('child_process');

function isPi () {
  let cpuInfo = ''
  try {
    cpuInfo = fs.readFileSync('/proc/device-tree/compatible', { encoding: 'utf8' })
  } catch (e) {
    // if this fails, this is probably not a pi
    return false
  }

  const model = cpuInfo
    .split(',')
    .filter(line => line.length > 0)

  if (!model || model.length === 0) {
    return false
  }

  return model[0] === 'raspberrypi'
}

class PPPConnection {
    constructor(settings) {
        this.settings = settings
        this.isConnected = this.settings.value('ppp.enabled', false);
        this.pppProcess = null;
        this.device = this.settings.value('ppp.uart', null);
        this.baudRate = this.settings.value('ppp.baud', { value: 921600, label: '921600' })
        this.localIP = this.settings.value('ppp.localIP', '192.168.144.14');  // default local IP
        this.remoteIP = this.settings.value('ppp.remoteIP', '192.168.144.15'); // default remote IP
        this.baudRates = [
            { value: 921600, label: '921600' },
            { value: 1500000, label: '1.5 MBaud' },
            { value: 2000000, label: '2 MBaud' },
            { value: 12500000, label: '12.5 MBaud' }];
        this.serialDevices = [];

        if (this.isConnected) {
            const attemptPPPStart = () => {
                this.startPPP(this.device, this.baudRate, this.localIP, this.remoteIP, (err, result) => {
                    if (err) {
                        if (err.message.includes('already connected')) {
                            console.log('PPP connection is already established. Retrying in 1 second...');
                            this.isConnected = false;
                            this.setSettings();
                            setTimeout(attemptPPPStart, 1000); // Retry after 1 second
                        } else {
                            console.error('Error starting PPP connection:', err);
                            this.isConnected = false;
                            this.setSettings();
                        }
                    } else {
                        console.log('PPP connection started successfully:', result);
                    }
                });
            };

            attemptPPPStart();
        }
    }

    setSettings() {
        this.settings.setValue('ppp.uart', this.device);
        this.settings.setValue('ppp.baud', this.baudRate);
        this.settings.setValue('ppp.localIP', this.localIP);
        this.settings.setValue('ppp.remoteIP', this.remoteIP);
        this.settings.setValue('ppp.enabled', this.isConnected);
    }

    quitting() {
        // stop the PPP connection if rpanion is quitting
        if (this.pppProcess) {
            console.log('Stopping PPP connection on quit...');
            this.pppProcess.kill();
            execSync('sudo pkill -SIGTERM pppd && sleep 1');
        }
        console.log('PPPConnection quitting');
    }

    async getDevices (callback) {
        // get all serial devices
        this.serialDevices = []
        let retError = null

        const Binding = autoDetect()
        const ports = await Binding.list()

        for (let i = 0, len = ports.length; i < len; i++) {
            if (ports[i].pnpId !== undefined) {
                // usb-ArduPilot_Pixhawk1-1M_32002A000847323433353231-if00
                // console.log("Port: ", ports[i].pnpID);
                let namePorts = ''
                if (ports[i].pnpId.split('_').length > 2) {
                namePorts = ports[i].pnpId.split('_')[1] + ' (' + ports[i].path + ')'
                } else {
                namePorts = ports[i].manufacturer + ' (' + ports[i].path + ')'
                }
                // console.log("Port: ", ports[i].pnpID);
                this.serialDevices.push({ value: ports[i].path, label: namePorts, pnpId: ports[i].pnpId })
            } else if (ports[i].manufacturer !== undefined) {
                // on recent RasPiOS, the pnpID is undefined :(
                const nameports = ports[i].manufacturer + ' (' + ports[i].path + ')'
                this.serialDevices.push({ value: ports[i].path, label: nameports, pnpId: nameports })
            }
        }

        // for the Ras Pi's inbuilt UART
        if (fs.existsSync('/dev/serial0') && isPi()) {
        this.serialDevices.push({ value: '/dev/serial0', label: '/dev/serial0', pnpId: '/dev/serial0' })
        }
        if (fs.existsSync('/dev/ttyAMA0') && isPi()) {
        //Pi5 uses a different UART name. See https://forums.raspberrypi.com/viewtopic.php?t=359132
        this.serialDevices.push({ value: '/dev/ttyAMA0', label: '/dev/ttyAMA0', pnpId: '/dev/ttyAMA0' })
        }
        if (fs.existsSync('/dev/ttyAMA1') && isPi()) {
        this.serialDevices.push({ value: '/dev/ttyAMA1', label: '/dev/ttyAMA1', pnpId: '/dev/ttyAMA1' })
        }
        if (fs.existsSync('/dev/ttyAMA2') && isPi()) {
        this.serialDevices.push({ value: '/dev/ttyAMA2', label: '/dev/ttyAMA2', pnpId: '/dev/ttyAMA2' })
        }
        if (fs.existsSync('/dev/ttyAMA3') && isPi()) {
        this.serialDevices.push({ value: '/dev/ttyAMA3', label: '/dev/ttyAMA3', pnpId: '/dev/ttyAMA3' })
        }
        if (fs.existsSync('/dev/ttyAMA4') && isPi()) {
        this.serialDevices.push({ value: '/dev/ttyAMA4', label: '/dev/ttyAMA4', pnpId: '/dev/ttyAMA4' })
        }
        // rpi uart has different name under Ubuntu
        const data = await si.osInfo()
        if (data.distro.toString().includes('Ubuntu') && fs.existsSync('/dev/ttyS0') && isPi()) {
        // console.log("Running Ubuntu")
        this.serialDevices.push({ value: '/dev/ttyS0', label: '/dev/ttyS0', pnpId: '/dev/ttyS0' })
        }
        // jetson serial ports
        if (fs.existsSync('/dev/ttyTHS1')) {
        this.serialDevices.push({ value: '/dev/ttyTHS1', label: '/dev/ttyTHS1', pnpId: '/dev/ttyTHS1' })
        }
        if (fs.existsSync('/dev/ttyTHS2')) {
        this.serialDevices.push({ value: '/dev/ttyTHS2', label: '/dev/ttyTHS2', pnpId: '/dev/ttyTHS2' })
        }
        if (fs.existsSync('/dev/ttyTHS3')) {
        this.serialDevices.push({ value: '/dev/ttyTHS3', label: '/dev/ttyTHS3', pnpId: '/dev/ttyTHS3' })
        }

        return callback(retError, this.serialDevices);
    }

    startPPP(device, baudRate, localIP, remoteIP, callback) {
        if (this.isConnected) {
            return callback(new Error('PPP is already connected'), {
                selDevice: this.device,
                selBaudRate: this.baudRate,
                localIP: this.localIP,
                remoteIP: this.remoteIP,
                enabled: this.isConnected,
                baudRates: this.baudRates,
                serialDevices: this.serialDevices,
            });
        }
        if (!device) {
            return callback(new Error('Device is required'), {
                selDevice: this.device,
                selBaudRate: this.baudRate,
                localIP: this.localIP,
                remoteIP: this.remoteIP,
                enabled: this.isConnected,
                baudRates: this.baudRates,
                serialDevices: this.serialDevices,
            });
        }
        if (this.pppProcess) {
            return callback(new Error('PPP still running. Please wait for it to finish.'), {
                selDevice: this.device,
                selBaudRate: this.baudRate,
                localIP: this.localIP,
                remoteIP: this.remoteIP,
                enabled: this.isConnected,
                baudRates: this.baudRates,
                serialDevices: this.serialDevices,
            });
        }

        this.device = device;
        this.baudRate = baudRate;
        this.localIP = localIP;
        this.remoteIP = remoteIP;
        
        const args = [
            "pppd",
            this.device.value,
            this.baudRate.value, // baud rate
            //'persist',          // enables faster termination
            //'holdoff', '1',     // minimum delay of 1 second between connection attempts
            this.localIP + ':' + this.remoteIP, // local and remote IPs
            'local',
            'noauth',
            //'debug',
            'crtscts',
            'nodetach',
            'proxyarp',
            'ktune'
        ];
        // if running in dev env, need to preload sudo login
        if (process.env.NODE_ENV === 'development') {
            execSync('sudo -v');
        }
        console.log(`Starting PPP with args: ${args.join(' ')}`);
        this.pppProcess = spawn('sudo', args, {
        //detached: true,
        stdio: ['ignore', 'pipe', 'pipe'] // or 'ignore' for all three to fully detach
        });
        this.pppProcess.stdout.on('data', (data) => {
            console.log("PPP Output: ", data.toString().trim());
        });
        this.pppProcess.stderr.on('data', (data) => {
            console.log("PPP Error: ", data.toString().trim());
        });
        this.pppProcess.on('close', (code) => {
            console.log("PPP process exited with code: ", code.toString().trim());
            this.isConnected = false;
            this.pppProcess = null; // reset the process reference
            this.setSettings();
        });
        this.isConnected = true;
        this.setSettings();
        return callback(null, {
            selDevice: this.device,
            selBaudRate: this.baudRate,
            localIP: this.localIP,
            remoteIP: this.remoteIP,
            enabled: this.isConnected,
            baudRates: this.baudRates,
            serialDevices: this.serialDevices,
        });
    }

    stopPPP(callback) {
        if (!this.isConnected) {
            return callback(new Error('PPP is not connected'), {
                selDevice: this.device,
                selBaudRate: this.baudRate,
                localIP: this.localIP,
                remoteIP: this.remoteIP,
                enabled: this.isConnected,
                baudRates: this.baudRates,
                serialDevices: this.serialDevices,
            });
        }
        if (this.pppProcess) {
            // Gracefully kill the PPP process
            console.log('Stopping PPP connection...');
            this.pppProcess.kill();
            execSync('sudo pkill -SIGTERM pppd');
            this.isConnected = false;
            this.setSettings();
        }
        return callback(null, {
            selDevice: this.device,
            selBaudRate: this.baudRate,
            localIP: this.localIP,
            remoteIP: this.remoteIP,
            enabled: this.isConnected,
            baudRates: this.baudRates,
            serialDevices: this.serialDevices,
        });
    }

    getPPPdatarate(callback) {
        if (!this.isConnected) {
            return callback(new Error('PPP is not connected'));
        }
        // get current data transfer stats for connected PPP session
        return new Promise((resolve, reject) => {
            exec('ifconfig ppp0', (error, stdout, stderr) => {
                if (error) {
                    reject(`Error getting PPP data rate: ${stderr}`);
                } else {
                    // match format RX packets 110580  bytes 132651067 (132.6 MB)
                    const match = stdout.match(/RX packets \d+  bytes (\d+) \(\d+\.\d+ MB\).*TX packets \d+  bytes (\d+) \(\d+\.\d+ MB\)/);
                    if (match) {
                        const rxBytes = parseInt(match[1], 10);
                        const txBytes = parseInt(match[5], 10);
                        console.log(`PPP Data Rate - RX: ${rxBytes} bytes, TX: ${txBytes} bytes`);
                        resolve({ rxBytes, txBytes });
                    } else {
                        reject('Could not parse PPP data rate');
                    }
                }
            });
        });
    }

    getPPPSettings(callback) {
        this.getDevices((err, devices) => {
            if (err) {
                console.error('Error fetching serial devices:', err);
                return callback(err, {
                    selDevice: null,
                    selBaudRate: this.baudRate,
                    localIP: this.localIP,
                    remoteIP: this.remoteIP,
                    enabled: this.isConnected,
                    baudRates: this.baudRates,
                    serialDevices: [],
                });
            } else {
                this.serialDevices = devices;
                // Set default device if not already set
                if (!this.device && this.serialDevices.length > 0) {
                    this.device = this.serialDevices[0]; // Set first available device as default
                }
                // if this.device is not in the list, set it to first available device
                if (this.device && !this.serialDevices.some(d => d.value === this.device.value)) {
                    this.device = this.serialDevices[0];
                }
                return callback(null, {
                    selDevice: this.device,
                    selBaudRate: this.baudRate,
                    localIP: this.localIP,
                    remoteIP: this.remoteIP,
                    enabled: this.isConnected,
                    baudRates: this.baudRates,
                    serialDevices: this.serialDevices,
                });
            }
        });
    }
}

module.exports = PPPConnection;