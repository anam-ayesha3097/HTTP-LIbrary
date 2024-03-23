const net = require("net");
const path = require("path");
const yargs = require("yargs");
const dns = require("dns");

const argv = yargs
  .usage(`\n httpfs is a simple file server.`)
  .epilog(
    `Use "node httpfs help [command]" for more information about a command.`
  )
  .default("host", "localhost")
  .default("port", 3000)
  .command("help", "", function ({ argv }) {
    if (argv._.length === 1) {
      console.log(`
                  
                  httfs is a simple file server application. 
                  
                  Usage:     
                    httpfs [-v] [-p PORT] [-d PATH-TO-DIR]
                  
                  The commands are:    
                    get     executes a HTTP GET request and prints the response.     
                    post    executes a HTTP POST request and prints the response.     
                    help    prints this screen.  
                   
                  Use "httfs help [command]" for more information about a command.
            `);
    }

    if (argv._[1].toUpperCase() === "POST") {
      console.log(`
              usage: httpc post [-v] [-d inline-data] [-f file] URL
              
              Post executes a HTTP POST request for a given URL with inline data or from file.
              -v    Prints the detail of the response such as protocol, status, and headers.
              -d    string      Associates an inline data to the body HTTP POST request.
              -f    file        Associates the content of a file to the body HTTP POST request.
              `);
    } else if (argv._[1].toUpperCase() === "GET") {
      console.log(`
              usage: httpc get [-v] [-h key:value] URL
              
              Get executes a HTTP GET request for a given URL.
              -v    Prints the detail of the response such as protocol, status, and headers.
              -f    file        Associates the content of a file to the body HTTP POST request.
              `);
    } else {
      console.log(`No instructions found for '${argv._[1]}'`);
    }
  })
  .options({
    d: {
      alias: "data",
      describe: "Enable POST data",
      type: "string",
    },
    f: {
      alias: "file",
      describe: "Absolute file location of data to be sent over request",
      type: "string",
    },
    p: {
      alias: "port",
      describe: "Specifies the port number. Default is 3000",
      type: "string",
    },
    o: {
      alias: "overwrite",
      describe: "Enable or disable overwriting a file",
      type: "boolean",
    },
    v: {
      alias: "verbose",
      describe: "Make the operation more talkative",
      type: "boolean",
    },
    h: {
      alias: "header",
      describe: "Headers sent over the HTTP request",
    },
  })
  .help("help").argv;
let client;
try {
  client = net
    .createConnection({ host: argv.host, port: argv.port })
    .on("error", () => {
      console.log("HTTP 1.1 500 \n Internal Server Error");
    });

  let response = [];
  client
    .on("connect", async () => {
      try {
        const options = {};
        console.log(`Connected to server at ${argv.host}:${argv.port}`);

        const programName = path.basename(process.argv[1]); //Get program name

        if (argv._.length === 0) {
          console.log("No arguments provided. Exiting.");
          process.exit(1);
        }

        if (argv.h) {
          options["headers"] = parseOptions(argv.h, ":");
          // options["headers"] = options["headers"].join(";");
        }

        if (argv._[0].toUpperCase() === "GET") {
          // Handle GET requests
          const jsonRequest = createJSONRequest(
            argv,
            "GET",
            argv.f || argv._[1] || "/",
            null,
            null,
            options
          );
          client.write(jsonRequest);
        } else if (argv._[0].toUpperCase() === "POST") {
          const filePath = argv._[1]; // Specify the file path to create
          let jsonRequest;
          if (argv.h)
            jsonRequest = createJSONRequest(
              argv,
              "POST",
              argv.f || argv._[1],
              argv.d || "",
              argv.o,
              options
            );
          else
            jsonRequest = createJSONRequest(
              argv,
              "POST",
              argv.f || argv._[1],
              argv.d || "",
              argv.o,
              options
            );
          client.write(jsonRequest);
        } else {
          console.log(
            "Invalid request. Usage: node client.js GET [path] or node client.js POST [path] [content]"
          );
          client.end();
        }
      } catch (err) {
        console.log("Error - ", err);
        console.log(
          "HTTP/1.1 505 Not Implemented\r\nContent-Type: text/plain\r\n\r\nServer Not Responding"
        );
      }
    })
    .on("data", (data) => {
      try {
        response.push(data);
      } catch (err) {
        console.log("Error - ", err);
        console.log(
          "HTTP/1.1 505 Not Implemented\r\nContent-Type: text/plain\r\n\r\nServer Not Responding"
        );
      }
    })
    .on("end", () => {
      try {
        const data = Buffer.concat(response);
        if (argv.v) {
          dns.lookup(argv.host, { family: 4 }, (err, address) => {
            if (err) {
              console.error(
                `Could not resolve IP address for ${argv.host}: ${err.message}`
              );
            } else {
              console.log(address);
              console.log(`* Trying to connect to: ${argv.host}`);
              console.log(`* IP Address ${address}`);
              console.log(`* Connected to ${argv.host}`);
              console.log(`> Host: ${argv.host}`);
              console.log(`> User-Agent: httpc/0.0.1`);
              console.log(`> Accept: */*`);
              console.log(`> `);
              console.log(JSON.parse(data).data);
            }
          });
        } else {
          try {
            let json = JSON.parse(data.toString());
            let fileName = argv._[argv._.length - 1];
            fileName = fileName.split("/");
            fileName = fileName[fileName.length - 1];
            let fileType = fileName.split(".");
            fileType = fileType[fileType.length - 1];
            let fileFormat;
            if (fileType === "png" || fileType === "jpg" || fileType === "jpeg")
              fileFormat = "base64";
            else fileFormat = "utf-8";

            if (json.opt && json.opt["Content-Disposition"] === "attachment") {
              const fs = require("fs");
              fs.writeFileSync(fileName, json.data.toString(fileFormat));
            } else if (
              json.opt &&
              json.opt["Content-Disposition"] === "inline"
            ) {
              console.log(json.data);
            }
          } catch (err) {
            if (argv._[0].toUpperCase() === "GET") {
              let fileName = argv._[argv._.length - 1];
              fileName = fileName.split("/");
              fileName = fileName[fileName.length - 1];
              let fileType = fileName.split(".");
              fileType = fileType[fileType.length - 1];
              try {
                const fs = require("fs");
                fs.writeFileSync(fileName, data);
                console.log(
                  "HTTP/1.1 200 Success \nFile Downloaded Successfully"
                );
              } catch (err) {
                console.log(
                  "HTTP/1.1 401 Unathorized \nInsufficient access to read from current directory"
                );
              }
            }
          }
        } // Close the client connection after receiving the response
        client.end();
      } catch (err) {
        console.log("Error - ", err);
        console.log(
          "HTTP/1.1 505 Not Implemented\r\nContent-Type: text/plain\r\n\r\nServer Not Responding"
        );
      }
    });

  client.on("close", () => {
    //console.log('Connection closed');
  });
} catch (err) {
  console.log("HTTP 1.1 500 \n Internal Server Error");
}

const createJSONRequest = (
  method,
  filePath,
  fileContent,
  flag,
  options = {}
) => {
  if (argv.h) console.log(options);

  const jsonRequest = {
    method: method,
    path: filePath,
    content: fileContent,
  };
  if (argv.o) {
    jsonRequest["flag"] = "overwrite";
    jsonRequest["flagValue"] = flag;
  }

  if (argv.h) {
    jsonRequest["headers"] = options["headers"] || "";
  }

  return JSON.stringify(jsonRequest);
};

const parseOptions = (headers, separator, parseData = false) => {
  try {
    if (headers instanceof Array) {
      const obj = {};
      for (const arr of headers) {
        const [key, value] = [arr.split(separator)[0], arr.split(separator)[1]];
        obj[key] = value;
      }
      return obj; //gives key-value pair
    } else return headers.split(separator); //gives key-value pair
  } catch (err) {
    if (argv.v)
      console.log(
        "Provided string is not an object. Attempting to parse as key value - " +
          err
      );
  }
};
