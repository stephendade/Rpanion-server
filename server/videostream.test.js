const assert = require('assert')
const settings = require('settings-store')
const VideoStream = require('./videostream')

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

    // Simulate active camera
    vManager.active = true
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
      assert.equal(msg.seq, 0) // First photo
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
      // Decode vendor name (Uint8Array to string)
      const vendorText = new TextDecoder().decode(msg.vendorName).replace(/\0/g, '')
      assert.equal(vendorText, 'Rpanion')
      assert.equal(msg.flags, 256) // Default streaming flag
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
