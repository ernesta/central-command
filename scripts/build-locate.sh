#!/bin/sh
# Builds the helper that asks macOS Location Services for this Mac's position (native/locate.swift) as the background app
# resources/Locate.app (macOS only asks for the location permission of an app bundle), for this Mac's architecture
# (`electron-builder --mac` builds for it too). Needs the Xcode command line tools; elsewhere it does nothing.
set -e
[ "$(uname)" = "Darwin" ] || exit 0
cd "$(dirname "$0")/.."
app=resources/Locate.app
rm -rf "$app" resources/locate
mkdir -p "$app/Contents/MacOS"
cp native/locate-Info.plist "$app/Contents/Info.plist"
swiftc -O native/locate.swift -target "$(uname -m)-apple-macos12.0" -o "$app/Contents/MacOS/locate"
codesign --force --sign - "$app"
echo "built $app"
