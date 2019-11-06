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
from gi.repository import Gst, GstRtspServer, GObject

loop = GObject.MainLoop()
GObject.threads_init()
Gst.init(None)

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
    def __init__(self, device, h, w, fps, bitrate):
        GstRtspServer.RTSPMediaFactory.__init__(self)
        self.device = device
        self.height = h
        self.width = w
        self.fps = fps
        self.bitrate = bitrate

    def do_create_element(self, url):
        s_src = "v4l2src device={0} ! video/x-raw,rate={1},width={2},height={3} ! videoconvert ! video/x-raw,format=I420".format(self.device, self.fps, self.width, self.height)
        s_h264 = "x264enc tune=zerolatency bitrate={0} speed-preset=superfast".format(self.bitrate)
        pipeline_str = "( {s_src} ! queue max-size-buffers=1 name=q_enc ! {s_h264} ! rtph264pay name=pay0 pt=96 )".format(**locals())
        print(pipeline_str)
        return Gst.parse_launch(pipeline_str)

class GstServer():
    def __init__(self, device,h, w, fps, bitrate):
        self.server = GstRtspServer.RTSPServer()
        f = MyFactory(device, h, w, fps, bitrate)
        f.set_shared(True)
        m = self.server.get_mount_points()
        m.add_factory("/video", f)
        self.server.attach(None)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="RTSP Server using Gstreamer")
    parser.add_argument("--videosource", help="Video Device", default="/dev/video0", type=str)
    parser.add_argument("--height", help="Height", default=480, type=int)
    parser.add_argument("--width", help="Width", default=640, type=int)
    parser.add_argument("--fps", help="FPS", default=15, type=int)
    parser.add_argument("--bitrate", help="bitrate", default=2000, type=int)
    args = parser.parse_args()

    print("Server available on rtsp://<IP>:8554/video")
    print("Use: gst-launch-1.0 rtspsrc location=rtsp://<IP>:8554/video latency=0 ! queue ! decodebin ! autovideosink")
    print("Where IP is {0}".format(ip4_addresses()))

    s = GstServer(args.videosource, args.height, args.width, args.fps, args.bitrate)
    loop.run()


