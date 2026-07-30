const assert = require('assert')
const path = require('path')
const settings = require('settings-store')
const logpaths = require('./paths')
const VideoStream = require('./videostream')
const { minimal, common } = require('node-mavlink')
const { EventEmitter } = require('events')

describe('Video Functions', function () {
  it('#videomanagerinit()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)

    // check initial status
    assert.equal(vManager.active, false)
  })

  it('#videomanagerpopulateaddresses()', function () {
    // Getting a list of valid IP addresses
    settings.clear()
    const vManager = new VideoStream(settings)

    vManager.populateAddresses("testfactory")

    // check initial status
    assert.notEqual(vManager.ifaces.length, 0)
    assert.notEqual(vManager.deviceAddresses.length, 0)
  })

  it('#videomanagerscan()', function (done) {
    // Scanning for video devices capable of streaming
    // in a CI environment, no devices will be returned
    settings.clear()
    const vManager = new VideoStream(settings)

    vManager.getVideoDevices(function (err, data) {
      // The code returns a data object, not individual arguments
      assert.notEqual(data, null)
      assert.equal(data.active, false)
      assert.notEqual(data.networkInterfaces, null)

      // Defaults defined in the class when scan fails or mock runs
      assert.equal(data.selectedUseUDPIP, '127.0.0.1')
      assert.equal(data.selectedUseUDPPort, 5400)
      assert.equal(data.selectedUseTimestamp, false)
      assert.deepEqual(data.selectedMavStreamURI, { label: '127.0.0.1', value: '127.0.0.1' })

      // Check structure of return object
      assert.ok(Array.isArray(data.devices))
      assert.ok(Array.isArray(data.fpsOptions))
      done()
    })
  }).timeout(5000)

  it('#getStillDevices()', function (done) {
    // Scanning for still photo devices (CSI and UVC cameras)
    settings.clear()
    const vManager = new VideoStream(settings)

    vManager.getStillDevices(function (err, data) {
      // The function should return a data object with devices and capabilities
      assert.notEqual(data, null)
      assert.ok(Array.isArray(data.devices))
      assert.ok(data.capabilities !== null)
      assert.ok(typeof data.capabilities.cv2 === 'boolean')
      assert.ok(typeof data.capabilities.picamera2 === 'boolean')
      // err may be non-null if v4l2-ctl is not available in CI environment
      done()
    })
  }).timeout(5000)

  it('#videomanagerisUbuntu()', async function () {
    settings.clear()
    const vManager = new VideoStream(settings)

    const res = await vManager.isUbuntu()
    assert.equal(res, true)
  })

  it('#helperOptions()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)

    // Compression Select
    let comp = vManager.getCompressionSelect('H265')
    assert.equal(comp.value, 'H265')
    comp = vManager.getCompressionSelect('INVALID') // Should default to H264 (index 0)
    assert.equal(comp.value, 'H264')

    // Transport Select
    let trans = vManager.getTransportSelect('RTP')
    assert.equal(trans.value, 'RTP')
    trans = vManager.getTransportSelect('INVALID') // Should default to RTSP
    assert.equal(trans.value, 'RTSP')

    // Transport Options
    const options = vManager.getTransportOptions()
    assert.equal(options.length, 2)
  })

  it('#pathHelpers()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)

    assert.equal(vManager.toRelativePath(''), '')
    assert.equal(vManager.toRelativePath('.'), '')
    assert.equal(vManager.toRelativePath('subdir'), 'subdir')

    const absoluteDest = path.join(logpaths.mediaDir, 'saved')
    assert.equal(vManager.toRelativePath(absoluteDest), 'saved')

    assert.equal(vManager.toAbsolutePath(''), logpaths.mediaDir)
    assert.equal(vManager.toAbsolutePath('saved'), path.join(logpaths.mediaDir, 'saved'))
  })

  it('#settingsManagement()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)

    // Setup fake settings
    vManager.active = true
    vManager.cameraMode = 'video'
    vManager.videoSettings = { width: 1920, height: 1080 }

    // Test Save
    vManager.saveSettings()
    assert.equal(settings.value('camera.active'), true)
    assert.equal(settings.value('camera.mode'), 'video')
    assert.deepEqual(settings.value('camera.videoSettings'), { width: 1920, height: 1080 })

    // Test Reset
    vManager.resetCamera()
    assert.equal(vManager.active, false)
    assert.equal(vManager.videoSettings, null)
    assert.equal(settings.value('camera.active'), false)
  })

  it('#stopCamera()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)

    // Mock an active stream
    vManager.active = true
    vManager.intervalObj = setInterval(() => { }, 1000) // Dummy interval
    vManager.deviceStream = {
      kill: (signal) => {
        assert.equal(signal, 'SIGTERM')
      }
    }

    vManager.stopCamera((err, status) => {
      assert.equal(err, null)
      assert.equal(status, false)
      assert.equal(vManager.active, false)
      assert.equal(vManager.deviceStream, null)
      assert.equal(vManager.intervalObj, null)
      done()
    })
  })


  it('#captureStillPhoto()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)

    // Simulate active camera in photo mode
    vManager.active = true
    vManager.cameraMode = 'photo'
    let signalSent = false

    vManager.deviceStream = {
      kill: (signal) => {
        if (signal === 'SIGUSR1') signalSent = true
      }
    }

    // Listen for the MAVLink events that should be emitted
    let triggerReceived = false
    vManager.eventEmitter.on('cameratrigger', (msg, compId) => {
      triggerReceived = true
      assert.ok(msg.timeUsec > 0)
      assert.equal(msg.seq, 1) // First photo (photoSeq is pre-incremented)
    })

    vManager.captureStillPhoto(1, 1, 1)

    // Allow event loop to process
    setTimeout(() => {
      assert.equal(signalSent, true, "Should send SIGUSR1 to python process")
      assert.equal(triggerReceived, true, "Should emit cameratrigger MAVLink message")
      assert.equal(vManager.photoSeq, 1, "Should increment photo sequence")
      done()
    }, 50)
  })

  it('#captureStillPhotoRejectsWrongMode()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)

    // Active, but in video mode rather than photo mode
    vManager.active = true
    vManager.cameraMode = 'video'
    let signalSent = false
    vManager.deviceStream = {
      kill: (signal) => {
        if (signal === 'SIGUSR1') signalSent = true
      }
    }

    const acks = []
    vManager.eventEmitter.on('camera_command_ack', (commandId, senderSysId, senderCompId, targetComponent, result) => {
      acks.push({ commandId, result })
    })

    // Simulate a MAVLink-triggered capture (commandId set) while in the wrong mode
    vManager.captureStillPhoto(1, 1, 1, null, common.MavCmd.IMAGE_START_CAPTURE)

    assert.equal(signalSent, false, "Should NOT send SIGUSR1 to whatever process is actually running")
    assert.equal(acks.length, 1, "Should ACK the command instead of silently ignoring it")
    assert.equal(acks[0].commandId, common.MavCmd.IMAGE_START_CAPTURE)
    assert.equal(acks[0].result, 1, "Should NACK with MAV_RESULT_TEMPORARILY_REJECTED, not silently claim success")
  })

  it('#onMavPacketAutoSwitchesModeForVideoCapture()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)
    vManager.cameraMode = 'streaming' // not 'video'
    vManager.videoSettings = { isRecording: false }

    // Stub out actual process management - this test is about the dispatch/
    // switching logic, not really spawning photovideo.py
    const calls = []
    vManager.stopCamera = (cb) => { calls.push('stopCamera'); vManager.active = false; cb(null, false) }
    vManager.startCamera = (cb) => { calls.push(`startCamera(${vManager.cameraMode})`); vManager.active = true; cb(null) }
    vManager.toggleVideoRecording = () => { calls.push('toggleVideoRecording'); vManager.videoSettings.isRecording = true }

    const acks = []
    vManager.eventEmitter.on('camera_command_ack', (commandId, senderSysId, senderCompId, targetComponent, result) => {
      acks.push({ commandId, result })
    })

    const packet = { header: { msgid: common.CommandLong.MSG_ID, sysid: 1, compid: 1 } }
    const data = { targetComponent: minimal.MavComponent.CAMERA, command: common.MavCmd.VIDEO_START_CAPTURE, _param1: 0 }

    vManager.onMavPacket(packet, data)

    // Should switch mode (stop, then start in the new mode) rather than reject...
    assert.deepEqual(calls, ['stopCamera', 'startCamera(video)', 'toggleVideoRecording'])
    assert.equal(vManager.cameraMode, 'video')
    // ...acking MAV_RESULT_IN_PROGRESS immediately (switching takes a while),
    // then a final ACCEPTED once actually switched and recording
    assert.equal(acks.length, 2)
    assert.equal(acks[0].commandId, common.MavCmd.VIDEO_START_CAPTURE)
    assert.equal(acks[0].result, 5, "Should ACK MAV_RESULT_IN_PROGRESS while switching modes")
    assert.equal(acks[1].result, undefined, "Should ACK accepted (default) once switched and recording")
  })

  it('#onMavPacketRejectsWhenSwitchAlreadyInProgress()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)
    vManager.cameraMode = 'photo'
    vManager.modeSwitchInProgress = true // simulate an in-flight switch

    let switched = false
    vManager.stopCamera = () => { switched = true }

    const acks = []
    vManager.eventEmitter.on('camera_command_ack', (commandId, senderSysId, senderCompId, targetComponent, result) => {
      acks.push({ commandId, result })
    })

    const packet = { header: { msgid: common.CommandLong.MSG_ID, sysid: 1, compid: 1 } }
    const data = { targetComponent: minimal.MavComponent.CAMERA, command: common.MavCmd.VIDEO_START_STREAMING, _param1: 0 }

    vManager.onMavPacket(packet, data)

    assert.equal(switched, false, "Should NOT attempt another switch while one is already in progress")
    assert.equal(acks.length, 1)
    assert.equal(acks[0].result, 1, "Should NACK with MAV_RESULT_TEMPORARILY_REJECTED")
  })

  it('#setupStreamEventsIgnoresStaleProcessAfterModeSwitch()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)

    const makeFakeProc = () => {
      const proc = new EventEmitter()
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      proc.kill = () => {}
      return proc
    }

    // An old process ('Mode A') starts and becomes ready...
    const procA = makeFakeProc()
    vManager.deviceStream = procA
    vManager.setupStreamEvents('Mode A', () => {})
    procA.stdout.emit('data', Buffer.from('Camera is ready in Mode A\n'))
    assert.equal(vManager.active, true, "Mode A should be marked active once ready")

    // ...then a mode switch happens: a NEW process ('Mode B') is spawned and
    // becomes ready, superseding procA - mirroring what
    // switchCameraModeAndTakeAction's stopCamera()+startCamera() flow does
    // (this.deviceStream reassigned to the new process).
    const procB = makeFakeProc()
    vManager.deviceStream = procB
    vManager.setupStreamEvents('Mode B', () => {})
    procB.stdout.emit('data', Buffer.from('Camera is ready in Mode B\n'))
    assert.equal(vManager.active, true, "Mode B should be marked active once ready")

    // The OLD process (procA) finally exits from its earlier SIGTERM, well
    // after Mode B has taken over - its stale 'close' event must NOT clobber
    // the current (Mode B) active state.
    procA.emit('close', 0)

    assert.equal(vManager.active, true, "A stale process's close event must not clobber the current mode's active state")
    assert.equal(vManager.deviceStream, procB, "The current device stream must be unaffected")
  })

  it('#toggleVideoRecording()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)

    vManager.active = true
    let signalSent = false
    vManager.deviceStream = {
      kill: (signal) => {
        if (signal === 'SIGUSR1') signalSent = true
      }
    }

    vManager.toggleVideoRecording()
    assert.equal(signalSent, true, "Should send SIGUSR1 to toggle recording")
  })

  it('#sendCameraInformation()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)

    // Mock settings to ensure model name extraction works
    vManager.videoSettings = { device: 'imx219' }

    vManager.eventEmitter.on('camerainfo', (msg, sysId, compId) => {
      // Decode vendor name (plain byte array to string)
      const vendorText = String.fromCharCode(...msg.vendorName).replace(/\0/g, '')
      assert.equal(vendorText, 'Rpanion')
      assert.equal(msg.flags, common.CameraCapFlags.CAPTURE_IMAGE | common.CameraCapFlags.CAPTURE_VIDEO | common.CameraCapFlags.HAS_VIDEO_STREAM) // Full capability set (mode auto-switching supports all)
      done()
    })

    vManager.sendCameraInformation(1, 1, 1)
  })

  it('#sendVideoStreamInformation()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)

    vManager.videoSettings = {
      width: 1280,
      height: 720,
      fps: 30,
      bitrate: 2000,
      rotation: 0,
      compression: 'H264',
      useUDP: false,
      mavStreamSelected: '127.0.0.1'
    }

    // Mock addresses so URI generation works
    vManager.deviceAddresses = ['rtsp://127.0.0.1:8554/test']

    vManager.eventEmitter.on('videostreaminfo', (msg) => {
      assert.equal(msg.streamId, 1)
      assert.equal(msg.resolutionH, 1280)
      assert.equal(msg.type, 0) // RTSP
      assert.equal(msg.encoding, 1) // H264
      assert.ok(msg.uri.includes('rtsp://'))
      done()
    })

    vManager.sendVideoStreamInformation(1, 1, 1)
  })

  it('#sendVideoStreamInformationMultipleAddresses()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)

    vManager.videoSettings = {
      width: 1280,
      height: 720,
      fps: 30,
      bitrate: 2000,
      rotation: 0,
      compression: 'H264',
      useUDP: false,
      mavStreamSelected: '127.0.0.1', // deliberately select the loopback address
      device: 'CSI-imx415'
    }

    // A loopback address plus a real, reachable one
    vManager.deviceAddresses = ['rtsp://127.0.0.1:8554/test', 'rtsp://10.0.2.100:8554/test']

    const received = []
    vManager.eventEmitter.on('videostreaminfo', (msg) => received.push(msg))

    vManager.sendVideoStreamInformation(1, 1, 1)

    // One message per address, not just the (loopback) selected one
    assert.equal(received.length, 2)
    // count reflects the total number of streams being advertised
    assert.ok(received.every(msg => msg.count === 2))
    // the real, reachable address should be advertised first...
    assert.equal(received[0].streamId, 1)
    assert.ok(received[0].uri.includes('10.0.2.100'))
    // ...and each stream's name should be distinguishable (clean model name + its
    // own address), not identical entries a user can't tell apart in a GCS dropdown
    assert.equal(received[0].name, 'imx415 (10.0.2.100)')
    // ...and loopback last, as a fallback rather than the primary choice
    assert.equal(received[1].streamId, 2)
    assert.equal(received[1].name, 'imx415 (127.0.0.1)')
    assert.ok(received[1].uri.includes('127.0.0.1'))
  })

  it('#sendCameraSettings()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)

    // Test photo mode
    vManager.cameraMode = 'photo'
    let photoModeSettingsReceived = false
    vManager.eventEmitter.on('camerasettings', (msg) => {
      if (!photoModeSettingsReceived) {
        photoModeSettingsReceived = true
        assert.equal(msg.modeId, 0) // IMAGE mode
        // Test video mode
        vManager.cameraMode = 'video'
        vManager.sendCameraSettings(1, 1, 1)
      } else {
        assert.equal(msg.modeId, 1) // VIDEO mode
        done()
      }
    })

    vManager.sendCameraSettings(1, 1, 1)
  })


})
