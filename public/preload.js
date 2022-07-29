const { contextBridge } = require("electron");
const ldap = require( "ldapjs" );
const { generatePassword, fetchDino } = require( "./pswdgen" )
const { exec } = require('child_process');

const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

const crypto = require('crypto');

const algorithm = 'aes-256-ctr';
const secretKey = 'vOVH6sdmpNDjRRIqCc7rfxs03lwHzfr3'; // * Change this key before deploying.

const encrypt = (text) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return { iv: iv.toString('hex'), content: encrypted.toString('hex') };
};

const decrypt = (hash) => {
    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash.iv, 'hex'));
    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);
    return decrpyted.toString();
};

const print = {
  getPrinters : () => {
    return new Promise(function(resolve, reject) {
      if (process.platform!=="win32") return reject("Printing on this OS is not supported.");
      exec('Get-Printer | ConvertTo-Json', {'shell':'powershell.exe'}, (err, stdout, stderr)=> {
          if(err) reject(err);
          try {
            resolve( JSON.parse(stdout) )
          } catch(err) { reject(err); }
      })
    })
  },
  thermal : (name = "Disabled", change, options = {}, settings = {}) => {
    return new Promise(async function(resolve, reject) {
      if (!name || name==="Disabled") reject("No printer selected")
      console.log("Sending print job to interface:", name)
      let job = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: name,
        ...options
      });
      
      let txt = settings.PRINT_TEMPLATE.split("\n");
      if (change.forceChange) txt = settings.PRINT_TEMPLATE_F.split("\n");
      for (var i = 0; i < txt.length; i++){
        let text = txt[i].replace(/%username%/g, change.username);
        text = text.replace(/%password%/g, change.newPassword);
        const txtArray = text.split(" ");
        const a = txtArray[0]
        job.setTextSize(0,0);
        job.alignCenter();
        job.bold(false);
        job.upsideDown(false);
        job.invert(false);
        job.underline(false);
        if (a[0] !== "#"){ job.println(text); continue; }
        if ( a.search("c") >= 0 ){ job.cut(); continue; }
        const f = a.search("f");
        if (f >= 0){
          const textSize = parseInt(a[f+1]);
          job.setTextSize(textSize,textSize); // 0-7
        }
        if ( a.search("b") >= 0 ) job.bold(true);
        if ( a.search("u") >= 0 ) job.underline(true);
        if ( a.search("!") >= 0 ) job.invert(true);
        if ( a.search("<") >= 0 ) job.alignLeft();
        if ( a.search(">") >= 0 ) job.alignRight();
        job.println( txtArray.slice(1, txtArray.length).join(" ") );
      }
      try {
        let execute = job.execute()
        resolve(execute);
      } catch (err) { reject(err); }
    })
  }
}


function validString(str) { return str != null && typeof str === "string" && str.length > 0; }
const errorTypes = [
  "error",
  "connectRefused",
  "connectTimeout",
  "connectError",
  "setupError",
  "socketTimeout",
  "resultError",
  "timeout"
]
const LDAP = {
  formatURI : (URI) => {  if ( URI.search(":") < 0 ) URI = URI + ":389"; if ( URI.search("://") < 0 ) URI = "ldaps://" + URI; return URI; },
  connect : (URI, test = false) => {
    return new Promise(function(resolve, reject) {
      URI = LDAP.formatURI(URI);
      const tlsOptions = { 'rejectUnauthorized': false }
      const client = ldap.createClient({ url: [URI], tlsOptions })
      for (let i = 0; i < errorTypes.length; i++) {
        client.on(errorTypes[i], (err) => {
          console.error("LDAP:", errorTypes[i], err)
          return reject(err);
        })
      }
      client.on('connect', () => {
        if (!client.secure) return reject("Secure / SSL connection required (eg. ldaps:// & port 636).");
        if (test) client.unbind();
        return resolve(client);
      })
    })
  },
  login : (URI, username = '', password = '') => {
    return new Promise(function(resolve, reject) {
      LDAP.connect( URI ).then( ( client )=> {
        client.on('resultError', (err) => {
          console.error("LDAP:", 'resultError', err)
          if (String(err).search("InvalidCredentialsError") >= 0){ return reject("LDAP Username / Password incorrect"); }
          return reject(err);
        })
        client.bind(username, password, function (err, res) {
          if (err) { return reject( err ); }
          LDAP.search( client, '', {} ).then( ( entry )=> {
            if (!entry || !entry.object || !entry.object.namingContexts) return reject( "LDAP Failed to bind" );
            return resolve({
              client,
              dn : entry.object.namingContexts[0]
            });
          }).catch((err)=>{ return reject( err ); });
        });
      }).catch((err)=>{ return reject( err ); });
    })
  },
  search : (client, query = '', options = {}, limit = 0) => {
    return new Promise(function(resolve, reject) {
      client.search(query, {sizeLimit: limit, ...options}, (err, res) => {
        if (err) { return reject( err ); }
        res.on('searchEntry', (entry) => { return resolve(entry); });
        res.on('error', (err) => { return reject(err.message); });
        res.on('end', (err) => {
          if (err.status <= 0) return reject("User not found.");
          return reject(err);
        });
      });
    })
  }
}

function encodePassword(password) { return new Buffer('"' + password + '"', 'utf16le').toString(); }

const resetPassword = (settings = {}, username = '', forceChange = false) => {
  return new Promise(function(resolve, reject) {
    if (!validString(username)) return reject( "Invalid Username" );
    if (!validString(settings.LDAP_URI)) return reject( "Settings not configured" );
    if (!validString(settings.LDAP_AUTH_USER)) return reject( "Settings not configured" );
    if (!validString(settings.LDAP_AUTH_PASS)) return reject( "Settings not configured" );
    LDAP.login( LDAP.formatURI(settings.LDAP_URI), settings.LDAP_AUTH_USER, settings.LDAP_AUTH_PASS ).then( ( { client, dn } )=> {
      client.on('resultError', (err) => {
        console.error("LDAP:", 'resultError', err)
        if (String(err).search("InsufficientAccessRightsError") >= 0){ return reject(settings.LDAP_AUTH_USER + " is not authorised to modify passwords."); }
        if(err.code && err.code===53) { return reject("Length/Complexity/History requirements not met."); }
        if (String(err).search("UnwillingToPerformError") >= 0){ return reject("Failed to write password."); }
        return reject(String(err));
      })
      LDAP.search( client, dn, {
        filter: `(&(objectCategory=user)(sAMAccountName=${username}))`,
        attributes: ['dn'],
        scope: 'sub',
        paged: true,
        sizeLimit: 1000,
      } ).then( async ( entry )=> {
        if (!entry || !entry.object || !entry.object.dn) return reject( `LDAP Failed to load user` );
        const userDN = entry.object.dn;
        let newPassword;
        if (settings.PASS_DINO) {
          newPassword = await fetchDino(settings.PASS_DINO_STR, settings.PROXY);
        }else{
          newPassword = generatePassword();
        }
        const encodedPassword = encodePassword(newPassword);
        

        client.modify(userDN, [
					new ldap.Change({
						operation: 'replace',
						modification: { unicodePwd: encodedPassword }
					}),
					new ldap.Change({
						operation: 'replace',
						modification: { lockoutTime: 0 }
					}),
					new ldap.Change({
						operation: 'replace',
						modification: { pwdLastSet: (forceChange ? 0 : -1) }
					})
				], function(err) {
					if (err) {
						client.unbind();
            return reject( String(err) );
					}
					else {
            client.unbind();
            if(!settings.PRINTER){ resolve(newPassword); }
            if (settings.PRINTER.name !== "Disabled"){
              let name = settings.PRINTER.name;
              if ( settings.PRINTER.name.search("\\\\") < 0 ) name = "\\\\localhost\\"+settings.PRINTER.name;
              print.thermal(name, { newPassword, username, forceChange }, {}, settings)
              .then( ( jobID )=> {
                return resolve(newPassword, jobID);
              }).catch((err)=>{
                return reject( `Password set to ${newPassword} but failed to print (${String(err)}) ` );
              });
            } else {
              return resolve(newPassword);
            }
          }
				});

      }).catch((err)=>{ return reject( err ); });
    }).catch((err)=>{ return reject( err ); });
  })
}

const defaults = {
    LDAP_URI : '',
    LDAP_AUTH_USER : '',
    LDAP_AUTH_PASS : '',
    PRINTER : 'Disabled'
};

const config = {
  load : () => {
    return new Promise(function(resolve, reject) {
      try {
        const settings = JSON.parse(localStorage.getItem('settings') || JSON.stringify(defaults));
        if (settings.LDAP_AUTH_PASS) settings.LDAP_AUTH_PASS = decrypt(settings.LDAP_AUTH_PASS)
        resolve(settings);
      } catch (err) { reject(err); }
    })
  },
  save : (settings = {}) => {
    return new Promise(function(resolve, reject) {
      try {
        if (settings.LDAP_AUTH_PASS) settings.LDAP_AUTH_PASS = encrypt(settings.LDAP_AUTH_PASS)
        localStorage.setItem('settings', JSON.stringify(settings));
        resolve(settings);
      } catch (err) { reject(err); }
    });
  }
}

process.once("loaded", () => {
  let ver = 0;
  for (let i = 0; i < window.process.argv.length; i++) {
    if (window.process.argv[i].search(/\?appver/) < 0) continue;
    ver = window.process.argv[i].split("|")[1]
  }
  contextBridge.exposeInMainWorld("versions", process.versions);
  contextBridge.exposeInMainWorld("encryption", algorithm);
  contextBridge.exposeInMainWorld("version", ver);
  contextBridge.exposeInMainWorld("LDAP", LDAP);
  contextBridge.exposeInMainWorld("printer", print);
  contextBridge.exposeInMainWorld("config", config);
  contextBridge.exposeInMainWorld("encrypt", encrypt);
  contextBridge.exposeInMainWorld("resetPassword", resetPassword);
  contextBridge.exposeInMainWorld("generatePassword", generatePassword);
  contextBridge.exposeInMainWorld("fetchDino", fetchDino);
});