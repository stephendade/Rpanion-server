#!/usr/bin/env python3
"""
Heavily based on ArduPilot tools code.

"""

import glob
import os
import subprocess
import timeit
from os.path import exists

from datetime import datetime
from pymavlink import mavutil
from pymavlink.generator import mavtemplate

def cmd_as_shell(cmd):
    return (" ".join(['"%s"' % x for x in cmd]))


def run_cmd(cmd, directory=".", show=True, output=False, checkfail=True):
    """Run a shell command."""
    shell = False
    if not isinstance(cmd, list):
        cmd = [cmd]
        shell = True
    if show:
        print("Running: (%s) in (%s)" % (cmd_as_shell(cmd), directory,))
    if output:
        return subprocess.Popen(cmd, shell=shell, stdout=subprocess.PIPE, cwd=directory).communicate()[0]
    elif checkfail:
        return subprocess.check_call(cmd, shell=shell, cwd=directory)
    else:
        return subprocess.call(cmd, shell=shell, cwd=directory)


def mavtogpx_filepath():
    """Get mavtogpx script path."""
    if exists("/usr/local/bin/mavtogpx.py"):
        return "/usr/local/bin/mavtogpx.py"
    else:
        return "~/.local/bin/mavtogpx.py"  # relies on pymavlink instalation and path in ubuntu


def convert_tlog_files():
    """Convert any tlog files to GPX,  KML, KMZ and PNG."""
    mavlog = glob.glob("flightlogs/*.tlog")
    latest_file = max(mavlog, key=os.path.getctime)
    kmzlogs = glob.glob("flightlogs/kmzlogs/*.kmz")
    passed = True
    for m in mavlog:

        # get the logID without path and extension
        current_log = m[m.rfind('/') + 1:-5]

        # Do not reprocess a TLOG when it is the latest
        if (current_log in latest_file):
            print("[tlog2kmz.py] Ignoring {file} seens being in use.".format(file=m))
            continue

        # Do not reprocess a TLOG
        if (any(current_log in word for word in kmzlogs)):
            # print("[tlog2kmz.py] KMZ file for {file} already exists, ignoring".format(file=m))
            continue

        try:
            run_cmd(mavtogpx_filepath() + " " + m)
            gpx = m + '.gpx'
            kml = m + '.kml'    
            run_cmd('gpsbabel -i gpx -f %s '
                        '-o kml,units=m,floating=1,extrude=1 -F %s' %
                        (gpx, kml))
        except subprocess.CalledProcessError:
            passed = False

        try:
            run_cmd('zip %s.kmz %s.kml' % (m, m))
            run_cmd('mv %s.kmz flightlogs/kmzlogs' % (m))
        except subprocess.CalledProcessError:
            passed = False

        # TO DO: enable PNG files from missions:
        # this command runs quite well but needs MAVProxy as a module. May some conversation necessary.
        # run_cmd("../MAVProxy/MAVProxy/tools/mavflightview.py --imagefile=%s.png %s" % (m, m))

        # clean up
        try:
            run_cmd('rm %s.kml' % (m))
            run_cmd('rm %s.gpx' % (m))
        except subprocess.CalledProcessError:
            pass
    return passed


starttime = timeit.default_timer()
print("[tlog2kmz.py] Starting:", starttime)

run_result = convert_tlog_files()

print("[tlog2kmz.py] Passed = {passed} | Time = {time} seconds | now = {now}".format(passed=run_result, time=(timeit.default_timer() - starttime), now=(datetime.now())))
