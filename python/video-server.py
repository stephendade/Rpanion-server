#!/usr/bin/env python3
# -*- coding:utf-8 vi:ts=4:noexpandtab
# Simple RTSP server. Run as-is or with a command-line to replace the default pipeline
# Taken from https://github.com/tamaggo/gstreamer-examples/blob/master/test_gst_rtsp_server.py
# gst-launch-1.0 rtspsrc location=rtsp://127.0.0.1:8554/video latency=0 ! decodebin ! autovideosink

import argparse
import platform
import ipaddress
from typing import List
import subprocess
import gi

gi.require_version("Gst", "1.0")
gi.require_version("GstRtsp", "1.0")
gi.require_version("GstRtspServer", "1.0")
from gi.repository import Gst, GstRtspServer, GLib


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


def getPipeline(device, height, width, bitrate, format, rotation, framerate, timestamp, compression) -> str:
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
        pipeline.append("queue max-size-buffers=1 leaky=downstream")
    elif format == "video/x-raw":
        pipeline.append("v4l2src device={0}".format(device))
        pipeline.append("videorate")
        pipeline.append("{2},width={0},height={1}{3}".format(width, height, format, framestr))
        pipeline.append("queue max-size-buffers=1 leaky=downstream")
    elif format == "video/x-h264":
        pipeline.append("v4l2src device={0}".format(device))
        pipeline.append("{2},width={0},height={1}{3}".format(width, height, format, framestr))
    elif format == "image/jpeg":
        pipeline.append("v4l2src device={0}".format(device))
        pipeline.append("videorate")
        pipeline.append("{2},width={0},height={1}{3}".format(width, height, format, framestr))
        pipeline.append("queue max-size-buffers=1 leaky=downstream")
        pipeline.append("jpegdec")
    else:
        print("Bad camera")
        return ""

    # now for rotations, overlays and compression, if required. Note we can't modify an x264 source stream
    if format != "video/x-h264":
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
                pipeline.append("h265parse")
            elif compression == "H264":
                pipeline.append("nvv4l2h264enc bitrate={0} iframeinterval=5 preset-level=1 insert-sps-pps=true".format(bitrate*1000))
                pipeline.append("h264parse")
        elif Gst.ElementFactory.find("v4l2h264enc") and compression == "H264":
            # Pi or similar arm platforms running on RasPiOS. Note that Pi5 onwards don't support hardware encoding
            # Only use a higher h264 level if the bitrate requires it. I find that level 4.1 can be a little
            # crashy sometimes.
            if bitrate > 20000:
                level = "4.1"
            else:
                level = "4"
            pipeline.append("videoconvert")
            pipeline.append("v4l2h264enc extra-controls=\"controls,repeat_sequence_header=1,h264_profile=4,video_bitrate={0},h264_i_frame_period=5\"".format(bitrate*1000))
            pipeline.append("video/x-h264,profile=high,level=(string){0}".format(level))
            pipeline.append("h264parse")
        else:
            # s/w encoder - x86, Pi5, etc
            pipeline.append("videoconvert")
            if is_pi_5_or_later() and compression == "H264":
                pipeline.append("video/x-raw,format=NV12")
            else:
                pipeline.append("video/x-raw,format=I420")
            pipeline.append("queue max-size-buffers=1 leaky=downstream")
            if compression == "H264":
                pipeline.append("x264enc tune=zerolatency bitrate={0} speed-preset=superfast key-int-max=25".format(bitrate))
            elif compression == "H265":
                pipeline.append("x265enc tune=zerolatency bitrate={0} speed-preset=superfast key-int-max=25".format(bitrate))

    # final rtp formatting
    pipeline.append("queue")
    if compression == "H264" or format == "video/x-h264":
        pipeline.append("rtph264pay config-interval=1 name=pay0 pt=96")
    elif compression == "H265":
        pipeline.append("rtph265pay config-interval=1 name=pay0 pt=96")

    # return as full string
    print(" ! ".join(pipeline))
    return " ! ".join(pipeline)


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

    def do_create_element(self, url):
        pipeline_str = getPipeline(self.device, self.height, self.width, self.bitrate, self.format, self.rotation,
                                   self.framerate, self.timestamp, self.compression)
        return Gst.parse_launch(pipeline_str)


class GstServer():
    def __init__(self):
        self.server = GstRtspServer.RTSPServer()
        self.sourceID = self.server.attach(None)
        print("Server available on rtsp://<IP>:8554")

    def addStream(self, device, h, w, bitrate, format, rotation, framerate, timestamp, compression):
        f = MyFactory(device, h, w, bitrate, format,
                      rotation, framerate, timestamp,
                      compression)
        f.set_shared(True)
        m = self.server.get_mount_points()
        name = ''.join(filter(str.isalnum, device))
        m.add_factory("/" + name, f)

        print("Added " + "rtsp://<IP>:8554/" + name)
        print("Use: gst-launch-1.0 rtspsrc location=rtsp://<IP>:8554/" +
              name + " latency=0 is-live=True ! queue ! decodebin ! autovideosink")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="RTSP Server using Gstreamer")
    parser.add_argument("--videosource", help="Video Device",
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
        s = GstServer()

        # Add each camera
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
        s = GstServer()
        s.addStream(args.videosource, args.height, args.width, args.bitrate,
                    args.format, args.rotation, args.fps, args.timestamp, args.compression)

        try:
            loop.run()
        except:
            print("Exiting RTSP Server")
            loop.quit()
    elif args.transport == "RTP":
        # RTP
        pipeline_str = getPipeline(args.videosource, args.height, args.width,
                                   args.bitrate, args.format, args.rotation, args.fps, args.timestamp,
                                   args.compression)
        pipeline_str += " ! udpsink host={0} port={1}".format(
            args.udp.split(':')[0], args.udp.split(':')[1])
        if is_multicast(args.udp.split(':')[0]):
            pipeline_str += " auto-multicast=true"
        pipeline = Gst.parse_launch(pipeline_str)
        pipeline.set_state(Gst.State.PLAYING)

        print("Server sending UDP stream to " + args.udp)
        if args.compression == "H264":
            print(
                "Use: gst-launch-1.0 udpsrc port={0} caps='application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string)H264' ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! autovideosink sync=false".format(args.udp.split(':')[1]))
        elif args.compression == "H265":
            print(
                "Use: gst-launch-1.0 udpsrc port={0} caps='application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string)H265' ! rtpjitterbuffer ! rtph265depay ! h265parse ! avdec_h265 ! videoconvert ! autovideosink sync=false".format(args.udp.split(':')[1]))

        try:
            loop.run()
        except:
            print("Exiting UDP Server")
            pipeline.set_state(Gst.State.NULL)
            loop.quit()
