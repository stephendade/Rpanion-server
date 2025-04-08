process.env.NODE_ENV = 'development'

const assert = require('assert')
const Path = require('path')
const fs = require('fs')
const os = require('os')
const logpaths = require('./paths.js')

const testRoot = fs.mkdtempSync(Path.join(os.tmpdir(), 'flightlogger-test-'))
logpaths.flightsLogsDir = Path.join(testRoot, 'flightlogs')
logpaths.kmzDir = Path.join(testRoot, 'flightlogs', 'kmzlogs')
logpaths.mediaDir = Path.join(testRoot, 'media')

const Logger = require('./flightLogger')

describe('Logging Functions', function () {
  beforeEach('Ensure cleared log folder', function () {
    if (fs.existsSync(logpaths.flightsLogsDir)) {
      fs.rmSync(logpaths.flightsLogsDir, { recursive: true, force: true })
    }
    if (fs.existsSync(logpaths.mediaDir)) {
      fs.rmSync(logpaths.mediaDir, { recursive: true, force: true })
    }
  })

  after(function () {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true })
    }
  })

  it('#loggerinit()', function () {
    const Lgr = new Logger()

    // assert folders were created
    assert.ok(fs.existsSync(Lgr.topfolder))
  })

  it('#clearlogfiles()', function () {
    const Lgr = new Logger()

    // create a fake log
    fs.writeFileSync(Path.join(logpaths.flightsLogsDir, 'flight.tlog'), Buffer.from('tést'))

    Lgr.clearlogs('tlog', null)

    // ensure kmz log folder exists before clearing kmz logs
    fs.mkdirSync(logpaths.kmzDir, { recursive: true })
    fs.writeFileSync(Path.join(logpaths.kmzDir, 'flight.kmz'), Buffer.from('dummy'))

    Lgr.clearlogs('binlog', null)
    Lgr.clearlogs('kmzlog', null)

    // assert all files deleted
    assert.equal(fs.readdirSync(logpaths.flightsLogsDir).length, 1) // note that the kmzlogs folder counts as 1
    assert.equal(fs.readdirSync(logpaths.kmzDir).length, 0)
  })

  it('#getlogs()', function (done) {
    const Lgr = new Logger()

    // Ensure media directory exists before testing
    if (!fs.existsSync(logpaths.mediaDir)) {
      fs.mkdirSync(logpaths.mediaDir, { recursive: true })
    }

    // create a fake log
    fs.writeFileSync(Path.join(logpaths.flightsLogsDir, 'flight.tlog'), Buffer.from('tést'))

    Lgr.getLogs(function (err, tlogs, binlogs, kmzlogs, mediafiles) {
      assert.equal(tlogs.length, 1)
      assert.equal(binlogs.length, 0)
      assert.equal(kmzlogs.length, 0)
      assert.equal(mediafiles.length, 0)
      done()
    })
  })
})
