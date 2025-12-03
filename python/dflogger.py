#!/usr/bin/env python3
"""
Standalone DataFlash Logger

Based on MAVProxy's dataflash_logger module.
Logs ArduPilot DataFlash logs transmitted over MAVLink.

Usage:
    python3 dflogger.py --connection <mavlink_connection> --logdir <log_directory>

Examples:
    python3 dflogger.py --connection udp:127.0.0.1:14550 --logdir ./logs
    python3 dflogger.py --connection /dev/ttyUSB0 --logdir /var/logs/flight
    python3 dflogger.py --connection tcp:192.168.1.10:5760 --logdir ./logs --verbose
"""

import os
import struct
import sys
import time
import argparse
import signal
from datetime import datetime
from pymavlink import mavutil


class DataFlashLogger:
    """Standalone DataFlash logger for ArduPilot vehicles"""

    def __init__(
            self,
            connection_string,
            logdir,
            verbose=False,
            target_system=0,
            target_component=mavutil.mavlink.MAV_COMP_ID_LOG,
            rotate_on_disarm=False):
        """
        Initialize the DataFlash logger

        Args:
            connection_string: PyMAVLink connection string (e.g., 'udp:127.0.0.1:14550')
            logdir: Directory to store log files
            verbose: Enable verbose output
            target_system: Target system ID (0 = any)
            target_component: Target component ID
            rotate_on_disarm: Rotate log file when vehicle disarms
        """
        self.connection_string = connection_string
        self.logdir = logdir
        self.verbose = verbose
        self.target_system = target_system
        self.target_component = target_component
        self.rotate_on_disarm = rotate_on_disarm

        # Connection state
        self.master = None
        self.sender = None
        self.stopped = False
        self.running = True

        # Logging state
        self.logfile = None
        self.tlogfile = None
        self.last_seqno = 0
        self.download = 0
        self.prev_download = 0
        self.last_status_time = time.time()
        self.last_idle_status_printed_time = time.time()

        # Block tracking
        self.missing_blocks = {}
        self.acking_blocks = {}
        self.blocks_to_ack_and_nack = []
        self.missing_found = 0
        self.abandoned = 0
        self.dropped = 0

        # Timing
        self.time_last_start_packet_sent = 0
        self.time_last_stop_packet_sent = 0

        # Armed state tracking
        self.armed = 0
        self.time_disarmed = None
        self.last_datablock_time = None
        self.pending_rotation = False

        # Create log directory if it doesn't exist
        try:
            os.makedirs(self.logdir, exist_ok=True)
        except OSError as e:
            print(f"Error creating log directory {self.logdir}: {e}")
            sys.exit(1)

    def connect(self):
        """Establish MAVLink connection"""
        print(f"Connecting to {self.connection_string}...")
        try:
            self.master = mavutil.mavlink_connection(
                self.connection_string,
                source_system=255,
                source_component=mavutil.mavlink.MAV_COMP_ID_LOG
            )
            print("Waiting for heartbeat...")
            while self.running:
                m = self.master.wait_heartbeat(timeout=1)
                if m is not None and self.master.probably_vehicle_heartbeat(m):
                    break

            # Check if we were stopped during connection
            if not self.running:
                return False

            sys_id = self.master.target_system
            comp_id = self.master.target_component
            print(f"Connected to system {sys_id}, component {comp_id}")
            return True
        except Exception as e:
            print(f"Connection failed: {e}")
            return False

    def new_log_filepath(self, extension='bin'):
        """Returns a filepath to a log with timestamp

        Args:
            extension: File extension (bin or tlog)
        """
        # Generate filename with timestamp only
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        filename = f'{timestamp}.{extension}'
        return os.path.join(self.logdir, filename)

    def start_new_log(self):
        """Open a new dataflash log, reset state"""
        # Close old log file if it exists
        if self.logfile is not None:
            try:
                self.logfile.close()
                print("DFLogger: Closed previous BIN log")
            except Exception as e:
                print(f"DFLogger: Error closing previous BIN log: {e}")

        # Generate bin filename with timestamp
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        bin_filename = os.path.join(self.logdir, f'{timestamp}.bin')

        self.last_seqno = 0
        self.logfile = open(bin_filename, 'w+b')
        print("DFLogger: BIN logging started")
        print(f"  BIN: {bin_filename}")

        self.download = 0
        self.prev_download = 0
        self.last_idle_status_printed_time = time.time()
        self.last_status_time = time.time()
        self.missing_blocks = {}
        self.acking_blocks = {}
        self.blocks_to_ack_and_nack = []
        self.missing_found = 0
        self.abandoned = 0
        self.dropped = 0

    def tell_sender_to_start(self):
        """Send a start packet (if we haven't sent one in the last second)"""
        now = time.time()
        if now - self.time_last_start_packet_sent < 1:
            return
        self.time_last_start_packet_sent = now

        if self.verbose:
            print("DFLogger: Sending start packet")

        target_sys = self.target_system
        target_comp = self.target_component
        self.master.mav.remote_log_block_status_send(
            target_sys,
            target_comp,
            mavutil.mavlink.MAV_REMOTE_LOG_DATA_BLOCK_START,
            1
        )

    def tell_sender_to_stop(self, m):
        """Send a stop packet (if we haven't sent one in the last second)"""
        now = time.time()
        if now - self.time_last_stop_packet_sent < 1:
            return

        if self.verbose:
            print("DFLogger: Sending stop packet")

        self.time_last_stop_packet_sent = now
        self.master.mav.remote_log_block_status_send(
            m.get_srcSystem(),
            m.get_srcComponent(),
            mavutil.mavlink.MAV_REMOTE_LOG_DATA_BLOCK_STOP,
            1
        )

    def rotate_log(self):
        """Send a start packet and rotate log"""
        now = time.time()
        self.time_last_start_packet_sent = now

        if self.verbose:
            print("DFLogger: rotating")

        target_sys = self.target_system
        target_comp = self.target_component

        # Send 3 stop packets
        for i in range(3):
            self.master.mav.remote_log_block_status_send(
                target_sys,
                target_comp,
                mavutil.mavlink.MAV_REMOTE_LOG_DATA_BLOCK_STOP,
                1
            )

        # Send start packet
        self.master.mav.remote_log_block_status_send(
            target_sys,
            target_comp,
            mavutil.mavlink.MAV_REMOTE_LOG_DATA_BLOCK_START,
            1
        )

        self.start_new_log()

    def packet_is_for_me(self, m):
        """Returns true if this packet is appropriately addressed"""
        if m.target_system != self.master.mav.srcSystem:
            return False
        if m.target_component != self.master.mav.srcComponent:
            return False

        # If we have a sender, also check the source address
        if self.sender is not None:
            if (m.get_srcSystem(), m.get_srcComponent()) != self.sender:
                return False

        return True

    def do_ack_block(self, seqno):
        """ACK a received block"""
        if seqno in self.acking_blocks:
            # Already acking this one
            return

        now = time.time()

        # ACK the block we just got
        self.blocks_to_ack_and_nack.append([self.master, seqno, 1, now, None])
        self.acking_blocks[seqno] = 1

        # NACK any blocks we haven't seen and should have
        if seqno - self.last_seqno > 1:
            for block in range(self.last_seqno + 1, seqno):
                if block not in self.missing_blocks and \
                   block not in self.acking_blocks:
                    self.missing_blocks[block] = 1
                    if self.verbose:
                        print(f"DFLogger: setting {block} for nacking")
                    self.blocks_to_ack_and_nack.append(
                        [self.master, block, 0, now, None]
                    )

    def handle_datablock(self, m):
        """Handle REMOTE_LOG_DATA_BLOCK message"""
        if not self.packet_is_for_me(m):
            self.dropped += 1
            return

        # Track when we last received a datablock
        self.last_datablock_time = time.time()

        # Cancel any pending rotation since we're still receiving data
        #if self.pending_rotation:
        #    if self.verbose:
        #        print("DFLogger: Cancelled pending rotation - still receiving data")
        #    self.pending_rotation = False

        # Start new log if this is the first packet
        if self.sender is None and m.seqno == 0:
            if self.verbose:
                print("DFLogger: Received data packet - starting new log")
            self.start_new_log()
            self.sender = (m.get_srcSystem(), m.get_srcComponent())

        if self.sender is None:
            # No connection right now, and this packet did not start one
            return

        if self.stopped:
            # Send a stop packet @1Hz until the other end gets the idea
            self.tell_sender_to_stop(m)
            return

        # Write data to log file
        size = len(m.data)
        data = bytearray(m.data[:size])
        ofs = size * m.seqno
        self.logfile.seek(ofs)
        self.logfile.write(data)

        # Track missing blocks
        if m.seqno in self.missing_blocks:
            if self.verbose:
                print(f"DFLogger: Got missing block: {m.seqno}")
            del self.missing_blocks[m.seqno]
            self.missing_found += 1
            self.blocks_to_ack_and_nack.append(
                [self.master, m.seqno, 1, time.time(), None]
            )
            self.acking_blocks[m.seqno] = 1
        else:
            self.do_ack_block(m.seqno)

        if self.last_seqno < m.seqno:
            self.last_seqno = m.seqno

        self.download += size

    def idle_print_status(self):
        """Print out statistics every 10 seconds"""
        now = time.time()
        if (now - self.last_idle_status_printed_time) >= 10:
            self.print_status()
            self.last_idle_status_printed_time = now

    def print_status(self):
        """Print current status"""
        transferred = self.download - self.prev_download
        self.prev_download = self.download
        now = time.time()
        interval = now - self.last_status_time
        self.last_status_time = now

        if interval > 0:
            rate = transferred / (interval * 1000)
        else:
            rate = 0

        state = "Inactive" if self.stopped else "Active"
        print(f"DFLogger: {state} Rate({interval:.0f}s):{rate:.3f}kB/s "
              f"Block:{self.last_seqno} Missing:{len(self.missing_blocks)} "
              f"Fixed:{self.missing_found} Abandoned:{self.abandoned}")

    def idle_send_acks_and_nacks(self):
        """Send ACK/NACK packets to UAV"""
        max_blocks_to_send = 10
        blocks_sent = 0
        i = 0
        now = time.time()

        while (i < len(self.blocks_to_ack_and_nack) and
               blocks_sent < max_blocks_to_send):
            stuff = self.blocks_to_ack_and_nack[i]
            [master, block, status, first_sent, last_sent] = stuff

            if status == 1:
                # ACK the block
                mavstatus = mavutil.mavlink.MAV_REMOTE_LOG_DATA_BLOCK_ACK
                (target_sys, target_comp) = self.sender
                self.master.mav.remote_log_block_status_send(
                    target_sys,
                    target_comp,
                    block,
                    mavstatus
                )
                blocks_sent += 1
                del self.acking_blocks[block]
                del self.blocks_to_ack_and_nack[i]
                continue

            if block not in self.missing_blocks:
                # We've received this block now
                del self.blocks_to_ack_and_nack[i]
                continue

            # Give up on packet if we have seen one with a much higher
            # number (or after 60 seconds)
            if (self.last_seqno - block > 200) or (now - first_sent > 60):
                if self.verbose:
                    print(f"DFLogger: Abandoning block ({block})")
                del self.blocks_to_ack_and_nack[i]
                del self.missing_blocks[block]
                self.abandoned += 1
                continue

            i += 1

            # Only send each NACK every-so-often
            if last_sent is not None:
                if now - last_sent < 0.1:
                    continue

            if self.verbose:
                print(f"DFLogger: Asking for block ({block})")
            mavstatus = mavutil.mavlink.MAV_REMOTE_LOG_DATA_BLOCK_NACK
            (target_sys, target_comp) = self.sender
            self.master.mav.remote_log_block_status_send(
                target_sys,
                target_comp,
                block,
                mavstatus
            )
            blocks_sent += 1
            stuff[4] = now

    def idle_task_started(self):
        """Called when logging is started"""
        now = time.time()

        # Check armed state for rotation
        try:
            isarmed = self.master.motors_armed()
            if self.armed != isarmed:
                print(f"DFLogger: Armed state changed: {self.armed} -> {isarmed}")
                self.armed = isarmed
                if not self.armed and self.rotate_on_disarm:
                    # Vehicle just disarmed - mark time and set pending rotation
                    print("DFLogger: Vehicle disarmed, waiting for logging to stop...")
                    self.time_disarmed = now
                    self.pending_rotation = True
                elif self.armed:
                    print("DFLogger: Vehicle armed")
                    # Cancel any pending rotation if we re-arm
                    self.pending_rotation = False
                    self.time_disarmed = None
        except Exception as e:
            if self.verbose:
                print(f"DFLogger: Error checking armed state: {e}")

        # Check if we should rotate log (disarmed + 5 seconds without data)
        if self.pending_rotation and self.time_disarmed is not None:
            if self.last_datablock_time is None:
                # Never received any datablocks yet
                time_since_disarm = now - self.time_disarmed
            else:
                # Check both time since disarm and time since last datablock
                time_since_disarm = now - self.time_disarmed
                time_since_data = now - self.last_datablock_time

                # Use the minimum of the two (we want to wait 5 seconds after BOTH)
                time_since_disarm = min(time_since_disarm, time_since_data)

            if time_since_disarm >= 0.5:
                print("DFLogger: No data for 0.5 seconds after disarm, rotating log now")
                self.rotate_log()
                self.pending_rotation = False
                self.time_disarmed = None
            elif self.verbose and int(time_since_disarm) != int(time_since_disarm - 0.1):
                # Print status every second (verbose mode)
                print(f"DFLogger: Waiting for rotation... {0.5 - time_since_disarm:.1f}s remaining")

        if self.verbose:
            self.idle_print_status()

        self.idle_send_acks_and_nacks()

    def idle_task_not_started(self):
        """Called when logging is not running"""
        if not self.stopped:
            self.tell_sender_to_start()

    def idle_task(self):
        """Called regularly to perform background tasks"""
        if self.sender is not None:
            self.idle_task_started()
        else:
            self.idle_task_not_started()

    def get_usec(self):
        '''time since 1970 in microseconds'''
        return int(time.time() * 1.0e6)

    def run(self):
        """Main loop"""
        if not self.connect():
            return False

        print("DFLogger: Starting dataflash and telemetry logging...")
        print(f"Log directory: {self.logdir}")
        print("Press Ctrl+C to stop")

        # Open tlog file immediately
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        tlog_filename = os.path.join(self.logdir, f'{timestamp}.tlog')
        self.tlogfile = open(tlog_filename, 'w+b')
        print(f"TLOG: {tlog_filename}")

        try:
            while self.running:
                # Receive MAVLink messages (all types for tlog)
                msg = self.master.recv_match(blocking=False, timeout=0.1)

                if msg is not None:
                    # Handle dataflash blocks specifically
                    if msg.get_type() == 'REMOTE_LOG_DATA_BLOCK':
                        self.handle_datablock(msg)
                    else:
                        # don't include remote data blocks in tlog
                        if self.tlogfile is not None:
                            try:
                                usec = self.get_usec()
                                self.tlogfile.write(bytearray(struct.pack('>Q', usec) + msg.get_msgbuf()))
                                self.tlogfile.flush()
                            except Exception as e:
                                if self.verbose:
                                    print(f"Error writing to tlog: {e}")
                else:
                    # Perform idle tasks
                    self.idle_task()

                    # Small sleep to prevent busy loop
                    time.sleep(0.001)

        except KeyboardInterrupt:
            print("\nDFLogger: Interrupted by user")

        finally:
            self.cleanup()

        return True

    def cleanup(self):
        """Clean up resources"""
        print("DFLogger: Cleaning up...")

        # Stop logging
        if self.sender is not None and self.master is not None:
            target_sys = self.target_system
            target_comp = self.target_component
            for i in range(3):
                try:
                    self.master.mav.remote_log_block_status_send(
                        target_sys,
                        target_comp,
                        mavutil.mavlink.MAV_REMOTE_LOG_DATA_BLOCK_STOP,
                        1
                    )
                except Exception:
                    pass
            time.sleep(0.1)

        # Close log files
        if self.logfile is not None:
            try:
                self.logfile.close()
                print("DFLogger: BIN log file closed")
            except Exception:
                pass

        if self.tlogfile is not None:
            try:
                self.tlogfile.close()
                print("DFLogger: TLOG file closed")
            except Exception:
                pass

        # Close connection
        if self.master is not None:
            try:
                self.master.close()
            except Exception:
                pass

        # Print final status
        self.print_status()
        print("DFLogger: Stopped")

    def stop(self):
        """Stop the logger"""
        self.running = False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Standalone DataFlash Logger for ArduPilot',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --connection udp:127.0.0.1:14550 --logdir ./logs
  %(prog)s --connection /dev/ttyUSB0 --logdir /var/logs/flight
  %(prog)s --connection tcp:192.168.1.10:5760 --logdir ./logs --verbose
  %(prog)s --connection udpin:0.0.0.0:14550 --logdir ./logs --rotate-on-disarm
        """
    )

    parser.add_argument(
        '--connection',
        required=True,
        help='MAVLink connection string (e.g., udp:127.0.0.1:14550, /dev/ttyUSB0, tcp:192.168.1.10:5760)'
    )

    parser.add_argument(
        '--logdir',
        required=True,
        help='Directory to store log files'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose output'
    )

    parser.add_argument(
        '--target-system',
        type=int,
        default=0,
        help='Target system ID (0 = any, default: 0)'
    )

    parser.add_argument(
        '--target-component',
        type=int,
        default=mavutil.mavlink.MAV_COMP_ID_LOG,
        help='Target component ID '
             f'(default: {mavutil.mavlink.MAV_COMP_ID_LOG})')

    parser.add_argument(
        '--rotate-on-disarm',
        action='store_true',
        help='Rotate log file when vehicle disarms'
    )

    args = parser.parse_args()

    # Create logger instance
    logger = DataFlashLogger(
        connection_string=args.connection,
        logdir=args.logdir,
        verbose=args.verbose,
        target_system=args.target_system,
        target_component=args.target_component,
        rotate_on_disarm=args.rotate_on_disarm
    )

    # Set up signal handler for graceful shutdown
    def signal_handler(sig, frame):
        print("\nDFLogger: Received signal, stopping...")
        logger.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Run the logger
    success = logger.run()
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
