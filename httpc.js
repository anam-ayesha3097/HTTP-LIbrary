// TODO: Help command for instructions

"use strict";

const net = require("net");
const http = require("http");
const yargs = require("yargs");

const argv = yargs
  .usage(
    "\nhttpc is a curl-like application but supports HTTP protocol only. \n\nUsage: \nnode httpc.js command [arguments]"
  )
  .epilog(
    `Use "node httpc help [command]" for more information about a command.`
  )
  .default("host", "localhost")
  .default("port", 3000)
  .command("help", "", function ({ argv }) {
    if (argv._.length === 1) {
      console.log(`
      
      httpc is a curl-like application but supports HTTP protocol only. 
      
      Usage:     
        httpc command [arguments] 
      
      The commands are:    
        get     executes a HTTP GET request and prints the response.     
        post    executes a HTTP POST request and prints the response.     
        help    prints this screen.  
       
      Use "httpc help [command]" for more information about a command.
`);

    }

    if (argv._[1].toUpperCase() === "POST") {
      console.log(`
      usage: httpc post [-v] [-h key:value] [-d inline-data] [-f file] URL
      
      Post executes a HTTP POST request for a given URL with inline data or from file.
      -v    Prints the detail of the response such as protocol, status, and headers.
      -h    key:value   Associates headers to HTTP Request with the format 'key:value'.
      -d    string      Associates an inline data to the body HTTP POST request.
      -f    file        Associates the content of a file to the body HTTP POST request.
      
      Either [-d] or [-f] can be used but not both. 
      `);
    } else if (argv._[1].toUpperCase() === "GET") {
      console.log(`
      usage: httpc get [-v] [-h key:value] URL
      
      Get executes a HTTP GET request for a given URL.
      -v    Prints the detail of the response such as protocol, status, and headers.
      -h    key:value   Associates headers to HTTP Request with the format 'key:value'.
      `);
    } else {
      console.log(`No instructions found for '${argv._[1]}'`);
    }

    process.exit(1);
  })
  .options({
    X: {
      alias: "method",
      describe: "HTTP method used to send request",
      default: "GET",
    },
    V: {
      alias: "version",
      describe: "httpc version used for curl request",
    },
    d: {
      alias: "data",
      describe: "HTTP POST data",
      type: "string",
    },
    H: {
      alias: "header",
      describe: "Headers sent over the HTTP request"
    },
    v: {
      alias: "verbose",
      describe: "Make the operation more talkative",
      type: "boolean",
    },
    f: {
      alias: "file",
      describe: "Absolute file location of data to be sent over request",
      type: "string",
    },
    o: {
      describe: "Output file name for storing post requests",
      type: "string",
    },
    w :{ 
      describe: "Write contents to the file",
      type: "boolean"
    }
  })
  .help("help").argv;

const client = net.createConnection({ host: argv.host, port: argv.port });

client.on("connect", async () => {

  if (argv._.length === 0 && argv.f && !argv.w) {
    console.log(argv);
    //reading the file
    const fs = require("fs");
    try {
      const fileContent = fs.readFileSync(argv.f).toString("utf-8");
      console.log(fileContent);
      
    } catch (err) {
      console.log("Error while reading file: " + err.message);
    }
    process.exit(1);
  }
  else if(argv._.length === 0 && argv.w) {
    const fs = require("fs");
    fs.writeFileSync(argv.f, argv.d);
    process.exit(1);
  }


  if (argv.V) {
    console.log(`httpc 0.0.1\nBeta-Release: 2023-10-01\nProtocols: http`);
    process.exit(1);
  }

  try {
    let url = {};
    const url_index = argv._.length > 1 ? 1 : 0;

    if (url_index === 1) {
      argv.X = argv._[0].toUpperCase();
      argv.method = argv._[0].toUpperCase();
    }

    if (net.isIP(argv._[url_index].split(":")[0])) {
      const address = argv._[url_index].split(":")[0];
      const port = argv._[url_index].split(":")[1]
        ? argv._[url_index].split(":")[1]
        : "80";
      const path = argv._[url_index].split("/")[1]
        ? argv._[url_index].split("/")[1]
        : "/";

      if (argv.v) console.log("Parsing IP");
      url.host = address;
      url.port = port;
      url.pathname = path;
      url.search = "";
    } else {
      if (argv.v) console.log("Parsing URL");
      url = new URL(argv._[url_index]);
    }

    const options = {
      host: url.host,
      port: url.port,
      path: url.pathname + url.search,
      method: argv.X.toUpperCase() || argv._[0].toUpperCase(), // fail-safe as X will be defined at all times and if not, url index will be 0,
      storeData: argv.o || false,
    };


    if (argv.X === "GET") {
      options.sendData = false;

      if (argv.H) {
        options["headers"] = parseOptions(argv.H, ":");
      }

      await http_listeners_wrapper(options);
      process.exit(1);
    } else if (argv.X === "POST") {
      options.sendData = argv.f || argv.d;

      if (argv.H) {
        options["headers"] = parseOptions(argv.H, ":");
      }
      await http_listeners_wrapper(options);
      process.exit(1);
    }
  } catch (err) {
    console.log(err);
  }
});

client.on("error", (err) => {
  console.log("socket error %j", err);
  process.exit(-1);
});

/* Helpers */

const http_listeners_wrapper = (options, maxRedirects = 10) => {
  return new Promise((resolve, reject) => {
    let redirects = 0;
    const http_listeners = (options) => {
      const req = http.request(options, (res) => {
        let chunk = "";
        res.setEncoding("utf-8");

        res.on("data", (data) => {
          chunk += data;
        });

        res.on("end", () => {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            data: chunk,
          };

          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            try {
              if (redirects < maxRedirects) {
                const redirectURL = new URL(res.headers.location);
                redirects++;
                if (argv.v) console.log("Redirecting to " + redirectURL.host);
                const new_options = {
                  ...options,
                  host: redirectURL.host,
                  port: redirectURL.port,
                  path: redirectURL.pathname + redirectURL.search,
                  method: argv.X.toUpperCase() || argv._[0].toUpperCase(), // fail-safe as X will be defined at all times and if not, url index will be 0
                };
                // req.destroy();
                http_listeners(new_options);
                // r.end();
              } else {
                reject("Too many redirects");
              }
            } catch (err) {
              console.log("Error parsing response url: " + err);
            }
          } else {
            if (argv.v) {
              console.log(
                `* Trying to connect to: ${res.socket.remoteAddress}`
              );
              console.log(
                `* Connected to ${options.host} (${res.socket.remoteAddress}) port ${res.socket.remotePort} #${redirects}`
              );
              console.log(
                `> ${options.method} ${options.path} HTTP/${res.httpVersion}`
              );
              console.log(`> Host: ${options.host}`);
              console.log(`> User-Agent: httpc/0.0.1`);
              console.log(`> Accept: */*`);
              console.log(`> `);
              console.log(
                `< HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}`
              );
              for (const key in res.headers)
                console.log(`< ${key}: ${res.headers[key]}`);
              console.log(`< `);
            }

            console.log(chunk);

            if (options.storeData) {
              const fs = require("fs");
              fs.writeFileSync(options.storeData, chunk);
            }

            resolve(response);
          }
        });

        res.on("error", (err) => {
          reject("Response error: " + err.message);
        });
      });

      req.on("error", (err) => {
        reject("Request error: " + err.message);
      });

      if (options.sendData) {
        if (argv.f) {
          const fs = require("fs");
          try {
            const fileContent = fs.readFileSync(argv.f).toString("utf-8");
            req.write(fileContent);
          } catch (err) {
            console.log("Error while reading file: " + err.message);
          }
        } else if (argv.d) {
          let opt = parseOptions(argv.d, "=", true);
          if (!opt)
            opt = parseOptions(argv.d, ":", true);
          req.write(JSON.stringify(opt));
        }
      }

      req.end();
    };

    http_listeners(options);
  });
};

const parseOptions = (headers, separator, parseData = false) => {
  try {
    if (headers.sendData || parseData) {
      return JSON.parse(argv.d);
    }
  } catch (err) {
    if (argv.v)
      console.log(
        "Provided string is not an object. Attempting to parse as key value - " +
        err
      );
  }

  const obj = {};
  if (headers instanceof Array) {
    for (const s of headers) {
      const key_value = s.split(separator);
      obj[key_value[0]] = key_value[1];
    }
    return obj;
  } else {
    const key_value = headers.split(separator);
    obj[key_value[0]] = key_value[1];
    return obj;
  }
};
