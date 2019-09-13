const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger')();
const serialManager = require('./serialManager');
const networkManager = require('./networkManager');
const analogManager = require('./analogPi');

const app = express();
const http = require("http").Server(app)

var io = require('socket.io')(http);

const sManager = new serialManager();

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
app.post('/api/portmodify', function (req, res) {
    console.log('Got post');
    sManager.updateLinkSettings(req.body.user);
})

app.post('/api/networkIP', (req, res) => {
    networkManager.getConnectionDetails(req.body.conName, (err, conDetails) => {
        res.setHeader('Content-Type', 'application/json');
        var ret = {netConnectionDetails: conDetails};
        //console.log(ret);
        res.send(JSON.stringify(ret));
    });
});

http.listen(3001, () =>
    console.log('Express server is running on localhost:3001')
);
