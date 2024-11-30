const assert = require('assert')
const settings = require('settings-store')
const VideoStream = require('./videostream')
const winston = require('./winstonconfig')(module)

const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai
chai.use(require('sinon-chai'))
const { minimal, common } = require('node-mavlink')

describe('Video Functions', function () {
  it('#videomanagerinit()', function () {
    settings.clear()
    const vManager = new VideoStream(settings, winston)

    // check initial status
    assert.equal(vManager.active, false)
  })

  it('#videomanagerpopulateaddresses()', function () {
    // Getting a list of valid IP addresses
    settings.clear()
    const vManager = new VideoStream(settings, winston)

    vManager.populateAddresses()

    // check initial status
    assert.notEqual(vManager.ifaces.length, 0)
    assert.notEqual(vManager.deviceAddresses.length, 0)
  })

  it('#videomanagerscan()', function (done) {
    // Scanning for video devices capable of streaming
    // in a CI environment, no devices will be returned
    settings.clear()
    const vManager = new VideoStream(settings, winston)

    vManager.populateAddresses()
    vManager.getVideoDevices(function (err, devices, active, seldevice, selRes, selRot, selbitrate, selfps,
      SeluseUDP, SelusePhotoMode, SeluseUDPIP, SeluseUDPPort, timestamp, fps, FPSMax, vidres,
      useCameraHeartbeat, useMavControl, selMavURI, selMediaPath) {
      assert.equal(err, null)
      assert.equal(active, false)
      assert.notEqual(seldevice, null)
      assert.notEqual(selRes, null)
      assert.notEqual(selRot, null)
      assert.notEqual(selbitrate, null)
      assert.notEqual(selfps, null)
      assert.equal(SeluseUDP, false)
      assert.equal(SelusePhotoMode, false)
      assert.equal(SeluseUDPIP, '127.0.0.1')
      assert.equal(SeluseUDPPort, 5400)
      assert.equal(timestamp, false)
      assert.notEqual(fps, null)
      assert.notEqual(FPSMax, null)
      assert.notEqual(vidres, null)
      assert.equal(useCameraHeartbeat, false)
      assert.equal(useMavControl, false)
      assert.notEqual(selMavURI, null)
      assert.equal(selMediaPath, '/home/pi/Rpanion-server/media/')
      done()
    })
  }).timeout(5000)

  it('#videomanagerisUbuntu()', async function () {
    settings.clear()
    const vManager = new VideoStream(settings, winston)

    const res = await vManager.isUbuntu()
    assert.equal(res, true)
  })

  it('#videomanagerstartStopStreaming()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings, winston)

    vManager.startStopStreaming(true, 'testsrc', '1080', '1920', 'video/x-h264', '0', '1000', '5', false, false, false, true, false, '0', function (err, status) {
      assert.equal(err, null)
      assert.equal(status, true)
      assert.notEqual(vManager.deviceStream.pid, null)
      vManager.startStopStreaming(false, 'testsrc', '1080', '1920', 'video/x-h264', '0', '1000', '5', false, false, false, true, false, '0', function (err, status) {
        assert.equal(err, null)
        assert.equal(status, false)
        done()
      })
    })
  })

  describe('#videomanagerstartInterval()', () => {
    let vManager
    let setIntervalStub
    let emitStub

    beforeEach(() => {
      vManager = new VideoStream(settings, winston)
      setIntervalStub = sinon.stub(global, 'setInterval')
      emitStub = sinon.stub(vManager.eventEmitter, 'emit')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('should start an interval and emit a "cameraheartbeat" event', () => {
      const intervalId = 12345
      setIntervalStub.returns(intervalId)

      vManager.startInterval()

      // Simulate the interval execution
      const mavType = minimal.MavType.CAMERA
      const autopilot = minimal.MavAutopilot.INVALID
      const component = minimal.MavComponent.CAMERA

      // Call the interval function manually
      const intervalFunction = setIntervalStub.firstCall.args[0] // Get the first argument (the callback)
      intervalFunction() // Manually invoke the callback

      expect(vManager.intervalObj).to.equal(intervalId)
      expect(emitStub).to.have.been.calledWith('cameraheartbeat', mavType, autopilot, component)
    })
  })

  describe('#videomanagercaptureStillPhoto()', () => {
    let vManager
    let emitStub

    beforeEach(() => {
      vManager = new VideoStream(settings, winston)
      // Mocking deviceStream with a kill method
      vManager.deviceStream = {
        kill: sinon.stub()
      }
      sinon.stub(Date, 'now').returns(1729137498022000) // Stub to return a fixed timestamp
      emitStub = sinon.stub(vManager.eventEmitter, 'emit')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('should emit a "cameratrigger" event', () => {
      // build a CAMERA_TRIGGER packet
      const expectedMsg = new common.CameraTrigger()
      expectedMsg.timeUsec = BigInt(Date.now() * 1000)
      expectedMsg.seq = 0

      vManager.captureStillPhoto() // Call the method under test

      expect(emitStub).to.have.been.calledWith('cameratrigger', expectedMsg)
    })
  })

  describe('#videomanagersendCameraInformation()', () => {
    let vManager
    let emitStub

    beforeEach(() => {
      vManager = new VideoStream(settings, winston)
      emitStub = sinon.stub(vManager.eventEmitter, 'emit')

      vManager.savedDevice = {
        width: 1920,
        height: 1080,
        usePhotoMode: true
      }
    })

    afterEach(() => {
      sinon.restore()
    })

    it('should emit a "camerainfo" event', () => {
      // build a CAMERA_INFORMATION packet
      const expectedMsg = new common.CameraInformation()

      expectedMsg.timeBootMs = 0
      expectedMsg.vendorName = 0
      expectedMsg.modelName = 0
      expectedMsg.firmwareVersion = 0
      expectedMsg.focalLength = null
      expectedMsg.sensorSizeH = null
      expectedMsg.sensorSizeV = null
      expectedMsg.resolutionH = vManager.savedDevice.width
      expectedMsg.resolutionV = vManager.savedDevice.height
      expectedMsg.lensId = 0
      // 256 = CAMERA_CAP_FLAGS_HAS_VIDEO_STREAM (hard-coded for now until Rpanion gains more camera capabilities)
      if (vManager.savedDevice.usePhotoMode) {
        // 2 = CAMERA_CAP_FLAGS_CAPTURE_IMAGE
        expectedMsg.flags = 2
      } else {
        // 256 = CAMERA_CAP_FLAGS_HAS_VIDEO_STREAM
        expectedMsg.flags = 256
      }

      expectedMsg.camDefinitionVersion = 0
      expectedMsg.camDefinitionUri = ''
      expectedMsg.gimbalDeviceId = 0

      const senderSysId = 1
      const senderCompId = minimal.MavComponent.CAMERA
      const targetComponent = 1

      vManager.sendCameraInformation(senderSysId, senderCompId, targetComponent) // Call the method under test
      expect(emitStub).to.have.been.calledWith('camerainfo', expectedMsg, senderSysId, senderCompId, targetComponent)

      // Test again with usePhotoMode = false
      vManager.savedDevice.usePhotoMode = false
      vManager.sendCameraInformation(senderSysId, senderCompId, targetComponent) // Call the method under test
      expect(emitStub).to.have.been.calledWith('camerainfo', expectedMsg, senderSysId, senderCompId, targetComponent)
    })
  })

  describe('#videomanagersendVideoStreamInformation()', () => {
    let vManager
    let emitStub

    beforeEach(() => {
      vManager = new VideoStream(settings, winston)
      emitStub = sinon.stub(vManager.eventEmitter, 'emit')

      vManager.savedDevice = {
        useUDP: true,
        useUDPPort: 9000,
        mavStreamSelected: 'localhost',
        device: 'camera1',
        fps: 30,
        width: 1920,
        height: 1080,
        bitrate: 6000,
        rotation: 0
      }
    })

    afterEach(() => {
      sinon.restore()
    })

    it('should emit a "videostreaminfo" event', () => {
      // build a VIDEO_STREAM_INFORMATION packet
      const expectedMsg = new common.VideoStreamInformation()

      expectedMsg.streamId = 1
      expectedMsg.count = 1
      // expectedMsg.type and expectedMsg.uri need to be different depending on whether RTP or RTSP is selected
      if (vManager.savedDevice.useUDP) {
        // expectedMsg.type = 0 = VIDEO_STREAM_TYPE_RTSP
        // expectedMsg.type = 1 = VIDEO_STREAM_TYPE_RTPUDP
        expectedMsg.type = 1
        // For RTP, just send the destination UDP port instead of a full URI
        expectedMsg.uri = vManager.savedDevice.useUDPPort.toString()
      } else {
        expectedMsg.type = 0
        expect.uri = `rtsp://${vManager.savedDevice.mavStreamSelected}:8554/${vManager.savedDevice.device}`
      }

      // 1 = VIDEO_STREAM_STATUS_FLAGS_RUNNING
      // 2 = VIDEO_STREAM_STATUS_FLAGS_THERMAL
      expectedMsg.flags = 1
      expectedMsg.framerate = vManager.savedDevice.fps
      expectedMsg.resolutionH = vManager.savedDevice.width
      expectedMsg.resolutionV = vManager.savedDevice.height
      expectedMsg.bitrate = vManager.savedDevice.bitrate
      expectedMsg.rotation = vManager.savedDevice.rotation
      // Rpanion doesn't collect field of view values, so just set to zero
      expectedMsg.hfov = 0
      expectedMsg.name = vManager.savedDevice.device

      const senderSysId = 1
      const senderCompId = minimal.MavComponent.CAMERA
      const targetComponent = 1

      vManager.sendVideoStreamInformation(senderSysId, senderCompId, targetComponent) // Call the method under test
      expect(emitStub).to.have.been.calledWith('videostreaminfo', expectedMsg, senderSysId, senderCompId, targetComponent)

      // Test again with useUDP = false
      vManager.savedDevice.useUDP = false
      vManager.sendVideoStreamInformation(senderSysId, senderCompId, targetComponent) // Call the method under test
      expect(emitStub).to.have.been.calledWith('videostreaminfo', expectedMsg, senderSysId, senderCompId, targetComponent)
    })
  })

  describe('#videomanagersendCameraSettings()', () => {
    let vManager
    let emitStub

    beforeEach(() => {
      vManager = new VideoStream(settings, winston)
      emitStub = sinon.stub(vManager.eventEmitter, 'emit')

      vManager.savedDevice = {
        usePhotoMode: true
      }
    })

    afterEach(() => {
      sinon.restore()
    })

    it('should emit a "camerasettings" event', () => {
      // build a CAMERA_SETTINGS packet
      const expectedMsg = new common.CameraSettings()
      expectedMsg.timeBootMs = 0
      // Camera modes: 0 = IMAGE, 1 = VIDEO, 2 = IMAGE_SURVEY
      if (vManager.savedDevice.usePhotoMode) {
        expectedMsg.modeId = 0
      } else {
        expectedMsg.modeId = 1
      }
      expectedMsg.zoomLevel = null
      expectedMsg.focusLevel = null

      const senderSysId = 1
      const senderCompId = minimal.MavComponent.CAMERA
      const targetComponent = 1

      vManager.sendCameraSettings(senderSysId, senderCompId, targetComponent) // Call the method under test
      expect(emitStub).to.have.been.calledWith('camerasettings', expectedMsg, senderSysId, senderCompId, targetComponent)

      // Test again with usePhotoMode = false
      vManager.savedDevice.usePhotoMode = false
      vManager.sendCameraSettings(senderSysId, senderCompId, targetComponent) // Call the method under test
      expect(emitStub).to.have.been.calledWith('camerasettings', expectedMsg, senderSysId, senderCompId, targetComponent)
    })
  })

  describe('#videomanageronMavPacket', function () {
    let instance
    let packet
    let data

    beforeEach(function () {
      instance = {
        active: true,
        savedDevice: {
          usePhotoMode: false
        },
        sendCameraInformation: sinon.spy(),
        sendVideoStreamInformation: sinon.spy(),
        sendCameraSettings: sinon.spy(),
        captureStillPhoto: sinon.spy(),

        // Define the onMavPacket function within the instance
        onMavPacket: function (packet, data) {
          if (!this.active) {
            return
          }

          if (data.targetComponent === minimal.MavComponent.CAMERA && packet.header.msgid === common.CommandLong.MSG_ID) {
            if (data._param1 === common.CameraInformation.MSG_ID) {
              this.sendCameraInformation(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
            } else if (data._param1 === common.VideoStreamInformation.MSG_ID && !this.savedDevice.usePhotoMode) {
              this.sendVideoStreamInformation(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
            } else if (data._param1 === common.CameraSettings.MSG_ID) {
              this.sendCameraSettings(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
            } else if (data.command === 203) {
              console.log('Received DoDigicamControl command')
              this.captureStillPhoto(packet)
            }
          }
        }
      }

      packet = {
        header: {
          sysid: 1,
          compid: 1,
          msgid: 76 // example msgid for CommandLong
        }
      }

      data = {
        targetComponent: 100,
        _param1: 0,
        command: null
      }
    })

    it('should not process if inactive', function () {
      instance.active = false
      instance.onMavPacket(packet, data)
      expect(instance.sendCameraInformation.called).to.be.false
      expect(instance.sendVideoStreamInformation.called).to.be.false
      expect(instance.sendCameraSettings.called).to.be.false
      expect(instance.captureStillPhoto.called).to.be.false
    })

    it('should send camera information when _param1 matches CameraInformation MSG_ID', function () {
      data.targetComponent = minimal.MavComponent.CAMERA
      data._param1 = common.CameraInformation.MSG_ID
      instance.onMavPacket(packet, data)
      expect(instance.sendCameraInformation.calledWith(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)).to.be.true
    })

    it('should send video stream information when _param1 matches VideoStreamInformation MSG_ID and usePhotoMode is false', function () {
      data.targetComponent = minimal.MavComponent.CAMERA
      data._param1 = common.VideoStreamInformation.MSG_ID
      instance.onMavPacket(packet, data)
      expect(instance.sendVideoStreamInformation.calledWith(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)).to.be.true
    })

    it('should send camera settings when _param1 matches CameraSettings MSG_ID', function () {
      data.targetComponent = minimal.MavComponent.CAMERA
      data._param1 = common.CameraSettings.MSG_ID
      instance.onMavPacket(packet, data)
      expect(instance.sendCameraSettings.calledWith(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)).to.be.true
    })

    it('should capture still photo when command equals 203 (MAV_CMD_DO_DIGICAM_CONTROL)', function () {
      data.targetComponent = minimal.MavComponent.CAMERA
      data.command = 203
      instance.onMavPacket(packet, data)
      expect(instance.captureStillPhoto.calledWith(packet)).to.be.true
    })

    it('should not process when targetComponent is not CAMERA', function () {
      data.targetComponent = 200 // not the CAMERA component
      instance.onMavPacket(packet, data)
      expect(instance.sendCameraInformation.called).to.be.false
      expect(instance.sendVideoStreamInformation.called).to.be.false
      expect(instance.sendCameraSettings.called).to.be.false
      expect(instance.captureStillPhoto.called).to.be.false
    })
  })
})
