# DataTech Thermal Compensation

Offline-capable installable web application for Windows, built around the
thermal-compensation calculations shared with this project.

## Run on Windows

1. Install Node.js 18 or later.
2. Open this folder in a terminal and run `npm start`.
3. Keep the terminal window open and open `http://localhost:4173` in
   Microsoft Edge.
4. In Edge, open **Settings and more (…) → Apps → Install this site as an app**.
   The installed app opens in its own window. After the first successful load,
   calculations remain available offline.

In GitHub Codespaces, start the server with `npm start`, then open the **Ports**
panel and use **Open in Browser** for port `4173`. A `*.localhost` address on
your computer points to your computer, not the Codespace.

You can also host the static app files on an HTTPS web server and install that
URL from Edge. HTTPS is required for service-worker installation on hosted sites;
`localhost` is treated as a secure origin for local use.

## Permanent online address

The site can be published with GitHub Pages from this repository. After the
Pages deployment workflow completes, open:

`https://master2measure1981-png.github.io/datatech-thermal-compensation/`

## Build standalone Windows apps

The Electron desktop wrapper runs the app and its local server together, so
users do not need Node.js installed. To build on a Windows x64 machine, use
Node.js 22.12 or later:

1. Install Node.js 18 or later.
2. From this folder, run `npm ci`.
3. Run `npm run desktop` to launch the desktop app for testing.
4. Run `npm run dist:win` to create both a Windows setup installer and a
   portable `.exe` in `dist/`.

The installer is interactive and can create Start Menu and desktop shortcuts.
The portable executable can be run without installing. Windows code signing is
not configured; Windows may show its standard publisher warning for unsigned
builds. To distribute broadly, sign the installer and executable with your
organization's trusted code-signing certificate.

## Included calculations

- **Direct measurement:** corrects a measured length to the selected reference
  temperature and propagates independent standard uncertainties.
- **Comparator:** uses the signed difference `part − master` and corrects for
  both master and workpiece temperatures.
- **Tolerance decision:** compares the expanded uncertainty interval with the
  entered specification limits, returning PASS, FAIL, or INDETERMINATE.
- **Length units:** switch between millimeters and inches. Length inputs,
  uncertainties, tolerance limits, and results convert together; temperatures
  and CTE values remain in their stated units.

Built-in approximate CTE values can be selected by material. Choose **Custom
CTE** to enter a material-specific value. Uncertainty inputs are standard
uncertainties (approximately 1σ); the default coverage factor is `k = 2`.

## Validation

Run the calculation regression tests with:

```sh
npm test
```

## Metrology limitations

The model assumes linear thermal expansion over the entered temperature range.
Uncertainty inputs are treated as independent, and covariance is not modeled.
The tolerance result follows an uncertainty guard-band rule; confirm the
applicable CTE data and decision rule against the governing customer or
contractual standard before using results for acceptance decisions.
