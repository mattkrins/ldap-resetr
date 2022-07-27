![ldap-resetr logo](https://github.com/mattkrins/ldap-resetr/blob/main/public/logo192.png?raw=true)
# ldap-resetr

A simple tool to reset/generate a random password for an ldap user and print to a thermal receipt printer.

Built using Electron and React.
Printing is only supported on windows currently (powershell needed to find printers), however adapting the code base for Unix should be relatively simple if required.

![ldap-resetr_0GXj9LYXsL](https://user-images.githubusercontent.com/2367602/181135227-ba5d34c4-3c2f-48ac-8cc0-86dadcb3a12a.png)

## Installation
Clone / download repository and in the root folder run:
```bash
$ npm install
```
Change the `secretKey` variable in public/preload.js

## Configuration
Application settings are available via the cog icon in the top left corner:

### Application Theme
Switch between light and dark mode themes. Application restart is required to apply.
### LDAP URI
This is the host / target LDAP server. A secure / SSL connection is required to make changes to passwords so you likely want to use port 636 and protocol ldaps://.
### LDAP Login
Username / Password to authenticate with the host / target LDAP server. Username must be prefixed by the target domain or an LDAP distinguished name (DN), eg. cn=John,ou=Users,dc=com,dc=domain
### Auto-Print
Select a thermal printer to print the newly generated password on. (currently windows only)
**Note**: To use a locally connected printer (not networked) you will need to share the local printer under the same name so it can be accessed via \\\\localhost\\PrinterName.

## Available Scripts

In the project directory, you can run:

### `electron:start`

Runs the app in the development mode.
The app will reload when you make changes in Electron or React.
You may also see any lint errors in the console.

### `electron:package:platform`

Example: `electron:package:win`

Builds an executable for production to the `dist` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.
The build is minified and the filenames include the hashes.

Standard Electron and React scripts available (electron, build, etc.)