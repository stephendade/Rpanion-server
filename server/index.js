const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger')();
const serialManager = require('./serialManager');

const app = express();

const sManager = new serialManager();

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

// Route that receives a POST request
app.post('/api/portmodify', function (req, res) {
    console.log('Got post');
    sManager.updateLinkSettings(req.body.user);
})

app.listen(3001, () =>
    console.log('Express server is running on localhost:3001')
);
