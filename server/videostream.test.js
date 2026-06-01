const assert = require('assert')
const path = require('path')
const fs = require('fs')
const settings = require('settings-store')
const { minimal, common } = require('node-mavlink')
const logpaths = require('./paths')
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
    vManager.stillSettings = { device: 'imx219', width: 4056, height: 3040 }
    vManager.useCameraHeartbeat = true

    // Test Save
    vManager.saveSettings()
    assert.equal(settings.value('camera.active'), true)
    assert.equal(settings.value('camera.mode'), 'video')
    assert.deepEqual(settings.value('camera.videoSettings'), { width: 1920, height: 1080 })
    assert.deepEqual(settings.value('camera.stillSettings'), { device: 'imx219', width: 4056, height: 3040 })
    assert.equal(settings.value('camera.useHeartbeat'), true)

    // Test Reset
    vManager.resetCamera()
    assert.equal(vManager.active, false)
    assert.equal(vManager.videoSettings, null)
    assert.equal(vManager.stillSettings, null)
    assert.equal(settings.value('camera.active'), false)
    assert.equal(settings.value('camera.videoSettings'), null)
    assert.equal(settings.value('camera.stillSettings'), null)
    assert.equal(settings.value('camera.useHeartbeat'), false)
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


  it('#captureStillPhoto() - camera active', function (done) {
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

  it('#captureStillPhoto() - does nothing when camera is inactive', function () {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    vManager.active = false
    let signalSent = false
    vManager.deviceStream = {
      kill: () => { signalSent = true }
    }
 
    let eventEmitted = false
    vManager.eventEmitter.on('cameratrigger', () => { eventEmitted = true })
 
    vManager.captureStillPhoto(1, 1, 1)
 
    assert.equal(signalSent, false, "Should not send signal when camera is inactive")
    assert.equal(eventEmitted, false, "Should not emit events when camera is inactive")
    assert.equal(vManager.photoSeq, 0, "Should not increment photo sequence")
  })

  it('#captureStillPhoto() - emits camera_command_ack when commandId is provided', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    vManager.active = true
    vManager.deviceStream = { kill: () => {} }
 
    let ackEmitted = false
    let digicamEmitted = false
 
    vManager.eventEmitter.on('camera_command_ack', (commandId, sysId, compId, targetComp) => {
      ackEmitted = true
      assert.equal(commandId, 203, "Should pass through the commandId")
      assert.equal(sysId, 1)
    })
    vManager.eventEmitter.on('digicamcontrol', () => { digicamEmitted = true })
 
    // Pass a non-null commandId — triggers the ack branch
    vManager.captureStillPhoto(1, 1, 1, null, 203)
 
    setTimeout(() => {
      assert.equal(ackEmitted, true, "Should emit camera_command_ack when commandId is set")
      assert.equal(digicamEmitted, false, "Should not emit digicamcontrol when commandId is set")
      done()
    }, 50)
  })
 
  it('#captureStillPhoto() - emits digicamcontrol as fallback when no commandId', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    vManager.active = true
    vManager.deviceStream = { kill: () => {} }
 
    let ackEmitted = false
    let digicamEmitted = false
 
    vManager.eventEmitter.on('camera_command_ack', () => { ackEmitted = true })
    vManager.eventEmitter.on('digicamcontrol', () => { digicamEmitted = true })
 
    // No commandId passed — triggers the digicamcontrol fallback
    vManager.captureStillPhoto(1, 1, 1)
 
    setTimeout(() => {
      assert.equal(digicamEmitted, true, "Should emit digicamcontrol when no commandId is set")
      assert.equal(ackEmitted, false, "Should not emit camera_command_ack when commandId is null")
      done()
    }, 50)
  })
 
  it('#captureStillPhoto() - writes GPS data to temp file when positionData is provided', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    vManager.active = true
    vManager.deviceStream = { kill: () => {} }
 
    const positionData = { lat: 49.2827, lon: -123.1207, alt: 100 }
    const gpsFilePath = '/tmp/rpanion_gps.json'
 
    // Clean up any existing file first
    if (fs.existsSync(gpsFilePath)) fs.unlinkSync(gpsFilePath)
 
    vManager.captureStillPhoto(1, 1, 1, positionData)
 
    setTimeout(() => {
      assert.ok(fs.existsSync(gpsFilePath), "Should write GPS temp file")
      const written = JSON.parse(fs.readFileSync(gpsFilePath, 'utf8'))
      assert.deepEqual(written, positionData, "GPS file should contain the positionData payload")
      fs.unlinkSync(gpsFilePath) // cleanup
      done()
    }, 50)
  })
 
  it('#captureStillPhoto() - removes stale GPS file when positionData is null', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    vManager.active = true
    vManager.deviceStream = { kill: () => {} }
 
    const gpsFilePath = '/tmp/rpanion_gps.json'
 
    // Pre-create a stale GPS file to simulate a prior capture
    fs.writeFileSync(gpsFilePath, JSON.stringify({ lat: 0, lon: 0, alt: 0 }))
 
    vManager.captureStillPhoto(1, 1, 1, null)
 
    setTimeout(() => {
      assert.equal(fs.existsSync(gpsFilePath), false, "Should remove stale GPS file when positionData is null")
      done()
    }, 50)
  })

  it('#toggleVideoRecording() - sends SIGUSR1 when camera is active', function () {
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
 
  it('#toggleVideoRecording() - does nothing when camera is inactive', function () {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    vManager.active = false
    let signalSent = false
    vManager.deviceStream = {
      kill: () => { signalSent = true }
    }
 
    vManager.toggleVideoRecording()
    assert.equal(signalSent, false, "Should not send signal when camera is inactive")
  })
 
  it('#toggleVideoRecording() - does nothing when deviceStream is null', function () {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    vManager.active = true
    vManager.deviceStream = null
 
    // Should return early without throwing
    assert.doesNotThrow(() => vManager.toggleVideoRecording())
  })

  it('#startHeartbeatInterval()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    let heartbeatCount = 0
    let lastMavType, lastAutopilot, lastComponent
 
    vManager.eventEmitter.on('cameraheartbeat', (mavType, autopilot, component) => {
      heartbeatCount++
      lastMavType = mavType
      lastAutopilot = autopilot
      lastComponent = component
    })
 
    vManager.startHeartbeatInterval()
 
    // intervalObj should be set immediately
    assert.notEqual(vManager.intervalObj, null, "Should store interval reference in intervalObj")
 
    // Wait long enough for at least two heartbeat ticks
    setTimeout(() => {
      clearInterval(vManager.intervalObj)
      vManager.intervalObj = null

      try {
        assert.ok(heartbeatCount >= 2, "Should emit cameraheartbeat on each 1-second tick")
 
        // Verify the MAVLink field values sent with each heartbeat
        const { minimal } = require('node-mavlink')
        assert.equal(lastMavType, minimal.MavType.CAMERA, "Should use MavType.CAMERA")
        assert.equal(lastAutopilot, minimal.MavAutopilot.INVALID, "Should use MavAutopilot.INVALID")
        assert.equal(lastComponent, minimal.MavComponent.CAMERA, "Should use MavComponent.CAMERA")
 
        done()
      } catch (err) {
        done(err)
      }
    }, 2200)
  }).timeout(5000)


  it('#setRecordingFlag()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    // setRecordingFlag is a no-op when videoSettings is null
    vManager.videoSettings = null
    assert.doesNotThrow(() => vManager.setRecordingFlag(true))
    assert.equal(vManager.videoSettings, null, "Should not set videoSettings when it is null")
 
    // With videoSettings present, it should update isRecording immutably and persist
    vManager.videoSettings = { width: 1280, height: 720, isRecording: false }
    const originalRef = vManager.videoSettings
 
    vManager.setRecordingFlag(true)
    assert.equal(vManager.videoSettings.isRecording, true, "Should set isRecording to true")
    assert.notEqual(vManager.videoSettings, originalRef, "Should replace the object rather than mutating it")
    assert.equal(settings.value('camera.videoSettings').isRecording, true, "Should persist the flag via saveSettings")
 
    vManager.setRecordingFlag(false)
    assert.equal(vManager.videoSettings.isRecording, false, "Should set isRecording to false")
    assert.equal(settings.value('camera.videoSettings').isRecording, false, "Should persist the cleared flag via saveSettings")
  })


  it('#toMavString()', function () {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    // Null/undefined/empty input returns empty string
    assert.equal(vManager.toMavString(null, 32), "")
    assert.equal(vManager.toMavString(undefined, 32), "")
    assert.equal(vManager.toMavString("", 32), "")
 
    // String shorter than limit passes through unchanged
    assert.equal(vManager.toMavString("Rpanion", 32), "Rpanion")
 
    // String that exactly fills the buffer (length === limit) must be truncated
    // to length - 1 to leave room for the trailing null byte
    const exactly32 = "A".repeat(32)
    const result32 = vManager.toMavString(exactly32, 32)
    assert.equal(result32.length, 31, "Should truncate to length - 1 to guarantee a null terminator slot")
 
    // String much longer than limit is truncated to length - 1
    const long = "B".repeat(300)
    const resultLong = vManager.toMavString(long, 32)
    assert.equal(resultLong.length, 31, "Should truncate long strings to length - 1")
 
    // Non-string input is coerced via toString()
    const numResult = vManager.toMavString(12345, 32)
    assert.equal(numResult, "12345")
  })

  it('#getStorageStats()', async function () {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    const stats = await vManager.getStorageStats()
 
    // Whether or not mediaDir is accessible, the returned shape must always be valid
    assert.ok(typeof stats.totalMiB === 'number', "totalMiB should be a number")
    assert.ok(typeof stats.usedMiB === 'number', "usedMiB should be a number")
    assert.ok(typeof stats.availableMiB === 'number', "availableMiB should be a number")
    assert.ok(stats.totalMiB >= 0, "totalMiB should be non-negative")
    assert.ok(stats.usedMiB >= 0, "usedMiB should be non-negative")
    assert.ok(stats.availableMiB >= 0, "availableMiB should be non-negative")
  })
 
  it('#sendStorageInfo()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    vManager.eventEmitter.on('storageinfo', (msg, sysId, compId) => {
      assert.equal(msg.storageId, 1, "Should report storageId 1")
      assert.equal(msg.storageCount, 1, "Should report storageCount 1")
      assert.equal(msg.readSpeed, 0)
      assert.equal(msg.writeSpeed, 0)
      assert.equal(msg.hfov, undefined) // not a field on StorageInformation
      assert.ok(typeof msg.totalCapacity === 'number', "totalCapacity should be a number")
      assert.ok(typeof msg.usedCapacity === 'number', "usedCapacity should be a number")
      assert.ok(msg.availableCapacity >= 0, "availableCapacity should be non-negative")
 
      // Verify the name field is set (may be truncated via toMavString)
      assert.ok(msg.name.includes('Rpanion'), "name should contain 'Rpanion'")
 
      // Verify caller arguments are forwarded correctly
      assert.equal(sysId, 1)
      assert.equal(compId, 1)
 
      done()
    })
 
    vManager.sendStorageInfo(1, 1, 1)
  }).timeout(5000)

  it('#sendCameraImageCaptured() without GPS file', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)
    vManager.photoSeq = 5
 
    // Ensure GPS file does not exist for this test
    const gpsPath = '/tmp/rpanion_gps.json'
    if (fs.existsSync(gpsPath)) {
      fs.unlinkSync(gpsPath)
    }
 
    vManager.eventEmitter.on('cameraimagecaptured', (msg, compId) => {
      assert.equal(msg.cameraId, 0)
      assert.equal(msg.lat, 0, "lat should default to 0 when GPS file is missing")
      assert.equal(msg.lon, 0, "lon should default to 0 when GPS file is missing")
      assert.equal(msg.alt, 0, "alt should default to 0 when GPS file is missing")
      assert.equal(msg.relativeAlt, 0, "relativeAlt should default to 0 when GPS file is missing")
      assert.deepEqual(msg.q, [1, 0, 0, 0])
      assert.equal(msg.imageIndex, 5)
      assert.equal(msg.captureResult, 1)
      assert.equal(msg.fileUrl, '')
      assert.ok(typeof msg.timeBootMs === 'number')
      assert.ok(typeof msg.timeUtc === 'bigint')
      assert.equal(compId, 42)
 
      done()
    })
 
    vManager.sendCameraImageCaptured(42)
  })
 
  it('#sendCameraImageCaptured() with GPS file', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)
    vManager.photoSeq = 7
 
    const gpsPath = '/tmp/rpanion_gps.json'
    const gpsData = { lat: -27.5, lon: 153.0, alt: 100.25, relAlt: 50.5 }
    fs.writeFileSync(gpsPath, JSON.stringify(gpsData))
 
    vManager.eventEmitter.on('cameraimagecaptured', (msg, compId) => {
      assert.equal(msg.lat, Math.round(-27.5 * 1e7))
      assert.equal(msg.lon, Math.round(153.0 * 1e7))
      assert.equal(msg.alt, Math.round(100.25 * 1000))
      assert.equal(msg.relativeAlt, Math.round(50.5 * 1000))
      assert.equal(msg.imageIndex, 7)
 
      // Clean up the GPS file
      fs.unlinkSync(gpsPath)
 
      done()
    })
 
    vManager.sendCameraImageCaptured(42)
  })

  it('#sendUnsupportedAck()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)
 
    vManager.eventEmitter.on('camera_command_ack', (command, sysId, compId, targetComp, result) => {
      assert.equal(command, 9999, "Should pass through the emitted command")
      assert.equal(sysId, 2)
      assert.equal(result, 3, "Result should be 3 (MAV_RESULT_UNSUPPORTED)")
      done()
    })
 
    vManager.sendUnsupportedAck(9999, 2, 1)
  })

  it('#sendCameraInformation()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)

    // Mock settings to ensure model name extraction works
    vManager.videoSettings = { device: 'imx219' }

    vManager.eventEmitter.on('camerainfo', (msg, sysId, compId) => {
      // vendorName is now a Uint8Array returned by toMavUint8Array()
      const vendorName = Buffer.from(msg.vendorName).toString('utf8').replace(/\0+$/, '')
      assert.equal(vendorName, 'Rpanion')
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

// ---------------------------------------------------------------------------
// onMavPacket testing: helper functions
// ---------------------------------------------------------------------------

/** Build a synthetic MAVLink packet header */
function makePacket (sysid = 1, compid = 1) {
  return { header: { sysid, compid, msgid: common.CommandLong.MSG_ID } }
}

/** Build the decoded data payload for a CommandLong */
function makeCommandLong (command, targetComponent, param1 = 0) {
  return {
    command,
    targetComponent,
    _param1: param1
  }
}

/** Shorthand: camera-targeted packet + data */
function cameraPacket (command, param1 = 0, sysid = 1, compid = 100) {
  return {
    packet: makePacket(sysid, compid),
    data: makeCommandLong(command, minimal.MavComponent.CAMERA, param1)
  }
}

// ---------------------------------------------------------------------------
// onMavPacket testing: Shared setup for all the following tests
// ---------------------------------------------------------------------------

function makeManager (overrides = {}) {
  settings.clear()
  const vm = new VideoStream(settings)
  // Provide minimal videoSettings so branches that read it don't throw
  vm.videoSettings = {
    device: 'imx219',
    width: 1280,
    height: 720,
    fps: 30,
    bitrate: 1100,
    rotation: 0,
    compression: 'H264',
    useUDP: false,
    useUDPIP: '127.0.0.1',
    useUDPPort: 5600,
    mavStreamSelected: '127.0.0.1',
    isRecording: false
  }
  vm.deviceAddresses = ['rtsp://127.0.0.1:8554/devvideo0']
  vm.cameraMode = 'streaming'
  Object.assign(vm, overrides)
  return vm
}

// ---------------------------------------------------------------------------
// onMavPacket testing: Tests
// ---------------------------------------------------------------------------

describe('onMavPacket()', function () {

  // ── Packet filtering ────────────────────────────────────────────────────

  it('ignores packets not targeting the CAMERA component', function () {
    const vm = makeManager()
    let emitted = false
    vm.eventEmitter.on('camera_command_ack', () => { emitted = true })
    vm.eventEmitter.on('camerainfo',         () => { emitted = true })

    const packet = makePacket(1, 1)
    const data   = makeCommandLong(512, minimal.MavComponent.AUTOPILOT1, common.CameraInformation.MSG_ID)
    vm.onMavPacket(packet, data)

    assert.equal(emitted, false, 'Should not react to packets targeting other components')
  })

  // ── Command 512 – REQUEST_MESSAGE ────────────────────────────────────────

  it('command 512 – CameraInformation.MSG_ID emits camerainfo', function (done) {
    const vm = makeManager()
    const { packet, data } = cameraPacket(512, common.CameraInformation.MSG_ID)

    vm.eventEmitter.on('camerainfo', (msg, sysId, compId, targetComp) => {
      assert.ok(msg, 'Should emit a CameraInformation message object')
      assert.equal(sysId, packet.header.sysid)
      done()
    })

    vm.onMavPacket(packet, data)
  })

  it('command 512 – VideoStreamInformation.MSG_ID in streaming mode emits videostreaminfo', function (done) {
    const vm = makeManager({ cameraMode: 'streaming' })
    const { packet, data } = cameraPacket(512, common.VideoStreamInformation.MSG_ID)

    vm.eventEmitter.on('videostreaminfo', (msg) => {
      assert.equal(msg.streamId, 1)
      done()
    })

    vm.onMavPacket(packet, data)
  })

  it('command 512 – VideoStreamInformation.MSG_ID in non-streaming mode sends unsupported ACK', function (done) {
    const vm = makeManager({ cameraMode: 'photo' })
    const { packet, data } = cameraPacket(512, common.VideoStreamInformation.MSG_ID)

    vm.eventEmitter.on('camera_command_ack', (command, sysId, compId, targetComp, result) => {
      assert.equal(result, 3, 'Result should be MAV_RESULT_UNSUPPORTED (3)')
      done()
    })

    vm.onMavPacket(packet, data)
  })

  it('command 512 – CameraSettings.MSG_ID emits camerasettings', function (done) {
    const vm = makeManager()
    const { packet, data } = cameraPacket(512, common.CameraSettings.MSG_ID)

    vm.eventEmitter.on('camerasettings', (msg) => {
      assert.ok(msg, 'Should emit a CameraSettings message object')
      done()
    })

    vm.onMavPacket(packet, data)
  })

  it('command 512 – StorageInformation.MSG_ID emits storageinfo', function (done) {
    const vm = makeManager()
    const { packet, data } = cameraPacket(512, common.StorageInformation.MSG_ID)

    vm.eventEmitter.on('storageinfo', (msg) => {
      assert.equal(msg.storageId, 1)
      done()
    })

    vm.onMavPacket(packet, data)
  }).timeout(5000)

  it('command 512 – unknown requested MSG_ID sends unsupported ACK', function (done) {
    const vm = makeManager()
    const unknownMsgId = 9999
    const { packet, data } = cameraPacket(512, unknownMsgId)

    vm.eventEmitter.on('camera_command_ack', (command, sysId, compId, targetComp, result) => {
      assert.equal(result, 3, 'Result should be MAV_RESULT_UNSUPPORTED (3)')
      done()
    })

    vm.onMavPacket(packet, data)
  })

  // ── Command 511 – SET_MESSAGE_INTERVAL ───────────────────────────────────

  it('command 511 emits camera_command_ack with result ACCEPTED (0)', function (done) {
    const vm = makeManager()
    const { packet, data } = cameraPacket(511)

    vm.eventEmitter.on('camera_command_ack', (command, sysId, compId, targetComp, result) => {
      assert.equal(command, 511)
      assert.equal(sysId, packet.header.sysid)
      assert.equal(result, 0, 'Result should be MAV_RESULT_ACCEPTED (0)')
      done()
    })

    vm.onMavPacket(packet, data)
  })

  // ── Command 203 – DO_DIGICAM_CONTROL ─────────────────────────────────────

  it('command 203 triggers captureStillPhoto', function (done) {
    const vm = makeManager()
    vm.active = true
    vm.deviceStream = { kill: () => {} }
    const { packet, data } = cameraPacket(203)

    vm.eventEmitter.on('camera_command_ack', (commandId) => {
      assert.equal(commandId, 203)
      done()
    })

    vm.onMavPacket(packet, data)
  })

  // ── Command 2000 – IMAGE_START_CAPTURE ───────────────────────────────────

  it('command 2000 triggers captureStillPhoto', function (done) {
    const vm = makeManager()
    vm.active = true
    vm.deviceStream = { kill: () => {} }
    const { packet, data } = cameraPacket(2000)

    vm.eventEmitter.on('camera_command_ack', (commandId) => {
      assert.equal(commandId, 2000)
      done()
    })

    vm.onMavPacket(packet, data)
  })

  // ── Command 2001 – IMAGE_STOP_CAPTURE ────────────────────────────────────

  it('command 2001 emits camera_command_ack for 2001', function (done) {
    const vm = makeManager()
    const { packet, data } = cameraPacket(2001)

    vm.eventEmitter.on('camera_command_ack', (commandId, sysId) => {
      assert.equal(commandId, 2001)
      assert.equal(sysId, packet.header.sysid)
      done()
    })

    vm.onMavPacket(packet, data)
  })

  // ── Command 2500 – VIDEO_START_CAPTURE ───────────────────────────────────

  it('command 2500 in video mode (not recording) toggles recording and emits ACK', function (done) {
    const vm = makeManager({ cameraMode: 'video' })
    vm.videoSettings.isRecording = false
    vm.active = true
    let signalSent = false
    vm.deviceStream = { kill: (sig) => { if (sig === 'SIGUSR1') signalSent = true } }
    const { packet, data } = cameraPacket(2500)

    vm.eventEmitter.on('camera_command_ack', (commandId) => {
      assert.equal(commandId, 2500)
      assert.equal(signalSent, true, 'Should toggle recording via SIGUSR1')
      done()
    })

    vm.onMavPacket(packet, data)
  })

  it('command 2500 when already recording does NOT toggle (just ACKs)', function (done) {
    const vm = makeManager({ cameraMode: 'video' })
    vm.videoSettings.isRecording = true
    vm.active = true
    let signalSent = false
    vm.deviceStream = { kill: (sig) => { if (sig === 'SIGUSR1') signalSent = true } }
    const { packet, data } = cameraPacket(2500)

    vm.eventEmitter.on('camera_command_ack', (commandId) => {
      assert.equal(commandId, 2500)
      assert.equal(signalSent, false, 'Should not toggle when already recording')
      done()
    })

    vm.onMavPacket(packet, data)
  })

  it('command 2500 in non-video mode just emits ACK without toggling', function (done) {
    const vm = makeManager({ cameraMode: 'streaming' })
    vm.active = true
    let signalSent = false
    vm.deviceStream = { kill: (sig) => { if (sig === 'SIGUSR1') signalSent = true } }
    const { packet, data } = cameraPacket(2500)

    vm.eventEmitter.on('camera_command_ack', (commandId) => {
      assert.equal(commandId, 2500)
      assert.equal(signalSent, false, 'Should not toggle when not in video mode')
      done()
    })

    vm.onMavPacket(packet, data)
  })

  // ── Command 2501 – VIDEO_STOP_CAPTURE ────────────────────────────────────

  it('command 2501 in video mode (is recording) toggles recording and emits ACK', function (done) {
    const vm = makeManager({ cameraMode: 'video' })
    vm.videoSettings.isRecording = true
    vm.active = true
    let signalSent = false
    vm.deviceStream = { kill: (sig) => { if (sig === 'SIGUSR1') signalSent = true } }
    const { packet, data } = cameraPacket(2501)

    vm.eventEmitter.on('camera_command_ack', (commandId) => {
      assert.equal(commandId, 2501)
      assert.equal(signalSent, true, 'Should toggle recording via SIGUSR1')
      done()
    })

    vm.onMavPacket(packet, data)
  })

  it('command 2501 when not recording does NOT toggle (just ACKs)', function (done) {
    const vm = makeManager({ cameraMode: 'video' })
    vm.videoSettings.isRecording = false
    vm.active = true
    let signalSent = false
    vm.deviceStream = { kill: (sig) => { if (sig === 'SIGUSR1') signalSent = true } }
    const { packet, data } = cameraPacket(2501)

    vm.eventEmitter.on('camera_command_ack', (commandId) => {
      assert.equal(commandId, 2501)
      assert.equal(signalSent, false, 'Should not toggle when already stopped')
      done()
    })

    vm.onMavPacket(packet, data)
  })

  it('command 2501 in non-video mode just emits ACK without toggling', function (done) {
    const vm = makeManager({ cameraMode: 'streaming' })
    vm.active = true
    let signalSent = false
    vm.deviceStream = { kill: (sig) => { if (sig === 'SIGUSR1') signalSent = true } }
    const { packet, data } = cameraPacket(2501)

    vm.eventEmitter.on('camera_command_ack', (commandId) => {
      assert.equal(commandId, 2501)
      assert.equal(signalSent, false, 'Should not toggle when not in video mode')
      done()
    })

    vm.onMavPacket(packet, data)
  })

  // ── Unknown command targeting CAMERA ────────────────────────────────────

  it('unknown camera-targeted command sends unsupported ACK', function (done) {
    const vm = makeManager()
    const { packet, data } = cameraPacket(9876)

    vm.eventEmitter.on('camera_command_ack', (command, sysId, compId, targetComp, result) => {
      assert.equal(command, 9876)
      assert.equal(result, 3, 'Result should be MAV_RESULT_UNSUPPORTED (3)')
      done()
    })

    vm.onMavPacket(packet, data)
  })
})