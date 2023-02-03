#!/usr/bin/env python3
# -*- coding:utf-8 vi:ts=4:noexpandtab
# Simple RTSP server. Run as-is or with a command-line to replace the default pipeline
# Taken from https://github.com/tamaggo/gstreamer-examples/blob/master/test_gst_rtsp_server.py
# gst-launch-1.0 rtspsrc location=rtsp://127.0.0.1:8554/video latency=0 ! decodebin ! autovideosink

import gi
import argparse
import os
from netifaces import interfaces, ifaddresses, AF_INET

gi.require_version("Gst", "1.0")
gi.require_version("GstRtsp", "1.0")
gi.require_version("GstRtspServer", "1.0")
from gi.repository import Gst, GstRtspServer, GLib


def ip4_addresses():
    ip_list = []
    for interface in interfaces():
        #print(ifaddresses(interface)[AF_INET])
        if AF_INET in ifaddresses(interface).keys():
            for link in ifaddresses(interface)[AF_INET]:
                if 'addr' in link.keys():
                    ip_list.append(link['addr'])
    return ip_list


def getPipeline(device, height, width, bitrate, format, rotation, framerate, timestamp):
    #rotation
    if device in ["0rpicam", "1rpicam"]:
        devrotation = rotation
    else:
        devrotation = "videoflip video-direction=identity"
        if rotation == 90:
            devrotation = "videoflip video-direction=90r"
        elif rotation == 180:
            devrotation = "videoflip video-direction=180"
        elif rotation == 270:
            devrotation = "videoflip video-direction=90l"

    # -1 is no framerate specified
    if framerate == -1:
        framestr = ""
    else:
        framestr = ",framerate={0}/1".format(framerate)

    # If on Pi or Jetson (arm architecture), use the hardware x264 encoder
    if 'arm' in os.uname().machine:
        # Use v4l2-ctl -d 11 --list-ctrls-menu to get v4l2h264enc options
        # Using the main profile for compatiblity
        s_h264 = "! v4l2h264enc extra-controls=\"controls,repeat_sequence_header=1,h264_profile=2,video_bitrate={0},h264_i_frame_period=5\" ! video/x-h264,profile=main,level=(string)4 ! h264parse".format(bitrate*1000)
    else:
        s_h264 = "! x264enc tune=zerolatency bitrate={0} speed-preset=superfast".format(bitrate)

    # include timestamp?
    ts = ""
    if timestamp:
        ts = "! clockoverlay time-format=\"%d-%b-%Y %H:%M:%S\" "
        if device in ["0rpicam", "1rpicam"]:
            ts = "annotation-mode=12 annotation-text-colour=0"

    if device == "testsrc":
        s_src = "videotestsrc pattern=ball ! video/x-raw,width={0},height={1}{2} ! videoconvert".format(width, height, framestr)
    elif device in ["0rpicam", "1rpicam"]:
        # Old (Buster and earlier) can use the rpicamsrc interface
        s_src = "rpicamsrc {5} bitrate={0} rotation={3} camera-number={6} preview=false ! video/x-h264,width={1},height={2}{4}".format(bitrate*1000, width, height, devrotation, framestr, ts, device[0])
        s_h264 = ""
    elif device.startswith("/base/soc/i2c"):
        # Bullseye uses the new libcamera interface ... so need a different pipeline
        s_src = "libcamerasrc camera-name={4} ! capsfilter caps=video/x-raw,width={0},height={1},format=NV12{3} ! videoconvert ! {2}".format(width, height, devrotation, framestr, device)
    elif format == "video/x-raw":
        s_src = "v4l2src device={0} ! videorate ! {3},width={1},height={2}{5} ! {4} ! videoconvert ! video/x-raw,format=I420".format(device, width, height, format, devrotation, framestr)
    elif format == "video/x-h264":
        s_src = "v4l2src device={0} ! {3},width={1},height={2}{5} ! {4}".format(device, width, height, format, devrotation, framestr)
        s_h264 = ""
    elif format == "image/jpeg":
        s_src = "v4l2src device={0} ! videorate ! {3},width={1},height={2}{5} ! jpegdec ! {4}".format(device, width, height, format, devrotation, framestr)
    else:
        print("Bad camera")
        return ""

    pipeline_str = "( {0} {1} {2} ! queue max-size-buffers=1 name=q_enc ! rtph264pay config-interval=1 name=pay0 pt=96 )".format(s_src, ts if device not in ["0rpicam", "1rpicam"] else "", s_h264)
    print(pipeline_str)
    return pipeline_str


class MyFactory(GstRtspServer.RTSPMediaFactory):
    def __init__(self, device, h, w, bitrate, format, rotation, framerate, timestamp):
        GstRtspServer.RTSPMediaFactory.__init__(self)
        self.device = device
        self.height = h
        self.width = w
        self.bitrate = bitrate
        self.format = format
        self.rotation = rotation
        self.framerate = framerate
        self.timestamp = timestamp

    def do_create_element(self, url):
        pipeline_str = getPipeline(self.device, self.height, self.width, self.bitrate, self.format, self.rotation, self.framerate, self.timestamp)
        return Gst.parse_launch(pipeline_str)


class GstServer():
    def __init__(self):
        self.server = GstRtspServer.RTSPServer()
        self.sourceID = self.server.attach(None)
        print("Server available on rtsp://<IP>:8554")
        print("Where IP is {0}".format(ip4_addresses()))
        
    def addStream(self, device,h, w, bitrate, format, rotation, framerate, timestamp):
        f = MyFactory(device, h, w, bitrate, format, rotation, framerate, timestamp)
        f.set_shared(True)
        m = self.server.get_mount_points()
        name = ''.join(filter(str.isalnum, device))
        m.add_factory("/" + name, f)
        
        print("Added " + "rtsp://<IP>:8554/" + name)
        print("Use: gst-launch-1.0 rtspsrc is-live=True location=rtsp://<IP>:8554/" + name + " latency=0 ! queue ! decodebin ! autovideosink")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="RTSP Server using Gstreamer")
    parser.add_argument("--videosource", help="Video Device", default="/dev/video0", type=str)
    parser.add_argument("--height", help="Height", default=480, type=int)
    parser.add_argument("--width", help="Width", default=640, type=int)
    parser.add_argument("--fps", help="Framerate", default=10, type=int)
    parser.add_argument("--bitrate", help="Max bitrate (kbps)", default=2000, type=int)
    parser.add_argument("--format", help="Video format", default="video/x-raw", type=str)
    parser.add_argument("--rotation", help="rotation angle", default=0, type=int, choices=[0, 90, 180, 270])
    parser.add_argument("--udp", help="use UDP sink (dest IP:port) instead of RTSP", default="0:5600", type=str)
    parser.add_argument("--multirtsp", help="CSV of multi-camera setup. Format is videosource,height,width,bitrate,formatstr,rotation, fps;source2,etc", default="", type=str)
    parser.add_argument("--timestamp", help="add timestamp", default=False, action='store_true')
    args = parser.parse_args()

    loop = GLib.MainLoop()
    Gst.init(None)

    Gst.debug_set_active(True)
    Gst.debug_set_default_threshold(3)

    if args.multirtsp != "":
        # Multi-camera streaming, delimited via ';'
        # Example commandline is:
        # ./rtsp-server.py --multirtsp="/dev/video0,480,640,2000,video/x-raw,0,10;/dev/video2,480,640,2000,video/x-raw,0,10"

        cams = args.multirtsp.split(';')
        s = GstServer()

        # Add each camera
        for cam in cams:
            try:
                (videosource, height, width, bitrate, formatstr, rotation, fps, timestamp) = cam.split(',')
            except:
                print("Bad format: " + cam)
                break
            if not (height.isdigit() and width.isdigit() and bitrate.isdigit() and rotation.isdigit() and fps.isdigit()):
                print("Bad format: " + cam)
                break
            s.addStream(videosource, height, width, bitrate, formatstr, rotation, fps, timestamp)

        try:
            loop.run()
        except:
            print("Exiting RTSP Server")
            loop.quit()        
    elif args.udp.split(':')[0] == "0":
        s = GstServer()
        s.addStream(args.videosource, args.height, args.width, args.bitrate, args.format, args.rotation, args.fps, args.timestamp)

        try:
            loop.run()
        except:
            print("Exiting RTSP Server")
            loop.quit()
    else:
        pipeline_str = getPipeline(args.videosource, args.height, args.width, args.bitrate, args.format, args.rotation, args.fps, args.timestamp)
        pipeline_str += " ! udpsink host={0} port={1}".format(args.udp.split(':')[0], args.udp.split(':')[1])
        pipeline = Gst.parse_launch(pipeline_str)
        pipeline.set_state(Gst.State.PLAYING)

        print("Server sending UDP stream to " + args.udp)
        print("Use: gst-launch-1.0 udpsrc port={0} caps='application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string)H264' ! rtpjitterbuffer ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! autovideosink sync=false".format(args.udp.split(':')[1]))

        try:
            loop.run()
        except:
            print("Exiting UDP Server")
            pipeline.set_state(Gst.State.NULL)
            loop.quit()
