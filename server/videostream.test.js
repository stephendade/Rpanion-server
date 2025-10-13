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

    vManager.populateAddresses()

    // check initial status
    assert.notEqual(vManager.ifaces.length, 0)
    assert.notEqual(vManager.deviceAddresses.length, 0)
  })

  it('#videomanagerscan()', function (done) {
    // Scanning for video devices capable of streaming
    // in a CI environment, no devices will be returned
    settings.clear()
    const vManager = new VideoStream(settings)

    vManager.populateAddresses()
    // err, devices, active, seldevice, selRes, selRot, selbitrate, selfps, SeluseUDPIP, SeluseUDPPort, timestamp, fps, FPSMax, vidres, cameraHeartbeat, selMavURI, compression, transport, transportOptions
    vManager.getVideoDevices(function (err, devices, active, seldevice, selRes, selRot, selbitrate, selfps, SeluseUDPIP,
                                       SeluseUDPPort, timestamp, fps, FPSMax, vidres, cameraHeartbeat, selMavURI,
                                       compression, transport, transportOptions) {
      assert.equal(err, null)
      assert.equal(active, false)
      assert.notEqual(seldevice, null)
      assert.notEqual(selRes, null)
      assert.notEqual(selRot, null)
      assert.notEqual(selbitrate, null)
      assert.notEqual(selfps, null)
      assert.equal(SeluseUDPIP, '127.0.0.1')
      assert.equal(SeluseUDPPort, 5400)
      assert.equal(timestamp, false)
      assert.notEqual(fps, null)
      assert.notEqual(FPSMax, null)
      assert.notEqual(vidres, null)
      assert.notEqual(selMavURI, null)
      assert.deepEqual(compression, { label: 'H.264', value: 'H264' })
      assert.deepEqual(transport, { label: 'RTSP', value: 'RTSP' })
      assert.deepEqual(transportOptions, [{ label: 'RTP', value: 'RTP' }, { label: 'RTSP', value: 'RTSP' }])
      // Check that RTSP source is available in devices
      const rtspSrc = devices.find(d => d.value === 'rtspsrc')
      assert.notEqual(rtspSrc, undefined)
      assert.equal(rtspSrc.label, 'RTSP Source')
      done()
    })
  }).timeout(5000)

  it('#videomanagerisUbuntu()', async function () {
    settings.clear()
    const vManager = new VideoStream(settings)

    const res = await vManager.isUbuntu()
    assert.equal(res, true)
  })

  it('#videomanagerRTSPSource()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)

    vManager.getVideoDevices(function (err) {
      assert.equal(err, null)
      // Test that RTSP URL can be used as a device
      vManager.startStopStreaming(true, 'rtsp://192.168.1.100:8554/stream', '1080', '1920', 'video/x-raw', '0', '1000', '5', 'RTSP', '127.0.0.1', 5600, false, false, '0', 'H264', function (err, status) {
        assert.equal(err, null)
        assert.equal(status, true)
        assert.notEqual(vManager.deviceStream.pid, null)
        vManager.startStopStreaming(false, 'rtsp://192.168.1.100:8554/stream', '1080', '1920', 'video/x-raw', '0', '1000', '5', 'RTSP', '127.0.0.1', 5600, false, false, '0', 'H264', function (err, status) {
          assert.equal(err, null)
          assert.equal(status, false)
          done()
        })
      })
    })
  })

  it('#videomanagerstartStopStreaming()', function (done) {
    settings.clear()
    const vManager = new VideoStream(settings)

    vManager.startStopStreaming(true, 'testsrc', '1080', '1920', 'video/x-h264', '0', '1000', '5', false, false, false, true, false, '0', "H264", function (err, status) {
      assert.equal(err, null)
      assert.equal(status, true)
      assert.notEqual(vManager.deviceStream.pid, null)
      vManager.startStopStreaming(false, 'testsrc', '1080', '1920', 'video/x-h264', '0', '1000', '5', false, false, false, true, false, '0', "H264", function (err, status) {
        assert.equal(err, null)
        assert.equal(status, false)
        done()
      })
    })
  })
})
