#!/usr/bin/env python3
# -*- coding:utf-8 vi:ts=4:noexpandtab
# Simple RTSP server. Run as-is or with a command-line to replace the default pipeline
# Taken from https://github.com/tamaggo/gstreamer-examples/blob/master/test_gst_rtsp_server.py
# gst-launch-1.0 rtspsrc location=rtsp://127.0.0.1:8554/video latency=0 ! decodebin ! autovideosink

import argparse
import platform
import ipaddress
import os
import shutil
import signal
import sys
import time
from typing import List
import subprocess
import gi

gi.require_version("Gst", "1.0")
gi.require_version("GstRtsp", "1.0")
gi.require_version("GstRtspServer", "1.0")
from gi.repository import Gst, GstRtspServer, GLib

# Local port used to bridge a persistent capture pipeline (camera -> encoder ->
# tee -> [record to file] / [RTP over loopback]) into the RTSP server's
# per-client relay pipelines when local recording is enabled - see
# addRecordingStream()/RelayFactory below.
RECORDING_RELAY_PORT = 5700

# Named elements making up the local-recording branch off the tee (see
# getPipeline()'s record_path handling). Named explicitly so a bus ERROR
# message can be attributed to this branch specifically (e.g. disk full) and
# isolated - see isolateRecordingBranch() - without tearing down the whole
# pipeline (and with it, the live stream).
RECORDING_ELEMENT_NAMES = ('rec_queue', 'rec_mux', 'rec_sink')


# Returns true if this is a Raspi5 or later
# https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#raspberry-pi-revision-codes
def is_pi_5_or_later() -> bool:
    cmd = "cat /proc/cpuinfo | awk '/Revision/ {print $3}'"
    revcode = subprocess.check_output(cmd, shell=True)

    if revcode == "":
        return False

    try:
        code = int(revcode, 16)
        new = (code >> 23) & 0x1
        model = (code >> 4) & 0xff
        # mem = (code >> 20) & 0x7

        if new and model >= 0x17:
            return True
        else:
            return False
    except:
        return False


def is_multicast(ip: str) -> bool:
    try:
        ip_obj = ipaddress.ip_address(ip)
        # Multicast addresses are in the range 224.0.0.0 to 239.255.255.255
        return ip_obj.is_multicast
    except ValueError:
        # If the IP address is not valid, return False
        return False


def resolvePayloadCodec(device, format, compression) -> str:
    # Determine whether the encoded output is H264 or H265, matching the
    # choice getPipeline() itself makes: precompressed sources (RTSP source or
    # native v4l2 h264) are governed by `format`; everything else is encoded
    # in this script and governed by the user's `compression` choice.
    if format in ["video/x-h264", "video/x-h265"] or device.startswith("rtsp://"):
        return "H265" if format == "video/x-h265" else "H264"
    return "H265" if compression == "H265" else "H264"


def getPipeline(device, height, width, bitrate, format, rotation, framerate, timestamp, compression,
                 record_path="", stream_sink="") -> str:
    pipeline: List[str] = []

    # -1 is no framerate specified
    if framerate == -1:
        framestr = ""
    else:
        framestr = ",framerate={0}/1".format(framerate)

    # start with device
    if device == "testsrc":
        pipeline.append("videotestsrc pattern=ball")
        pipeline.append("video/x-raw,width={0},height={1}{2}".format(width, height, framestr))
    elif device.startswith("rtsp://"):
        # rtsp streaming source
        pipeline.append("rtspsrc location=\"{0}\" is-live=true latency=0 udp-buffer-size=212992".format(device))
        if format == "video/x-h264":
            pipeline.append("rtph264depay")
        elif format == "video/x-h265":
            pipeline.append("rtph265depay")
        else:
            print("Error: Need to specify video/x-h264 or video/x-h265 for rtsp source in --format")
            return ""
    elif device in ["argus0", "argus1"]:
        pipeline.append("nvarguscamerasrc sensor-id={0}".format(device[-1]))
        pipeline.append("video/x-raw(memory:NVMM),width={0},height={1},format=NV12{2}".format(width, height, framestr))
    elif device in ["0rpicam", "1rpicam"]:
        # Old (Buster and earlier) can use the rpicamsrc interface
        ts = ""
        if timestamp:
            ts = "annotation-mode=12 annotation-text-colour=0"
        pipeline.append("rpicamsrc {2} bitrate={0} rotation={1} camera-number={3} preview=false".format(
            bitrate*1000, rotation, ts, device[0]))
        pipeline.append("video/x-h264,width={0},height={1}{2}".format(
            width, height, framestr))
    elif device.startswith("/base/soc/i2c") or device.startswith("/base/axi/pcie"):
        # Bullseye uses the new libcamera interface ... so need a different pipeline
        # Note that the Pi5 uses a different format
        if is_pi_5_or_later():
            format = "RGBx"
        else:
            format = "I420"  # https://forums.raspberrypi.com/viewtopic.php?t=93560
        pipeline.append("libcamerasrc camera-name={0}".format(device))
        pipeline.append("capsfilter caps=video/x-raw,width={0},height={1},format={3}{2}".format(width, height, framestr, format))
        pipeline.append("queue max-size-buffers=3 leaky=downstream")
    elif format == "video/x-raw":
        # Use io-mode=2 (mmap) for better performance
        pipeline.append("v4l2src device={0} io-mode=2".format(device))
        pipeline.append("videorate drop-only=true")
        pipeline.append("{2},width={0},height={1}{3}".format(width, height, format, framestr))
        pipeline.append("queue max-size-buffers=2 leaky=downstream")
    elif format == "video/x-h264":
        pipeline.append("v4l2src device={0}".format(device))
        pipeline.append("{2},width={0},height={1}{3}".format(width, height, format, framestr))
    elif format == "image/jpeg":
        # Use io-mode=2 (mmap) for better performance with JPEG sources
        pipeline.append("v4l2src device={0} io-mode=2".format(device))
        # Drop frames immediately if processing can't keep up
        pipeline.append("videorate drop-only=true max-rate={0}".format(
            framerate if framerate != -1 else 30))
        pipeline.append("{2},width={0},height={1}{3}".format(
            width, height, format, framestr))
        # Reduce buffer to 2 and make it leaky to drop old frames faster
        pipeline.append("queue max-size-buffers=2 leaky=downstream")
        # Use hardware JPEG decoder if available, otherwise software
        if Gst.ElementFactory.find("v4l2jpegdec"):
            # Hardware decoder with output buffer optimization
            pipeline.append("v4l2jpegdec capture-io-mode=4")
        else:
            # Software decoder - allow error recovery
            pipeline.append("jpegdec max-errors=-1")
        # Output format from decoder - use I420 for better encoder compatibility
        pipeline.append("videoconvert n-threads=4")
        pipeline.append("video/x-raw,format=I420")
        # Add another small queue after decode to prevent blocking
        pipeline.append("queue max-size-buffers=2 leaky=downstream")
    else:
        print("Bad camera")
        return ""

    # now for rotations, overlays and compression, if required. Note we can't modify an x264 source stream
    if format not in ["video/x-h264", "video/x-h265"] and not device.startswith("rtsp://"):
        # now add rotations for not-jetson and not-legacy-pi-camera
        if device not in ["0rpicam", "1rpicam"] and 'tegra' not in platform.uname().release:
            if rotation == 90:
                pipeline.append("videoflip video-direction=90r")
            elif rotation == 180:
                pipeline.append("videoflip video-direction=180")
            elif rotation == 270:
                pipeline.append("videoflip video-direction=90l")

        # and then timestamps
        if timestamp and device not in ["0rpicam", "1rpicam"] and 'tegra' not in platform.uname().release:
            pipeline.append("videoconvert")
            pipeline.append("clockoverlay time-format=\"%d-%b-%Y %H:%M:%S\"")

        # 3 options for H264: Rpi hardware compression (v4l2h264enc), Jetson hardware compression (nvv4l2h264enc)
        # or software compression (x264enc)
        # 2 options for H265: Jetson hardware compression (nvv4l2h265enc) or software compression (x265enc)
        # Use v4l2-ctl -d 11 --list-ctrls-menu to get v4l2h264enc options
        if (Gst.ElementFactory.find("nvv4l2h264enc") and compression == "H264") or (Gst.ElementFactory.find("nvv4l2h265enc") and compression == "H265"):
            # Jetson, with h/w rotation
            if rotation == 90:
                devrotation = "flip-method=3"
            elif rotation == 180:
                devrotation = "flip-method=2"
            elif rotation == 270:
                devrotation = "flip-method=1"
            else:
                devrotation = ""
            pipeline.append("nvvidconv {0}".format(devrotation))
            if timestamp:
                pipeline.append("clockoverlay time-format=\"%d-%b-%Y %H:%M:%S\"")
                pipeline.append("nvvidconv")
            if compression == "H265":
                pipeline.append("nvv4l2h265enc bitrate={0} iframeinterval=5 preset-level=1 insert-sps-pps=true".format(bitrate*1000))
            elif compression == "H264":
                pipeline.append("nvv4l2h264enc bitrate={0} iframeinterval=5 preset-level=1 insert-sps-pps=true".format(bitrate*1000))
        elif Gst.ElementFactory.find("v4l2h264enc") and compression == "H264" and not (device == "testsrc" or device.startswith("/dev/video")):
            # Pi or similar arm platforms running on RasPiOS. Note that Pi5 onwards don't support hardware encoding
            # Only use a higher h264 level if the bitrate requires it. I find that level 4.1 can be a little
            # crashy sometimes.
            # The hardware encoder doesn't support USB or testvideo sources realiably, so use software x264 instead
            if bitrate > 20000:
                level = "4.1"
            else:
                level = "4"
            pipeline.append("videoconvert")
            pipeline.append("v4l2h264enc extra-controls=\"controls,repeat_sequence_header=1,h264_profile=4,video_bitrate={0},h264_i_frame_period=5\"".format(bitrate*1000))
            pipeline.append("video/x-h264,profile=high,level=(string){0}".format(level))
        else:
            # s/w encoder - x86, Pi5, etc
            pipeline.append("videoconvert")
            if is_pi_5_or_later() and compression == "H264":
                pipeline.append("video/x-raw,format=NV12")
            else:
                pipeline.append("video/x-raw,format=I420")
            # testcamerasrc doesn't like leaky queues
            if device != "testsrc":
                pipeline.append("queue max-size-buffers=2 leaky=downstream")
            else:
                pipeline.append("queue max-size-buffers=2")
            if compression == "H264":
                # Use multiple threads for software encoding
                pipeline.append("x264enc tune=zerolatency bitrate={0} speed-preset=superfast key-int-max=25 threads=0".format(bitrate))
            elif compression == "H265":
                pipeline.append("x265enc tune=zerolatency bitrate={0} speed-preset=superfast key-int-max=25".format(bitrate))

    # Ensure exactly one parse element sits right before the tee/pay/mux
    # point, regardless of which branch above produced the stream - mp4mux
    # (used for local recording) needs avc-aligned access units, and the RTP
    # payloader benefits from parsed input too.
    if resolvePayloadCodec(device, format, compression) == "H265":
        pipeline.append("h265parse")
        pay_element = "rtph265pay config-interval=1 name=pay0 pt=96"
    else:
        pipeline.append("h264parse")
        pay_element = "rtph264pay config-interval=1 name=pay0 pt=96"

    main_str = " ! ".join(pipeline)

    if record_path:
        # Separate leaky queue per branch so a slow/failing recording side
        # can't backpressure the live stream. Elements are named so a bus
        # ERROR from this branch (e.g. disk full) can be attributed to it -
        # see isolateRecordingBranch().
        filename = os.path.join(record_path, time.strftime("RPN%Y%m%d_%H%M%S.mp4"))
        full = ("{0} ! tee name=t ! queue ! {1}{2}   "
                "t. ! queue name=rec_queue leaky=downstream ! mp4mux name=rec_mux ! filesink name=rec_sink location=\"{3}\"").format(
            main_str, pay_element, stream_sink, filename)
        print("Recording started to {0}".format(filename))
    else:
        full = "{0} ! queue ! {1}{2}".format(main_str, pay_element, stream_sink)

    # return as full string
    print(full)
    return full


class MyFactory(GstRtspServer.RTSPMediaFactory):
    def __init__(self, device, h, w, bitrate, format, rotation, framerate, timestamp, compression):
        GstRtspServer.RTSPMediaFactory.__init__(self)
        self.device = device
        self.height = h
        self.width = w
        self.bitrate = bitrate
        self.format = format
        self.rotation = rotation
        self.framerate = framerate
        self.timestamp = timestamp
        self.compression = compression

        # Configure for low latency streaming
        self.set_latency(0)  # Minimize latency
        self.set_buffer_size(0)  # Use default but don't accumulate
        self.set_transport_mode(GstRtspServer.RTSPTransportMode.PLAY)

    def do_create_element(self, url):
        pipeline_str = getPipeline(self.device, self.height, self.width, self.bitrate, self.format, self.rotation,
                                   self.framerate, self.timestamp, self.compression)
        return Gst.parse_launch(pipeline_str)

    def do_configure(self, media):
        # Configure the media for each client connection
        # This is called when a client connects
        self.set_eos_shutdown(True)  # Clean shutdown on EOS


class RelayFactory(GstRtspServer.RTSPMediaFactory):
    """Lightweight per-client RTSP relay used only when local recording is
    enabled (see GstServer.addStream). Rather than opening the camera itself
    like MyFactory does per-client, it re-payloads the RTP stream already
    being produced by a persistent capture pipeline (startRecordingCapture())
    - so recording keeps running independent of RTSP client connections.
    """

    def __init__(self, codec):
        GstRtspServer.RTSPMediaFactory.__init__(self)
        self.codec = codec
        self.set_latency(0)
        self.set_transport_mode(GstRtspServer.RTSPTransportMode.PLAY)

    def do_create_element(self, url):
        depay = "rtph265depay" if self.codec == "H265" else "rtph264depay"
        pay = "rtph265pay" if self.codec == "H265" else "rtph264pay"
        # address=127.0.0.1 is required - without it udpsrc binds 0.0.0.0 (all
        # interfaces), letting anyone on the network inject RTP packets into
        # this relay even though startRecordingCapture()'s udpsink only ever
        # sends here over loopback.
        pipeline_str = (
            "udpsrc port={0} address=127.0.0.1 caps=\"application/x-rtp,media=video,clock-rate=(int)90000,encoding-name=(string){1}\" "
            "! rtpjitterbuffer latency=0 ! {2} ! {3} config-interval=1 name=pay0 pt=96"
        ).format(RECORDING_RELAY_PORT, self.codec, depay, pay)
        return Gst.parse_launch(pipeline_str)


# Minimum free space (MB) required at the recording destination - a margin
# over the ~5s installDiskSpaceMonitor() check interval, sized against the
# max bitrate the UI allows (50 Mbps -> ~31MB/5s), not just the default
# (1100kbps -> <1MB/5s). Local recording is proactively stopped once free
# space drops below this, well before the disk actually fills - see
# installDiskSpaceMonitor()/isolateRecordingBranch() for why waiting for an
# actual write failure is not a safe way to do this.
MIN_RECORDING_DISK_SPACE_MB = 200


# Detach the recording branch (rec_queue/rec_mux/rec_sink) from the tee -
# blocks the tee's request pad, pushes EOS down just that branch so mp4mux
# writes a valid trailer, then removes the now-idle elements - leaving the
# live stream running untouched.
#
# Must be called PROACTIVELY (see installDiskSpaceMonitor), not reactively
# from a filesink error: testing against a full disk showed a fatal write
# error cascades back through rec_queue and tee to the shared upstream
# source, killing the live stream too - faster than a bus ERROR message can
# reach the GLib main loop to react to it.
def isolateRecordingBranch(pipeline, reason=""):
    tee = pipeline.get_by_name('t')
    rec_queue = pipeline.get_by_name('rec_queue')
    rec_sink = pipeline.get_by_name('rec_sink')
    if not tee or not rec_queue or not rec_sink:
        return
    queue_sinkpad = rec_queue.get_static_pad('sink')
    teepad = queue_sinkpad.get_peer() if queue_sinkpad else None
    if not teepad:
        return

    def finish_removal():
        if queue_sinkpad.is_linked():
            teepad.unlink(queue_sinkpad)
        tee.release_request_pad(teepad)
        for name in RECORDING_ELEMENT_NAMES:
            el = pipeline.get_by_name(name)
            if el:
                el.set_state(Gst.State.NULL)
                pipeline.remove(el)
        suffix = " ({0})".format(reason) if reason else ""
        print("Recording stopped{0} - live stream continues.".format(suffix), flush=True)
        return GLib.SOURCE_REMOVE

    def on_sink_eos(pad, info):
        pad.remove_probe(info.id)
        GLib.idle_add(finish_removal)
        return Gst.PadProbeReturn.OK

    def on_sink_event(pad, info):
        event = info.get_event()
        if event and event.type == Gst.EventType.EOS:
            return on_sink_eos(pad, info)
        return Gst.PadProbeReturn.OK

    def on_tee_blocked(_pad, _info):
        # No more buffers reach the branch now - safe to push EOS down it so
        # mp4mux can write a valid trailer before we remove it. Wait for that
        # EOS to actually arrive at rec_sink before tearing down, with a
        # timeout fallback in case the branch is already wedged.
        rec_sink.get_static_pad('sink').add_probe(Gst.PadProbeType.EVENT_DOWNSTREAM, on_sink_event)
        queue_sinkpad.send_event(Gst.Event.new_eos())
        GLib.timeout_add_seconds(3, lambda: finish_removal() if pipeline.get_by_name('rec_sink') else GLib.SOURCE_REMOVE)
        return Gst.PadProbeReturn.OK

    teepad.add_probe(Gst.PadProbeType.BLOCK_DOWNSTREAM, on_tee_blocked)


# Periodically check free space at record_path while recording is active, and
# proactively stop just the recording branch before the disk actually fills -
# see isolateRecordingBranch() for why this has to be proactive rather than
# reactive to an actual write failure.
def hasEnoughDiskSpace(record_path):
    try:
        free_mb = shutil.disk_usage(record_path).free / (1024 * 1024)
    except OSError:
        return True  # can't tell - don't block recording on a stat failure
    return free_mb >= MIN_RECORDING_DISK_SPACE_MB


def installDiskSpaceMonitor(pipeline, record_path, interval_seconds=5):
    def check():
        if not pipeline.get_by_name('rec_sink'):
            return GLib.SOURCE_REMOVE  # already stopped/removed
        if not hasEnoughDiskSpace(record_path):
            print("Free disk space at {0} is below the {1} MB minimum - stopping local recording.".format(
                record_path, MIN_RECORDING_DISK_SPACE_MB), flush=True)
            isolateRecordingBranch(pipeline, reason="disk space low")
            return GLib.SOURCE_REMOVE
        return True

    GLib.timeout_add_seconds(interval_seconds, check)


# Send an EOS through the pipeline on SIGTERM/SIGINT so mp4mux gets a chance
# to write a valid moov atom before the process exits - a bare kill would
# otherwise leave any local recording file truncated/unplayable.
#
# The bus ERROR handling below is only a best-effort backstop for non-disk
# failures - see isolateRecordingBranch()'s comment for why it can't reliably
# save the live stream from a disk-space error; installDiskSpaceMonitor()
# catching it early is the real protection.
def installCleanShutdown(pipeline, loop):
    bus = pipeline.get_bus()
    bus.add_signal_watch()

    def on_bus_message(_bus, message):
        if message.type == Gst.MessageType.EOS:
            print("EOS received, finalizing recording and stopping pipeline.", flush=True)
            pipeline.set_state(Gst.State.NULL)
            loop.quit()
        elif message.type == Gst.MessageType.ERROR:
            err, dbg = message.parse_error()
            src_name = message.src.get_name() if message.src else ""
            if src_name in RECORDING_ELEMENT_NAMES:
                print("Recording error ({0}): {1} ({2})".format(src_name, err, dbg), file=sys.stderr)
                isolateRecordingBranch(pipeline, reason="write error")
            else:
                print("GStreamer error: {0} ({1})".format(err, dbg), file=sys.stderr)
                pipeline.set_state(Gst.State.NULL)
                loop.quit()
        return True

    bus.connect("message", on_bus_message)

    def on_shutdown_signal():
        print("Received shutdown signal, sending EOS to finalize recording...", flush=True)
        pipeline.send_event(Gst.Event.new_eos())
        # Safety net: force quit if EOS doesn't propagate (e.g. source stalled)
        GLib.timeout_add_seconds(3, lambda: (pipeline.set_state(Gst.State.NULL), loop.quit(), GLib.SOURCE_REMOVE)[-1])
        return GLib.SOURCE_REMOVE

    GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, signal.SIGTERM, on_shutdown_signal)
    GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, signal.SIGINT, on_shutdown_signal)


class GstServer():
    def __init__(self, loop):
        self.server = GstRtspServer.RTSPServer()
        self.loop = loop
        self.capturePipeline = None  # keeps the recording capture pipeline (if any) alive

        # Configure server for low-latency streaming
        self.server.set_backlog(5)  # Limit queued connections

        self.sourceID = self.server.attach(None)
        print("Server available on rtsp://<IP>:8554")

    # Build and start the persistent capture pipeline used when local
    # recording is enabled: camera -> encode -> tee -> [record to mp4] /
    # [RTP over loopback for RelayFactory to relay to RTSP clients].
    def startRecordingCapture(self, device, h, w, bitrate, format, rotation, framerate, timestamp, compression, record_path):
        stream_sink = " ! udpsink host=127.0.0.1 port={0}".format(RECORDING_RELAY_PORT)
        pipeline_str = getPipeline(device, h, w, bitrate, format, rotation, framerate, timestamp, compression,
                                   record_path=record_path, stream_sink=stream_sink)
        pipeline = Gst.parse_launch(pipeline_str)
        installCleanShutdown(pipeline, self.loop)
        installDiskSpaceMonitor(pipeline, record_path)
        pipeline.set_state(Gst.State.PLAYING)
        self.capturePipeline = pipeline

    def addStream(self, device, h, w, bitrate, format, rotation, framerate, timestamp, compression, record_path=""):
        # Gate BEFORE the recording branch is ever built, not just via the periodic
        # installDiskSpaceMonitor() check - that check only starts firing 5s after
        # the pipeline goes PLAYING, so an already-full disk would otherwise let
        # filesink fail (and cascade-kill the live stream, see isolateRecordingBranch)
        # before the monitor ever got a chance to catch it.
        if record_path and not hasEnoughDiskSpace(record_path):
            print("Free disk space at {0} is below the {1} MB minimum - not starting local recording.".format(
                record_path, MIN_RECORDING_DISK_SPACE_MB), flush=True)
            record_path = ""

        if record_path:
            # Recording enabled: run one persistent capture pipeline for the
            # process lifetime (independent of RTSP client connections), and
            # serve clients from a cheap relay factory in front of it.
            self.startRecordingCapture(device, h, w, bitrate, format, rotation, framerate, timestamp, compression, record_path)
            f = RelayFactory(resolvePayloadCodec(device, format, compression))
            # Shared: all clients are served from the one relay pipeline,
            # rather than each opening their own connection to the camera.
            f.set_shared(True)
        else:
            f = MyFactory(device, h, w, bitrate, format,
                          rotation, framerate, timestamp,
                          compression)

            # Don't share the media pipeline - each client gets their own
            # This prevents one slow client from affecting others
            f.set_shared(False)

        # Enable clock synchronization for smoother playback
        f.set_clock(None)  # Use default system clock

        m = self.server.get_mount_points()
        if not device.startswith("rtsp://"):
            name = ''.join(filter(str.isalnum, device))
        else:
            # remove any rtsp username or passwords, format rtsp://admin:admin@192.168.1.217:554/11
            if "@" in device:
                name = device.split('@')[1]
            else:
                name = device.replace("rtsp://", "")
            name = ''.join(filter(str.isalnum, name))
        m.add_factory("/" + name, f)

        print("Added " + "rtsp://<IP>:8554/" + name)
        print("Use: gst-launch-1.0 rtspsrc location=rtsp://<IP>:8554/" +
              name + " latency=0 ! queue ! decodebin ! autovideosink sync=false")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="RTSP Server using Gstreamer")
    parser.add_argument("--videosource", help="Video Device. Can be device (/dev/video0) or rtsp source (rtsp://192.168.1.100:8554/stream)",
                        default="/dev/video0", type=str)
    parser.add_argument("--height", help="Height", default=480, type=int)
    parser.add_argument("--width", help="Width", default=640, type=int)
    parser.add_argument("--fps", help="Framerate", default=10, type=int)
    parser.add_argument(
        "--bitrate", help="Max bitrate (kbps)", default=2000, type=int)
    parser.add_argument("--format", help="Video format",
                        default="video/x-raw", type=str)
    parser.add_argument("--compression", help="encoder choice",
                        default='H264', type=str, choices=['H264', 'H265'])
    parser.add_argument("--rotation", help="rotation angle",
                        default=0, type=int, choices=[0, 90, 180, 270])
    parser.add_argument("--transport", help="Transport protocol selection",
                        default="RTSP", type=str, choices=['RTSP', 'RTP'])
    parser.add_argument(
        "--udp", help="If using RTP, the destinatinon IP:port", default="127.0.0.1:5600", type=str)
    parser.add_argument(
        "--multirtsp", help="CSV of multi-camera RTSP setup. Format is videosource,height,width,bitrate,formatstr,rotation, fps;source2,etc", default="", type=str)
    parser.add_argument("--timestamp", help="add timestamp",
                        default=False, action='store_true')
    parser.add_argument(
        "--record", help="Absolute directory path to also record the stream locally to (mp4). Empty disables local recording.",
        default="", type=str)
    args = parser.parse_args()

    loop = GLib.MainLoop()
    Gst.init(None)

    Gst.debug_set_active(True)
    Gst.debug_set_default_threshold(3)

    if args.multirtsp != "":
        # Multi-camera streaming, delimited via ';'
        # Example commandline is:
        # ./video-server.py --multirtsp="/dev/video0,480,640,2000,video/x-raw,0,10;/dev/video2,480,640,2000,video/x-raw,0,10"

        cams = args.multirtsp.split(';')
        s = GstServer(loop)

        # Add each camera (local recording is not supported in multi-camera mode)
        for cam in cams:
            try:
                (videosource, height, width, bitrate, formatstr,
                 rotation, fps, timestamp) = cam.split(',')
            except:
                print("Bad format: " + cam)
                break
            if not (height.isdigit() and width.isdigit() and bitrate.isdigit() and rotation.isdigit() and fps.isdigit()):
                print("Bad format: " + cam)
                break
            s.addStream(videosource, height, width, bitrate,
                        formatstr, rotation, fps, timestamp, args.compression)

        try:
            loop.run()
        except:
            print("Exiting RTSP Server")
            loop.quit()
    elif args.transport == "RTSP":
        # RTSP
        s = GstServer(loop)
        s.addStream(args.videosource, args.height, args.width, args.bitrate,
                    args.format, args.rotation, args.fps, args.timestamp, args.compression,
                    record_path=args.record)

        try:
            loop.run()
        except:
            print("Exiting RTSP Server")
            loop.quit()
    elif args.transport == "RTP":
        # RTP
        record_path = args.record
        # See the matching check in GstServer.addStream() - must happen before
        # the recording branch is built, not just via the periodic
        # installDiskSpaceMonitor() check, which only starts 5s after PLAYING.
        if record_path and not hasEnoughDiskSpace(record_path):
            print("Free disk space at {0} is below the {1} MB minimum - not starting local recording.".format(
                record_path, MIN_RECORDING_DISK_SPACE_MB), flush=True)
            record_path = ""

        stream_sink = " ! udpsink host={0} port={1}".format(
            args.udp.split(':')[0], args.udp.split(':')[1])
        if is_multicast(args.udp.split(':')[0]):
            stream_sink += " auto-multicast=true"
        pipeline_str = getPipeline(args.videosource, args.height, args.width,
                                   args.bitrate, args.format, args.rotation, args.fps, args.timestamp,
                                   args.compression, record_path=record_path, stream_sink=stream_sink)
        pipeline = Gst.parse_launch(pipeline_str)
        if record_path:
            installCleanShutdown(pipeline, loop)
            installDiskSpaceMonitor(pipeline, record_path)
        pipeline.set_state(Gst.State.PLAYING)

        print("Server sending UDP stream to " + args.udp)
        if args.compression == "H264" or (args.videosource.startswith("rtsp://") and args.format == "video/x-h264"):
            print(
                "Use: gst-launch-1.0 udpsrc port={0} caps='application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string)H264' ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! autovideosink sync=false".format(args.udp.split(':')[1]))
        elif args.compression == "H265" or (args.videosource.startswith("rtsp://") and args.format == "video/x-h265"):
            print(
                "Use: gst-launch-1.0 udpsrc port={0} caps='application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string)H265' ! rtpjitterbuffer ! rtph265depay ! h265parse ! avdec_h265 ! videoconvert ! autovideosink sync=false".format(args.udp.split(':')[1]))

        try:
            loop.run()
        except:
            print("Exiting UDP Server")
            pipeline.set_state(Gst.State.NULL)
            loop.quit()
