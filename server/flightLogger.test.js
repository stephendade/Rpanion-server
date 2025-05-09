const assert = require('assert')
const Path = require('path')
const fs = require('fs')
const appRoot = require('app-root-path')
const Logger = require('./flightLogger')
const logpaths = require('./paths.js')

describe('Logging Functions', function () {
  beforeEach('Ensure cleared log folder', function () {
    deleteFolderRecursive(logpaths.flightsLogsDir, '.tlog')
  })

  // Recursively delete folder and files
  const deleteFolderRecursive = function (path, ext) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach((file) => {
        const curPath = Path.join(path, file)
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          deleteFolderRecursive(curPath)
        } else if (curPath.endsWith(ext)) { // delete file
          fs.unlinkSync(curPath)
        }
      })
      // fs.rmdirSync(path)
    }
  }

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
    Lgr.clearlogs('binlog', null)
    Lgr.clearlogs('kmzlog', null)

    // assert all files deleted
    assert.equal(fs.readdirSync(logpaths.flightsLogsDir).length, 1) // note that the kmzlogs folder counts as 1
    assert.equal(fs.readdirSync(logpaths.kmzDir).length, 0)
  })

  it('#getlogs()', function (done) {
    const Lgr = new Logger()

    // create a fake log
    fs.writeFileSync(Path.join(logpaths.flightsLogsDir, 'flight.tlog'), Buffer.from('tést'))

    Lgr.getLogs(function (err, tlogs, binlogs, kmzlogs) {
      assert.equal(tlogs.length, 1)
      assert.equal(binlogs.length, 0)
      assert.equal(kmzlogs.length, 0)
      done()
    })
  })
})
