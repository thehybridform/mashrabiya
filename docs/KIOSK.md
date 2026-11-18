# Raspberry Pi 5 kiosk

How to turn a Raspberry Pi 5 into the thing that shows the card: boots headless, signs in to Home
Assistant as its own limited user, runs Chromium full screen, rotated to portrait, with the pointer
hidden and an optional USB infrared touch frame mapped to the screen.

This is the recipe the reference build used. Commands assume Raspberry Pi OS (Trixie, 64-bit,
the Wayland `labwc` desktop). Replace the placeholders:

| Placeholder | Meaning |
|---|---|
| `kiosk` | The Linux user on the Pi (`/home/kiosk`) |
| `PI_HOST` | The Pi's network name: `mashrabiya.local` with the `hostname: mashrabiya` below (mDNS via avahi) |
| `HA_URL` | Your Home Assistant URL, for example `http://homeassistant.local:8123` |
| `HDMI-A-1` | The output name your monitor uses (see `wlr-randr`) |

## 1. First boot, headless, with cloud-init

Raspberry Pi OS Trixie configures a fresh image from three files on the boot partition (`bootfs`),
read by cloud-init on the first boot: `user-data`, `network-config` and `meta-data`. Write the card
with Raspberry Pi Imager, edit the files while the card is still in your computer, then boot.

**The format matters.** The first attempt in the reference build used a plural `users:` list, a
hashed hex Wi-Fi key and only an `instance_id`. It booted to the welcome wizard and never joined Wi-Fi.
What worked was copying the shape Raspberry Pi Imager itself writes: singular `user:`, a plain quoted
Wi-Fi `password:`, the regulatory domain, and a new `instance-id`. When in doubt, generate a reference
card with Imager's OS customisation and compare your files with it.

`user-data`:

```yaml
#cloud-config
hostname: mashrabiya
manage_etc_hosts: true
packages:
  - avahi-daemon
enable_ssh: true
ssh_pwauth: false
user:
  name: kiosk
  groups: users,adm,dialout,audio,netdev,video,plugdev,cdrom,games,input,gpio,spi,i2c,render,sudo
  shell: /bin/bash
  lock_passwd: true
  sudo: ALL=(ALL) NOPASSWD:ALL
  ssh_authorized_keys:
    - ssh-ed25519 AAAA... you@your-computer
timezone: Europe/London
keyboard:
  model: pc105
  layout: gb
```

`network-config` (Ethernet and Wi-Fi; the passphrase is a plain quoted string, not a hex key):

```yaml
network:
  version: 2
  renderer: NetworkManager
  ethernets:
    eth0:
      dhcp4: true
      optional: true
  wifis:
    renderer: NetworkManager
    wlan0:
      dhcp4: true
      optional: true
      access-points:
        "Your Network Name":
          password: "your wifi passphrase"
      regulatory-domain: "GB"
```

`meta-data`:

```yaml
instance-id: mashrabiya-20260101-1
```

Use a **new `instance-id` every time you change the files**: cloud-init runs once per instance id and
silently skips the configuration if it has seen the id before.

Also set the Wi-Fi regulatory domain on the kernel command line: append
`cfg80211.ieee80211_regdom=GB` (your country code) to the single line in `cmdline.txt`, keeping it one line.

Put the card in the Pi, power on, wait a few minutes, then `ssh kiosk@PI_HOST`. If the Pi
instead shows a welcome wizard, cloud-init did not apply: recheck the format above and the
`instance-id`.

## 2. Update the system

```sh
sudo apt update
apt list --upgradable 2>/dev/null | grep -vc Listing
sudo apt full-upgrade -y
sudo reboot
```

**Re-check the upgradable count** before calling the Pi current. `apt update` can fail to fetch some
package indexes and still finish ("Some index files failed to download"), in which case the upgradable
count is 0 because apt does not know about anything newer. If you see that message, or the count is
0 on a brand-new image, run `sudo apt update` again until it is clean and count again.

A Pi 5 that is not powered by a 5 V / 5 A supply limits USB current. If the touch frame or other USB
devices draw from the Pi, add this line to `/boot/firmware/config.txt` and reboot:

```
usb_max_current_enable=1
```

## 3. A limited Home Assistant user for the kiosk

In Home Assistant, Settings, People, Users, create a user for the mirror: **not an administrator**,
"Can only log in from the local network" on. Sign in once on the Pi's browser to save the session.
A kiosk is a device people walk up to; if it is ever compromised the damage is limited to what that
user may do. Typing a password on a touchscreen that has no keyboard is awkward: sign in from another
computer over a temporary remote session (for example a VNC server bound to `127.0.0.1` and reached
through an SSH tunnel), then remove it.

## 4. Chromium kiosk under labwc

labwc runs `~/.config/labwc/autostart` at login. Create it:

```sh
mkdir -p ~/.config/labwc
cat > ~/.config/labwc/autostart <<'EOF'
lwrespawn chromium \
  --kiosk \
  --force-device-scale-factor=0.75 \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --password-store=basic \
  --ozone-platform=wayland \
  --disable-session-crashed-bubble \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  HA_URL/mirror-dash/mirror &
EOF
```

(Replace `HA_URL/mirror-dash/mirror` with your dashboard's address.) What the flags do:

| Flag | Why |
|---|---|
| `--kiosk` | Full screen, no browser chrome |
| `--force-device-scale-factor=0.75` | The card is sized in millimetres; see [Scale factor](#scale-factor) |
| `--disable-pinch`, `--overscroll-history-navigation=0` | Two fingers on the glass must not zoom, and a long swipe must not navigate back |
| `--noerrdialogs`, `--disable-infobars`, `--no-first-run`, `--disable-session-crashed-bubble` | Nothing may pop up in front of the display, including after a power cut |
| `--password-store=basic` | No keyring prompt on a headless session |
| `--ozone-platform=wayland` | Native Wayland rendering |
| `--autoplay-policy=no-user-gesture-required` | Allows sounds without a first tap |
| `--check-for-update-interval=31536000` | Do not nag about browser updates (a year, in seconds) |

`lwrespawn` is labwc's helper that restarts a program when it exits, so a Chromium crash recovers by
itself.

### Scale factor

The card measures in physical millimetres: it assumes **one CSS pixel is 0.236 mm** (`--mm` is
4.235 px). Chromium's scale factor makes that true for your panel. For a monitor with `W` pixels
across the visible width in portrait and a visible width of `w` millimetres:

```
scale = W / (w * 4.235)
```

The reference build, a 27 inch 1920x1080 panel turned to portrait (about 336 mm across the short
side), uses 0.75 and ends up with 1440x2560 CSS pixels. If text looks too big or too small on your
panel, change the number: larger scale, larger everything.

### Restarting the kiosk

```sh
sudo systemctl restart lightdm
```

Do not stop it with `pkill -f "chromium.*--kiosk"`: the pattern also matches the `lwrespawn` wrapper
(its command line contains the same text), so the respawner dies with the browser and nothing comes
back until the next login. Restarting the display manager restarts the whole session cleanly.

## 5. Portrait rotation

labwc uses `kanshi` for output configuration. `~/.config/kanshi/config`:

```
profile {
  output HDMI-A-1 transform 90
}
```

`transform 90` is a quarter turn; use `270` if the monitor is turned the other way. Restart the
session to apply it. Find the output name with `wlr-randr`.

## 6. Hide the pointer

A touch kiosk should not show a mouse cursor. Make a cursor theme whose pointer is one transparent
pixel. This needs `xcursorgen`, from the `x11-apps` package:

```sh
sudo apt install -y x11-apps
mkdir -p ~/.local/share/icons/blank/cursors && cd ~/.local/share/icons/blank
python3 - <<'EOF'
import struct, zlib
def chunk(t, d):
    c = struct.pack(">I", len(d)) + t + d
    return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
png = (b"\x89PNG\r\n\x1a\n"
       + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(b"\x00\x00\x00\x00\x00"))
       + chunk(b"IEND", b""))
open("blank.png", "wb").write(png)
EOF
echo "1 0 0 blank.png" > blank.cfg
xcursorgen blank.cfg cursors/left_ptr
for n in default arrow pointer text hand2 xterm watch; do ln -sf left_ptr cursors/$n; done
printf '[Icon Theme]\nName=blank\n' > index.theme
```

Then tell labwc to use it, in `~/.config/labwc/environment`:

```
XCURSOR_THEME=blank
XCURSOR_SIZE=24
```

and restart the session.

## 7. USB infrared touch frame

A USB IR touch frame (see [HARDWARE.md](HARDWARE.md)) shows up as a standard HID multitouch
device, so no driver is needed. Two things need configuring in `~/.config/labwc/rc.xml`: which
output the touches belong to, and, because the display is rotated, how the touch coordinates map to
it.

> **Warning: an unmounted frame is live.** The frame reports touches whether or not it is in front
> of the screen. Handling it on a table, leaning it against something, or a sleeve brushing its
> border presses whatever button is under that spot on the display. In the reference build, moving
> the frame around before it was mounted pressed Leaving, which locked the doors, turned off the
> lights and changed the thermostat. Until it is mounted, disable touch (below), or do all handling
> with the display showing something harmless, such as a test page.

### 7a. Find the device

```sh
sudo apt install -y evtest
sudo evtest          # lists input devices; pick the frame, then touch it and watch events
```

The frame usually appears twice: a touch interface and a mouse interface. Note the touch device's
name (for example `Vendor MultiTouch Frame 50`). `libinput list-devices` shows the same names.

### 7b. Map it to the screen

`~/.config/labwc/rc.xml`. Raspberry Pi OS (Trixie) starts the session as `labwc -m` (confirm with
`ps -eo args | grep labwc`), which merges your file over the system `/etc/xdg/labwc/rc.xml`, so you
only write what you change. Without `-m`, your file replaces the system one entirely:

```xml
<?xml version="1.0"?>
<labwc_config>
  <touch deviceName="Vendor MultiTouch Frame 50" mapToOutput="HDMI-A-1" mouseEmulation="no"/>
  <libinput>
    <device category="touch">
      <calibrationMatrix>0 1 0 -1 0 1</calibrationMatrix>
    </device>
  </libinput>
</labwc_config>
```

- `mapToOutput` ties touches to the monitor; `mouseEmulation="no"` makes touches arrive as touch
  events, which the card handles directly.
- The calibration matrix must sit under `<device category="touch">`. **A device name used as the
  `category` is silently ignored in labwc 0.20**: no error, no effect, and the touches simply come in
  rotated wrong. `category="touch"` applies to all touch devices.
- To keep touch off until the frame is mounted, add `<sendEventsMode>no</sendEventsMode>` inside
  the same `<device>` element, and remove it when you are ready.

Restart the session after each change.

### 7c. Find the rotation matrix empirically

`calibrationMatrix` is six numbers `a b c d e f`, applied to touch positions normalised to 0..1:

```
x' = a*x + b*y + c
y' = d*x + e*y + f
```

For the four ways the display can be turned, the standard matrices are:

| Display turned | Matrix |
|---|---|
| Not rotated | `1 0 0 0 1 0` |
| 90 degrees clockwise | `0 -1 1 1 0 0` |
| 180 degrees | `-1 0 1 0 -1 1` |
| 270 degrees clockwise | `0 1 0 -1 0 1` |

Which one you need depends on how the frame is physically oriented as well as how the monitor is, so
**find it by trying**. Put a harmless page on the display, then with one finger tap along the *top
edge* from left to right and watch where the touch lands:

- It lands along the top edge, left to right: the matrix is right.
- It lands down the left or right edge: the rotation is a quarter turn off; try the 90 and 270 matrices.
- It lands along the top edge but right to left, or along the bottom edge: it is half a turn off; try
  the 180 degree matrix.

Two or three tries find it. Then tap the four corners to confirm.

### 7d. Scale and offset when the frame is larger than the screen

Usually the frame's touch area is bigger than the visible screen (the frame is the border of a sheet of
glass, the monitor sits behind part of it). Then the screen covers only a fraction of the touch range
and every tap lands in the wrong place, more so towards the far edges.

Measure, in the touch frame's own coordinates *after* the rotation above, where the screen sits: its
left edge `ox` and top edge `oy`, and its width `sw` and height `sh`, all as fractions of the frame's
touch area (0..1). Define:

```
a = 1/sw    c = -ox/sw        (horizontal)
e = 1/sh    f = -oy/sh        (vertical)
```

and apply them *after* the rotation. If the rotation matrix is `r1 r2 r3 r4 r5 r6`, the combined
matrix is:

```
a*r1   a*r2   a*r3 + c      e*r4   e*r5   e*r6 + f
```

Worked example (numbers for illustration only): rotation `0 1 0 -1 0 1`; the screen spans 5 % to
95 % of the width (`ox` 0.05, `sw` 0.90) and 30 % to 90 % of the height (`oy` 0.30, `sh` 0.60). Then
`a` is 1.111, `c` is -0.0556, `e` is 1.667, `f` is -0.5, and the combined matrix is:

```
0 1.111 -0.056   -1.667 0 1.167
```

To measure `ox`, `oy`, `sw` and `sh`, tap the four corners of the screen with the plain rotation
matrix in place and read the raw positions (a test page that prints touch coordinates as fractions of
the window works well), or adjust the numbers by eye until taps land under the finger at the corners
and in the middle.

## Safe shutdown before unplugging

A Pi running from an SD card can corrupt it if power is cut while it writes. Before unplugging, or
before anything that cuts the supply:

```sh
sudo shutdown -h now
```

and wait until the green activity light stops flashing. If the mirror's power can be switched from Home
Assistant (a smart plug), shut the Pi down first, give it half a minute, then switch it off.

## Screenshots with grim

From an SSH session, capture what the display shows:

```sh
XDG_RUNTIME_DIR=/run/user/$(id -u) WAYLAND_DISPLAY=wayland-0 grim -s 0.5 /tmp/shot.png
scp kiosk@PI_HOST:/tmp/shot.png .
```

`-s 0.5` halves the size; leave it out for full resolution. Install with `sudo apt install grim`.

## Frame-rate meter

Add `?fps=1` to the dashboard URL in the autostart (for example `HA_URL/mirror-dash/mirror?fps=1`) and
restart the session, or set `debug_fps: true` in the card config. The top right shows frames drawn in
the last second and the longest gap between frames in the last five seconds. Remove it when you are
done measuring.
