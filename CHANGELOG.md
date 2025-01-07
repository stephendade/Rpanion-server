### Changelog

#### [v0.11.0](https://github.com/stephendade/Rpanion-server/compare/v0.10.0...v0.11.0)
 - Add support for Raspberry Pi 5
 - Add support for NVIDIA Jetson Orin
 - Add support for nodejs 22
 - Flight Controller: Rpanion-server can send it's own MAVLink HEARTBEAT messages
 - Add support for RasPiOS Bookworm
 - Video: Better detection of Cameras
 - Video: Add support for the Raspbery Pi GS Camera
 - Video: Latency reductions
 - Logging: Moved tlog handling to mavlink-router
 - Video: More reliable detection (and usage) of hardware H264 encoding
 - Video: Rpanion-server can send it's own MAVLink VIDEO_STREAM_INFORMATION messages
 - Video: Basic implementation of MAVLink camera protocol
 - Add username/password protection to Web GUI
 - Network: Major bug fixes when adding and removing networks
 - Various security fixes to Web GUI

#### [v0.10.0](https://github.com/stephendade/Rpanion-server/compare/v0.9.0...v0.10.0)
 - Add support for nodejs 18 and 20
 - Video: Use libcamera on Raspberry Pi
 - Video: Add support for 2nd CSI port on Raspberry Pi
 - Video: Hardware x264 encoding for USB cameras
 - Video: Reduce x264 latency
 - Video: Add support for Jetson CSI cameras
 - FlightController: Add option to send datastream requests
 - UI: More consistency
 - Network: Better Wireguard status
 - Network: Add refresh button to Wifi network list
 - Network: Various bug fixes in showing connection details
 - Add (limited) support for Ubuntu22 on Raspberry Pi. Video not supported.
 - Added support for Le Potato SBC
 - FlightController: Added support for alterntate serial ports on Raspberry Pi 4

#### [v0.9.0](https://github.com/stephendade/Rpanion-server/compare/v0.8.0...v0.9.0)

- Upgrade from nodejs v14 to v16
- FlightLogs: Add automatic processing of tlogs to kml files
- Video: Add option to overlay timestamp
- FlightController: Remove unused MAVLink dialect option
- Add VPN configuration GUI for Zerotier and Wireguard
- Add help text to all pages
- Allow user to download Rpanion-server logfile
- FlightController: Add UDP server option
- NetworkManager: Scan for available Wifi networks
- FlightController: Add extra baudrates
- Video: Add Mission Planner connection strings
- Add upgrade control to "About" page
- NetworkManager: allow editing of ssid
- Add rate limiting to server (50 requests/min) to mitigate denial-of-service attacks
- Add cloud upload of flight logs
- FlightController: Show ArduPilot version
- Video: Fix streaming config interval

#### [v0.8.0](https://github.com/stephendade/Rpanion-server/compare/v0.7.0...v0.8.0)

- MAVLink: Update [`1613716`](https://github.com/stephendade/Rpanion-server/commit/16137169b0c156762d12c69ac88810df458629d7)
- CI: Add package-lock.json [`411ce51`](https://github.com/stephendade/Rpanion-server/commit/411ce5124dddfb20d165223427f7983ed92fc838)
- Build: Update npm packages [`4fd902c`](https://github.com/stephendade/Rpanion-server/commit/4fd902c9993a02f7e57801bf0bf181b472ed984f)
- UI: Consistant UI [`82b3f17`](https://github.com/stephendade/Rpanion-server/commit/82b3f172e8c8c0b16b0708ff0085d8ca123d9889)
- Src: Make code formatting consistent [`c3c484b`](https://github.com/stephendade/Rpanion-server/commit/c3c484b7f9bc616b28330a5beb2c9a62be5e2ab5)
- Build: Major npm package updates [`b90938e`](https://github.com/stephendade/Rpanion-server/commit/b90938e22f7ac3b4a4037cf81c1d3248f8c37079)
- Server: Fixed formatting [`0d86c9d`](https://github.com/stephendade/Rpanion-server/commit/0d86c9df0ecdc7d6e23fc803426a669376b74f98)
- Server: Style fixes [`242232c`](https://github.com/stephendade/Rpanion-server/commit/242232c125ff8f57925313ecd3bde2773c7b80c0)
- Network: Add adhoc Wifi mode [`9018737`](https://github.com/stephendade/Rpanion-server/commit/901873760adcc5131bd30876df1f5e785f101178)
- CI: Add Coveralls [`505f150`](https://github.com/stephendade/Rpanion-server/commit/505f1506b0b426e480b9536eabbd6eae24049b72)
- Build: Revert to old npm to support NodeJS V11 [`760b8c3`](https://github.com/stephendade/Rpanion-server/commit/760b8c33c46cf0625f61a6a0910d1719a434af9f)
- Add NTRIP support [`17fb002`](https://github.com/stephendade/Rpanion-server/commit/17fb0026f7f806ab2d3399541ce288916cb4b98e)
- CI: Remove Coveralls [`e9e7237`](https://github.com/stephendade/Rpanion-server/commit/e9e7237cb5ee8beb5ae58385af81be8066a86590)
- Network: Add list of clients for access point mode [`d8f586c`](https://github.com/stephendade/Rpanion-server/commit/d8f586c39339b92c282350c4c9b14e6ab8abe5d6)
- Video: Add UDP streaming option to server [`41f089c`](https://github.com/stephendade/Rpanion-server/commit/41f089cc06635eddb22eb90a404f10809c118968)
- Add Ubuntu support [`44b0af0`](https://github.com/stephendade/Rpanion-server/commit/44b0af08fe216fa5e467daf8b153801dd170e2d0)
- Deploy: Remove git clone steps [`39bd1b6`](https://github.com/stephendade/Rpanion-server/commit/39bd1b61e49e1889056f9ff147fdf07c5a8028de)
- Server: Remove unsed bin logger [`ec42715`](https://github.com/stephendade/Rpanion-server/commit/ec42715e27dc3dbe8d6fd36e471ad581d632027b)
- Video: Add Jetson support [`95534a4`](https://github.com/stephendade/Rpanion-server/commit/95534a40f74b2df89d78ce31f835d50dd12768eb)
- Modules: Update mavlink-router [`4883b31`](https://github.com/stephendade/Rpanion-server/commit/4883b31b8296caaeb0b9e203653c64d325c711b7)
- Build: Update scripts and readme [`acfc8ee`](https://github.com/stephendade/Rpanion-server/commit/acfc8ee5c306f3a721bae1cf99555b43655031e1)
- Server: Fix Wifi network display [`21b2479`](https://github.com/stephendade/Rpanion-server/commit/21b24796c244f63441983bdd095c91fdd02916dc)
- Video: Fix accordian UI element [`be49b41`](https://github.com/stephendade/Rpanion-server/commit/be49b41bc0211aa47f505f242e6964ab5e2ed085)
- Tests: Remove bin log tests [`1b418b1`](https://github.com/stephendade/Rpanion-server/commit/1b418b16744812f28f6ec69d6cbfe102e3e97f1d)
- Frontend: New Approuter [`631ce47`](https://github.com/stephendade/Rpanion-server/commit/631ce479fcdb1e821284b19bf5a8f0bf75a1db0f)
- Build: Remove Geany file [`13cbf56`](https://github.com/stephendade/Rpanion-server/commit/13cbf5630cb6f3319f316e017651eeb5813eb5c8)
- MAVLink: Increase timeout and code cleanup [`37b5b38`](https://github.com/stephendade/Rpanion-server/commit/37b5b3890d99f0821e2346daafae40c1e08ebd84)
- Python: Add framerate option for video streaming [`e51d162`](https://github.com/stephendade/Rpanion-server/commit/e51d162cd0f10c0ec69d64690cb2539b12ac0adc)
- Add support for telemetry TCP server [`887e3e3`](https://github.com/stephendade/Rpanion-server/commit/887e3e3c2ded7de176a16ddf0c887b8a21bb8a04)
- Video: Add UDP streaming option to GUI [`1c240fd`](https://github.com/stephendade/Rpanion-server/commit/1c240fd31b0a8c8d15cf0602b035e41ce31a967a)
- Video: Add framerate option [`dfeba49`](https://github.com/stephendade/Rpanion-server/commit/dfeba4964b3b005d4de7a49dc85c7e7eee293411)
- Move CI to Github Actions [`0997b53`](https://github.com/stephendade/Rpanion-server/commit/0997b53a7fd3406ebdeed5a5139e8ee3021bff5d)
- CI: remove Travis [`029665a`](https://github.com/stephendade/Rpanion-server/commit/029665af14580684716c27376b79d8e0accb9bdc)
- Update npm packages [`859e23d`](https://github.com/stephendade/Rpanion-server/commit/859e23d24532d4198374c9052b838c5c2faf7911)
- Server: Add support for wifi channel selection [`a56ca6b`](https://github.com/stephendade/Rpanion-server/commit/a56ca6b496be46f7fda62396f2c3f92ca46a9f26)
- Ubuntu: Camera enable and documentation [`62a1d8b`](https://github.com/stephendade/Rpanion-server/commit/62a1d8b5bba3216ce52d38a1b13c385443cbb5f4)
- Frontend: Add video framerate option [`b42b17a`](https://github.com/stephendade/Rpanion-server/commit/b42b17ab22465069df298746b83dcd4bfebbbb5b)
- Mavlink: Remove unused bin logger [`fd877a9`](https://github.com/stephendade/Rpanion-server/commit/fd877a90cd454b8297946953f3ad328661071ba1)
- Build: Update packages [`06d6d39`](https://github.com/stephendade/Rpanion-server/commit/06d6d39ba07f8ce8ce7bb21ec6678a384e4a4887)
- Fronend: Add support for wifi channel selection [`1389ef2`](https://github.com/stephendade/Rpanion-server/commit/1389ef291ac2f9e9af8d2ec4e9db96191ba7ce8c)
- Flight Controller: Add Jetson UART [`ef9e03a`](https://github.com/stephendade/Rpanion-server/commit/ef9e03ae629b02311e8b20789e3b0fa01baca984)
- Video: Add support for Raspian Bullseye [`d029e2d`](https://github.com/stephendade/Rpanion-server/commit/d029e2d06167f031e5da3daa75c776ccad99a270)
- Deploy: Fix Jetson issues [`7652934`](https://github.com/stephendade/Rpanion-server/commit/76529346acf60c0665d3602fc280802e0241e204)
- Build: Add script to change nodejs version [`2f442c7`](https://github.com/stephendade/Rpanion-server/commit/2f442c7b30889996a44bd539c8071b025a1aafd7)
- Build: Update packages [`7213e67`](https://github.com/stephendade/Rpanion-server/commit/7213e67f3ff75c6db731e10a4f191254d64954bb)
- Frontend: Fix loading and submitted text placement [`f7d8562`](https://github.com/stephendade/Rpanion-server/commit/f7d85621be53244916dd955be5548b3544d3a89b)
- Tests: Add adhoc page [`80107a7`](https://github.com/stephendade/Rpanion-server/commit/80107a7d3f3578c12a4adb3c4b25472915771984)
- CI: Use mavlink-router script [`808f749`](https://github.com/stephendade/Rpanion-server/commit/808f749770aa80a30f02d30d046fd0a3255fd9b7)
- Frontend: Fix page width to 500 [`e268fe6`](https://github.com/stephendade/Rpanion-server/commit/e268fe61a1d6b0912e380e8dc4ff528befc7dfc7)
- CI: Fix pip install [`bc1da43`](https://github.com/stephendade/Rpanion-server/commit/bc1da432c332441118a28ab8bb602d4055ab151a)
- Nodejs: Update to V14 as default [`d5b6e8d`](https://github.com/stephendade/Rpanion-server/commit/d5b6e8de3a00faab9572dbff1f5b1b462c3061b3)
- CI: fix pip install [`d82d89b`](https://github.com/stephendade/Rpanion-server/commit/d82d89be8551a0eaff2f9477d2930d3c1dd3f358)
- Deploy: Fixes for RPi OS Bulleye [`04081c9`](https://github.com/stephendade/Rpanion-server/commit/04081c9f8da8b7348088d29d3b97954a312c09de)
- Deploy: Add patches for raspicam [`fcc8e87`](https://github.com/stephendade/Rpanion-server/commit/fcc8e872001a492f8a465d0fa120d3af92296fdf)
- Video: Fix typo [`ec91ac5`](https://github.com/stephendade/Rpanion-server/commit/ec91ac5f4cd2d0908dd669aa1b5f133a20f32230)
- Deploy: Add missing Ubuntu package [`8a0aafa`](https://github.com/stephendade/Rpanion-server/commit/8a0aafaa3781c1126734b4f7e71ad9085f2c0353)
- Video: Make default FPS 10 [`33395ee`](https://github.com/stephendade/Rpanion-server/commit/33395eee3777e26666393363c6c38484de4505c1)
- Network: Dont list p2p-wifi [`0c4d2f0`](https://github.com/stephendade/Rpanion-server/commit/0c4d2f06bd275369089fd988e2290a6d183e4ff8)
- NTrip: Remove unused imports [`0fe4582`](https://github.com/stephendade/Rpanion-server/commit/0fe45822f07e08a5d8be7e9753f0b3cc5d5d77ef)
- Video: Fix typo in Pi Camera RTSP [`76e896f`](https://github.com/stephendade/Rpanion-server/commit/76e896fdb19a354de7c4975bcbdd4ef7f0777ccb)
- Network: Add missing variable to new network [`58b0c3e`](https://github.com/stephendade/Rpanion-server/commit/58b0c3ed88933835ce771d8f1998aa4c9f6b396d)
- Tests: extend video test timeout [`deb60aa`](https://github.com/stephendade/Rpanion-server/commit/deb60aafdaa00a5875c250d101e1343fe0d930cf)
- CI: Add Github Actions badge [`3488b22`](https://github.com/stephendade/Rpanion-server/commit/3488b22b9e4693286116dc1b86bb6ae63589c449)
- Frontend: Fix bad css link [`96533f7`](https://github.com/stephendade/Rpanion-server/commit/96533f7042849b555bfdbed16eca2365eab9251f)
- CI: Fix another typo [`9a3113d`](https://github.com/stephendade/Rpanion-server/commit/9a3113dbeebace33b7e1d3f360d4078efc33ab13)
- CI: Fix pip typo [`1c4efe2`](https://github.com/stephendade/Rpanion-server/commit/1c4efe240949af6dd299a8221bb98de51cfa8f75)
- Deploy: Add exec permission for jetson deploy [`ff56b17`](https://github.com/stephendade/Rpanion-server/commit/ff56b173e0e74c0a796d5c72513f103e968cde12)

#### [v0.7.0](https://github.com/stephendade/Rpanion-server/compare/v0.6.0...v0.7.0)

> 15 November 2020

- Deploy: Update PiShrink script and add Pi2 [`6b26a23`](https://github.com/stephendade/Rpanion-server/commit/6b26a2370771bbcc15e97fbb3811a598aba3fac5)
- Frontend: Move to bootstrap UI [`74f2069`](https://github.com/stephendade/Rpanion-server/commit/74f206995a694c4be2ee81cfb94f0a6a5353ffc8)
- Network Config: Removed final popups [`039d37d`](https://github.com/stephendade/Rpanion-server/commit/039d37df139526bf357550a487bc257a6046db86)
- Network: Add wifi enable disable toggle [`76e47c7`](https://github.com/stephendade/Rpanion-server/commit/76e47c78680929828392756e228912c0cc15dbf0)
- About: Add confirm for shutdown [`a7c68a8`](https://github.com/stephendade/Rpanion-server/commit/a7c68a89cc439d12477a4b55e56a2e530ecff51c)
- Backend: Get disk space stats [`187f480`](https://github.com/stephendade/Rpanion-server/commit/187f480e78fad93bbe11c961cd7a17ec2db6ec44)
- Build: Update dependent packages [`aa6bee0`](https://github.com/stephendade/Rpanion-server/commit/aa6bee0f9aadfbceea3d35b3291dcee8a64a39ab)
- Server: Remove dependency on deasync [`9430f4b`](https://github.com/stephendade/Rpanion-server/commit/9430f4bf3d7f8413f8f191326c065c9289c2edc9)
- Tests: Add a few networkManager tests [`73036e0`](https://github.com/stephendade/Rpanion-server/commit/73036e02bf9384c74faf0d6ad9211600f7ea58b9)
- Video: Support mjpeg cameras [`ea164ed`](https://github.com/stephendade/Rpanion-server/commit/ea164edcb414ad8e7eeef9d3f9190579a0835b99)
- About: Add shutdown function [`b0391af`](https://github.com/stephendade/Rpanion-server/commit/b0391af8f046f20340632d9ae3e25cc9db4574e6)
- Geany: Update project file [`342c3f6`](https://github.com/stephendade/Rpanion-server/commit/342c3f61e255c685632956ad77731f85e412abe1)
- Network Page: Add toggle for show password [`8cf9cb7`](https://github.com/stephendade/Rpanion-server/commit/8cf9cb7da2114f163e761f4f220e03a3a1e55c8f)
- Frontend: Add shutdown button [`f1f60e1`](https://github.com/stephendade/Rpanion-server/commit/f1f60e141cfe5687a530edcc52502985e069dfaf)
- Frontend: Change class the className [`34af492`](https://github.com/stephendade/Rpanion-server/commit/34af492fcf1fb893798fb4fca68f3e06db00c637)
- Frontend: Display disk space stats [`5d405e8`](https://github.com/stephendade/Rpanion-server/commit/5d405e8dd4e21c56bfb9358c8428abd511ea9da3)
- Modules: Update mavlink-router [`ddaeed2`](https://github.com/stephendade/Rpanion-server/commit/ddaeed24030142cbe1eec432867811ce086b8043)
- NetworkManager: Disable wifi selects if flight mode on [`cbcb2dd`](https://github.com/stephendade/Rpanion-server/commit/cbcb2dd9b7cb49b7d491dcd90b73e6c0bf062c01)
- Video: Dont include ISP devices in RPi [`8ec0376`](https://github.com/stephendade/Rpanion-server/commit/8ec0376033143c7aaf3a14726691091cf7a21039)
- CI: Add nmcli package [`b6a7c51`](https://github.com/stephendade/Rpanion-server/commit/b6a7c518e5a0d0998a4054dd504db5b73b14387d)
- README: Add coveralls badge [`62bfa5e`](https://github.com/stephendade/Rpanion-server/commit/62bfa5e418680206541ace1999a446c0f0f4c5dd)
- Server: add sudo for shutdown [`71da9ed`](https://github.com/stephendade/Rpanion-server/commit/71da9ed756e38b4dbdc1324cd12476a8747585d2)
- About: Change reboot to shutdown [`ae811f6`](https://github.com/stephendade/Rpanion-server/commit/ae811f64b64f143b4d330d8514493eaab2638e02)
- Doco: Add Pi2 [`0840d2d`](https://github.com/stephendade/Rpanion-server/commit/0840d2dacab4fbaf87121b974e9bc66a11022955)
- CI: Update pip, remove pymavlink [`900b891`](https://github.com/stephendade/Rpanion-server/commit/900b8918b5323b58c271f2e5ddebf5b95ec9528c)

#### [v0.6.0](https://github.com/stephendade/Rpanion-server/compare/v0.5.0...v0.6.0)

> 16 June 2020

- Mavlink: Add ArduPilot dialect [`ec22e53`](https://github.com/stephendade/Rpanion-server/commit/ec22e53a66fbb65e02c589340cc162f1dd8b838a)
- Mavlink: Updated generated files [`ea6fcce`](https://github.com/stephendade/Rpanion-server/commit/ea6fcce4a929ade5f904c5141284e076933dd491)
- Server: Linting files [`8fc062b`](https://github.com/stephendade/Rpanion-server/commit/8fc062be89d030b12105804a0d3a4369aa9c3754)
- Mavlink: update headers [`0506c01`](https://github.com/stephendade/Rpanion-server/commit/0506c0194102551ea343399d9316019b2ee64f3e)
- FlightController: Lint fix [`7f6a713`](https://github.com/stephendade/Rpanion-server/commit/7f6a71376be3314a877761fbedd517f29408926a)
- Videostream: Lint and add tests [`c372dfa`](https://github.com/stephendade/Rpanion-server/commit/c372dfaeb1b0539dd48380608bab8f345401e13e)
- Routing: Now using mavlink-router [`ab5063c`](https://github.com/stephendade/Rpanion-server/commit/ab5063c90b62cbdec01724021edabd45c046fbcb)
- Deploy: Updated Pi Zero script [`4c03fa5`](https://github.com/stephendade/Rpanion-server/commit/4c03fa5d03c173f85ede39c844c9e32b594e1ed0)
- Deploy: Add SD card cloning scripts [`082d447`](https://github.com/stephendade/Rpanion-server/commit/082d4472393313092c6e7661c5553498c2598d07)
- Server: Added more tests [`8b23395`](https://github.com/stephendade/Rpanion-server/commit/8b2339528cead867c1461b907630bd72ee7fe62c)
- End of the line [`17a6cdf`](https://github.com/stephendade/Rpanion-server/commit/17a6cdf984db69c0470a06d64c78e0f110003416)
- Project: Add release info and changelog [`c002db8`](https://github.com/stephendade/Rpanion-server/commit/c002db891692b6758607521be3aa7db454042f01)
- FlightController: Fix reconnect on loss of telemetry [`f22124e`](https://github.com/stephendade/Rpanion-server/commit/f22124e8b1297f1e950e8c8376646992da17817c)
- LogBrowser: Add front and backend linkages for bin logs [`59c9917`](https://github.com/stephendade/Rpanion-server/commit/59c99174b1c14c0f26c088babba9d2f85282083f)
- Packages: Upgrade to latest. Plus serialport fixes for new ver8 [`7199bfc`](https://github.com/stephendade/Rpanion-server/commit/7199bfcef660ef157e5668bd0e648f88a84f263e)
- Deploy: Added specific deploy script for Ras Pi Zero W [`eb8b0c5`](https://github.com/stephendade/Rpanion-server/commit/eb8b0c5a49fa56c52aca61d1877cd059dff1349d)
- MavManager: Tests for bin file logging [`d84d3a1`](https://github.com/stephendade/Rpanion-server/commit/d84d3a1a0953f573570ae6755555ba72500ec101)
- flightLogger: Disable on nodejs &lt; 12 due to nonsupport of int64 [`bb62a51`](https://github.com/stephendade/Rpanion-server/commit/bb62a51d3739ee26be0b42488d9cea3aba573dd0)
- FlightController: More tests [`dff259f`](https://github.com/stephendade/Rpanion-server/commit/dff259fe6af9312447daf8a7fe582f1cf1a9a5a6)
- Frontend: Add model error messages [`4faa7ba`](https://github.com/stephendade/Rpanion-server/commit/4faa7ba3b00d9897f9c211fa98302cc4cf4a5156)
- NetworkConfig: Better dialog box for Wifi network type [`9076353`](https://github.com/stephendade/Rpanion-server/commit/90763539ebb593c0ec8d7ca5bf2eeca3335b84c6)
- FlightController: Initial tests [`cba686b`](https://github.com/stephendade/Rpanion-server/commit/cba686bbd97ca462c33ce9a8e6724bf264d0ce99)
- Backend: Move bin logging to mavlink-router [`8db1bb4`](https://github.com/stephendade/Rpanion-server/commit/8db1bb46f388e04331dcbd69adfda69134debb88)
- mavManager: Fix tests [`2a271a1`](https://github.com/stephendade/Rpanion-server/commit/2a271a1091d287975763156004898f66de991874)
- FlightController: Extract out interval to function [`d51adf5`](https://github.com/stephendade/Rpanion-server/commit/d51adf5bedab636497592777130f92af1eadb3a7)
- Nodejs: Package update [`5832303`](https://github.com/stephendade/Rpanion-server/commit/5832303579665dea782bc7e0a072da1c127bfef6)
- Winston: Lint config file [`1186230`](https://github.com/stephendade/Rpanion-server/commit/1186230c2f0614410a6db3e8f3452a58490a53a4)
- Lint fixes [`8e036bb`](https://github.com/stephendade/Rpanion-server/commit/8e036bbd3022c63166164f7ea66eb558592ff185)
- Packages: Remove unused or underused packages [`3f65c79`](https://github.com/stephendade/Rpanion-server/commit/3f65c79c23cd14c9c8ce40c9ef1b372562074576)
- FrontEnd: converted alert popups to modal dialogs [`cf38818`](https://github.com/stephendade/Rpanion-server/commit/cf388182f20337f94e2b65b672da82c7bad5345b)
- Linting [`af592ef`](https://github.com/stephendade/Rpanion-server/commit/af592ef8437b072a6ec676f1b2f5a91312db96cf)
- Server: Add Mavlink dialect option [`31c7d8c`](https://github.com/stephendade/Rpanion-server/commit/31c7d8caf1fefdcdd34208a7bf014d995042cf5b)
- MavManager: Linting fixes [`4e065c5`](https://github.com/stephendade/Rpanion-server/commit/4e065c58b42669cd095628dc81c16f4919c9c5a3)
- About: Add RPi HAT info [`f84f80e`](https://github.com/stephendade/Rpanion-server/commit/f84f80e093e6254cdbfa68a2318a449b9558b2ad)
- FlightController: Calculate datarate [`9bd99f3`](https://github.com/stephendade/Rpanion-server/commit/9bd99f3dc6bda18643132a39437b59c622c7bdd2)
- Revert "Project: Update Geany" [`96bff9b`](https://github.com/stephendade/Rpanion-server/commit/96bff9b79d68b8421b6ac589cd078e2892d2dd0b)
- Project: Update Geany [`8f5c8bd`](https://github.com/stephendade/Rpanion-server/commit/8f5c8bd86f7f8ee4c51ac2ef9aaf67e556796888)
- FlightController: Test start stop [`bbdfc33`](https://github.com/stephendade/Rpanion-server/commit/bbdfc3322eec70babc84d77cd7d7d006179ffe39)
- Modules: Add mavlink-router and deploy scripts [`d144b41`](https://github.com/stephendade/Rpanion-server/commit/d144b410e411737e6172753cb8c50355e001c79a)
- flightLogger: Fix typo in version compare [`68fc0e6`](https://github.com/stephendade/Rpanion-server/commit/68fc0e6d78ce4a3a1e31cf3adbfb033b5f934018)
- MAVLink: Monitor vehicle arm status [`dfa10c4`](https://github.com/stephendade/Rpanion-server/commit/dfa10c410ae1d2eff4e214b4ae2b77ffb8a843b6)
- MAVManager: Don't use packets from GCS [`fb05855`](https://github.com/stephendade/Rpanion-server/commit/fb0585501b080dbccf7526f90970c499101666cb)
- FlightController: Check for mavlink-routerd [`58e12b4`](https://github.com/stephendade/Rpanion-server/commit/58e12b48edc8dbcdaa45e3a212f3fab401b4643c)
- Project: Update geany config [`19a6b1e`](https://github.com/stephendade/Rpanion-server/commit/19a6b1e0118f735bd1eb444f888ed9168c3c7042)
- FlightLogger: add bin tests [`4ffe16a`](https://github.com/stephendade/Rpanion-server/commit/4ffe16a904c2d9c15197f2b93e46d972634867f8)
- About: Fix HAT detection [`7b93bca`](https://github.com/stephendade/Rpanion-server/commit/7b93bcafb2335120e0b9be87f84411cbbda37499)
- flightLogger: mkdir is now sync [`49a8eeb`](https://github.com/stephendade/Rpanion-server/commit/49a8eeba0a53178aa029a5cacbf00069348fd3f8)
- mavManager: Fix component id filtering [`e804138`](https://github.com/stephendade/Rpanion-server/commit/e80413848f2878a24cd75e44465b8f5a2572004c)
- Doco: Add instructions for mavlink-router [`2755e50`](https://github.com/stephendade/Rpanion-server/commit/2755e507e147368a662253f898f69bc3c0e9ec9f)
- CI: Add mavlink-router install [`eaa1ffd`](https://github.com/stephendade/Rpanion-server/commit/eaa1ffd77a200a709d9dceed09d5f3d7a36a2dc9)
- FlightController: Disallow edit of 127.0.0.1:14540 output [`648bc47`](https://github.com/stephendade/Rpanion-server/commit/648bc4748c647bdf0916be2971716a1c0048b543)
- CI: Use pip3 [`72f250f`](https://github.com/stephendade/Rpanion-server/commit/72f250f973cc3c8bff36aaf5b3102d5c628c03c8)
- CI: Add videostream packages [`c612a08`](https://github.com/stephendade/Rpanion-server/commit/c612a08c9faf8e6e463d103551cee14081b5351f)
- MavManager: add arming events [`d4ea0b7`](https://github.com/stephendade/Rpanion-server/commit/d4ea0b77b54720a2b4e1bea8214e94feff935392)
- FlightController: Add dialect option [`a2abe86`](https://github.com/stephendade/Rpanion-server/commit/a2abe86eb470e4c5f059468bc7d61cd92c84884d)
- Frontend: Fix JS error [`1da6b3b`](https://github.com/stephendade/Rpanion-server/commit/1da6b3b02aaa240e88cba2eda6fd903c9ea6f266)
- flightController: Pass on arming events [`874197a`](https://github.com/stephendade/Rpanion-server/commit/874197ae397358218ffda355e57610484cdceb7e)
- FlightController: send out error messages [`03cc715`](https://github.com/stephendade/Rpanion-server/commit/03cc71586ea99ba4a8a8d908d354b971ec392e91)
- Video: Handle when no connected video devices [`4588e64`](https://github.com/stephendade/Rpanion-server/commit/4588e64b8f6ebee792b2588670c7d333b03752ad)
- Video: Fix timing typo [`f07ba13`](https://github.com/stephendade/Rpanion-server/commit/f07ba13096365d5c6982b1e4ef4983d009b05a98)
- FrontEnd: Logging enable only works for tlogs [`c77fd97`](https://github.com/stephendade/Rpanion-server/commit/c77fd970da19dbbf76ab79ed09a2e5ad410693d4)
- FlightController: add 1500000 baudrate [`803a3a8`](https://github.com/stephendade/Rpanion-server/commit/803a3a8b45bdf76fc14217545eafdf09b8d9a994)
- CI: Update caching options [`606453d`](https://github.com/stephendade/Rpanion-server/commit/606453d157fb32b13c8edb1951ef6e955298fbec)
- Deploy: Disable systemd on mavlink-router [`ce74300`](https://github.com/stephendade/Rpanion-server/commit/ce7430073b56d6a9ac195da70ed0c85d93bd2fac)
- Network: Fix bug where 2.4GHz networks are forced for infrastructure [`de8d6e4`](https://github.com/stephendade/Rpanion-server/commit/de8d6e4dc9a2940d4512e61879ce792a6e3c210f)
- FlightController: Refresh on socketio reconnect [`1207589`](https://github.com/stephendade/Rpanion-server/commit/1207589b48826e9e49a469b72e3c1c987b915116)
- FlightController: Fix tests [`fe71c16`](https://github.com/stephendade/Rpanion-server/commit/fe71c16918170c7f2eec6b5fb7dcb486779b7fd8)
- Modules: update mavlink-router [`266fd50`](https://github.com/stephendade/Rpanion-server/commit/266fd50108048136ede7ade87e5968ca5004caa4)
- Git: ignore more files [`68cd9f7`](https://github.com/stephendade/Rpanion-server/commit/68cd9f7bc9c1a8b034aa2af20955a7740b45e172)
- Update README.md [`013a560`](https://github.com/stephendade/Rpanion-server/commit/013a560792df406e66324c5555b48d59cc6995dd)
- Server: Fix cookie error [`9420e8e`](https://github.com/stephendade/Rpanion-server/commit/9420e8e0d3fcc8afda47319141dbffd6e1dfb1ef)
- FlightController: Display datarate [`ee59d88`](https://github.com/stephendade/Rpanion-server/commit/ee59d88c4cd908a9ba4f45d7e6875e0fb34b59bb)
- Doco: Fix typo in install command [`1dbb3ea`](https://github.com/stephendade/Rpanion-server/commit/1dbb3eae30b58f7607f8af4682be2a1bdc062299)
- Docs: Added link to user doco [`eb46dc3`](https://github.com/stephendade/Rpanion-server/commit/eb46dc3bb77448d92d7e5fee922833743b0b0406)
- FlightController: Show user that 127.0.0.1:14540 is in use [`5adcd67`](https://github.com/stephendade/Rpanion-server/commit/5adcd6731456ad60ca14fd0d0f681a160db9c5b9)
- Packages: Add underscore [`bee6da2`](https://github.com/stephendade/Rpanion-server/commit/bee6da2f97341c404afbe6f4f1d5e250ea8c553f)
- CI: Add build matrix of nodejs 11 and 12 [`5a61815`](https://github.com/stephendade/Rpanion-server/commit/5a618150d2673f808430add308eeda18b1b560ec)

#### [v0.5.0](https://github.com/stephendade/Rpanion-server/compare/v0.4.0...v0.5.0)

> 9 February 2020

- Tlog: Added Telemetry logging functionality [`3c7a016`](https://github.com/stephendade/Rpanion-server/commit/3c7a0164d3e13f416b6e1448759d319bf53245b4)
- Network: Added waiting screen [`4f6eaa3`](https://github.com/stephendade/Rpanion-server/commit/4f6eaa3e2adc9966a1804655b1c88f9c38b557a0)
- Network: Allow connection to be specific for adapter [`70b9db5`](https://github.com/stephendade/Rpanion-server/commit/70b9db55d7e1be9967071780a9fda9ba6ed1dc43)
- Frontend: Added loading screen for all pages [`c825a18`](https://github.com/stephendade/Rpanion-server/commit/c825a18dffaf51250a93262b83a201208c2c48af)
- Styling: Linted the about page [`8323fbe`](https://github.com/stephendade/Rpanion-server/commit/8323fbe866a6ad879eec92b501f72182e807e17e)
- Video: Video streaming settings now saved [`4c355c4`](https://github.com/stephendade/Rpanion-server/commit/4c355c4137c7272fbe536beb584cd0eb83f49b0b)
- Backend: Expand logging [`4fbf951`](https://github.com/stephendade/Rpanion-server/commit/4fbf951c763f01c90ec29694d7bd004a27a76fe1)
- Video: Better layout for streaming addresses and added waiting screen [`6699370`](https://github.com/stephendade/Rpanion-server/commit/669937049bfd9eab25635f613da640ea3f814e15)
- Server: Use better settings manager [`a3d1cce`](https://github.com/stephendade/Rpanion-server/commit/a3d1cceda7aa2c4113c4cc4002a096887ee827b3)
- Network: Added deactivate connection control [`bd161dc`](https://github.com/stephendade/Rpanion-server/commit/bd161dc99f2dfcb6c2e81ba29ccaf483853cdda5)
- Frontend: Move socketIO management to basepage [`d821711`](https://github.com/stephendade/Rpanion-server/commit/d82171187b0d52b0f6a5cf67569f744ee3695df3)
- Video: Better detection of Ras Pi Cameras [`cc74d38`](https://github.com/stephendade/Rpanion-server/commit/cc74d38627b7ec9e139c75cc6bca610dab144d85)
- Doco: README more clear [`f35aa3f`](https://github.com/stephendade/Rpanion-server/commit/f35aa3f24be9e673abd1c036c02573c8d8cdebee)
- React: Use statically rendered frontend [`dfad505`](https://github.com/stephendade/Rpanion-server/commit/dfad505c8d09f468fac1978586d71ba9f85568aa)
- Video: Added rotation option [`55253b0`](https://github.com/stephendade/Rpanion-server/commit/55253b032654b0377c9c836241c833aa7fe593f2)
- Network: Ensure new connection does not connect during creation [`2a6adb1`](https://github.com/stephendade/Rpanion-server/commit/2a6adb136eec035b6ad7f5b2cac5a3bd70544d46)
- Tests: Test framework and Coveralls for backend [`ce1dfd8`](https://github.com/stephendade/Rpanion-server/commit/ce1dfd8ba891f11b5486f65841a0dea7269dab16)
- Tests: Adding linting [`11a7b0c`](https://github.com/stephendade/Rpanion-server/commit/11a7b0c55753498d4812d674f018a905bddbfb27)
- Build: Separated out build process and better doco [`5dda2ff`](https://github.com/stephendade/Rpanion-server/commit/5dda2ffb50b18319a85ae6ee33e9a134f8147762)
- Network: Correct active connection display for multi-adapters [`66604da`](https://github.com/stephendade/Rpanion-server/commit/66604daf2ab76079da0549def9163ef4a191fd4b)
- Server: Add more logging [`ad607e7`](https://github.com/stephendade/Rpanion-server/commit/ad607e76d320ae47270319433dbe87bcd43d76a2)
- Project: Add lint fix to Geany project file [`26c2459`](https://github.com/stephendade/Rpanion-server/commit/26c2459d669cf40ad2a561aa7a5c5f681d480b69)
- WiFi: Disable WPS and change default WifiAP to 10.1.2.100 [`e26bcb4`](https://github.com/stephendade/Rpanion-server/commit/e26bcb49a9234a7d73d332edef61807f81a240da)
- FlightLogger: Use saved settings [`b83c81f`](https://github.com/stephendade/Rpanion-server/commit/b83c81f4b94d87c2252fd0d4b857242d399ccd65)
- Video: Add bitrate option [`15b8a54`](https://github.com/stephendade/Rpanion-server/commit/15b8a5466c0bec5a8de625f4c6519319cc459647)
- Backend: Style fixes [`7428c9d`](https://github.com/stephendade/Rpanion-server/commit/7428c9d121d6ed79d8089a6f91643b1440021d92)
- Documentation: Fix bad rebase [`cba1b73`](https://github.com/stephendade/Rpanion-server/commit/cba1b73096aa789f93c7f156c9643e003bec2e2b)
- Tests: Correct coverage [`53d1e7a`](https://github.com/stephendade/Rpanion-server/commit/53d1e7a87b792510471f10218d5e5afd245fe829)
- Video: Rotation now works on Ras Pi Cameras [`9cd12dd`](https://github.com/stephendade/Rpanion-server/commit/9cd12ddab94038c6781b288a911bc44d7ae24a52)
- mavManager: Add logging [`6d402f0`](https://github.com/stephendade/Rpanion-server/commit/6d402f0ca4c1124b748cc0ac3b2f0b0a3e2bb737)
- Documentation: More info on the Wifi deploy script [`3ca5220`](https://github.com/stephendade/Rpanion-server/commit/3ca522088e14e953e028631433bf83375312b953)
- Documentation: Added install command for Ras Pi [`333c9d0`](https://github.com/stephendade/Rpanion-server/commit/333c9d0e9420189d36748ee809a592c3420f0733)
- Network: Disable autoconnect with deactivation [`4c13aa3`](https://github.com/stephendade/Rpanion-server/commit/4c13aa398b44c3cbd33fcd28f94e2ce8ab842815)
- Git: Ignore logging folder and settings.json [`0df0485`](https://github.com/stephendade/Rpanion-server/commit/0df0485e4aa388ee6feefa87c5aec22c7bd8fb0c)
- FlightController: Fix typo in serial port id [`b1c1247`](https://github.com/stephendade/Rpanion-server/commit/b1c1247ba7cc2c4e1a8eac761473e940987467a3)
- Basepage: Fix incorrect css labels [`23c206c`](https://github.com/stephendade/Rpanion-server/commit/23c206ccf95ca5de87d1555688530d11629c2ccf)
- Video: Added Mission Planner strings [`fd227ab`](https://github.com/stephendade/Rpanion-server/commit/fd227ab8e2db826b559fa6958ff47847d0d59ad9)
- CI: Make travis build Reactjs app too [`5d93449`](https://github.com/stephendade/Rpanion-server/commit/5d93449b64a36282bf0d9affe2d977ffc0cd4323)
- Deploy: Add missing service deactivation for WiFi AP [`2fe3786`](https://github.com/stephendade/Rpanion-server/commit/2fe3786033f428522a772b54721440e442f5379d)
- Documentation: Fix formatting [`4a58c3c`](https://github.com/stephendade/Rpanion-server/commit/4a58c3c623b3348ccfee8287dd9dedf8a5703927)
- Documentation: Add website location [`2e99a96`](https://github.com/stephendade/Rpanion-server/commit/2e99a96118e15bbae905cba662d367517b3d387a)
- Documentation: Fix heading typo [`98f2c5b`](https://github.com/stephendade/Rpanion-server/commit/98f2c5b53d784b793ff99e53fddde29b8e39de0b)
- Deploy: Fix Wifi psk [`865d86e`](https://github.com/stephendade/Rpanion-server/commit/865d86e9f9ba6f65743aabb9d0e1e7e5033cd9af)

#### [v0.4.0](https://github.com/stephendade/Rpanion-server/compare/v0.3.0...v0.4.0)

> 1 December 2019

- FlightController: Better UDP on-sending stability [`885dfe3`](https://github.com/stephendade/Rpanion-server/commit/885dfe3c444f00e9a91ddbcf300856a697e8d73b)
- Deploy: Added script for initial Wifi hotspot [`ee3fc10`](https://github.com/stephendade/Rpanion-server/commit/ee3fc10bbe162ba79d54a05cb79486c2e71f9ebf)
- NetworkManager: Force newer encryption for Wifi APs [`9d9111b`](https://github.com/stephendade/Rpanion-server/commit/9d9111b1c5461db0ba36d3c98fbeeb846ce3e082)
- Upversion to 0.4.0 [`3247159`](https://github.com/stephendade/Rpanion-server/commit/32471597b8824d342e68728a1d6c1bd18e4e5ede)

#### [v0.3.0](https://github.com/stephendade/Rpanion-server/compare/v0.2.0...v0.3.0)

> 1 December 2019

- Deploy: Set line endings to unix [`5aa48f9`](https://github.com/stephendade/Rpanion-server/commit/5aa48f980172f33b8c67c882f6b982f69e0af6b3)
- Deploy: Added deployment script for Rasberry Pi (Raspian) [`6858efb`](https://github.com/stephendade/Rpanion-server/commit/6858efbd594624bf01699bf759f392b2bcea5ff9)
- FlightController: More reliable mavlink onsending [`9fb54fb`](https://github.com/stephendade/Rpanion-server/commit/9fb54fbac8534a5d2ec9080b6e1f45051b79900e)
- Video: Hardware encoding for Ras Pi Cam [`fc1bd84`](https://github.com/stephendade/Rpanion-server/commit/fc1bd8440c08b9068b9d15e55abcfa855ba5cd30)
- FlightController: Fix bug where a new UDP connection crashes the manager [`a78d82f`](https://github.com/stephendade/Rpanion-server/commit/a78d82f059d863fd11828f25b3e29e4f30fe08cd)
- Video: Fix typo in bitrate [`31415e4`](https://github.com/stephendade/Rpanion-server/commit/31415e4821f486dc1657315b74e28baaaae90a87)
- Upversion to 0.3.0 [`cdb15fc`](https://github.com/stephendade/Rpanion-server/commit/cdb15fc7cb09b8bde556fcb4a31f410c606b46ef)
- Deploy: add missing sudo [`93358a7`](https://github.com/stephendade/Rpanion-server/commit/93358a7925fc503ccb5625e286ad3f13a35195e9)

#### v0.2.0

> 30 November 2019

- Initial commit [`ca46d77`](https://github.com/stephendade/Rpanion-server/commit/ca46d77af96afb56211050cb3f88f2a177b23c6f)
- Packages: Added eslint [`7e476d8`](https://github.com/stephendade/Rpanion-server/commit/7e476d8dce6cf2c84e1496df8f6d252ca5555c5f)
- Flight Controller - initial working [`710fb99`](https://github.com/stephendade/Rpanion-server/commit/710fb99455f12e0197c2eb1d354cad639d9ae553)
- Flight Controller: Fixed and added UDP outputs [`f0340c5`](https://github.com/stephendade/Rpanion-server/commit/f0340c5b70cc076857ded6558641d760beaadbda)
- Removed old analog port and serial port routing pages [`755c6f6`](https://github.com/stephendade/Rpanion-server/commit/755c6f6bd25028c842a8cfbb419f11c7e6c751bc)
- Initial commit [`0486132`](https://github.com/stephendade/Rpanion-server/commit/048613208c261c2f7e26f9d2ea3d1d038bdcfa69)
- Network: Backend now working [`6debb26`](https://github.com/stephendade/Rpanion-server/commit/6debb2671f39bf8702a991937610a3f72721b020)
- Video: Added RTSP video streaming [`9bae90b`](https://github.com/stephendade/Rpanion-server/commit/9bae90bbd9ccb1f56a53b56546a37b67eb7582ff)
- Network: Added read-only network config page [`90595bb`](https://github.com/stephendade/Rpanion-server/commit/90595bbea9f418c263ca2898e90044076072ba9b)
- Video: Better grabbing of device caps and removed framerate selection [`052a34e`](https://github.com/stephendade/Rpanion-server/commit/052a34e4683c5679941e18c17c033e7e00f9be08)
- Network: Wired up front end UI for network editing [`4271da3`](https://github.com/stephendade/Rpanion-server/commit/4271da37653f4df9930d2b84cfcc44a45f77f2a6)
- Serial: Better error handling for serial&lt;-&gt;TCP UDP [`dd62866`](https://github.com/stephendade/Rpanion-server/commit/dd62866993d7f658ecbef9423037843b758a71d8)
- Serial: Cleaned up source [`d825270`](https://github.com/stephendade/Rpanion-server/commit/d825270a99932aea38846066da48c7e352ae21f3)
- Analog: Added page for Ras Pi [`5fe65cd`](https://github.com/stephendade/Rpanion-server/commit/5fe65cdb4df0f4378c68df54c01ccad8b933e166)
- Server: Added logging via Winston [`4fe3642`](https://github.com/stephendade/Rpanion-server/commit/4fe3642f999f7545b8ff582096e0acaadc7419b6)
- About: Added about page with system information [`492174c`](https://github.com/stephendade/Rpanion-server/commit/492174c24c8ecdd30803115e4f741cd98d920aaf)
- Removed unused code [`77ea839`](https://github.com/stephendade/Rpanion-server/commit/77ea8397844e625f301ff7ce2978107c9d70e1da)
- Serial: Fixed UDP links [`8b3a787`](https://github.com/stephendade/Rpanion-server/commit/8b3a787e52a688e9f2f739091d680e0a2b056d07)
- Documentation: Updated [`b69afaf`](https://github.com/stephendade/Rpanion-server/commit/b69afafb219b4b81f7eaaa6d524970bf5145ee67)
- Server: Cleanups [`908b06c`](https://github.com/stephendade/Rpanion-server/commit/908b06cd0a392feeacd2e5ad5ae1d1980c0e784e)
- Network: More GUI configuring [`870adb2`](https://github.com/stephendade/Rpanion-server/commit/870adb2cde701c203aba671ac00a16422440e1ac)
- Analog: Using socket.io instead of timed fetch [`69766a3`](https://github.com/stephendade/Rpanion-server/commit/69766a390d15273b3582544af8feab40552c5b24)
- Serial: Input checking [`1a25158`](https://github.com/stephendade/Rpanion-server/commit/1a25158b4dd1a1b07382631ef5204d29af877215)
- General: Fixed linting [`40175b6`](https://github.com/stephendade/Rpanion-server/commit/40175b67fccc41a40116ccb3e6913d399064b404)
- Server: Raspberry Pi compatibility fixes [`afb7fed`](https://github.com/stephendade/Rpanion-server/commit/afb7fedd4b3c518612274d33ac56cd2d3befd409)
- Tests: Add initial for front end [`dc2e5bc`](https://github.com/stephendade/Rpanion-server/commit/dc2e5bce0ba8c125b38066248d5efbca5a8f07df)
- Frontend: Added socket.io connection status to footer of analog and serial [`143f60a`](https://github.com/stephendade/Rpanion-server/commit/143f60afd74661f65c1a6be5621abbd8cf9de7e0)
- Project: updated paths [`1234ac8`](https://github.com/stephendade/Rpanion-server/commit/1234ac84c836f9e35971d0c0b9f1564c3b7f59c5)
- Serial: Correct adding of serial ports and changing baud rates [`20f63f1`](https://github.com/stephendade/Rpanion-server/commit/20f63f173723981b4ba2576829023e7cfa4b01b9)
- Add CI (Travis) [`2a9dc80`](https://github.com/stephendade/Rpanion-server/commit/2a9dc809dc3f937f80078c27ce7a19c3697b9780)
- Serial: Using socket.io for updates [`241c176`](https://github.com/stephendade/Rpanion-server/commit/241c1761a104aa31a3c57960dadd53072b2c23fd)
- General: add eslint config [`b84c06a`](https://github.com/stephendade/Rpanion-server/commit/b84c06a0f3786a6c5a72cf05cbd74cb023fc3c85)
- Video: Updated RTSP server [`278f4f3`](https://github.com/stephendade/Rpanion-server/commit/278f4f3631895524a9823fcabc330e337679833a)
- Documentation: more install steps [`ca392e1`](https://github.com/stephendade/Rpanion-server/commit/ca392e13834cb463f22c657ad40143514afbae0d)
- Documentation: Add details about service [`6278c6d`](https://github.com/stephendade/Rpanion-server/commit/6278c6ddf442b40602f0cee0c29232bf44213b78)
- Added systemd service [`e111183`](https://github.com/stephendade/Rpanion-server/commit/e1111836dbbd89900d983444ec1b5815bb5e8569)
- General: Added dependency installer [`63b1869`](https://github.com/stephendade/Rpanion-server/commit/63b186916df389021dd1e44b4a6cd1d8b4027699)
- Networking: Handle device with no connections [`5e4e335`](https://github.com/stephendade/Rpanion-server/commit/5e4e3357e168f67ca2e8153a206d0b4dac84eedc)
- Serial: Allow re-check of ports on page refresh [`96c7696`](https://github.com/stephendade/Rpanion-server/commit/96c769625616a5eff869462843df57964b4db17b)
- Network: Fixed AP gui config [`d3ec15d`](https://github.com/stephendade/Rpanion-server/commit/d3ec15d59544b7a71aa7dbef5c74394647837106)
- Src: Raspberry Pi compatibility fixes [`bba3387`](https://github.com/stephendade/Rpanion-server/commit/bba338738f90214e1079c10c554ba1e36f0dd4af)
- General: Added new packages [`1a20dd5`](https://github.com/stephendade/Rpanion-server/commit/1a20dd545adc251aa706ea878774fe824e620743)
- Video: Force Ras Pi cam to use software x264 encoding [`5388fc3`](https://github.com/stephendade/Rpanion-server/commit/5388fc36d5483bd1f1520ac53a70daa0cbbb78ed)
- Service: Fix typo and dependencies [`ef75d23`](https://github.com/stephendade/Rpanion-server/commit/ef75d23bb86c7d8935004d7342be9da5e7b03c1a)
- Serial: Fixed UDP under Linux [`af673ef`](https://github.com/stephendade/Rpanion-server/commit/af673ef538f7f4231b4fcbdf5e50c3acf62b3f10)
- Video: Fix modes for Ras Pi Cam [`5717d45`](https://github.com/stephendade/Rpanion-server/commit/5717d459b956e7f94e83e1199b33b55ea9e10281)
- Server: Fix linting issue [`85ee16f`](https://github.com/stephendade/Rpanion-server/commit/85ee16f99da4bf3889eaf105f779e8f0252ad66d)
- Video Streaming: Show debug messages [`436617d`](https://github.com/stephendade/Rpanion-server/commit/436617d745d0f1ae48dd9047bed9e1b369ddb307)
- Server: Fixed crash when analog ports don't exist [`b62a6dc`](https://github.com/stephendade/Rpanion-server/commit/b62a6dcdcadf0944727691272c5116b1a5b684c7)
- Packages: moved eslint to dev [`818025a`](https://github.com/stephendade/Rpanion-server/commit/818025a379e0d203910a9b1926a0bb203d25aa13)
- General: Remove old Windows scripts [`1a37ef3`](https://github.com/stephendade/Rpanion-server/commit/1a37ef316a22b992a05ffc7066ac47a6efbf2f2a)
- Home: Add some text [`823356e`](https://github.com/stephendade/Rpanion-server/commit/823356e0a2f918399509398f3f06cf46667a0081)
- Mavlink: Ignore bad packets [`6f24ff7`](https://github.com/stephendade/Rpanion-server/commit/6f24ff733881af5ec3013388b7eac523e25fb69e)
- Doco: Update list of dependencies [`47f3bfc`](https://github.com/stephendade/Rpanion-server/commit/47f3bfcc794e618a555e8cc2f4cf6bd98655ba4f)
- General: Add serialsetting.json to ignore [`d99c7dd`](https://github.com/stephendade/Rpanion-server/commit/d99c7dd541d7ebd8ad06332296b674f0a769794f)
- FlightController: Remove hardcoded UDP outputs [`b1b1d71`](https://github.com/stephendade/Rpanion-server/commit/b1b1d7153ac405a66819cff99ae627832d31f683)
- Network: Fix IP addressing for hotspots [`c11bd4e`](https://github.com/stephendade/Rpanion-server/commit/c11bd4e2078ec56d019cef9594d6082cdf705d73)
- Network: Fix bug in Wifi network adding [`f2ddf2a`](https://github.com/stephendade/Rpanion-server/commit/f2ddf2afcd94506a6499729f2dbbc004d9eae585)
- Upversion to 0.2.0 [`70cf310`](https://github.com/stephendade/Rpanion-server/commit/70cf310956a1e9274fb91c5e2ecd4d83f31da9e4)
- FlightController: Fix bug with Ras Pi serial port [`0b130fa`](https://github.com/stephendade/Rpanion-server/commit/0b130fa76f095d7fdcfa3d5dfbc99c20d0f7b448)
- Extra packages to install [`01fd53d`](https://github.com/stephendade/Rpanion-server/commit/01fd53da4b21a88f730e4b6380ffd2dea799dfcb)
- Analog: Fixed typo for Pi [`9f59d45`](https://github.com/stephendade/Rpanion-server/commit/9f59d45264d9f742fa87a666e4fe1eae4576dc80)
- Client: Added name [`607a727`](https://github.com/stephendade/Rpanion-server/commit/607a727c2845f516c95b9c1ea778c76e305823d0)
- Packages: Raspberry Pi compatibility fixes [`2c47512`](https://github.com/stephendade/Rpanion-server/commit/2c47512d6f27234ff301972e90160d42db0c1b5b)
