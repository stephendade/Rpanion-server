const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger')();
const networkManager = require('./networkManager');
const aboutPage = require('./aboutInfo');
const videoStream = require('./videostream');
const fcManagerClass = require('./flightController');

var winston = require('./winstonconfig')(module);

const app = express();
const http = require("http").Server(app)
const path = require('path');

var io = require('socket.io')(http);
const { check, validationResult } = require('express-validator');


const vManager = new videoStream();

const fcManager = new fcManagerClass();

var FCStatusLoop = null;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(pino);

// Simply pass `compression` as an Express middleware!
app.use(compression());
app.use(bodyParser.json());

// Serve the static files from the React app
app.use(express.static(path.join(__dirname, '..', '/build')));

app.get('/api/softwareinfo', (req, res) => {
    aboutPage.getSoftwareInfo((OSV, NodeV, RpanionV, err) => {
        if (!err) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ OSVersion: OSV, Nodejsversion: NodeV, rpanionversion: RpanionV}));
            winston.info('/api/softwareinfo OS:' + OSV + " Node:" + NodeV + " Rpanion:" + RpanionV);
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ OSVersion: err, Nodejsversion: err, rpanionversion: err}));
            winston.error('Error in /api/softwareinfo ', { message: err });
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
                                      streamingStatus: vManager.active,
                                      streamAddress: vManager.deviceAddress,
                                      errors: null}));
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ errors: err}));
            winston.error('Error in /api/videodevices ', { message: err });
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
            winston.error('Error in /api/hardwareinfo ', { message: err });
        }
    });

});


app.get('/api/FCOutputs', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ UDPoutputs: fcManager.getUDPOutputs() }));
});

app.get('/api/FCDetails', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    fcManager.getSerialDevices((err, devices, bauds, seldevice, selbaud, mavers, selmav, active) => {
        if (!err) {
            console.log("Sending");
            console.log(devices);
            res.send(JSON.stringify({ telemetryStatus: active,
                                      serialPorts: devices,
                                      baudRates: bauds,
                                      serialPortSelected: seldevice,
                                      mavVersions: mavers,
                                      mavVersionSelected: selmav,
                                      baudRateSelected: selbaud }));
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ serialPortSelected: err, baudRateSelected: err}));
            winston.error('Error in /api/FCDetails ', { message: err });
        }
    });
});

app.post('/api/FCModify', [check('device').isJSON(), check('baud').isJSON(), check('mavversion').isJSON()], function (req, res) {
    //User wants to start/stop FC telemetry
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        winston.error('Bad POST vars in /api/FCModify', { message: errors.array() });
        return res.status(422).json({ errors: errors.array() });
    }

    fcManager.startStopTelemetry(JSON.parse(req.body.device), JSON.parse(req.body.baud), JSON.parse(req.body.mavversion), (err, isSuccess) => {
        if (!err) {
            res.setHeader('Content-Type', 'application/json');
            //console.log(isSuccess);
            res.send(JSON.stringify({telemetryStatus: isSuccess}));
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ telemetryStatus: false}));
            winston.error('Error in /api/FCModify ', { message: err });

        }
    });
});

app.post('/api/FCReboot', function (req, res) {
    fcManager.rebootFC();
});

app.post('/api/addudpoutput', [check('newoutputIP').isIP(), check('newoutputPort').isInt({min: 1})], function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        winston.error('Bad POST vars in /api/addudpoutput ', { message: errors.array() });
        return res.status(422).json({ errors: errors.array() });
    }

    var newOutput = fcManager.addUDPOutput(req.body.newoutputIP, parseInt(req.body.newoutputPort));

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ UDPoutputs: newOutput }));
});

app.post('/api/removeudpoutput', [check('removeoutputIP').isIP(), check('removeoutputPort').isInt({min: 1})], function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        winston.error('Bad POST vars in /api/removeudpoutput ', { message: errors.array() });
        return res.status(422).json({ errors: errors.array() });
    }

    var newOutput = fcManager.removeUDPOutput(req.body.removeoutputIP, parseInt(req.body.removeoutputPort));

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ UDPoutputs: newOutput }));
});

io.on('connection', function(socket) {
    //only set interval if not already set
    if (FCStatusLoop !== null) {
        return;
    }

    // send Flight Controller status out 1 per second
    FCStatusLoop = setInterval(function() {
        io.sockets.emit('FCStatus', fcManager.getSystemStatus());
    }, 1000);
});

app.get('/api/networkadapters', (req, res) => {
    networkManager.getAdapters((err, netDeviceList) => {
        if (!err) {
            res.setHeader('Content-Type', 'application/json');
            var ret = {netDevice: netDeviceList};
            res.send(JSON.stringify(ret));
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            var ret = {netDevice: []};
            res.send(JSON.stringify(ret));
            winston.error('Error in /api/networkadapters ', { message: err });
        }
    });
});

app.get('/api/networkconnections', (req, res) => {
    networkManager.getConnections((err, netConnectionList) => {
        if (!err) {
            res.setHeader('Content-Type', 'application/json');
            var ret = {netConnection: netConnectionList};
            res.send(JSON.stringify(ret));
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            var ret = {netConnection: []};
            res.send(JSON.stringify(ret));
            winston.error('Error in /api/networkconnections ', { message: err });
        }
    });
});

app.post('/api/startstopvideo', [check('device').isLength({min: 2}),
                                 check('height').isInt({min: 1}),
                                 check('width').isInt({min: 1}),
                                 check('bitrate').isInt({min: 100, max: 10000}),
                                 check('format').isIn(['video/x-raw', 'video/x-h264']),
                                 check('rotation').isInt().isIn([0, 90, 180, 270])], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        winston.error('Bad POST vars in /api/startstopvideo ', { message: errors.array() });
        return res.status(422).json({ errors: errors.array() });
    }
    //user wants to start/stop video streaming
    vManager.startStopStreaming(req.body.device, req.body.height, req.body.width, req.body.format, req.body.rotation, req.body.bitrate, (err, status, addresses) => {
        if(!err) {
            res.setHeader('Content-Type', 'application/json');
            var ret = {streamingStatus: status, streamAddresses: addresses};
            res.send(JSON.stringify(ret));
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            var ret = {streamingStatus: false, streamAddresses: ["Error " + err]};
            res.send(JSON.stringify(ret));
            winston.error('Error in /api/startstopvideo ', { message: err });
        }
    });
})

//Get details of a network connection by connection ID
app.post('/api/networkIP', [check('conName').isUUID()], (req, res) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        winston.error('Bad POST vars in /api/networkIP ', { message: errors.array() });
        return res.status(422).json({ errors: errors.array() });
    }
    networkManager.getConnectionDetails(req.body.conName, (err, conDetails) => {
        if (!err) {
            res.setHeader('Content-Type', 'application/json');
            var ret = {netConnectionDetails: conDetails};
            res.send(JSON.stringify(ret));
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            var ret = {netConnectionDetails: {}};
            res.send(JSON.stringify(ret));
            winston.error('Error in /api/networkIP ', { message: err });
        }
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
        winston.error('Bad POST vars in /api/networkactivate ', { message: errors.array() });
    }
    else {
        console.log('Activating network ' + req.body.conName);
        networkManager.activateConnection(req.body.conName, (err) => {
            if (err) {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: err};
                res.send(JSON.stringify(ret));
                winston.error('Error in /api/networkactivate ', { message: err });
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: null, action: "NetworkActivateOK"};
                res.send(JSON.stringify(ret));
            }
        });
    }
});

//user wants to deactivate network
app.post('/api/networkdeactivate', [check('conName').isUUID()], (req, res) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.setHeader('Content-Type', 'application/json');
        var ret = {error: "Bad input - " + errors.array()[0].param};
        res.send(JSON.stringify(ret));
        winston.error('Bad POST vars in /api/networkdeactivate ', { message: errors.array() });
    }
    else {
        console.log('Dectivating network ' + req.body.conName);
        networkManager.deactivateConnection(req.body.conName, (err) => {
            if (err) {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: err};
                res.send(JSON.stringify(ret));
                winston.error('Error in /api/networkdeactivate ', { message: err });
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: null, action: "NetworkDectivateOK"};
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
        winston.error('Bad POST vars in /api/networkdelete ', { message: errors.array() });
    }
    else {
        console.log('Deleting network ' + req.body.conName);
        networkManager.deleteConnection(req.body.conName, (err) => {
            if (err) {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: err};
                res.send(JSON.stringify(ret));
                winston.error('Error in /api/networkdelete ', { message: err });
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
                              check('conSettings.attachedIface.value').optional().escape(),
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
        winston.error('Bad POST vars in /api/networkedit ', { message: errors.array() });
    }
    else {
        console.log('Editing network ' + req.body.conName);
        networkManager.editConnection(req.body.conName, req.body.conSettings, (err) => {
            if (err) {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: err};
                res.send(JSON.stringify(ret));
                winston.error('Error in /api/networkedit ', { message: err });
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
                              check('conSettings.attachedIface.value').optional().escape(),
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
        winston.error('Bad POST vars in /api/networkadd ', { message: errors.array() });
    }
    else {
        console.log('Adding network ' + req.body);
        networkManager.addConnection(req.body.conName, req.body.conType, req.body.conAdapter, req.body.conSettings, (err) => {
            if (err) {
                res.setHeader('Content-Type', 'application/json');
                var ret = {error: err};
                res.send(JSON.stringify(ret));
                winston.error('Error in /api/networkadd ', { message: err });
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

// Handles any requests that don't match the ones above (ie pass to react app)
app.get('*', (req,res) =>{
    res.sendFile(path.join(__dirname, '..', '/build/index.html'));
});

const port = process.env.PORT || 3001;
http.listen(port, () =>
    console.log('Express server is running on localhost:' + port)
);
