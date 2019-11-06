const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger')();
const serialManager = require('./serialManager');
const networkManager = require('./networkManager');
const analogManager = require('./analogPi');
const aboutPage = require('./aboutInfo');

const videoStream = require('./videostream');


const app = express();
const http = require("http").Server(app)

var io = require('socket.io')(http);
const { check, validationResult } = require('express-validator');

const sManager = new serialManager();

const vManager = new videoStream();

var analogLoop = null;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(pino);

// Simply pass `compression` as an Express middleware!
app.use(compression());
app.use(bodyParser.json());

app.get('/api/portstatus', (req, res) => {
    sManager.refreshPorts();
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ portStatus: sManager.ports, ifaces: sManager.iface}));
});

app.get('/api/softwareinfo', (req, res) => {
    aboutPage.getSoftwareInfo((OSV, NodeV, RpanionV, err) => {
        if (!err) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ OSVersion: OSV, Nodejsversion: NodeV, rpanionversion: RpanionV}));
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ OSVersion: err, Nodejsversion: err, rpanionversion: err}));
        }
    });

});

app.get('/api/videodevices', (req, res) => {
    vManager.getVideoDevices((err, devices) => {
        if (!err) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ dev: devices,
                                      vidDeviceSelected: devices[0],
                                      vidres: devices[0].caps,
                                      vidResSelected: devices[0].caps[0],
                                      selectFramerates: devices[0].caps[0].selectFramerates,
                                      framerateSelected: devices[0].caps[0].selectFramerates[0],
                                      streamingStatus: vManager.active,
                                      streamAddress: vManager.deviceAddress,
                                      errors: null}));
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ errors: err}));
        }
    });

});

app.get('/api/hardwareinfo', (req, res) => {
    aboutPage.getHardwareInfo((RAM, CPU, err) => {
        if (!err) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ CPUName: CPU, RAMName: RAM}));
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ CPUName: err, RAMName: err}));
        }
    });

});

io.on('connection', function(socket) {
    //only set interval if not already set
    if (analogLoop !== null) {
        return;
    }
    // send the analog readings out every 1 second
    analogLoop = setInterval(function() {
        analogManager.getAnalogReading((err, readings) => {
            if (err) {
                io.sockets.emit('analogstatus', { errormessage: err.toString() });
            }
            else {
                io.sockets.emit('analogstatus', { portStatus: readings, errormessage: "" });
            }
        });
        sManager.refreshPorts();
        io.sockets.emit('serialstatus', { portStatus: sManager.ports, ifaces: sManager.iface});
    }, 1000);
});

app.get('/api/networkadapters', (req, res) => {
    networkManager.getAdapters((err, netDeviceList) => {
        res.setHeader('Content-Type', 'application/json');
        var ret = {netDevice: netDeviceList};
        res.send(JSON.stringify(ret));
    });
});

app.get('/api/networkconnections', (req, res) => {
    networkManager.getConnections((err, netConnectionList) => {
        res.setHeader('Content-Type', 'application/json');
        var ret = {netConnection: netConnectionList};
        res.send(JSON.stringify(ret));
    });
});

// Route that receives a POST request
app.post('/api/portmodify', [], function (req, res) {
    sManager.updateLinkSettings(req.body.user);
})

app.post('/api/startstopvideo', [check('device'),
                                 check('height').isInt({min: 1}),
                                 check('width').isInt({min: 1}),
                                 check('framerate').isInt({min: 1})], (req, res) => {
    //user wants to start/stop video streaming
    vManager.startStopStreaming(req.body.device, req.body.height, req.body.width, req.body.framerate, (err, status, addresses) => {
        if(!err) {
            res.setHeader('Content-Type', 'application/json');
            var ret = {streamingStatus: status, streamAddresses: addresses};
            res.send(JSON.stringify(ret));
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            var ret = {streamingStatus: false, streamAddresses: ["Error " + err]};
            res.send(JSON.stringify(ret));
        }
    });
})

//Get details of a network connection by connection ID
app.post('/api/networkIP', [check('conName').isUUID()], (req, res) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    networkManager.getConnectionDetails(req.body.conName, (err, conDetails) => {
        res.setHeader('Content-Type', 'application/json');
        var ret = {netConnectionDetails: conDetails};
        //console.log(ret);
        res.send(JSON.stringify(ret));
    });
});

//user wants to activate network
app.post('/api/networkactivate', [check('conName').isUUID()], (req, res) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.setHeader('Content-Type', 'application/json');
        var ret = {error: "Bad input - " + errors.array()[0].param};
        res.send(JSON.stringify(ret));
    }
    else {
        console.log('Activating network ' + req.body.conName);
        networkManager.activateConnection(req.body.conName, (err) => {
            if (err) {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: err};
                res.send(JSON.stringify(ret));
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: null, action: "NetworkActivateOK"};
                res.send(JSON.stringify(ret));
            }
        });
    }
});

//user wants to delete network
app.post('/api/networkdelete', [check('conName').isUUID()], (req, res) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.setHeader('Content-Type', 'application/json');
        var ret = {error: "Bad input - " + errors.array()[0].param};
        res.send(JSON.stringify(ret));
    }
    else {
        console.log('Deleting network ' + req.body.conName);
        networkManager.deleteConnection(req.body.conName, (err) => {
            if (err) {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: err};
                res.send(JSON.stringify(ret));
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: null, action: "NetworkDeleteOK"};
                res.send(JSON.stringify(ret));
            }
        });
    }
});

//user wants to edit network
app.post('/api/networkedit', [check('conName').isUUID(),
                              check('conSettings.ipaddresstype.value').isIn(['auto', 'manual', 'shared']),
                              check('conSettings.ipaddress.value').optional().isIP(),
                              check('conSettings.subnet.value').optional().isIP(),
                              check('conSettings.wpaType.value').optional().isIn(['wpa-none', 'wpa-psk']),
                              check('conSettings.password.value').optional().escape(),
                              check('conSettings.ssid.value').optional().escape(),
                              check('conSettings.band.value').optional().isIn(['a', 'bg']),
                              check('conSettings.mode.value').optional().isIn(['infrastructure', 'ap']),
                              ],
                              (req, res) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.setHeader('Content-Type', 'application/json');
        var ret = {error: "Bad input - " + errors.array()[0].param};
        res.send(JSON.stringify(ret));
    }
    else {
        console.log('Editing network ' + req.body.conName);
        networkManager.editConnection(req.body.conName, req.body.conSettings, (err) => {
            if (err) {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: err};
                res.send(JSON.stringify(ret));
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: null, action: "NetworkEditOK"};
                res.send(JSON.stringify(ret));
            }
        });
    }
});

//User wants to add network
app.post('/api/networkadd', [check('conSettings.ipaddresstype.value').isIn(['auto', 'manual', 'shared']),
                              check('conSettings.ipaddress.value').optional().isIP(),
                              check('conSettings.subnet.value').optional().isIP(),
                              check('conSettings.wpaType.value').optional().isIn(['wpa-none', 'wpa-psk']),
                              check('conSettings.password.value').optional().escape(),
                              check('conSettings.ssid.value').optional().escape(),
                              check('conSettings.band.value').optional().isIn(['a', 'bg']),
                              check('conSettings.mode.value').optional().isIn(['infrastructure', 'ap']),
                              check('conName').escape(),
                              check('conType').escape(),
                              check('conAdapter').escape()
                              ],
                              (req, res) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.setHeader('Content-Type', 'application/json');
        var ret = {error: "Bad input - " + errors.array()[0].param};
        res.send(JSON.stringify(ret));
    }
    else {
        console.log('Adding network ' + req.body.conName);
        networkManager.addConnection(req.body.conName, req.body.conType, req.body.conAdapter, req.body.conSettings, (err) => {
            if (err) {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: err};
                res.send(JSON.stringify(ret));
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: null, action: "NetworkAddOK"};
                res.send(JSON.stringify(ret));
            }
        });
    }
    console.log(req.body);
});

http.listen(3001, () =>
    console.log('Express server is running on localhost:3001')
);
