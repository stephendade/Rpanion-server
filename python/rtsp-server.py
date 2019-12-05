#!/usr/bin/env python3
# -*- coding:utf-8 vi:ts=4:noexpandtab
# Simple RTSP server. Run as-is or with a command-line to replace the default pipeline
# Taken from https://github.com/tamaggo/gstreamer-examples/blob/master/test_gst_rtsp_server.py
# gst-launch-1.0 rtspsrc location=rtsp://127.0.0.1:8554/video latency=0 ! decodebin ! autovideosink

import sys
import gi
import argparse
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

class MyFactory(GstRtspServer.RTSPMediaFactory):
    def __init__(self, device, h, w, bitrate, format, rotation):
        GstRtspServer.RTSPMediaFactory.__init__(self)
        self.device = device
        self.height = h
        self.width = w
        self.bitrate = bitrate
        self.format = format

        #rotation
        if self.device == "rpicam":
            self.rotation = rotation
        else:
            self.rotation = "videoflip video-direction=identity"
            if rotation == 90:
                self.rotation = "videoflip video-direction=90r"
            elif rotation == 180:
                self.rotation = "videoflip video-direction=180"
            elif rotation == 270:
                self.rotation = "videoflip video-direction=90l"

    def do_create_element(self, url):
        if self.device == "rpicam":
                s_src = "rpicamsrc bitrate={0} rotation={3} ! video/x-h264,width={1},height={2}".format(self.bitrate*1000, self.width, self.height, self.rotation)
                pipeline_str = "( {s_src} ! queue max-size-buffers=1 name=q_enc ! h264parse ! rtph264pay name=pay0 pt=96 )".format(**locals())
        elif self.format == "video/x-raw":
                s_src = "v4l2src device={0} ! {3},width={1},height={2} ! {4} ! videoconvert ! video/x-raw,format=I420".format(self.device, self.width, self.height, self.format, self.rotation)
                s_h264 = "x264enc tune=zerolatency bitrate={0} speed-preset=superfast".format(self.bitrate)
                pipeline_str = "( {s_src} ! queue max-size-buffers=1 name=q_enc ! {s_h264} ! rtph264pay name=pay0 pt=96 )".format(**locals())
        elif self.format == "video/x-h264":
                s_src = "v4l2src device={0} ! {3},width={1},height={2}".format(self.device, self.width, self.height, self.format)
                pipeline_str = "( {s_src} ! queue max-size-buffers=1 name=q_enc ! h264parse ! rtph264pay name=pay0 pt=96 )".format(**locals())
        print(pipeline_str)
        return Gst.parse_launch(pipeline_str)

class GstServer():
    def __init__(self, device,h, w, bitrate, format, rotation):
        self.server = GstRtspServer.RTSPServer()
        f = MyFactory(device, h, w, bitrate, format, rotation)
        f.set_shared(True)
        m = self.server.get_mount_points()
        m.add_factory("/video", f)
        self.sourceID = self.server.attach(None)

        print("Server available on rtsp://<IP>:8554/video")
        print("Use: gst-launch-1.0 rtspsrc location=rtsp://<IP>:8554/video latency=0 ! queue ! decodebin ! autovideosink")
        print("Where IP is {0}".format(ip4_addresses()))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="RTSP Server using Gstreamer")
    parser.add_argument("--videosource", help="Video Device", default="/dev/video0", type=str)
    parser.add_argument("--height", help="Height", default=480, type=int)
    parser.add_argument("--width", help="Width", default=640, type=int)
    parser.add_argument("--bitrate", help="bitrate (kbps)", default=2000, type=int)
    parser.add_argument("--format", help="Video format", default="video/x-raw", type=str)
    parser.add_argument("--rotation", help="rotation angle", default=0, type=int, choices=[0, 90, 180, 270])
    args = parser.parse_args()

    loop = GLib.MainLoop()
    Gst.init(None)

    Gst.debug_set_active(True)
    Gst.debug_set_default_threshold(3)

    s = GstServer(args.videosource, args.height, args.width, args.bitrate, args.format, args.rotation)

    try:
        loop.run()
    except:
        print("Exiting RTSP Server")
        loop.quit()

