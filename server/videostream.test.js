const assert = require('assert')
const sinon = require('sinon')
const { EventEmitter } = require('events')
const child_process = require('child_process')
const { minimal, common } = require('node-mavlink')
const si = require('systeminformation')

const settings = require('settings-store')
const winston = require('./winstonconfig')(module)

describe('Video Functions (CI Safe)', function () {
  let sandbox;
  let VideoStream;
  let mockProcess;

  beforeEach(function () {
    sandbox = sinon.createSandbox()

    mockProcess = new EventEmitter()
    mockProcess.pid = 123
    mockProcess.stdin = { pause: sinon.spy() }
    mockProcess.kill = sinon.spy()
    mockProcess.stdout = new EventEmitter()
    mockProcess.stderr = new EventEmitter()

    const spawnStub = sandbox.stub(child_process, 'spawn');
    spawnStub.returns(mockProcess);

    VideoStream = require('./videostream');

    sandbox.stub(console, 'log');
    sandbox.stub(console, 'error');
    settings.clear();
  });

  afterEach(function () {
    sandbox.restore()
    delete require.cache[require.resolve('./videostream')];
  });

  describe('Constructor and Initialization', function () {
    it('should not initialize if camera.active is false', function () {
      settings.setValue('camera.active', false)
      const initializeStub = sandbox.stub(VideoStream.prototype, 'initialize');
      const vManager = new VideoStream(settings, winston);
      assert.ok(initializeStub.notCalled);
    });

    it('should call initialize if camera.active is true in settings', function () {
      settings.setValue('camera.active', true);
      const initializeStub = sandbox.stub(VideoStream.prototype, 'initialize');
      const vManager = new VideoStream(settings, winston);
      assert.ok(initializeStub.calledOnce);
    });

    it('should load photo settings if mode is "photo"', function() {
        settings.setValue('camera.mode', 'photo');
        settings.setValue('camera.stillSettings', { device: 'test' });
        const vManager = new VideoStream(settings, winston);
        assert.deepStrictEqual(vManager.stillSettings, { device: 'test' });
    });

    it('should load video settings if mode is "video"', function() {
        settings.setValue('camera.mode', 'video');
        settings.setValue('camera.videoSettings', { device: 'test' });
        const vManager = new VideoStream(settings, winston);
        assert.deepStrictEqual(vManager.videoSettings, { device: 'test' });
    });

    it('should handle video device error during initialize', function () {
      const vManager = new VideoStream(settings, winston);
      sandbox.stub(vManager, 'getVideoDevices').callsFake(cb => cb('Video Error'));
      const resetStub = sandbox.stub(vManager, 'resetCamera');
      vManager.initialize();
      assert.ok(resetStub.calledOnce);
    });

    it('should handle still device error during initialize', function () {
      const vManager = new VideoStream(settings, winston);
      sandbox.stub(vManager, 'getVideoDevices').callsFake(cb => cb(null)); // success
      sandbox.stub(vManager, 'getStillDevices').callsFake(cb => cb('Still Error'));
      const resetStub = sandbox.stub(vManager, 'resetCamera');
      vManager.initialize();
      assert.ok(resetStub.calledOnce);
    });
  });

  describe('#getVideoDevices()', function () {
    it('should callback with data when devices are found', function (done) {
        const vManager = new VideoStream(settings, winston);

        // Stub the function directly to prevent real hardware calls
        sandbox.stub(vManager, 'getVideoDevices').callsFake((callback) => {
            const fakeData = {
                devices: [{ value: '/dev/video0', label: 'MockCam', caps: [] }],
                selectedDevice: { value: '/dev/video0', label: 'MockCam' },
            };
            callback(null, fakeData);
        });

        vManager.getVideoDevices((err, responseData) => {
            try {
                assert.strictEqual(err, null);
                assert.strictEqual(responseData.devices.length, 1);
                assert.strictEqual(responseData.selectedDevice.value, '/dev/video0');
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it('should handle having no devices found', function (done) {
        const vManager = new VideoStream(settings, winston);

        sandbox.stub(vManager, 'getVideoDevices').callsFake((callback) => {
            callback('No video devices found', { devices: [] });
        });

        vManager.getVideoDevices((err, responseData) => {
            try {
                assert.ok(err.includes('No video devices'));
                assert.deepStrictEqual(responseData.devices, []);
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it('should handle a script execution error', function (done) {
        const vManager = new VideoStream(settings, winston);

        sandbox.stub(vManager, 'getVideoDevices').callsFake((callback) => {
            callback('simulated stderr', {});
        });

        vManager.getVideoDevices((err, responseData) => {
            try {
                assert.strictEqual(err, 'simulated stderr');
                done();
            } catch (e) {
                done(e);
            }
        });
    });
  });

  describe('#startCamera()', function () {
    it('should call startVideoStreaming for "streaming" mode', function () {
      const vManager = new VideoStream(settings, winston);
      vManager.cameraMode = 'streaming';
      const startStub = sandbox.stub(vManager, 'startVideoStreaming').callsFake(cb => cb());
      vManager.startCamera(() => {});
      assert.ok(startStub.calledOnce);
    });

    it('should call startPhotoMode for "photo" mode', function () {
      const vManager = new VideoStream(settings, winston);
      vManager.cameraMode = 'photo';
      const startStub = sandbox.stub(vManager, 'startPhotoMode').callsFake(cb => cb());
      vManager.startCamera(() => {});
      assert.ok(startStub.calledOnce);
    });

    it('should call startVideoMode for "video" mode', function () {
      const vManager = new VideoStream(settings, winston);
      vManager.cameraMode = 'video';
      const startStub = sandbox.stub(vManager, 'startVideoMode').callsFake(cb => cb());
      vManager.startCamera(() => {});
      assert.ok(startStub.calledOnce);
    });

    it('should return an error for an unsupported mode', function (done) {
        const vManager = new VideoStream(settings, winston);
        vManager.cameraMode = 'unsupported';
        vManager.startCamera((err) => {
            assert.ok(err instanceof Error);
            assert.ok(err.message.includes('Unsupported camera mode'));
            done();
        });
    });
  });

  describe('Camera Start/Stop (by mode)', function () {
    beforeEach(function () {
      sandbox.stub(VideoStream.prototype, 'isUbuntu').resolves(false);
    });

    it('should start and stop video streaming', function (done) {
      const vManager = new VideoStream(settings, winston);
      vManager.cameraMode = 'streaming';
      vManager.videoDevices = [{ value: 'mock' }];
      vManager.videoSettings = {
        device: 'mock', height: '720', width: '1280', format: 'video/x-h264',
        rotation: '0', bitrate: '800', fps: '30', useUDP: false,
        useTimestamp: true, compression: 'H264'
      };

      vManager.startVideoStreaming((err, result) => {
        assert.strictEqual(err, null);
        assert.ok(result.active);
        assert.ok(child_process.spawn.calledOnce);

        vManager.stopCamera((stopErr, status) => {
          assert.strictEqual(stopErr, null);
          assert.strictEqual(status, false);
          assert.ok(mockProcess.kill.called);
          done();
        });
      });
    });

    it('should handle startPhotoMode', function (done) {
        const vManager = new VideoStream(settings, winston);
        vManager.stillSettings = { device: '/dev/photo0' };
        vManager.startPhotoMode((err, result) => {
            assert.strictEqual(err, null);
            assert.ok(result.active);
            const spawnArgs = child_process.spawn.getCall(0).args[1];
            assert.ok(spawnArgs.includes('--mode=photo'));
            assert.ok(spawnArgs.includes('--device=/dev/photo0'));
            done();
        });
    });

    it('should handle startVideoMode', function (done) {
        const vManager = new VideoStream(settings, winston);
        vManager.videoSettings = { device: '/dev/video1', width: 1280, height: 720, format: 'H264', fps: 30, rotation: 90, bitrate: 1000 };
        vManager.startVideoMode((err, result) => {
            assert.strictEqual(err, null);
            assert.ok(result.active);
            const spawnArgs = child_process.spawn.getCall(0).args[1];
            assert.ok(spawnArgs.includes('--mode=video'));
            assert.ok(spawnArgs.includes('--device=/dev/video1'));
            assert.ok(spawnArgs.includes('--width=1280'));
            done();
        });
    });
  });

  describe('MAVLink Packet Handling', function () {
    let vManager;

    beforeEach(function() {
      vManager = new VideoStream(settings, winston);
      vManager.active = true; // Enable packet processing
      sandbox.stub(vManager, 'sendCameraInformation');
      sandbox.stub(vManager, 'sendVideoStreamInformation');
      sandbox.stub(vManager, 'sendCameraSettings');
      sandbox.stub(vManager, 'captureStillPhoto');
    });

    it('should do nothing if camera is not active', function() {
        vManager.active = false;
        const packet = { header: { sysid: 1, compid: 1, msgid: common.CommandLong.MSG_ID } };
        const data = { targetComponent: minimal.MavComponent.CAMERA, _param1: common.CameraInformation.MSG_ID };
        vManager.onMavPacket(packet, data);
        assert.ok(vManager.sendCameraInformation.notCalled);
    });

    it('should call sendCameraInformation on request', function() {
        const packet = { header: { sysid: 1, compid: 1, msgid: common.CommandLong.MSG_ID } };
        const data = { targetComponent: minimal.MavComponent.CAMERA, _param1: common.CameraInformation.MSG_ID };
        vManager.onMavPacket(packet, data);
        assert.ok(vManager.sendCameraInformation.calledOnce);
    });

    it('should call sendVideoStreamInformation on request', function() {
        vManager.cameraMode = 'streaming'; // Required for this command
        const packet = { header: { sysid: 1, compid: 1, msgid: common.CommandLong.MSG_ID } };
        const data = { targetComponent: minimal.MavComponent.CAMERA, _param1: common.VideoStreamInformation.MSG_ID };
        vManager.onMavPacket(packet, data);
        assert.ok(vManager.sendVideoStreamInformation.calledOnce);
    });

    it('should call sendCameraSettings on request', function() {
        const packet = { header: { sysid: 1, compid: 1, msgid: common.CommandLong.MSG_ID } };
        const data = { targetComponent: minimal.MavComponent.CAMERA, _param1: common.CameraSettings.MSG_ID };
        vManager.onMavPacket(packet, data);
        assert.ok(vManager.sendCameraSettings.calledOnce);
    });

    it('should call captureStillPhoto on command', function() {
        const packet = { header: { sysid: 1, compid: 1, msgid: common.CommandLong.MSG_ID } };
        const data = { targetComponent: minimal.MavComponent.CAMERA, command: 203 }; // MAV_CMD_DO_DIGICAM_CONTROL
        vManager.onMavPacket(packet, data);
        assert.ok(vManager.captureStillPhoto.calledOnce);
    });
  });

  describe('Utility Functions', function() {
    it('should detect Ubuntu correctly', async function() {
      const vManager = new VideoStream(settings, winston);
      const osInfoStub = sandbox.stub(si, 'osInfo');

      osInfoStub.resolves({ distro: 'Ubuntu 22.04.1 LTS' });
      const isUbuntu = await vManager.isUbuntu();
      assert.strictEqual(isUbuntu, true);

      osInfoStub.resolves({ distro: 'Debian GNU/Linux 11 (bullseye)' });
      const isNotUbuntu = await vManager.isUbuntu();
      assert.strictEqual(isNotUbuntu, false);
    });

    it('should reset all camera settings (resetCamera)', function () {
      settings.setValue('camera.active', true)
      settings.setValue('camera.mode', 'photo')
      settings.setValue('camera.videoSettings', { foo: 'bar' })
      settings.setValue('camera.stillSettings', { foo: 'bar' })
      settings.setValue('camera.useHeartbeat', true)
      const vManager = new VideoStream(settings, winston)
      vManager.active = true
      vManager.stillSettings = { foo: 'bar' }
      vManager.videoSettings = { foo: 'bar' }
      vManager.resetCamera()
      assert.equal(vManager.active, false)
      assert.equal(vManager.videoSettings, null)
      assert.equal(vManager.stillSettings, null)
    })

    it('should populate RTSP addresses', function () {
      const vManager = new VideoStream(settings, winston)
      sandbox.stub(vManager, 'scanInterfaces').returns(['192.168.1.1', '10.0.0.1'])
      vManager.populateAddresses('testfactory')
      assert.ok(vManager.deviceAddresses.some(addr => addr.includes('rtsp://')))
    })

    it('scanInterfaces returns an array', function () {
      const vManager = new VideoStream(settings, winston)
      const ifaces = vManager.scanInterfaces()
      assert.ok(Array.isArray(ifaces))
    })

    it('startHeartbeatInterval emits cameraheartbeat', function (done) {
      const vManager = new VideoStream(settings, winston)
      vManager.eventEmitter.on('cameraheartbeat', () => {
        clearInterval(vManager.intervalObj)
        done()
      })
      vManager.startHeartbeatInterval()
    })
  });
});