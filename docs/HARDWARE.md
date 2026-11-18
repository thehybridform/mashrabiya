# Hardware

What to look for when buying the parts. Vendor-neutral on purpose: specifications change faster than
product names do, so this lists what matters and why. Check every part against the others before you
order anything that cannot be returned (the glass in particular cannot be cut after it is made).

## The shape of the build

From the viewer's side: **touch frame** (optional) in front of the **two-way glass**, in front of
the **monitor**, with a **Raspberry Pi 5** behind it. The glass is the part everyone sees, so
everything else exists to be invisible while the screen is dark.

## Two-way glass

A two-way (one-way) mirror reflects part of the light and passes part. When the room is brighter
than the display behind it, you see a mirror; where the display is lit, you see the display.

- **Reflectivity / transmission.** A split around 40 % reflective and 60 % transmissive is a good start
  for a monitor of ordinary brightness (about 300 nit): it still looks like a mirror and still lets the
  screen through. More reflective looks better as a mirror and dims the display more. Ask the supplier
  for a **sample in the mix you are considering**, hold it in front of your monitor in the room it will
  live in, and decide then.
- **Dielectric coatings** generally pass more light for a given reflectivity than metallic ones. Ask.
- **Tempered (safety) glass** is the right choice for anything that may be touched or that hangs on a
  door; acrylic scratches. Tempered glass **cannot be cut or drilled after tempering**: order the exact
  size, with any notches, and with the coating already applied.
- **Thickness** around 6 mm balances weight and rigidity. Glass at that size is heavy (several
  kilograms); size the mounting for it.
- Which face is the mirror: confirm the coated side faces the viewer.
- A film on the back (safety film) keeps a break in one piece.

## Monitor

- **Brightness.** The glass costs you most of the light, so brighter is better: 300 nit is workable,
  more is easier. The card uses saturated colours on black to cope.
- **Panel type.** An IPS panel keeps its colour and contrast from the side, which matters because
  viewers are rarely centred. Avoid panels with strong off-axis colour shift.
- **Native black.** Look for a good black level; a monitor that glows when "black" shows through the
  glass as a grey haze.
- **Portrait.** The monitor will be turned on its side. Check that it works rotated (the Pi rotates the
  image, so any monitor does) and that its stand-less depth and ventilation are acceptable that way.
- **Mounting.** VESA holes make it easy to hold the screen firmly against the glass. Some monitors have
  no VESA holes: check the back of the actual model, and plan a cleat or an adapter if it has none.
- **Thickness.** A thin monitor keeps the whole assembly shallow, which matters on a door or a narrow
  wall.
- **Power.** An *external* power brick can be replaced by a DC supply of your choosing; internal-supply
  monitors need mains inside the box. Decide which you want before choosing.
- **Speakers and other features** are irrelevant behind glass; fewer is fine.

## Touch frame (optional)

An infrared touch frame is a bezel of emitters and sensors you mount in front of the glass; touches are
detected by interrupted light beams, so it works through any glass and coating.

- **Interface.** USB with HID **multitouch**. It should appear to Linux as a standard touch
  device with no driver. Confirm with the seller that Linux or Raspberry Pi is supported (some listings
  say not), and test it on the Pi before building the rest around it.
- **Size versus screen.** The frame is usually *bigger* than the monitor: it becomes the border of the
  glass, and the screen covers part of the touch area. Taps outside the screen do nothing, which is
  convenient (the lower half of the mirror can be plain mirror). It also means the touch area must be
  mapped to the screen ([KIOSK.md](KIOSK.md#7d-scale-and-offset-when-the-frame-is-larger-than-the-screen)).
  Measure the frame's outer size and its opening on arrival, *before* ordering glass cut to it.
- **Points.** Ten simultaneous touches is more than enough. The card needs one.
- **Thickness.** A frame raises a lip from the glass face by a few millimetres; that is the price of
  it working through the glass.
- **Palms and sleeves register.** That is a property of the technology: keep the interface's targets
  away from the edges (the card does) and mind the warning about unmounted frames in
  [KIOSK.md](KIOSK.md#7-usb-infrared-touch-frame).
- **Alternatives.** Capacitive foil behind the glass is flush, but is more expensive at large sizes and
  can be unreliable through mirror coatings. A smaller panel with a built-in touch screen is the
  simplest route if you can accept a smaller display.

## Raspberry Pi 5 and cooling

- **Pi 5, 4 GB or 8 GB.** Rendering a full-screen Chromium page with animation is comfortable on a Pi 5;
  older boards struggle.
- **Cooling.** The official active cooler (or equivalent) keeps it from throttling in a closed box. A
  display enclosure is warm: leave vent gaps top and bottom.
- **Power.** The official 5 V / 5 A (27 W) USB-C supply gives the board full USB current. If you power
  it from a DC converter, choose 5 V at 5 A. With any lower-current supply, the Pi limits USB current,
  which matters when the touch frame is powered from it (see
  [KIOSK.md](KIOSK.md#2-update-the-system) for `usb_max_current_enable`).
- **Storage.** A good-quality microSD card, or an NVMe drive on a HAT. Always shut the Pi down before
  cutting power ([KIOSK.md](KIOSK.md#safe-shutdown-before-unplugging)).
- **Video.** The Pi 5 outputs through micro-HDMI: buy a micro-HDMI to HDMI cable of the right length,
  right-angled if the box is shallow.
- **Network.** Built-in Wi-Fi is enough for the card; wired Ethernet is more reliable if you can run it.
- **USB.** Put the touch frame on a USB 2 port: busy USB 3 devices can disturb 2.4 GHz Wi-Fi.

## Other things worth planning

- **Power to the display.** A single supply feeding monitor, Pi and frame keeps the installation tidy;
  across a moving joint such as a door hinge, use low voltage only and fuse it.
- **A way to switch it all off** from Home Assistant (a smart plug on the supply) lets you recover a
  frozen Pi without opening the box.
- **Sensors for waking the display** (a presence radar, a light sensor) are independent of the card;
  the card does not control screen power. Use Home Assistant automations.
