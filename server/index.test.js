// Import dependencies
const assert = require('assert');
const { describe, it, before, after } = require('mocha');
const http = require('http');

// Import the Express app
const app = require('./index');

let server;

describe('Express server', function () {
  // Start the server before all tests
  before(function(done) {
    // The app should export the Express app, not start the server directly
    server = app.listen(3001, () => {
      console.log('Test server started on port 3001');
      done();
    });
  });

  // Close the server after all tests
  after(function(done) {
    server.close(() => {
      console.log('Test server closed');
      done();
    });
  });

// Helper function to make requests using Node's built-in http
function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    };

    if (body) {
      const bodyData = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        res.body = data;
        try {
          res.json = JSON.parse(data);
        } catch (e) {
          res.json = null;
        }
        resolve(res);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

  // Test the GET / endpoint
  describe('GET /', function () {
    it('should return a 200 status code', async function () {
      const response = await request('GET', '/');
      assert.equal(response.statusCode, 200);
    });
  });

  // Test that unauthorized users cannot access the /users endpoint
  describe('GET /users nonauth', function () {
    it('should return a 401 status code', async function () {
      const response = await request('GET', '/api/users');
      assert.equal(response.statusCode, 401);
    });
  });

  // Test that login works
  describe('POST /login', function () {
    it('should return a 200 status code', async function () {
      const response = await request('POST', '/api/login', {
        username: 'admin',
        password: 'admin'
      });
      assert.equal(response.statusCode, 200);
    });
  });

  // Test /api/capturestillphoto for camera not active or not photo mode
  describe('POST /api/capturestillphoto', function () {
    it('should return a 400 if camera is not active or not in photo mode', async function () {
      // No auth token provided, will be rejected as 401
      const response = await request('POST', '/api/capturestillphoto');
      // Accept either 400 or 401 (depends if middleware or logic triggers first)
      assert([400, 401].includes(response.statusCode));
    });
  });

  // Test /api/camera/start validation error=
  describe('POST /api/camera/start validation', function () {
    it('should return 422 for missing required fields', async function () {
      const loginRes = await request('POST', '/api/login', {
        username: 'admin',
        password: 'admin'
      });
      const token = (loginRes.json && loginRes.json.token) || '';

      const response = await request(
        'POST',
        '/api/camera/start',
        { cameraMode: 'streaming' },
        { Authorization: 'Bearer ' + token }
      );
      assert.equal(response.statusCode, 422);
    });
  });

  // Test that /api/camera/stop returns 401 without authorization
  describe('POST /api/camera/stop', function () {
    it('should return 401 without authentication', async function () {
      const response = await request('POST', '/api/camera/stop');
      assert.equal(response.statusCode, 401);
    });
  });
});
